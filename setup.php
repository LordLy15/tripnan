<?php
header('Content-Type: text/html; charset=utf-8');
echo "<html><head><title>TripNan Setup</title>";
echo "<link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' rel='stylesheet'>";
echo "<style>body{padding:50px;background:#f8f9fa}</style></head><body>";
echo "<div class='container'><div class='card shadow'><div class='card-body'>";
echo "<h2 class='text-center mb-4'>TripNan Database Setup</h2>";

$host = 'localhost';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $dbname = 'tripnan_db';
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "<div class='alert alert-success'>Database '$dbname' ready.</div>";

    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Drop old tables if exist
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("DROP TABLE IF EXISTS notifications");
    $pdo->exec("DROP TABLE IF EXISTS trip_shares");
    $pdo->exec("DROP TABLE IF EXISTS trip_templates");
    $pdo->exec("DROP TABLE IF EXISTS friends");
    $pdo->exec("DROP TABLE IF EXISTS schedules");
    $pdo->exec("DROP TABLE IF EXISTS trips");
    $pdo->exec("DROP TABLE IF EXISTS trip_categories");
    $pdo->exec("DROP TABLE IF EXISTS password_resets");
    $pdo->exec("DROP TABLE IF EXISTS users");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    echo "<div class='alert alert-info'>Old tables removed.</div>";

    // Create users table
    $pdo->exec("
        CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            full_name VARCHAR(100) DEFAULT NULL,
            avatar VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'users' created.</div>";

    // Create password_resets table
    $pdo->exec("
        CREATE TABLE password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_token (token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'password_resets' created.</div>";

    // Create trip_categories table
    $pdo->exec("
        CREATE TABLE trip_categories (
            id VARCHAR(50) PRIMARY KEY,
            owner VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(20) DEFAULT '#0d6efd',
            icon VARCHAR(50) DEFAULT 'tag',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_owner (owner)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'trip_categories' created.</div>";

    // Insert default categories
    $stmt = $pdo->prepare("INSERT INTO trip_categories (id, owner, name, color, icon) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute(['cat_vacation', 'default', 'Vacation', '#10b981', 'sun']);
    $stmt->execute(['cat_business', 'default', 'Business', '#f59e0b', 'briefcase']);
    $stmt->execute(['cat_adventure', 'default', 'Adventure', '#ef4444', 'compass']);
    $stmt->execute(['cat_family', 'default', 'Family', '#8b5cf6', 'users']);
    echo "<div class='alert alert-success'>Default categories added.</div>";

    // Create trips table
    $pdo->exec("
        CREATE TABLE trips (
            id VARCHAR(50) PRIMARY KEY,
            owner VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            totalPlanBudget DECIMAL(15,2) DEFAULT 0,
            tripCode VARCHAR(20) NOT NULL,
            category_id VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_owner (owner)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'trips' created.</div>";

    // Create schedules table
    $pdo->exec("
        CREATE TABLE schedules (
            id VARCHAR(50) PRIMARY KEY,
            trip_id VARCHAR(50) NOT NULL,
            date DATE NOT NULL,
            title VARCHAR(100) NOT NULL,
            planBudget DECIMAL(15,2) DEFAULT 0,
            realBudget DECIMAL(15,2) DEFAULT 0,
            isCompleted BOOLEAN DEFAULT FALSE,
            imageUrl MEDIUMTEXT DEFAULT NULL,
            INDEX idx_trip_id (trip_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'schedules' created.</div>";

    // Create friends table
    $pdo->exec("
        CREATE TABLE friends (
            id VARCHAR(50) PRIMARY KEY,
            trip_id VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL,
            INDEX idx_trip_id (trip_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'friends' created.</div>";

    // Create trip_templates table
    $pdo->exec("
        CREATE TABLE trip_templates (
            id VARCHAR(50) PRIMARY KEY,
            owner VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT DEFAULT NULL,
            template_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_owner (owner)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'trip_templates' created.</div>";

    // Create trip_shares table
    $pdo->exec("
        CREATE TABLE trip_shares (
            id VARCHAR(50) PRIMARY KEY,
            trip_id VARCHAR(50) NOT NULL,
            shared_with VARCHAR(50) NOT NULL,
            permission ENUM('view', 'edit') DEFAULT 'view',
            shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_trip_id (trip_id),
            INDEX idx_shared_with (shared_with)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'trip_shares' created.</div>";

    // Create notifications table
    $pdo->exec("
        CREATE TABLE notifications (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT DEFAULT NULL,
            data JSON DEFAULT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_is_read (is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    echo "<div class='alert alert-success'>Table 'notifications' created.</div>";

    echo "<hr><div class='text-center'>";
    echo "<h3 class='text-success mb-4'>Setup Complete!</h3>";
    echo "<a href='index.html' class='btn btn-primary btn-lg'>Go to TripNan App</a>";
    echo "</div>";

} catch (PDOException $e) {
    echo "<div class='alert alert-danger'>";
    echo "<h4>Setup Failed!</h4>";
    echo "<p><strong>Error:</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Make sure MySQL (XAMPP) is running.</p>";
    echo "</div>";
}

echo "</div></div></div></body></html>";
?>
