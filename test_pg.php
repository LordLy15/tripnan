<?php
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR';
$dbname = 'postgres';
$port = '5432';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $user_id = 'dnaan';
    $stmt = $pdo->prepare("SELECT g.id as relationship_id, u.username, u.email FROM global_friends g JOIN users u ON g.friend_username = u.username WHERE g.user_username = ? ORDER BY g.created_at DESC");
    $stmt->execute([$user_id]);
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
