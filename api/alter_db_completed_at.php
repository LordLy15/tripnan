<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$port = '6543';
$dbname = 'postgres';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $sql = "ALTER TABLE schedules ADD COLUMN completed_at VARCHAR(255) DEFAULT NULL";
    $pdo->exec($sql);
    echo "Column 'completed_at' added successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
