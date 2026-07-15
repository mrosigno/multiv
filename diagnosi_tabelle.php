<?php
// ============================================================
// diagnosi_tabelle.php — Analisi tabelle DB primario
// RIMUOVERE DOPO IL TEST
// ============================================================

// Inserisci direttamente le credenziali del primario
$host     = '188.213.169.59';           // <- IP primario
$db_name  = 'gl_test';  // <- nome DB
$username = 'gl_admin';   // <- utente
$password = 'GL-adm-2016$'; // <- password
    

$largeTables = [
    'fatturecorpo','fatture','prima_nota_casa','scadenzario',
    'pagamenti','carichi','scarichi','articoli_prisma'
];
$mediumTables = [
    'fattpaservizi','fattpainvii','clienti','ddt',
    'trasferimenti','destinazioni','deduzioni'
];
$skipTables = ['system_auth'];

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db_name;charset=utf8mb4",
        $username, $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10]
    );

    echo "✅ Connessione OK<br><br>";

    $allTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $skipList  = array_merge($largeTables, $mediumTables, $skipTables);
    $small     = array_filter($allTables, fn($t) => !in_array($t, $skipList));

    echo "<h3>Tabelle SMALL da sincronizzare (" . count($small) . " tabelle)</h3>";
    echo "<table border=1 cellpadding=6 style='border-collapse:collapse;font-family:monospace;font-size:13px'>";
    echo "<tr style='background:#ddd'><th>Tabella</th><th>Righe</th><th>KB</th></tr>";

    $totalRows = 0;
    $toPromote = [];

    foreach ($small as $table) {
        $count = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
        $info  = $pdo->query(
            "SELECT ROUND((data_length + index_length)/1024,1)
             FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = '$table'"
        )->fetchColumn();

        $totalRows += $count;
        if ($count > 1000) $toPromote[] = ['name' => $table, 'rows' => $count];

        $color = $count > 5000 ? '#fee2e2' : ($count > 1000 ? '#fef9c3' : '#f0fdf4');
        echo "<tr style='background:$color'>
                <td>$table</td>
                <td style='text-align:right'>$count</td>
                <td style='text-align:right'>$info</td>
              </tr>";
    }

    echo "<tr style='background:#e5e7eb'>
            <td><strong>TOTALE</strong></td>
            <td style='text-align:right'><strong>$totalRows</strong></td>
            <td></td>
          </tr>";
    echo "</table><br>";

    if (!empty($toPromote)) {
        echo "<p style='color:red'>⚠️ Queste tabelle hanno troppe righe per lo step 'small'<br>";
        echo "Vanno aggiunte come step separati:</p><ul>";
        foreach ($toPromote as $t) {
            echo "<li><strong>{$t['name']}</strong> — {$t['rows']} righe</li>";
        }
        echo "</ul>";
    } else {
        echo "<p style='color:green'>✅ Tutte le tabelle small sono di dimensione gestibile.</p>";
    }

    echo "<p>Righe totali step small: <strong>$totalRows</strong></p>";

} catch (Exception $e) {
    echo "❌ Errore connessione: " . $e->getMessage();
}
?>