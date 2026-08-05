<?php
require 'api.php';
try {
  $pdo->exec("ALTER TABLE users ADD COLUMN dob DATE, ADD COLUMN gender VARCHAR(10), ADD COLUMN city VARCHAR(100)");
  echo "Columns added";
} catch (Exception $e) {
  echo $e->getMessage();
}
?>
