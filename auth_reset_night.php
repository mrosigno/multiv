<?php
// ============================================================
// auth_reset_night.php
// Reset notturno di system_auth sul primario.
// Scatta una volta a mezzanotte (00:00).
// Se il sistema è sul SECONDARIO, imposta authorized=0
// per evitare che il primario tornato online di notte
// venga trovato con authorized=1 dal vecchio gestionale.
// Se il sistema è sul PRIMARIO, non fa nulla
// (il heartbeat diurno mantiene già authorized=1).
// ============================================================

// --- Protezione token ---
define('CRON_TOKEN', 'FxH92sNepmRzic2Ki4OIf5aXyq7vOdd4');

$tokenFromUrl = $_GET['token'] ?? '';
if ($tokenFromUrl !== CRON_TOKEN) {
    http_response_code(403);
    die('Accesso negato.');
}

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/db_config.php';

$switchFile = __DIR__ . '/db_switch.json';
$logFile    = __DIR__ . '/auth_heartbeat_log.txt';

function writeLog($msg) {
    global $logFile;
    file_put_contents(
        $logFile,
        "[" . date('Y-m-d H:i:s') . "] " . $msg . PHP_EOL,
        FILE_APPEND
    );
    // Rotazione log
    $lines = file($logFile);
    if (count($lines) > 200) {
        file_put_contents($logFile, implode('', array_slice($lines, -100)));
    }
}

// Leggi stato attivo
if (!file_exists($switchFile)) {
    writeLog("RESET NOTTURNO: db_switch.json non trovato — skip.");
    echo "skip: file switch non trovato";
    exit();
}

$switchState  = json_decode(file_get_contents($switchFile), true);
$activeServer = $switchState['active'] ?? 'primary';

// Se siamo sul primario: non fare nulla
// Il heartbeat diurno ha già mantenuto authorized=1 durante il giorno
if ($activeServer === 'primary') {
    writeLog("RESET NOTTURNO: sistema su PRIMARIO — nessuna azione necessaria.");
    echo "ok: sistema su primario, nessuna azione";
    exit();
}

// Se siamo sul secondario: imposta authorized=0 sul primario
// Questo protegge il caso in cui il primario torni online di notte
// prima che il heartbeat diurno riprenda alle 05:00
writeLog("RESET NOTTURNO: sistema su SECONDARIO — imposto authorized=0 sul primario.");

try {
    $dsn = "mysql:host=" . DB_PRIMARY['host'] .
           ";dbname=" . DB_PRIMARY['db_name'] .
           ";charset=utf8mb4";

    $pdo = new PDO($dsn, DB_PRIMARY['username'], DB_PRIMARY['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ]);

    $pdo->prepare(
        "UPDATE system_auth
         SET authorized = 0,
             updated_at = NOW(),
             updated_by = 'reset_notturno'
         WHERE id = 1"
    )->execute();

    writeLog("RESET NOTTURNO: authorized=0 scritto correttamente sul primario.");
    echo "ok: authorized=0 impostato sul primario";

} catch (Exception $e) {
    // Primario non raggiungibile di notte — non è un problema critico.
    // Se è down, authorized è già 0 di default.
    // Se è tornato su, al peggio il vecchio gestionale
    // potrebbe entrare finché il heartbeat delle 05:00 non corregge.
    writeLog("RESET NOTTURNO: primario non raggiungibile — " . $e->getMessage());
    echo "warning: primario non raggiungibile";
}
