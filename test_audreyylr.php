<?php
error_reporting(E_ALL);
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';
$dbname = 'postgres';
$port = '5432';
$pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
$stmt = $pdo->prepare('SELECT g.id as relationship_id, u.username, u.email FROM global_friends g JOIN users u ON g.friend_username = u.username WHERE g.user_username = ?');
$stmt->execute(['audreyylr']);
var_dump($stmt->fetchAll(PDO::FETCH_ASSOC));
