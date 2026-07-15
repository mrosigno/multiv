<?php
// ============================================================
// sync_scheduled.php
// Sincronizzazione incrementale primario → secondario
// Solo righe modificate (TS > ultima sync)
// Lanciato ogni 20 minuti dal cron Aruba (07:00-21:00)
// ============================================================

// --- Header anti-cache: forza esecuzione fresca ad ogni chiamata ---
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// --- DEBUG TEMPORANEO: mostra errori a video ---
// Rimuovere queste 3 righe una volta risolto il problema
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

@set_time_limit(180);
@ini_set('memory_limit', '128M');

// --- Protezione token ---
define('CRON_TOKEN', 'FxH92sNepmRzic2Ki4OIf5aXyq7vOdd4');

$tokenFromUrl = $_GET['token'] ?? '';
if ($tokenFromUrl !== CRON_TOKEN) {
    http_response_code(403);
    die('Accesso negato.');
}



require_once __DIR__ . '/db_config.php';

$logFile   = __DIR__ . '/sync_scheduled_log.txt';
$stateFile = __DIR__ . '/sync_state.json';

// ============================================================
// TABELLE DA SINCRONIZZARE
// Solo quelle soggette a modifiche frequenti
// Tutte devono avere il campo TS
// ============================================================
define('SYNC_TABLES', [
    'fatturecorpo',
    'fatture',
    'prima_nota_casa',
    'scadenzario',
    'pagamenti',
    'carichi',
    'scarichi',
    'articoli_prisma',
    'fattpaservizi',
    'fattpainvii',
    'clienti',
    'ddt',
    'trasferimenti',
    'destinazioni',
    'deduzioni'
]);

// ============================================================
// FUNZIONI LOG
// ============================================================

function writeLog($msg) {
    global $logFile;
    file_put_contents(
        $logFile,
        "[" . date('Y-m-d H:i:s') . "] " . $msg . PHP_EOL,
        FILE_APPEND
    );
}

function rotateLogs() {
    global $logFile;
    if (!file_exists($logFile)) return;
    $lines = file($logFile);
    if (count($lines) > 300) {
        file_put_contents($logFile, implode('', array_slice($lines, -150)));
    }
}

// ============================================================
// STATO SYNC
// ============================================================

function getSyncState() {
    global $stateFile;
    if (!file_exists($stateFile)) {
        return ['last_incremental' => '2000-01-01 00:00:00'];
    }
    $data = json_decode(file_get_contents($stateFile), true);
    return $data ?? ['last_incremental' => '2000-01-01 00:00:00'];
}

function saveSyncState($lastSync, $ok, $error = null) {
    global $stateFile;
    $state = [
        'last_incremental' => $lastSync,
        'last_run'         => date('Y-m-d H:i:s'),
        'last_run_ok'      => $ok,
        'last_error'       => $error
    ];
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
}

// ============================================================
// CONNESSIONE DB
// ============================================================

function connectDB($config, $timeout = 15) {
    $dsn = "mysql:host={$config['host']};dbname={$config['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => $timeout
    ]);
    // Disabilita strict mode per gestire date legacy (0000-00-00 ecc.)
    $pdo->exec("SET SESSION sql_mode = ''");
    return $pdo;
}

// ============================================================
// SYNC INCREMENTALE DI UNA TABELLA
// Copia solo righe con TS > $lastSync
// Usa REPLACE INTO per gestire sia INSERT che UPDATE
// ============================================================

