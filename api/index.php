<?php
// api/index.php

// 1. Gestione CORS (Permette a Vite su porta 8080 di chiamare PHP su porta 80)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Risposta per le richieste di preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

// 2. Routing basato sul parametro 'endpoint'
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

try {
    switch ($endpoint) {
        case 'status':
            echo json_encode(['status' => 'API PHP Multi-V Online', 'time' => time()]);
            break;

        // --- BATCH 1 ---
        case 'clienti':
            $stmt = $pdo->query("SELECT * FROM clienti ORDER BY Ragione_Sociale ASC");
            echo json_encode($stmt->fetchAll());
            break;

        case 'azienda':
            $stmt = $pdo->query("SELECT * FROM azienda LIMIT 1");
            echo json_encode($stmt->fetchAll());
            break;

        case 'magazzini':
            $stmt = $pdo->query("SELECT * FROM magazzini ORDER BY Descrizione ASC");
            echo json_encode($stmt->fetchAll());
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint non trovato']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore del server', 'message' => $e->getMessage()]);
}
?>