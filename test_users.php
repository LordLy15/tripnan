<?php
error_reporting(E_ALL);
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';
$dbname = 'postgres';
$port = '5432';
$pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
$stmt = $pdo->query("SELECT username, email FROM users");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
