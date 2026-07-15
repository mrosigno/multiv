<?php
// test_scrittura.php — RIMUOVERE DOPO IL TEST
header('Cache-Control: no-store, no-cache, must-revalidate');

$stateFile = __DIR__ . '/sync_state.json';
$logFile   = __DIR__ . '/sync_scheduled_log.txt';

echo "<h3>Test scrittura file</h3>";
echo "<p>Percorso sync_state.json: $stateFile</p>";
echo "<p>File esiste: " . (file_exists($stateFile) ? 'SI' : 'NO') . "</p>";
echo "<p>File scrivibile (is_writable): " . (is_writable($stateFile) ? 'SI' : 'NO') . "</p>";

// Mostra permessi attuali
if (file_exists($stateFile)) {
    $perms = substr(sprintf('%o', fileperms($stateFile)), -4);
    echo "<p>Permessi attuali: $perms</p>";
    echo "<p>Proprietario UID: " . fileowner($stateFile) . "</p>";
    echo "<p>PHP gira come UID: " . getmyuid() . "</p>";
}

// Tenta una scrittura di test
$testData = [
    'last_incremental' => date('Y-m-d H:i:s'),
    'last_run'         => date('Y-m-d H:i:s'),
    'last_run_ok'      => true,
    'last_error'       => 'TEST SCRITTURA MANUALE - ' . date('H:i:s')
];

$result = @file_put_contents($stateFile, json_encode($testData, JSON_PRETTY_PRINT));

if ($result === false) {
    echo "<p style='color:red'><strong>❌ SCRITTURA FALLITA</strong></p>";
    $error = error_get_last();
    echo "<p>Errore PHP: " . ($error['message'] ?? 'N/D') . "</p>";
} else {
    echo "<p style='color:green'><strong>✅ Scrittura riuscita: $result byte scritti</strong></p>";
}

// Stesso test sul file di log
echo "<hr><h3>Test scrittura log</h3>";
echo "<p>File esiste: " . (file_exists($logFile) ? 'SI' : 'NO') . "</p>";
echo "<p>File scrivibile: " . (is_writable($logFile) ? 'SI' : 'NO') . "</p>";

$resultLog = @file_put_contents($logFile, "[TEST " . date('Y-m-d H:i:s') . "] Scrittura di prova\n", FILE_APPEND);
if ($resultLog === false) {
    echo "<p style='color:red'><strong>❌ SCRITTURA LOG FALLITA</strong></p>";
} else {
    echo "<p style='color:green'><strong>✅ Scrittura log riuscita: $resultLog byte aggiunti</strong></p>";
}

// Verifica anche la cartella
echo "<hr><h3>Permessi cartella</h3>";
echo "<p>Cartella: " . __DIR__ . "</p>";
echo "<p>Cartella scrivibile: " . (is_writable(__DIR__) ? 'SI' : 'NO') . "</p>";
$dirPerms = substr(sprintf('%o', fileperms(__DIR__)), -4);
echo "<p>Permessi cartella: $dirPerms</p>";
?>