function syncTableIncremental($pdoSrc, $pdoDest, $table, $lastSync) {

    // Verifica campo TS
    $columns = $pdoSrc->query(
        "SHOW COLUMNS FROM `$table`"
    )->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('TS', $columns)) {
        writeLog("  `$table`: campo TS non trovato - skip.");
        return ['ok' => true, 'rows' => 0, 'skipped' => true];
    }

    // Conta righe da sincronizzare
    $stmt = $pdoSrc->prepare(
        "SELECT COUNT(*) FROM `$table` WHERE `TS` > :last"
    );
    $stmt->execute([':last' => $lastSync]);
    $count = $stmt->fetchColumn();

    if ($count == 0) {
        return ['ok' => true, 'rows' => 0];
    }

    // Verifica che la tabella esista sul secondario
    $exists = $pdoDest->query("SHOW TABLES LIKE '$table'")->fetchColumn();
    if (!$exists) {
        // Crea struttura sul secondario se mancante
        $row       = $pdoSrc->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
        $createSQL = array_values($row)[1];
        $pdoDest->exec($createSQL);
        writeLog("  `$table`: struttura creata sul secondario.");
    }

    // Determina primary key
    $pkRow = $pdoSrc->query(
        "SHOW KEYS FROM `$table` WHERE Key_name = 'PRIMARY'"
    )->fetch(PDO::FETCH_ASSOC);
    $pk = $pkRow ? $pkRow['Column_name'] : null;

    // Fetch colonne
    $sampleRow = $pdoSrc->query(
        "SELECT * FROM `$table` LIMIT 1"
    )->fetch(PDO::FETCH_ASSOC);
    if (!$sampleRow) return ['ok' => true, 'rows' => 0];
    $cols    = array_keys($sampleRow);
    $colList = implode(',', array_map(fn($c) => "`$c`", $cols));

    // Copia in batch
    $offset    = 0;
    $batch     = 200;
    $copied    = 0;

    do {
        $stmt = $pdoSrc->prepare(
            "SELECT * FROM `$table`
             WHERE `TS` > :last
             ORDER BY `TS` ASC
             LIMIT $batch OFFSET $offset"
        );
        $stmt->execute([':last' => $lastSync]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($rows)) {
            foreach ($rows as $row) {
                $values  = array_map(function($val) use ($pdoDest) {
                    if ($val === null) return 'NULL';
                    // Converti date non valide in NULL
                    // (0000-00-00 o 0000-00-00 00:00:00 rifiutate da Aruba strict mode)
                    if (is_string($val) && preg_match('/^0000-00-00/', $val)) return "'2024-01-01 08:00:00'";
                    return $pdoDest->quote($val);
                }, array_values($row));
                $valList = implode(',', $values);

                if ($pk) {
                    // REPLACE INTO: aggiorna se esiste, inserisce se nuova
                    $pdoDest->exec(
                        "REPLACE INTO `$table` ($colList) VALUES ($valList)"
                    );
                } else {
                    $pdoDest->exec(
                        "INSERT IGNORE INTO `$table` ($colList) VALUES ($valList)"
                    );
                }
                $copied++;
            }
        }
        $offset += $batch;
    } while (count($rows) === $batch);

    return ['ok' => true, 'rows' => $copied];
}

// ============================================================
// ESECUZIONE PRINCIPALE
// ============================================================

// Leggi il lastSync PRIMA di iniziare
// e salvalo in una variabile separata - verrà aggiornato SOLO se tutto OK
$syncState    = getSyncState();
$lastSync     = $syncState['last_incremental'];
$now          = date('Y-m-d H:i:s');

writeLog("=== AVVIO sync incrementale | dal: $lastSync ===");

// Connessioni
try {
    $pdoSrc  = connectDB(DB_PRIMARY);
    $pdoDest = connectDB(DB_SECONDARY);
} catch (Exception $e) {
    $err = "ERRORE connessione: " . $e->getMessage();
    writeLog($err);
    // NON aggiornare last_incremental in caso di errore connessione
    saveSyncState($lastSync, false, $err);
    http_response_code(500);
    echo $err;
    exit();
}

$pdoDest->exec("SET FOREIGN_KEY_CHECKS=0");

$errors      = [];
$totalCopied = 0;
$tablesDone  = 0;

foreach (SYNC_TABLES as $table) {
    try {
        $result = syncTableIncremental($pdoSrc, $pdoDest, $table, $lastSync);

        if (!empty($result['skipped'])) {
            writeLog("  `$table`: SALTATA (campo TS non trovato).");
        } elseif ($result['rows'] > 0) {
            writeLog("  `$table`: {$result['rows']} righe sincronizzate.");
            $totalCopied += $result['rows'];
        } else {
            writeLog("  `$table`: nessuna modifica (già aggiornata).");
        }
        $tablesDone++;

    } catch (Exception $e) {
        $err = "`$table`: " . $e->getMessage();
        $errors[] = $err;
        writeLog("  ERRORE $err");
    }
}

$pdoDest->exec("SET FOREIGN_KEY_CHECKS=1");

if (empty($errors)) {
    // Solo se tutto OK aggiorna last_incremental al momento attuale
    saveSyncState($now, true);
    $summary = "OK - $tablesDone tabelle, $totalCopied righe copiate.";
    writeLog("=== FINE sync: $summary ===");
    echo "ok - $totalCopied righe copiate su $tablesDone tabelle";
} else {
    // In caso di errori: mantieni il vecchio last_incremental
    // così al prossimo run riproverà dallo stesso punto
    saveSyncState($lastSync, false, implode(' | ', $errors));
    $summary = implode(' | ', $errors);
    writeLog("=== FINE sync con errori: $summary ===");
    echo "errori: $summary";
}

rotateLogs();
