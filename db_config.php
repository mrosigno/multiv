<?php
// ============================================================
// db_config.php — Credenziali e selezione DB attivo
// ============================================================

// --- Credenziali server PRIMARIO ---
define('DB_PRIMARY', [
    'host'     => '188.213.169.59',        // <- sostituisci con il tuo IP primario
    'db_name'  => 'gl_test',
    'username' => 'gl_admin',
    'password' => 'GL-adm-2016$',
]);

// --- Credenziali server SECONDARIO ---
define('DB_SECONDARY', [
    'host'     => '31.11.38.12',        // <- sostituisci con il tuo IP secondario
    'db_name'  => 'Sql1901803_5',
    'username' => 'Sql1901803',
    'password' => 'gL28011967!',
]);

// ============================================================
// Lettura stato attivo da db_switch.json
// ============================================================
$switchFile = __DIR__ . '/db_switch.json';

// Se il file non esiste per qualsiasi motivo, lo ricrea con default primario
if (!file_exists($switchFile)) {
    file_put_contents($switchFile, json_encode([
        'active'      => 'primary',
        'switched_at' => null,
        'switched_by' => null
    ], JSON_PRETTY_PRINT));
}

$switchState  = json_decode(file_get_contents($switchFile), true);
$activeServer = $switchState['active'] ?? 'primary';

// ============================================================
// Selezione credenziali in base allo stato
// ============================================================
$dbConfig = ($activeServer === 'secondary') ? DB_SECONDARY : DB_PRIMARY;

$host     = $dbConfig['host'];
$db_name  = $dbConfig['db_name'];
$username = $dbConfig['username'];
$password = $dbConfig['password'];