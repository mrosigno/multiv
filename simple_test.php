<?php
require_once __DIR__ . '/db_config.php';
echo "Test DB connection...\n";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✅ DB connected!\n";

    // Get user FRANCO
    echo "\nGet user FRANCO...\n";
    $stmt = $pdo->prepare("SELECT * FROM user WHERE fs_user_id = ? LIMIT 1");
    $stmt->execute(['FRANCO']);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo "✅ User found:\n";
        echo "  ID: " . $user['id'] . "\n";
        echo "  Username: " . $user['fs_user_id'] . "\n";
        echo "  SMTP Host: " . ($user['smtp_host'] ?? 'NULL') . "\n";
        echo "  SMTP Port: " . ($user['smtp_port'] ?? 'NULL') . "\n";
        echo "  SMTP User: " . ($user['smtp_user'] ?? 'NULL') . "\n";
    } else {
        echo "❌ User FRANCO not found!\n";
    }

} catch (PDOException $e) {
    echo "❌ DB Error: " . $e->getMessage() . "\n";
}
