<?php
// ============================================================
// admin.php — Pannello di controllo DB Switch
// ============================================================
session_start();

@set_time_limit(300);
@ini_set('memory_limit', '256M');

// --- Credenziali pannello admin (CAMBIA QUESTI VALORI) ---
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', 'Gl280167!');

// --- Token cron (deve corrispondere a sync_scheduled.php) ---
define('CRON_TOKEN', 'FxH92sNepmRzic2Ki4OIf5aXyq7vOdd4');

// --- URL base dinamico (equivalente PHP del getDynamicHost() React) ---
// Rileva automaticamente protocollo, dominio e sottocartella corrente.
// Funziona sia in locale (XAMPP) che in produzione (Aruba) senza modifiche.
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host     = $_SERVER['HTTP_HOST'];                        // es. www.pacinigroupsrl.it
$dir      = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/'); // es. /multiv
define('BASE_URL', $protocol . '://' . $host . $dir);    // es. https://www.pacinigroupsrl.it/multiv

// --- Percorsi file ---
$switchFile   = __DIR__ . '/db_switch.json';
$logFile      = __DIR__ . '/db_switch_log.txt';       // log operazioni pannello (switch/ripristino)
$syncLogFile  = __DIR__ . '/sync_scheduled_log.txt';  // log sincronizzazioni cron/manuali
$stateFile    = __DIR__ . '/sync_state.json';

// ============================================================
// FUNZIONI DI SUPPORTO
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
// Unisce admin log + sync log, ordinati per data/ora
// ============================================================
function getMergedLog($maxLines = 100) {
    global $logFile, $syncLogFile;

    $all = [];

    if (file_exists($logFile)) {
        $all = array_merge($all, file($logFile));
    }
    if (file_exists($syncLogFile)) {
        $all = array_merge($all, file($syncLogFile));
    }

    // Ordina per timestamp estratto da [YYYY-MM-DD HH:MM:SS]
    usort($all, function($a, $b) {
        preg_match('/^\[([\d\- :]+)\]/', $a, $ma);
        preg_match('/^\[([\d\- :]+)\]/', $b, $mb);
        $ta = isset($ma[1]) ? strtotime($ma[1]) : 0;
        $tb = isset($mb[1]) ? strtotime($mb[1]) : 0;
        return $ta <=> $tb;
    });

    return array_slice($all, -$maxLines);
}

function getState() {
    global $switchFile;
    return json_decode(file_get_contents($switchFile), true);
}

function setState($active) {
    global $switchFile;
    $data = [
        'active'      => $active,
        'switched_at' => date('Y-m-d H:i:s'),
        'switched_by' => ADMIN_USER
    ];
    file_put_contents($switchFile, json_encode($data, JSON_PRETTY_PRINT));
    writeLog("db_switch.json aggiornato a '$active'.");
}

function connectDB($config, $timeout = 10) {
    $dsn = "mysql:host={$config['host']};dbname={$config['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => $timeout
    ]);
    $pdo->exec("SET SESSION sql_mode = ''");
    return $pdo;
}

function setAuthOnPrimary($value) {
    try {
        $pdo = connectDB(DB_PRIMARY, 5);
        $pdo->prepare(
            "UPDATE system_auth
             SET authorized = :val,
                 updated_at = NOW(),
                 updated_by = 'admin_web'
             WHERE id = 1"
        )->execute([':val' => $value]);
        writeLog("system_auth.authorized = $value scritto sul primario.");
        return true;
    } catch (Exception $e) {
        writeLog("ATTENZIONE: impossibile scrivere system_auth: " . $e->getMessage());
        return false;
    }
}

function getSyncInfo() {
    global $stateFile;
    if (!file_exists($stateFile)) {
        return ['minutes' => null, 'ok' => false, 'last_run' => null, 'last_sync' => null, 'error' => null];
    }
    $state = json_decode(file_get_contents($stateFile), true);
    if (!$state || empty($state['last_run'])) {
        return ['minutes' => null, 'ok' => false, 'last_run' => null, 'last_sync' => null, 'error' => null];
    }
    $minutes = round((time() - strtotime($state['last_run'])) / 60);
    return [
        'minutes'    => $minutes,
        'ok'         => $state['last_run_ok'] ?? false,
        'last_run'   => $state['last_run'],
        'last_sync'  => $state['last_incremental'] ?? null,
        'error'      => $state['last_error'] ?? null
    ];
}

