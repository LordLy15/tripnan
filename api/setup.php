<?php
header('Content-Type: text/html; charset=utf-8');
echo "<html><head><title>TripNan Setup (Supabase)</title>";
echo "<link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' rel='stylesheet'>";
echo "<style>body{padding:50px;background:#f8f9fa}</style></head><body>";
echo "<div class='container'><div class='card shadow'><div class='card-body'>";
echo "<h2 class='text-center mb-4'>TripNan Database Setup (Supabase)</h2>";

// Supabase Connection
$host = 'db.xxxxxx.supabase.co'; // Ganti dengan Host Supabase Anda
$user = 'postgres';
$pass = 'password_supabase_anda'; // Ganti dengan Password Anda
$dbname = 'postgres';
$port = '5432';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<div class='alert alert-success'>Connected to Supabase successfully.</div>";

    // Drop old tables if exist
    $pdo->exec("DROP TABLE IF EXISTS notifications CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS trip_shares CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS trip_templates CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS friends CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS schedules CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS trips CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS trip_categories CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS password_resets CASCADE");
    $pdo->exec("DROP TABLE IF EXISTS users CASCADE");
    echo "<div class='alert alert-info'>Old tables removed.</div>";

    // Create users table
    $pdo->exec("
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            full_name VARCHAR(100) DEFAULT NULL,
            avatar VARCHAR(500) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "<div class='alert alert-success'>Table 'users' created.</div>";

    // Create password_resets table
    $pdo->exec("
        CREATE TABLE password_resets (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_password_resets_email ON password_resets(email)");
    $pdo->exec("CREATE INDEX idx_password_resets_token ON password_resets(token)");
    echo "<div class='alert alert-success'>Table 'password_resets' created.</div>";

    // Create trip_categories table
    $pdo->exec("
        CREATE TABLE trip_categories (
            id VARCHAR(50) PRIMARY KEY,
            owner VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(20) DEFAULT '#0d6efd',
            icon VARCHAR(50) DEFAULT 'tag',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_trip_categories_owner ON trip_categories(owner)");
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_trips_owner ON trips(owner)");
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
            imageUrl TEXT DEFAULT NULL
        )
    ");
    $pdo->exec("CREATE INDEX idx_schedules_trip_id ON schedules(trip_id)");
    echo "<div class='alert alert-success'>Table 'schedules' created.</div>";

    // Create friends table
    $pdo->exec("
        CREATE TABLE friends (
            id VARCHAR(50) PRIMARY KEY,
            trip_id VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL
        )
    ");
    $pdo->exec("CREATE INDEX idx_friends_trip_id ON friends(trip_id)");
    echo "<div class='alert alert-success'>Table 'friends' created.</div>";

    // Create trip_templates table
    $pdo->exec("
        CREATE TABLE trip_templates (
            id VARCHAR(50) PRIMARY KEY,
            owner VARCHAR(50) NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT DEFAULT NULL,
            template_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_trip_templates_owner ON trip_templates(owner)");
    echo "<div class='alert alert-success'>Table 'trip_templates' created.</div>";

    // Create trip_shares table
    $pdo->exec("
        CREATE TABLE trip_shares (
            id VARCHAR(50) PRIMARY KEY,
            trip_id VARCHAR(50) NOT NULL,
            shared_with VARCHAR(50) NOT NULL,
            permission VARCHAR(10) DEFAULT 'view',
            shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id)");
    $pdo->exec("CREATE INDEX idx_trip_shares_shared_with ON trip_shares(shared_with)");
    echo "<div class='alert alert-success'>Table 'trip_shares' created.</div>";

    // Create notifications table
    $pdo->exec("
        CREATE TABLE notifications (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT DEFAULT NULL,
            data JSONB DEFAULT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("CREATE INDEX idx_notifications_user_id ON notifications(user_id)");
    $pdo->exec("CREATE INDEX idx_notifications_is_read ON notifications(is_read)");
    echo "<div class='alert alert-success'>Table 'notifications' created.</div>";

    echo "<hr><div class='text-center'>";
    echo "<h3 class='text-success mb-4'>Setup Complete!</h3>";
    echo "<a href='index.html' class='btn btn-primary btn-lg'>Go to TripNan App</a>";
    echo "</div>";

} catch (PDOException $e) {
    echo "<div class='alert alert-danger'>";
    echo "<h4>Setup Failed!</h4>";
    echo "<p><strong>Error:</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Make sure your Supabase credentials are correct.</p>";
    echo "</div>";
}

echo "</div></div></div></body></html>";
?>
