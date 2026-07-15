<?php
// get_log_test.php — TEST ISOLATO, rimuovere dopo la verifica
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Content-Type: text/plain; charset=UTF-8');

$logFile = __DIR__ . '/sync_scheduled_log.txt';

echo "Percorso letto: $logFile\n";
echo "File esiste: " . (file_exists($logFile) ? 'SI' : 'NO') . "\n";
echo "Ultima modifica file: " . date('Y-m-d H:i:s', filemtime($logFile)) . "\n";
echo "Dimensione file: " . filesize($logFile) . " byte\n";
echo "----------------------------------------\n";

clearstatcache(true, $logFile);
$lines = array_slice(file($logFile), -10);
echo implode('', array_reverse($lines));
