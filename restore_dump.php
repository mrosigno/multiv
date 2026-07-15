<?php
// ============================================================
// restore_dump.php
// Upload ed esecuzione di un dump SQL completo sul DB SECONDARIO
// Usato quando la struttura del DB è cambiata e la sync
// incrementale non è sufficiente (nuove tabelle/campi).
//
// SICUREZZA: richiede login admin (sessione admin.php).
// Esegue SEMPRE e SOLO sul SECONDARIO, mai sul primario.
// ============================================================
session_start();

@set_time_limit(280);
@ini_set('memory_limit', '512M');

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Content-Type: application/json; charset=UTF-8');

// --- Richiede sessione admin già autenticata da admin.php ---
if (empty($_SESSION['admin_logged'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Accesso negato: effettua il login da admin.php']);
    exit();
}

require_once __DIR__ . '/db_config.php';

$logFile     = __DIR__ . '/restore_dump_log.txt';
$uploadDir   = __DIR__ . '/dump_uploads';
$chunkMarker = __DIR__ . '/dump_uploads/.progress';

// Crea cartella upload se non esiste
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

function writeLog($msg) {
    global $logFile;
    file_put_contents(
        $logFile,
        "[" . date('Y-m-d H:i:s') . "] " . $msg . PHP_EOL,
        FILE_APPEND
    );
    $lines = file($logFile);
    if (count($lines) > 300) {
        file_put_contents($logFile, implode('', array_slice($lines, -150)));
    }
}

function connectDB($config, $timeout = 20) {
    $dsn = "mysql:host={$config['host']};dbname={$config['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => $timeout
    ]);
    $pdo->exec("SET SESSION sql_mode = ''");
    return $pdo;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// ============================================================
// AZIONE: upload del file (può arrivare in un colpo solo, max 50MB)
// ============================================================
if ($action === 'upload') {

    if (empty($_FILES['dumpfile']) || $_FILES['dumpfile']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['dumpfile']['error'] ?? 'nessun file';
        echo json_encode(['ok' => false, 'error' => "Errore upload (codice: $errCode)"]);
        exit();
    }

    $tmpName  = $_FILES['dumpfile']['tmp_name'];
    $origName = basename($_FILES['dumpfile']['name']);

    if (!preg_match('/\.sql$/i', $origName)) {
        echo json_encode(['ok' => false, 'error' => 'Il file deve avere estensione .sql']);
        exit();
    }

    $destPath = $uploadDir . '/current_dump.sql';

    if (!move_uploaded_file($tmpName, $destPath)) {
        writeLog("ERRORE: upload fallito per $origName");
        echo json_encode(['ok' => false, 'error' => 'Impossibile salvare il file sul server']);
        exit();
    }

    $sizeKb = round(filesize($destPath) / 1024, 1);
    writeLog("Upload completato: $origName ($sizeKb KB) -> current_dump.sql");

    // Conta quante istruzioni SQL contiene (stima, per la progress bar)
    $content    = file_get_contents($destPath);
    $statements = preg_split('/;\s*[\r\n]+/', $content);
    $statements = array_filter(array_map('trim', $statements));
    $totalStmt  = count($statements);

    // Salva info progress
    file_put_contents($chunkMarker, json_encode([
        'total_statements'   => $totalStmt,
        'executed_statements'=> 0,
        'file_size_kb'       => $sizeKb,
        'original_name'      => $origName,
        'uploaded_at'        => date('Y-m-d H:i:s')
    ]));

    echo json_encode([
        'ok' => true,
        'size_kb' => $sizeKb,
        'total_statements' => $totalStmt,
        'message' => "File caricato: $sizeKb KB, circa $totalStmt istruzioni SQL."
    ]);
    exit();
}

// ============================================================
// AZIONE: esecuzione a chunk (chiamata ripetuta dal JS finché non finisce)
// ============================================================
if ($action === 'execute_chunk') {

    $dumpPath = $uploadDir . '/current_dump.sql';
    $offset   = (int)($_POST['offset'] ?? 0);
    $chunkSize = 50; // istruzioni SQL per chiamata

    if (!file_exists($dumpPath)) {
        echo json_encode(['ok' => false, 'error' => 'Nessun file di dump caricato. Esegui prima l\'upload.']);
        exit();
    }

    // Leggi e splitta il file (cache statements in sessione per evitare riparsing ad ogni chunk)
    if (!isset($_SESSION['dump_statements']) || $offset === 0) {
        $content = file_get_contents($dumpPath);

        // Rimuovi commenti SQL e righe vuote
        $content = preg_replace('/^--.*$/m', '', $content);
        $content = preg_replace('/^\/\*.*?\*\/$/ms', '', $content);

        $statements = preg_split('/;\s*[\r\n]+/', $content);
        $statements = array_values(array_filter(array_map('trim', $statements)));

        $_SESSION['dump_statements'] = $statements;
        writeLog("Parsing completato: " . count($statements) . " istruzioni totali.");
    }

    $statements = $_SESSION['dump_statements'];
    $total      = count($statements);

    if ($offset >= $total) {
        echo json_encode([
            'ok' => true,
            'done' => true,
            'offset' => $total,
            'total' => $total,
            'message' => 'Ripristino completato.'
        ]);
        unset($_SESSION['dump_statements']);
        writeLog("=== RIPRISTINO DUMP COMPLETATO: $total istruzioni eseguite ===");
        exit();
    }

    try {
        $pdo = connectDB(DB_SECONDARY, 25);
        $pdo->exec("SET FOREIGN_KEY_CHECKS=0");
        $pdo->exec("SET UNIQUE_CHECKS=0");
    } catch (Exception $e) {
        writeLog("ERRORE connessione secondario: " . $e->getMessage());
        echo json_encode(['ok' => false, 'error' => 'Connessione al secondario fallita: ' . $e->getMessage()]);
        exit();
    }

    $chunk      = array_slice($statements, $offset, $chunkSize);
    $errors     = [];
    $executed   = 0;

    foreach ($chunk as $stmt) {
        if (empty($stmt)) continue;
        try {
            $pdo->exec($stmt);
            $executed++;
        } catch (Exception $e) {
            // Logga ma continua: alcuni errori (es. DROP TABLE IF NOT EXISTS) sono normali
            $errors[] = substr($stmt, 0, 80) . '... -> ' . $e->getMessage();
        }
    }

    $newOffset = $offset + count($chunk);

    if (!empty($errors)) {
        foreach (array_slice($errors, 0, 5) as $err) {
            writeLog("  AVVISO: $err");
        }
    }

    writeLog("Chunk eseguito: righe $offset-$newOffset di $total" .
             (!empty($errors) ? " (" . count($errors) . " avvisi)" : ""));

    $pdo->exec("SET FOREIGN_KEY_CHECKS=1");
    $pdo->exec("SET UNIQUE_CHECKS=1");

    echo json_encode([
        'ok'      => true,
        'done'    => false,
        'offset'  => $newOffset,
        'total'   => $total,
        'errors'  => count($errors),
        'percent' => round(($newOffset / max($total,1)) * 100)
    ]);
    exit();
}

// ============================================================
// AZIONE: pulizia file dopo completamento o annullamento
// ============================================================
if ($action === 'cleanup') {
    $dumpPath = $uploadDir . '/current_dump.sql';
    if (file_exists($dumpPath)) unlink($dumpPath);
    if (file_exists($chunkMarker)) unlink($chunkMarker);
    unset($_SESSION['dump_statements']);
    writeLog("File dump temporaneo rimosso.");
    echo json_encode(['ok' => true]);
    exit();
}

echo json_encode(['ok' => false, 'error' => 'Azione non riconosciuta']);
