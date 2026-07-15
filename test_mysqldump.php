<?php
// ============================================================
// test_mysqldump.php — Test completo disponibilità mysqldump
// RIMUOVERE DOPO IL TEST
// ============================================================

echo "<h2>Test disponibilità strumenti dump su Aruba</h2>";
echo "<style>body{font-family:monospace;padding:20px} 
      .ok{color:green} .no{color:red} .warn{color:orange}
      table{border-collapse:collapse;margin:10px 0}
      td,th{border:1px solid #ccc;padding:6px 12px}</style>";

// --- TEST 1: exec() disponibile? ---
echo "<h3>1. Funzioni di sistema PHP</h3>";
$disabled = explode(',', ini_get('disable_functions'));
$disabled = array_map('trim', $disabled);

$funcs = ['exec', 'shell_exec', 'system', 'passthru', 'proc_open', 'popen'];
echo "<table><tr><th>Funzione</th><th>Stato</th></tr>";
foreach ($funcs as $f) {
    $ok = !in_array($f, $disabled) && function_exists($f);
    echo "<tr><td>$f()</td><td class='" . ($ok ? 'ok' : 'no') . "'>" . 
         ($ok ? '✅ Disponibile' : '❌ Disabilitata') . "</td></tr>";
}
echo "</table>";

// --- TEST 2: percorsi mysqldump ---
echo "<h3>2. Ricerca mysqldump sul filesystem</h3>";
$paths = [
    '/usr/bin/mysqldump',
    '/usr/local/bin/mysqldump',
    '/usr/local/mysql/bin/mysqldump',
    '/opt/mysql/bin/mysqldump',
    '/usr/local/php8.1/bin/mysqldump',
    '/usr/local/php8.0/bin/mysqldump',
];
echo "<table><tr><th>Percorso</th><th>Esiste?</th></tr>";
$foundDump = null;
foreach ($paths as $p) {
    $exists = file_exists($p);
    if ($exists && !$foundDump) $foundDump = $p;
    echo "<tr><td>$p</td><td class='" . ($exists ? 'ok' : 'no') . "'>" .
         ($exists ? '✅ Trovato' : '❌ Non trovato') . "</td></tr>";
}
echo "</table>";

// --- TEST 3: proc_open (alternativa a exec) ---
echo "<h3>3. Test proc_open (alternativa exec)</h3>";
if (function_exists('proc_open')) {
    $desc = [1 => ['pipe','w'], 2 => ['pipe','w']];
    $proc = @proc_open('echo test_ok', $desc, $pipes);
    if (is_resource($proc)) {
        $out = stream_get_contents($pipes[1]);
        proc_close($proc);
        if (trim($out) === 'test_ok') {
            echo "<p class='ok'>✅ proc_open funziona — mysqldump eseguibile via proc_open</p>";
        } else {
            echo "<p class='warn'>⚠️ proc_open disponibile ma output anomalo: $out</p>";
        }
    } else {
        echo "<p class='no'>❌ proc_open non eseguibile (bloccata dal sistema)</p>";
    }
} else {
    echo "<p class='no'>❌ proc_open disabilitata</p>";
}

// --- TEST 4: PDO + SELECT INTO OUTFILE ---
echo "<h3>4. Test SELECT INTO OUTFILE (dump nativo MySQL)</h3>";
echo "<p class='warn'>⚠️ Non testabile automaticamente — richiede permessi FILE sul DB.<br>
      Da verificare manualmente su phpMyAdmin con:<br>
      <code>SHOW GRANTS FOR CURRENT_USER();</code><br>
      Cerca 'FILE' nei permessi.</p>";

// --- TEST 5: shell via PHP open_basedir ---
echo "<h3>5. Restrizioni open_basedir</h3>";
$ob = ini_get('open_basedir');
if ($ob) {
    echo "<p class='warn'>⚠️ open_basedir attivo: <strong>$ob</strong><br>
          Limita l'accesso ai file fuori da queste cartelle.</p>";
} else {
    echo "<p class='ok'>✅ open_basedir non impostato.</p>";
}

// --- TEST 6: Cartella scrivibile per dump temporaneo ---
echo "<h3>6. Cartella scrivibile per file temporanei</h3>";
$tmpFile = __DIR__ . '/test_write_' . time() . '.tmp';
if (file_put_contents($tmpFile, 'test') !== false) {
    unlink($tmpFile);
    echo "<p class='ok'>✅ Cartella corrente scrivibile: " . __DIR__ . "</p>";
} else {
    echo "<p class='no'>❌ Cartella non scrivibile.</p>";
}

// --- RIEPILOGO ---
echo "<h3>Riepilogo e raccomandazione</h3>";
$execOk    = !in_array('exec', $disabled) && function_exists('exec');
$procOk    = function_exists('proc_open');

if ($execOk && $foundDump) {
    echo "<p class='ok'><strong>✅ SOLUZIONE A: exec() + mysqldump disponibili — soluzione ottimale possibile.</strong></p>";
} elseif ($procOk && $foundDump) {
    echo "<p class='ok'><strong>✅ SOLUZIONE B: proc_open + mysqldump — alternativa valida.</strong></p>";
} elseif ($foundDump) {
    echo "<p class='warn'><strong>⚠️ mysqldump trovato ma nessuna funzione di esecuzione disponibile.</strong></p>";
} else {
    echo "<p class='no'><strong>❌ mysqldump non disponibile su questo server.<br>
          La sync via PHP puro è l'unica opzione.</strong></p>";
    echo "<p>Alternativa: valutare sync tramite cron SSH su server esterno o servizio dedicato.</p>";
}
?>