// ============================================================
// SYNC DI RITORNO: secondario → primario
// Copia solo righe modificate sul secondario durante il downtime
// ============================================================
function syncSecondaryToPrimary() {

    $activeTables = [
        'fatturecorpo', 'fatture', 'prima_nota_casa',
        'scadenzario', 'pagamenti', 'carichi', 'scarichi',
        'articoli_prisma', 'fattpaservizi', 'fattpainvii',
        'clienti', 'ddt', 'trasferimenti', 'destinazioni', 'deduzioni'
    ];

    try {
        $pdoSrc  = connectDB(DB_SECONDARY, 15);
        $pdoDest = connectDB(DB_PRIMARY, 15);
    } catch (Exception $e) {
        writeLog("ERRORE connessione sync ritorno: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }

    // Leggi momento dello switch a secondario come punto di partenza
    global $switchFile;
    $sw    = json_decode(file_get_contents($switchFile), true);
    $since = $sw['switched_at'] ?? '2000-01-01 00:00:00';

    writeLog("Sync ritorno: copio modifiche dal $since in poi.");

    $pdoDest->exec("SET FOREIGN_KEY_CHECKS=0");
    $errors      = [];
    $totalCopied = 0;

    foreach ($activeTables as $table) {
        try {
            $columns = $pdoSrc->query(
                "SHOW COLUMNS FROM `$table`"
            )->fetchAll(PDO::FETCH_COLUMN);

            if (!in_array('TS', $columns)) continue;

            $count = $pdoSrc->prepare(
                "SELECT COUNT(*) FROM `$table` WHERE `TS` > :since"
            );
            $count->execute([':since' => $since]);
            $n = $count->fetchColumn();
            if ($n == 0) continue;

            $pkRow = $pdoSrc->query(
                "SHOW KEYS FROM `$table` WHERE Key_name='PRIMARY'"
            )->fetch(PDO::FETCH_ASSOC);
            $pk = $pkRow ? $pkRow['Column_name'] : null;

            $sample = $pdoSrc->query(
                "SELECT * FROM `$table` LIMIT 1"
            )->fetch(PDO::FETCH_ASSOC);
            if (!$sample) continue;
            $cols    = array_keys($sample);
            $colList = implode(',', array_map(fn($c) => "`$c`", $cols));

            $offset = 0;
            $batch  = 200;
            do {
                $stmt = $pdoSrc->prepare(
                    "SELECT * FROM `$table` WHERE `TS` > :since
                     ORDER BY `TS` ASC LIMIT $batch OFFSET $offset"
                );
                $stmt->execute([':since' => $since]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $values  = array_map(function($val) use ($pdoDest) {
                        if ($val === null) return 'NULL';
                        if (is_string($val) && preg_match('/^0000-00-00/', $val)) return "'2024-01-01 08:00:00'";
                        return $pdoDest->quote($val);
                    }, array_values($row));
                    $valList = implode(',', $values);
                    if ($pk) {
                        $pdoDest->exec("REPLACE INTO `$table` ($colList) VALUES ($valList)");
                    } else {
                        $pdoDest->exec("INSERT IGNORE INTO `$table` ($colList) VALUES ($valList)");
                    }
                }
                $offset += $batch;
            } while (count($rows) === $batch);

            writeLog("  `$table`: $n righe copiate sul primario.");
            $totalCopied += $n;

        } catch (Exception $e) {
            $errors[] = "`$table`: " . $e->getMessage();
            writeLog("  ERRORE `$table`: " . $e->getMessage());
        }
    }

    $pdoDest->exec("SET FOREIGN_KEY_CHECKS=1");

    return empty($errors)
        ? ['ok' => true, 'rows' => $totalCopied]
        : ['ok' => false, 'error' => implode(' | ', $errors)];
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
if (isset($_POST['login'])) {
    if ($_POST['user'] === ADMIN_USER && $_POST['pass'] === ADMIN_PASS) {
        $_SESSION['admin_logged'] = true;
    } else {
        $loginError = "Credenziali errate.";
    }
}
if (isset($_POST['logout'])) {
    session_destroy();
    header("Location: admin.php");
    exit();
}

// ============================================================
// AZIONI
// ============================================================
$message = '';
$msgType = 'info';

if (!empty($_SESSION['admin_logged'])) {

    require_once __DIR__ . '/db_config.php';
    $syncInfo = getSyncInfo();

    // --- Switch a secondario ---
    if (isset($_POST['switch_secondary'])) {
        writeLog("== INIZIO SWITCH A SECONDARIO ==");
        $syncOk = $syncInfo['ok'] && $syncInfo['minutes'] !== null && $syncInfo['minutes'] <= 30;
        if (!$syncOk) {
            $_SESSION['pending_switch'] = true;
            $minStr = $syncInfo['minutes'] !== null ? "{$syncInfo['minutes']} minuti fa" : "mai eseguita";
            $message = "⚠️ L'ultima sync risale a: $minStr\n" .
                       "Il secondario potrebbe non essere aggiornato.\n" .
                       "Puoi forzare lo switch oppure annullare.";
            $msgType = 'warning';
        } else {
            $_SESSION['pending_switch'] = false;
            setAuthOnPrimary(0);
            setState('secondary');
            $message = "✅ Switch completato.\n" .
                       "• Sistema ora su: SERVER SECONDARIO\n" .
                       "• Ultima sync: {$syncInfo['minutes']} minuti fa\n" .
                       "• Vecchio gestionale: BLOCCATO";
            $msgType = 'success';
            writeLog("== FINE SWITCH: OK ==");
            rotateLogs();
        }
    }

    // --- Switch forzato ---
    if (isset($_POST['switch_force'])) {
        writeLog("== SWITCH FORZATO A SECONDARIO ==");
        $_SESSION['pending_switch'] = false;
        setAuthOnPrimary(0);
        setState('secondary');
        $message = "✅ Switch forzato completato.\n" .
                   "• Sistema ora su: SERVER SECONDARIO\n" .
                   "• ⚠️ Secondario potrebbe non essere aggiornato all'ultima versione\n" .
                   "• Vecchio gestionale: BLOCCATO";
        $msgType = 'success';
        writeLog("== FINE SWITCH FORZATO: OK ==");
        rotateLogs();
    }

    // --- Annulla switch ---
    if (isset($_POST['switch_cancel'])) {
        $_SESSION['pending_switch'] = false;
        $message = "Switch annullato. Sistema rimane su PRIMARIO.";
        $msgType = 'info';
    }

    // --- Ripristino primario ---
    if (isset($_POST['restore_primary'])) {
        writeLog("== INIZIO RIPRISTINO PRIMARIO ==");
        $result = syncSecondaryToPrimary();
        if ($result['ok']) {
            $unlockOk = setAuthOnPrimary(1);
            setState('primary');
            writeLog("Sync normale primario->secondario riprenderà " .
                     "automaticamente al prossimo ciclo cron (ogni 20 min).");
            $message = "✅ Ripristino completato.\n" .
                       "• Righe sincronizzate sul primario: {$result['rows']}\n" .
                       "• Sistema ora su: SERVER PRIMARIO\n" .
                       "• Vecchio gestionale: " . ($unlockOk ? "SBLOCCATO ✅" : "⚠️ sblocco manuale necessario") . "\n" .
                       "• Sync automatica primario→secondario: riprenderà al prossimo ciclo (max 20 min)";
            $msgType = $unlockOk ? 'success' : 'warning';
        } else {
            $message = "❌ Sync di ritorno fallita.\nErrore: " . $result['error'];
            $msgType = 'error';
        }
        writeLog("== FINE RIPRISTINO: $msgType ==");
        rotateLogs();
    }
}

// Endpoint AJAX: log aggiornato (admin + sync uniti)
if (isset($_GET['getlog']) && !empty($_SESSION['admin_logged'])) {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    $lines = getMergedLog(100);
    echo htmlspecialchars(implode('', array_reverse($lines)));
    exit();
}

// Endpoint AJAX: stato sync aggiornato
if (isset($_GET['getsync']) && !empty($_SESSION['admin_logged'])) {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    clearstatcache(true, $stateFile);
    echo json_encode(getSyncInfo());
    exit();
}

$state         = getState();
$syncInfo      = getSyncInfo();
$pendingSwitch = $_SESSION['pending_switch'] ?? false;
$syncUrl       = BASE_URL . '/sync_scheduled.php?token=' . urlencode(CRON_TOKEN);
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin — DB Switch Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
      font-family: 'Segoe UI', sans-serif; background: #0f172a;
      color: #e2e8f0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
  }
  .card {
      background: #1e293b; border-radius: 12px; padding: 2rem;
      width: 100%; max-width: 620px; box-shadow: 0 8px 32px rgba(0,0,0,.4);
  }
  h1 { font-size: 1.4rem; margin-bottom: 1.5rem; color: #f8fafc; }
  h2 { font-size: .85rem; color: #64748b; margin-bottom: .6rem;
       text-transform: uppercase; letter-spacing: .07em; }
  .badge {
      display: inline-block; padding: .35rem 1rem; border-radius: 999px;
      font-weight: 700; font-size: .85rem; margin-bottom: .4rem; letter-spacing: .04em;
  }
  .badge.primary   { background: #166534; color: #bbf7d0; }
  .badge.secondary { background: #92400e; color: #fde68a; }
  .info-row { font-size: .76rem; color: #64748b; margin-bottom: 1rem; }

  /* Riquadro stato sync */
  .sync-card {
      background: #0f172a; border-radius: 8px; padding: .85rem 1rem;
      margin-bottom: 1.25rem; font-size: .8rem; line-height: 1.7;
  }
  .sync-card .sync-row { display: flex; justify-content: space-between; align-items: center; }
  .sync-card .sync-label { color: #64748b; }
  .sync-card .sync-val   { font-family: monospace; color: #94a3b8; }
  .sync-card .sync-val.ok     { color: #34d399; }
  .sync-card .sync-val.warn   { color: #fbbf24; }
  .sync-card .sync-val.error  { color: #f87171; }
  .sync-card .sync-val.never  { color: #64748b; }
  .sync-dot { display: inline-block; width: 8px; height: 8px;
              border-radius: 50%; margin-right: 6px; }
  .dot-ok    { background: #34d399; }
  .dot-warn  { background: #fbbf24; }
  .dot-error { background: #f87171; }
  .dot-never { background: #475569; }

  .btn {
      display: block; width: 100%; padding: .8rem; border-radius: 8px;
      border: none; cursor: pointer; font-size: .95rem; font-weight: 600;
      margin-bottom: .75rem; transition: opacity .2s; text-align: center;
  }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn:hover:not(:disabled) { opacity: .85; }
  .btn-danger  { background: #dc2626; color: #fff; }
  .btn-success { background: #16a34a; color: #fff; }
  .btn-blue    { background: #2563eb; color: #fff; }
  .btn-gray    { background: #475569; color: #fff; }
  .btn-orange  { background: #ea580c; color: #fff; }
  .btn-teal    { background: #0d9488; color: #fff; }
  .btn-row     { display: flex; gap: .5rem; }
  .btn-row .btn { margin-bottom: 0; }

  .msg {
      padding: .9rem 1rem; border-radius: 8px; margin-bottom: 1.25rem;
      font-size: .88rem; white-space: pre-line; line-height: 1.7;
  }
  .msg.success { background: #14532d; color: #bbf7d0; }
  .msg.error   { background: #7f1d1d; color: #fecaca; }
  .msg.warning { background: #78350f; color: #fde68a; }
  .msg.info    { background: #1e3a5f; color: #bfdbfe; }

  .divider { border: none; border-top: 1px solid #334155; margin: 1.25rem 0; }

  label { display: block; font-size: .83rem; color: #94a3b8; margin-bottom: .3rem; }
  input[type=text], input[type=password] {
      width: 100%; padding: .65rem .85rem; border-radius: 6px;
      border: 1px solid #334155; background: #0f172a;
      color: #f1f5f9; margin-bottom: 1rem; font-size: .95rem;
  }
  .warning-box {
      background: #451a03; border: 1px solid #92400e; border-radius: 8px;
      padding: .85rem 1rem; font-size: .83rem; color: #fde68a;
      margin-bottom: 1rem; line-height: 1.6;
  }
  .confirm-box {
      background: #1c1917; border: 2px solid #ea580c;
      border-radius: 8px; padding: 1rem; margin-bottom: 1rem;
  }
  .confirm-box p {
      font-size: .85rem; color: #fdba74; margin-bottom: .75rem; line-height: 1.5;
  }

  /* Pannello sync manuale */
  .sync-panel {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 8px; padding: 1rem; margin-top: .5rem; display: none;
  }
  .progress-bar-wrap {
      background: #1e293b; border-radius: 999px; height: 6px;
      margin: .75rem 0; overflow: hidden;
  }
  .progress-bar {
      height: 100%; border-radius: 999px; background: #2563eb;
      width: 0%; transition: width .4s ease;
  }
  .progress-label { font-size: .75rem; color: #64748b; text-align: center; margin-bottom: .5rem; }
  .sync-result {
      font-size: .8rem; padding: .6rem .8rem; border-radius: 6px; margin-top: .5rem;
      font-family: monospace; line-height: 1.6; display: none;
  }
  .sync-result.ok    { background: #14532d; color: #bbf7d0; }
  .sync-result.error { background: #7f1d1d; color: #fecaca; }

  /* Pannello ripristino dump */
  .dump-panel {
      background: #0f172a; border: 1px solid #ea580c44;
      border-radius: 8px; padding: 1rem; margin-top: .75rem;
  }
  input[type=file] {
      width: 100%; padding: .6rem; border-radius: 6px;
      border: 1px dashed #475569; background: #1e293b;
      color: #cbd5e1; margin-bottom: .75rem; font-size: .85rem;
  }
  .dump-info {
      background: #1e293b; border-radius: 6px; padding: .75rem 1rem;
      font-size: .82rem; color: #94a3b8; line-height: 1.7;
      font-family: monospace;
  }

  .log-title { font-size: .76rem; color: #64748b; margin-bottom: .4rem; }
  .log-box {
      background: #0f172a; border-radius: 6px; padding: .8rem;
      font-size: .71rem; color: #64748b; max-height: 320px;
      overflow-y: auto; white-space: pre-wrap; font-family: monospace; line-height: 1.5;
  }
</style>
</head>
<body>
<div class="card">

<?php if (empty($_SESSION['admin_logged'])): ?>

  <!-- LOGIN -->
  <h1>🔐 Admin Login</h1>
  <?php if (!empty($loginError)): ?>
    <div class="msg error"><?= htmlspecialchars($loginError) ?></div>
  <?php endif; ?>
  <form method="POST">
    <label>Utente</label>
    <input type="text" name="user" autocomplete="username">
    <label>Password</label>
    <input type="password" name="pass" autocomplete="current-password">
    <button class="btn btn-blue" name="login">Accedi</button>
  </form>

<?php else: ?>

  <!-- PANNELLO PRINCIPALE -->
  <h1>⚙️ DB Switch Panel</h1>

  <!-- Stato server -->
  <div class="badge <?= $state['active'] ?>">
    SERVER ATTIVO: <?= strtoupper($state['active']) ?>
  </div>
  <div class="info-row">
    Ultimo switch: <?= $state['switched_at'] ?? '—' ?>
    &nbsp;|&nbsp; Da: <?= $state['switched_by'] ?? '—' ?>
  </div>

  <!-- Stato sincronizzazione -->
  <div class="sync-card">
    <h2>Stato sincronizzazione secondario</h2>
    <?php
      if ($syncInfo['last_run'] === null):
        $dotClass = 'dot-never'; $valClass = 'never'; $statusText = 'Mai eseguita';
      elseif (!$syncInfo['ok']):
        $dotClass = 'dot-error'; $valClass = 'error'; $statusText = 'Ultimo run con errori';
      elseif ($syncInfo['minutes'] <= 30):
        $dotClass = 'dot-ok';   $valClass = 'ok';    $statusText = 'Aggiornato';
      else:
        $dotClass = 'dot-warn'; $valClass = 'warn';  $statusText = 'Non recente';
      endif;
    ?>
    <div class="sync-row">
      <span class="sync-label">
        <span class="sync-dot <?= $dotClass ?>"></span>Stato
      </span>
      <span class="sync-val <?= $valClass ?>" id="syncStatus"><?= $statusText ?></span>
    </div>
    <div class="sync-row">
      <span class="sync-label">Ultimo run</span>
      <span class="sync-val" id="syncLastRun"><?= $syncInfo['last_run'] ?? '—' ?></span>
    </div>
    <div class="sync-row">
      <span class="sync-label">Dati aggiornati al</span>
      <span class="sync-val" id="syncLastSync"><?= $syncInfo['last_sync'] ?? '—' ?></span>
    </div>
    <?php if ($syncInfo['minutes'] !== null): ?>
    <div class="sync-row">
      <span class="sync-label">Minuti fa</span>
      <span class="sync-val <?= $valClass ?>" id="syncMinutes"><?= $syncInfo['minutes'] ?> min</span>
    </div>
    <?php endif; ?>
    <?php if ($syncInfo['error']): ?>
    <div class="sync-row" style="margin-top:.3rem">
      <span class="sync-label" style="color:#f87171">Errore</span>
      <span class="sync-val error" style="font-size:.7rem;max-width:60%;text-align:right">
        <?= htmlspecialchars(substr($syncInfo['error'], 0, 80)) ?>
      </span>
    </div>
    <?php endif; ?>
  </div>

  <!-- Messaggio operazione -->
  <?php if (!empty($message)): ?>
    <div class="msg <?= $msgType ?>"><?= htmlspecialchars($message) ?></div>
  <?php endif; ?>

  <hr class="divider">

  <?php if ($state['active'] === 'primary'): ?>

    <!-- OPERAZIONI SUL PRIMARIO -->
    <h2>Operazioni disponibili</h2>

    <?php if ($pendingSwitch): ?>
      <!-- Conferma switch forzato -->
      <div class="confirm-box">
        <p>⚠️ La sync non è recente. Il secondario potrebbe non avere gli ultimi dati.<br>
        Vuoi procedere comunque con lo switch?</p>
        <div class="btn-row">
          <form method="POST" style="flex:1">
            <button class="btn btn-orange" name="switch_force"
              onclick="return confirm('Confermi lo switch FORZATO al secondario?\nIl secondario potrebbe non essere aggiornato.')">
              ⚡ Forza switch
            </button>
          </form>
          <form method="POST" style="flex:1">
            <button class="btn btn-gray" name="switch_cancel">✖ Annulla</button>
          </form>
        </div>
      </div>
    <?php else: ?>

      <!-- Switch normale -->
      <form method="POST" onsubmit="return confirm(
          'ATTENZIONE\n\nStai per passare al server SECONDARIO.\n\n' +
          'Il vecchio gestionale verrà BLOCCATO.\n\nConfermi?')">
        <button class="btn btn-danger" name="switch_secondary">
          🔄 Switch a SECONDARIO
        </button>
      </form>

      <!-- Sync manuale con progress -->
      <button class="btn btn-teal" id="btnSync" onclick="avviaSync()">
        📦 Sincronizza secondario adesso
      </button>

      <div class="sync-panel" id="syncPanel">
        <h2>Sincronizzazione in corso</h2>
        <div class="progress-bar-wrap">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div class="progress-label" id="progressLabel">Avvio...</div>
        <div class="sync-result" id="syncResult"></div>
      </div>

      <hr class="divider">

      <!-- ========== RIPRISTINO DUMP COMPLETO ========== -->
      <h2>⚠️ Operazione avanzata: ripristino completo</h2>
      <div class="warning-box">
        Usa questa funzione SOLO quando la struttura del database è cambiata
        (nuove tabelle o campi) e la sincronizzazione normale non è sufficiente.<br><br>
        <strong>Questa operazione SOVRASCRIVE COMPLETAMENTE il database SECONDARIO</strong>
        con il contenuto del file SQL caricato. Il server PRIMARIO non viene mai toccato.
      </div>

      <button class="btn btn-orange" id="btnDumpToggle" onclick="toggleDumpPanel()">
        🗄️ Carica e ripristina dump completo sul secondario
      </button>

      <div class="dump-panel" id="dumpPanel" style="display:none">

        <div id="dumpStep1">
          <label>Seleziona il file .sql del dump completo (max 50 MB)</label>
          <input type="file" id="dumpFileInput" accept=".sql">
          <button class="btn btn-blue" id="btnDumpUpload" onclick="caricaDump()">
            ⬆️ Carica file
          </button>
        </div>

        <div id="dumpStep2" style="display:none">
          <div class="dump-info" id="dumpInfo"></div>

          <div class="confirm-box" style="margin-top:1rem">
            <p>⚠️ <strong>ATTENZIONE — operazione irreversibile</strong><br>
            Il database SECONDARIO verrà completamente sovrascritto con i dati
            di questo file.<br>
            Tutti i dati attualmente presenti sul secondario andranno persi
            e sostituiti da quelli del dump.<br><br>
            Il server PRIMARIO non verrà toccato in nessun modo.</p>

            <div class="btn-row">
              <button class="btn btn-danger" id="btnDumpConfirm" onclick="confermaEsecuzioneDump()">
                ⚡ Conferma e avvia ripristino
              </button>
              <button class="btn btn-gray" onclick="annullaDump()">
                ✖ Annulla
              </button>
            </div>
          </div>
        </div>

        <div id="dumpStep3" style="display:none">
          <div class="progress-bar-wrap">
            <div class="progress-bar" id="dumpProgressBar"></div>
          </div>
          <div class="progress-label" id="dumpProgressLabel">Esecuzione in corso...</div>
          <div class="sync-result" id="dumpResult"></div>
        </div>

      </div>

    <?php endif; ?>

  <?php else: ?>

    <!-- OPERAZIONI SUL SECONDARIO -->
    <div class="warning-box">
      ⚠️ Il sistema sta lavorando sul <strong>SERVER SECONDARIO</strong>.<br>
      Il vecchio gestionale è <strong>BLOCCATO</strong>.<br>
      Procedere al ripristino solo quando il server primario è online e stabile.
    </div>

    <form method="POST" onsubmit="return confirm(
        'ATTENZIONE\n\nRipristino SERVER PRIMARIO.\n\n' +
        'Verranno copiate sul primario le modifiche fatte durante il downtime.\n\n' +
        'Il primario è online e stabile?\n\nConfermi?')">
      <button class="btn btn-success" name="restore_primary">
        ✅ Ripristina PRIMARIO
      </button>
    </form>

  <?php endif; ?>

  <hr class="divider">

  <!-- Log operazioni -->
  <div class="log-title">📋 Ultime operazioni</div>
  <div class="log-box" id="logBox"><?php
    $mergedLines = getMergedLog(100);
    if (!empty($mergedLines)) {
        echo htmlspecialchars(implode('', array_reverse($mergedLines)));
    } else {
        echo "(nessun log ancora)";
    }
  ?></div>

  <hr class="divider">

  <form method="POST">
    <button class="btn btn-gray" name="logout">🚪 Esci</button>
  </form>

<?php endif; ?>
</div>

<script>
// ============================================================
// Sync manuale — singola chiamata, progress animato
// ============================================================
const SYNC_URL = <?= json_encode($syncUrl) ?>;

async function avviaSync() {
    if (!confirm('Avviare la sincronizzazione del secondario?\nVerranno copiate solo le righe modificate dall\'ultima sync.')) return;

    const btn     = document.getElementById('btnSync');
    const panel   = document.getElementById('syncPanel');
    const bar     = document.getElementById('progressBar');
    const label   = document.getElementById('progressLabel');
    const result  = document.getElementById('syncResult');

    btn.disabled      = true;
    btn.textContent   = '⏳ Sincronizzazione in corso...';
    panel.style.display = 'block';
    result.style.display = 'none';
    bar.style.width   = '0%';
    bar.style.background = '#2563eb';

    // Animazione progress bar mentre aspettiamo
    let pct = 0;
    const timer = setInterval(() => {
        pct = Math.min(pct + 2, 90);
        bar.style.width = pct + '%';
        label.textContent = 'Sincronizzazione in corso... ' + pct + '%';
    }, 800);

    try {
        const response = await fetch(SYNC_URL, {
            signal: AbortSignal.timeout(170000) // 170 secondi
        });
        const text = await response.text();

        clearInterval(timer);

        if (response.ok && text.trim().startsWith('ok')) {
            bar.style.width      = '100%';
            bar.style.background = '#16a34a';
            label.textContent    = '✅ Sincronizzazione completata!';
            result.className     = 'sync-result ok';
            result.textContent   = text.trim();
        } else {
            bar.style.width      = '100%';
            bar.style.background = '#dc2626';
            label.textContent    = '❌ Errore durante la sincronizzazione';
            result.className     = 'sync-result error';
            result.textContent   = text.trim() || 'Errore sconosciuto';
        }
        result.style.display = 'block';

    } catch (err) {
        clearInterval(timer);
        bar.style.width      = '100%';
        bar.style.background = '#dc2626';
        label.textContent    = '❌ Timeout o errore di rete';
        result.className     = 'sync-result error';
        result.textContent   = 'Timeout — La sync potrebbe essere comunque completata. Controlla il log.';
        result.style.display = 'block';
    }

    btn.disabled    = false;
    btn.textContent = '📦 Sincronizza secondario adesso';

    // Aggiorna log e stato sync
    await aggiornaLog();
    await aggiornaSyncInfo();
}

async function aggiornaLog() {
    try {
        const r = await fetch('admin.php?getlog=1&_=' + Date.now(), { cache: 'no-store' });
        const t = await r.text();
        const box = document.getElementById('logBox');
        if (box) box.textContent = t || '(nessun log ancora)';
    } catch(e) {}
}

async function aggiornaSyncInfo() {
    try {
        const r    = await fetch('admin.php?getsync=1&_=' + Date.now(), { cache: 'no-store' });
        const data = await r.json();
        if (!data || !data.last_run) return;

        document.getElementById('syncLastRun').textContent  = data.last_run  || '—';
        document.getElementById('syncLastSync').textContent = data.last_sync || '—';

        const minEl = document.getElementById('syncMinutes');
        if (minEl) minEl.textContent = (data.minutes || '0') + ' min';

        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            if (!data.ok) {
                statusEl.textContent  = 'Con errori';
                statusEl.className    = 'sync-val error';
            } else if (data.minutes <= 30) {
                statusEl.textContent  = 'Aggiornato';
                statusEl.className    = 'sync-val ok';
            } else {
                statusEl.textContent  = 'Non recente';
                statusEl.className    = 'sync-val warn';
            }
        }
    } catch(e) {}
}

// Aggiorna stato sync ogni 2 minuti automaticamente
setInterval(aggiornaSyncInfo, 120000);

// ============================================================
// RIPRISTINO DUMP COMPLETO — upload + esecuzione a chunk
// ============================================================
const DUMP_URL = <?= json_encode(BASE_URL . '/restore_dump.php') ?>;

function toggleDumpPanel() {
    const panel = document.getElementById('dumpPanel');
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (!visible) {
        // Reset stato ad ogni apertura
        document.getElementById('dumpStep1').style.display = 'block';
        document.getElementById('dumpStep2').style.display = 'none';
        document.getElementById('dumpStep3').style.display = 'none';
        document.getElementById('dumpFileInput').value = '';
    }
}

async function caricaDump() {
    const input = document.getElementById('dumpFileInput');
    if (!input.files || input.files.length === 0) {
        alert('Seleziona prima un file .sql');
        return;
    }

    const file = input.files[0];
    if (!file.name.toLowerCase().endsWith('.sql')) {
        alert('Il file deve avere estensione .sql');
        return;
    }

    const maxSizeMB = 50;
    if (file.size > maxSizeMB * 1024 * 1024) {
        alert('Il file supera i ' + maxSizeMB + ' MB consentiti.');
        return;
    }

    const btn = document.getElementById('btnDumpUpload');
    btn.disabled = true;
    btn.textContent = '⏳ Caricamento in corso...';

    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('dumpfile', file);

    try {
        const r = await fetch(DUMP_URL, {
            method: 'POST',
            body: formData,
            cache: 'no-store'
        });
        const data = await r.json();

        if (!data.ok) {
            alert('Errore upload: ' + data.error);
            btn.disabled = false;
            btn.textContent = '⬆️ Carica file';
            return;
        }

        // Mostra step 2: info file + conferma
        document.getElementById('dumpInfo').textContent =
            `File: ${file.name}\n` +
            `Dimensione: ${data.size_kb} KB\n` +
            `Istruzioni SQL rilevate: ~${data.total_statements}`;

        document.getElementById('dumpStep1').style.display = 'none';
        document.getElementById('dumpStep2').style.display = 'block';

    } catch (err) {
        alert('Errore durante il caricamento: ' + err.message);
        btn.disabled = false;
        btn.textContent = '⬆️ Carica file';
    }
}

function annullaDump() {
    if (!confirm('Annullare il ripristino e rimuovere il file caricato?')) return;

    fetch(DUMP_URL, {
        method: 'POST',
        body: new URLSearchParams({ action: 'cleanup' }),
        cache: 'no-store'
    }).finally(() => {
        document.getElementById('dumpStep1').style.display = 'block';
        document.getElementById('dumpStep2').style.display = 'none';
        document.getElementById('dumpStep3').style.display = 'none';
        document.getElementById('dumpFileInput').value = '';
        document.getElementById('btnDumpUpload').disabled = false;
        document.getElementById('btnDumpUpload').textContent = '⬆️ Carica file';
    });
}

async function confermaEsecuzioneDump() {
    const finalConfirm = confirm(
        'ULTIMA CONFERMA\n\n' +
        'Stai per sovrascrivere COMPLETAMENTE il database SECONDARIO.\n' +
        'Questa operazione NON è reversibile.\n\n' +
        'Procedere?'
    );
    if (!finalConfirm) return;

    document.getElementById('dumpStep2').style.display = 'none';
    document.getElementById('dumpStep3').style.display = 'block';

    const bar    = document.getElementById('dumpProgressBar');
    const label  = document.getElementById('dumpProgressLabel');
    const result = document.getElementById('dumpResult');

    bar.style.width = '0%';
    bar.style.background = '#2563eb';
    result.style.display = 'none';

    let offset = 0;
    let totalErrors = 0;

    async function eseguiChunk() {
        try {
            const r = await fetch(DUMP_URL, {
                method: 'POST',
                body: new URLSearchParams({ action: 'execute_chunk', offset: offset }),
                cache: 'no-store',
                signal: AbortSignal.timeout(60000)
            });
            const data = await r.json();

            if (!data.ok) {
                bar.style.background = '#dc2626';
                label.textContent = '❌ Errore durante il ripristino';
                result.className = 'sync-result error';
                result.textContent = data.error || 'Errore sconosciuto';
                result.style.display = 'block';
                return;
            }

            if (data.errors) totalErrors += data.errors;

            if (data.done) {
                bar.style.width = '100%';
                bar.style.background = '#16a34a';
                label.textContent = '✅ Ripristino completato!';
                result.className = 'sync-result ok';
                result.textContent = `Completato: ${data.total} istruzioni eseguite.` +
                    (totalErrors > 0 ? `\n⚠️ ${totalErrors} avvisi (vedi log).` : '');
                result.style.display = 'block';

                // Pulizia file temporaneo
                await fetch(DUMP_URL, {
                    method: 'POST',
                    body: new URLSearchParams({ action: 'cleanup' }),
                    cache: 'no-store'
                });

                await aggiornaLog();
                return;
            }

            // Avanza al chunk successivo
            offset = data.offset;
            bar.style.width = data.percent + '%';
            label.textContent = `Ripristino in corso... ${data.percent}% (${offset}/${data.total})`;

            setTimeout(eseguiChunk, 300);

        } catch (err) {
            bar.style.background = '#dc2626';
            label.textContent = '❌ Timeout o errore di rete';
            result.className = 'sync-result error';
            result.textContent = 'La connessione si è interrotta. Riprova ricaricando la pagina.';
            result.style.display = 'block';
        }
    }

    eseguiChunk();
}
</script>

</body>
</html>