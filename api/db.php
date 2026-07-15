<?php
// api/db.php
require_once 'config.php';

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options =[
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (\PDOException $e) {
    // In produzione, logga l'errore su file, non stamparlo a video
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Errore di connessione al database', 'details' => $e->getMessage()]);
    exit;
}
?>