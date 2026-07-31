<?php
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';
$dbname = 'postgres';
$port = '5432';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("ALTER TABLE trips ADD COLUMN coverurl TEXT DEFAULT NULL;");
    echo "Success!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
