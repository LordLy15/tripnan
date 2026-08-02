<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';
$dbname = 'postgres';
$port = '5432';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;options='--client_encoding=UTF8'";
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    echo "Connected successfully.\n";

    $sql = "ALTER TABLE trips ADD COLUMN is_finished BOOLEAN DEFAULT FALSE";
    $pdo->exec($sql);
    echo "Successfully added is_finished column.\n";

} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'column "is_finished" of relation "trips" already exists') !== false) {
        echo "Column already exists.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?>
