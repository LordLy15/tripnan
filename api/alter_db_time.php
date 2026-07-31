<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Supabase PostgreSQL connection
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$port = '6543'; // Supabase transaction pooler port
$dbname = 'postgres';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    echo "Connected to Supabase PostgreSQL successfully!\n";

    // Alter the schedules table to add 'time'
    $sql = "ALTER TABLE schedules ADD COLUMN time VARCHAR(255) DEFAULT NULL";
    
    $pdo->exec($sql);
    echo "Column 'time' added successfully to 'schedules' table.\n";
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
}
?>
