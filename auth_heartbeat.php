<?php
// ============================================================
// auth_heartbeat.php
// Mantiene authorized=1 sul primario solo quando
// il sistema è in modalità primaria.
// Lanciato ogni 20 minuti dal cron job Aruba (HTTP).
// ============================================================

@set_time_limit(30);

// --- Protezione accesso tramite token ---
define('CRON_TOKEN', 'FxH92sNepmRzic2Ki4OIf5aXyq7vOdd4');

$tokenFromUrl = $_GET['token'] ?? '';
if ($tokenFromUrl !== CRON_TOKEN) {
    http_response_code(403);
    die('Accesso negato.');
}

// --- Percorsi ---
$baseDir    = __DIR__;
$switchFile = $baseDir . '/db_switch.json';
$logFile    = $baseDir . '/heartbeat_log.txt';

// ============================================================
// FUNZIONI
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
    if (count($lines) > 500) {
        file_put_contents($logFile, implode('', array_slice($lines, -300)));
    }
}

// ============================================================
// LETTURA STATO SWITCH
// ============================================================

if (!file_exists($switchFile)) {
    writeLog("ERRORE: db_switch.json non trovato.");
    exit();
}

$switchState  = json_decode(file_get_contents($switchFile), true);
$activeServer = $switchState['active'] ?? 'primary';

// ============================================================
// LOGICA PRINCIPALE
// ============================================================

if ($activeServer === 'secondary') {
    // Sistema sul secondario: NON scrivere nulla sul primario.
    // Se il primario torna online spontaneamente troverà
    // authorized=0 (default tabella) e bloccherà il vecchio gestionale.
    writeLog("Sistema su SECONDARIO — heartbeat sospeso. Primario non autorizzato.");
    rotateLogs();
    echo "secondary - heartbeat sospeso";
    exit();
}

// Sistema sul primario: scrivi authorized=1
require_once $baseDir . '/db_config.php';

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
         SET authorized = 1,
             updated_at = NOW(),
             updated_by = 'heartbeat'
         WHERE id = 1"
    )->execute();

    writeLog("OK — authorized=1 confermato sul primario.");
    echo "ok";

} catch (Exception $e) {
    // Primario temporaneamente irraggiungibile.
    // Non è un problema: al prossimo ciclo riproverà.
    writeLog("ATTENZIONE — Primario non raggiungibile: " . $e->getMessage());
    echo "errore connessione primario";
}

rotateLogs();
