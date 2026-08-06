<?xml version="1.0" encoding="utf-8"?>
<?php
$pdo = new PDO('sqlite:c:\xampp\htdocs\tripnan\api\tripnan.sqlite');
$stmt = $pdo->query('SELECT * FROM trips');
$trips = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($trips);
?>
