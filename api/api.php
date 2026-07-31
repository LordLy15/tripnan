<?php
// Disable all error output to ensure clean JSON responses
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Supabase Database Connection
$host = 'aws-0-ap-southeast-2.pooler.supabase.com'; // Ganti dengan Host Supabase Anda
$user = 'postgres.yzcnevaoeocpzyyhkaaj';
$pass = 'AOJGXoijycm507dR'; // Ganti dengan Password Anda
$dbname = 'postgres';
$port = '5432';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage(), 'error' => 'DB_CONNECTION_FAILED']);
    exit();
}

function generateId() {
    return bin2hex(random_bytes(12));
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

try {
    switch ($action) {
        case 'register': {
            $username = isset($input['username']) ? trim($input['username']) : '';
            $password = isset($input['password']) ? $input['password'] : '';
            $email = isset($input['email']) ? trim($input['email']) : '';

            if (empty($username) || empty($password)) {
                echo json_encode(['success' => false, 'message' => 'Username and password are required']);
                break;
            }

            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            if ($stmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Username is already taken!']);
                break;
            }

            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (username, password, email, full_name) VALUES (?, ?, ?, ?)");
            $stmt->execute([$username, $hashedPassword, $email ?: null, $username]);

            echo json_encode(['success' => true, 'message' => 'Registration successful!']);
            break;
        }

        case 'login': {
            $username = isset($input['username']) ? trim($input['username']) : '';
            $password = isset($input['password']) ? $input['password'] : '';

            $stmt = $pdo->prepare("SELECT password, email, full_name, avatar FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                echo json_encode(['success' => false, 'message' => 'Username not found!']);
                break;
            }

            if (!password_verify($password, $user['password'])) {
                echo json_encode(['success' => false, 'message' => 'Incorrect password!']);
                break;
            }

            echo json_encode([
                'success' => true,
                'user' => [
                    'username' => $username,
                    'email' => $user['email'],
                    'full_name' => $user['full_name'],
                    'avatar' => $user['avatar']
                ]
            ]);
            break;
        }

        case 'get_trips': {
            $owner = isset($_GET['owner']) ? $_GET['owner'] : '';
            if (empty($owner)) {
                echo json_encode(['success' => true, 'trips' => []]);
                break;
            }

            // Get owned trips
            $stmt = $pdo->prepare("SELECT * FROM trips WHERE owner = ?");
            $stmt->execute([$owner]);
            $ownedTrips = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($ownedTrips as &$t) $t['isOwner'] = true;

            // Get shared trips
            $stmt = $pdo->prepare("
                SELECT t.* FROM trips t 
                JOIN trip_shares ts ON t.id = ts.trip_id 
                WHERE ts.shared_with = ?
            ");
            $stmt->execute([$owner]);
            $sharedTrips = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($sharedTrips as &$t) $t['isOwner'] = false;

            $trips = array_merge($ownedTrips, $sharedTrips);

            foreach ($trips as &$trip) {
                $schStmt = $pdo->prepare("SELECT id, trip_id, date, time, title, planbudget, realbudget, iscompleted, (CASE WHEN imageurl IS NOT NULL AND imageurl != '[]' THEN 1 ELSE 0 END) as has_photos FROM schedules WHERE trip_id = ?");
                $schStmt->execute([$trip['id']]);
                $schedules = $schStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach($schedules as &$s) {
                    $s['isCompleted'] = (bool)($s['iscompleted'] ?? $s['isCompleted'] ?? 0);
                    $s['planBudget'] = (float)($s['planbudget'] ?? $s['planBudget'] ?? 0);
                    $s['realBudget'] = (float)($s['realbudget'] ?? $s['realBudget'] ?? 0);
                    $s['has_photos'] = (bool)($s['has_photos'] ?? 0);
                    $s['photos'] = [];
                    unset($s['iscompleted'], $s['planbudget'], $s['realbudget'], $s['has_photos']);
                }
                $trip['schedules'] = $schedules;

                $frStmt = $pdo->prepare("SELECT id, name, email FROM friends WHERE trip_id = ?");
                $frStmt->execute([$trip['id']]);
                $manualFriends = $frStmt->fetchAll(PDO::FETCH_ASSOC);

                $shStmt = $pdo->prepare("
                    SELECT ts.id, u.full_name as name, u.email 
                    FROM trip_shares ts 
                    JOIN users u ON ts.shared_with = u.username 
                    WHERE ts.trip_id = ?
                ");
                $shStmt->execute([$trip['id']]);
                $sharedFriends = $shStmt->fetchAll(PDO::FETCH_ASSOC);

                $trip['friends'] = array_merge($manualFriends, $sharedFriends);
                $trip['totalPlanBudget'] = (float)($trip['totalplanbudget'] ?? $trip['totalPlanBudget'] ?? 0);
                $trip['tripCode'] = $trip['tripcode'] ?? $trip['tripCode'] ?? '';
                $trip['coverUrl'] = $trip['coverurl'] ?? $trip['coverUrl'] ?? null;
                unset($trip['totalplanbudget'], $trip['tripcode'], $trip['coverurl']);
            }
            echo json_encode(['success' => true, 'trips' => $trips]);
            break;
        }

        case 'create_trip': {
            $id = isset($input['id']) ? $input['id'] : generateId();
            $owner = isset($input['owner']) ? $input['owner'] : '';
            $name = isset($input['name']) ? $input['name'] : '';
            $budget = isset($input['totalPlanBudget']) ? $input['totalPlanBudget'] : 0;
            $code = isset($input['tripCode']) ? $input['tripCode'] : strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            $category_id = isset($input['category_id']) ? $input['category_id'] : null;
            $coverUrl = isset($input['coverUrl']) ? $input['coverUrl'] : null;

            $stmt = $pdo->prepare("INSERT INTO trips (id, owner, name, totalPlanBudget, tripCode, category_id, coverurl) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $owner, $name, $budget, $code, $category_id, $coverUrl]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'update_trip': {
            $id = isset($input['id']) ? $input['id'] : '';
            $updates = [];
            $params = [];

            if (isset($input['name'])) { $updates[] = "name = ?"; $params[] = $input['name']; }
            if (isset($input['totalPlanBudget'])) { $updates[] = "totalPlanBudget = ?"; $params[] = $input['totalPlanBudget']; }
            if (isset($input['tripCode'])) { $updates[] = "tripCode = ?"; $params[] = $input['tripCode']; }
            if (isset($input['category_id'])) { $updates[] = "category_id = ?"; $params[] = $input['category_id']; }
            if (isset($input['coverUrl'])) { $updates[] = "coverurl = ?"; $params[] = $input['coverUrl']; }

            if (!empty($updates)) {
                $params[] = $id;
                $stmt = $pdo->prepare("UPDATE trips SET " . implode(", ", $updates) . " WHERE id = ?");
                $stmt->execute($params);
            }
            echo json_encode(['success' => true]);
            break;
        }

        case 'delete_trip': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("DELETE FROM trips WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'add_schedule': {
            $id = isset($input['id']) ? $input['id'] : generateId();
            $trip_id = isset($input['trip_id']) ? $input['trip_id'] : '';
            $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
            $time = isset($input['time']) ? $input['time'] : null;
            $title = isset($input['title']) ? $input['title'] : 'New Activity';
            $planBudget = isset($input['planBudget']) ? $input['planBudget'] : 0;

            $stmt = $pdo->prepare("INSERT INTO schedules (id, trip_id, date, time, title, planBudget) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $trip_id, $date, $time, $title, $planBudget]);
            echo json_encode(['success' => true, 'id' => $id]);
            break;
        }

        case 'update_schedule': {
            $id = isset($input['id']) ? $input['id'] : '';
            
            $updates = [];
            $params = [];

            if (isset($input['date'])) { $updates[] = "date = ?"; $params[] = $input['date']; }
            if (isset($input['time'])) { $updates[] = "time = ?"; $params[] = $input['time']; }
            if (isset($input['title'])) { $updates[] = "title = ?"; $params[] = $input['title']; }
            if (isset($input['planBudget'])) { $updates[] = "planBudget = ?"; $params[] = $input['planBudget']; }
            if (isset($input['realBudget'])) { $updates[] = "realBudget = ?"; $params[] = $input['realBudget']; }
            if (isset($input['isCompleted'])) { $updates[] = "isCompleted = ?"; $params[] = $input['isCompleted'] ? 1 : 0; }
            if (isset($input['photos'])) { $updates[] = "imageUrl = ?"; $params[] = json_encode($input['photos']); }

            if (!empty($updates)) {
                $params[] = $id;
                $sql = "UPDATE schedules SET " . implode(", ", $updates) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }
            
            echo json_encode(['success' => true]);
            break;
        }

        case 'delete_schedule': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("DELETE FROM schedules WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'update_schedule_photos': {
            $id = isset($input['id']) ? $input['id'] : '';
            $photos = isset($input['photos']) ? json_encode($input['photos']) : '[]';

            $stmt = $pdo->prepare("UPDATE schedules SET imageUrl = ? WHERE id = ?");
            $stmt->execute([$photos, $id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'get_schedule_photos': {
            $id = isset($_GET['id']) ? $_GET['id'] : '';
            $stmt = $pdo->prepare("SELECT imageurl FROM schedules WHERE id = ?");
            $stmt->execute([$id]);
            $schedule = $stmt->fetch(PDO::FETCH_ASSOC);
            $photos = [];
            $imageurl = $schedule['imageurl'] ?? $schedule['imageUrl'] ?? null;
            if ($imageurl) {
                $decoded = json_decode($imageurl, true);
                $photos = is_array($decoded) ? $decoded : [$imageurl];
            }
            echo json_encode(['success' => true, 'photos' => $photos]);
            break;
        }

        case 'add_friend': {
            $id = isset($input['id']) ? $input['id'] : generateId();
            $trip_id = isset($input['trip_id']) ? $input['trip_id'] : '';
            $name = isset($input['name']) ? $input['name'] : '';
            $email = isset($input['email']) ? $input['email'] : '';

            $stmt = $pdo->prepare("INSERT INTO friends (id, trip_id, name, email) VALUES (?, ?, ?, ?)");
            $stmt->execute([$id, $trip_id, $name, $email]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'delete_friend': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("DELETE FROM friends WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'join_trip': {
            $tripCode = isset($input['trip_code']) ? strtoupper(trim($input['trip_code'])) : '';
            $user = isset($input['user']) ? $input['user'] : '';

            if (empty($tripCode) || empty($user)) {
                echo json_encode(['success' => false, 'message' => 'Trip code and username are required']);
                break;
            }

            // Find trip by code
            $stmt = $pdo->prepare("SELECT * FROM trips WHERE tripCode = ?");
            $stmt->execute([$tripCode]);
            $trip = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$trip) {
                echo json_encode(['success' => false, 'message' => 'Trip code not found. Please check and try again.']);
                break;
            }

            // Can't join own trip
            if ($trip['owner'] === $user) {
                echo json_encode(['success' => false, 'message' => 'You cannot join your own trip.']);
                break;
            }

            // Check if already shared with this user
            $stmt = $pdo->prepare("SELECT id FROM trip_shares WHERE trip_id = ? AND shared_with = ?");
            $stmt->execute([$trip['id'], $user]);
            if ($stmt->fetch()) {
                echo json_encode(['success' => true, 'message' => 'You already have access to this trip!', 'trip_id' => $trip['id']]);
                break;
            }

            // Add share entry
            $stmt = $pdo->prepare("INSERT INTO trip_shares (id, trip_id, shared_with, permission) VALUES (?, ?, ?, 'view')");
            $stmt->execute([generateId(), $trip['id'], $user]);

            echo json_encode(['success' => true, 'message' => 'Successfully joined trip!', 'trip_id' => $trip['id'], 'trip_name' => $trip['name']]);
            break;
        }

        case 'find_trip_by_code': {
            $tripCode = isset($_GET['trip_code']) ? strtoupper(trim($_GET['trip_code'])) : '';

            if (empty($tripCode)) {
                echo json_encode(['success' => false, 'message' => 'Trip code is required']);
                break;
            }

            $stmt = $pdo->prepare("SELECT id, name, owner FROM trips WHERE tripCode = ?");
            $stmt->execute([$tripCode]);
            $trip = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$trip) {
                echo json_encode(['success' => false, 'message' => 'Trip not found']);
                break;
            }

            echo json_encode(['success' => true, 'trip' => $trip]);
            break;
        }

        case 'get_categories': {
            $owner = isset($_GET['owner']) ? $_GET['owner'] : '';
            $stmt = $pdo->prepare("SELECT * FROM trip_categories WHERE owner = ? OR owner = 'default' ORDER BY name");
            $stmt->execute([$owner]);
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'categories' => $categories]);
            break;
        }

        case 'create_category': {
            $id = isset($input['id']) ? $input['id'] : generateId();
            $owner = isset($input['owner']) ? $input['owner'] : '';
            $name = isset($input['name']) ? $input['name'] : '';
            $color = isset($input['color']) ? $input['color'] : '#0d6efd';
            $icon = isset($input['icon']) ? $input['icon'] : 'tag';

            $stmt = $pdo->prepare("INSERT INTO trip_categories (id, owner, name, color, icon) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$id, $owner, $name, $color, $icon]);
            echo json_encode(['success' => true, 'id' => $id]);
            break;
        }

        case 'delete_category': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("DELETE FROM trip_categories WHERE id = ? AND owner != 'default'");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'get_templates': {
            $owner = isset($_GET['owner']) ? $_GET['owner'] : '';
            $stmt = $pdo->prepare("SELECT id, name, description, created_at FROM trip_templates WHERE owner = ? ORDER BY created_at DESC");
            $stmt->execute([$owner]);
            $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'templates' => $templates]);
            break;
        }

        case 'save_template': {
            $id = isset($input['id']) ? $input['id'] : generateId();
            $owner = isset($input['owner']) ? $input['owner'] : '';
            $name = isset($input['name']) ? $input['name'] : '';
            $description = isset($input['description']) ? $input['description'] : '';
            $template_data = json_encode($input['template_data']);

            $stmt = $pdo->prepare("SELECT id FROM trip_templates WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->fetch()) {
                $stmt = $pdo->prepare("UPDATE trip_templates SET name = ?, description = ?, template_data = ? WHERE id = ?");
                $stmt->execute([$name, $description, $template_data, $id]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO trip_templates (id, owner, name, description, template_data) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$id, $owner, $name, $description, $template_data]);
            }
            echo json_encode(['success' => true, 'id' => $id]);
            break;
        }

        case 'use_template': {
            $template_id = isset($input['template_id']) ? $input['template_id'] : '';
            $owner = isset($input['owner']) ? $input['owner'] : '';

            $stmt = $pdo->prepare("SELECT template_data FROM trip_templates WHERE id = ?");
            $stmt->execute([$template_id]);
            $template = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($template) {
                $data = json_decode($template['template_data'], true);
                
                $new_trip_id = generateId();
                $tripCode = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
                $tripName = (isset($data['name']) ? $data['name'] : 'Template Trip') . ' (Copy)';

                $pdo->beginTransaction();
                try {
                    $insTrip = $pdo->prepare("INSERT INTO trips (id, owner, name, tripCode) VALUES (?, ?, ?, ?)");
                    $insTrip->execute([$new_trip_id, $owner, $tripName, $tripCode]);

                    if (isset($data['schedules']) && is_array($data['schedules'])) {
                        $insSch = $pdo->prepare("INSERT INTO schedules (id, trip_id, date, time, title) VALUES (?, ?, ?, ?, ?)");
                        foreach ($data['schedules'] as $sch) {
                            $sch_id = generateId();
                            $date = isset($sch['date']) ? $sch['date'] : date('Y-m-d');
                            $time = isset($sch['time']) ? $sch['time'] : null;
                            $title = isset($sch['title']) ? $sch['title'] : 'Activity';
                            $insSch->execute([$sch_id, $new_trip_id, $date, $time, $title]);
                        }
                    }
                    $pdo->commit();
                    echo json_encode(['success' => true, 'new_trip_id' => $new_trip_id]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                }
            } else {
                echo json_encode(['success' => false, 'error' => 'Template not found']);
            }
            break;
        }

        case 'get_template': {
            $id = isset($_GET['id']) ? $_GET['id'] : '';
            $stmt = $pdo->prepare("SELECT * FROM trip_templates WHERE id = ?");
            $stmt->execute([$id]);
            $template = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($template) {
                $template['template_data'] = json_decode($template['template_data'], true);
                echo json_encode(['success' => true, 'template' => $template]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Template not found']);
            }
            break;
        }

        case 'delete_template': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("DELETE FROM trip_templates WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'share_trip': {
            $trip_id = isset($input['trip_id']) ? $input['trip_id'] : '';
            $shared_with = isset($input['shared_with']) ? $input['shared_with'] : '';
            $permission = isset($input['permission']) ? $input['permission'] : 'view';

            $stmt = $pdo->prepare("SELECT username FROM users WHERE username = ?");
            $stmt->execute([$shared_with]);
            if (!$stmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'User not found']);
                break;
            }

            $stmt = $pdo->prepare("SELECT id FROM trip_shares WHERE trip_id = ? AND shared_with = ?");
            $stmt->execute([$trip_id, $shared_with]);
            if ($stmt->fetch()) {
                $stmt = $pdo->prepare("UPDATE trip_shares SET permission = ? WHERE trip_id = ? AND shared_with = ?");
                $stmt->execute([$permission, $trip_id, $shared_with]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO trip_shares (id, trip_id, shared_with, permission) VALUES (?, ?, ?, ?)");
                $stmt->execute([generateId(), $trip_id, $shared_with, $permission]);
            }

            $stmt = $pdo->prepare("SELECT t.name, t.owner FROM trips t WHERE t.id = ?");
            $stmt->execute([$trip_id]);
            $trip = $stmt->fetch(PDO::FETCH_ASSOC);

            $notifId = generateId();
            $notifData = json_encode(['trip_id' => $trip_id, 'trip_name' => $trip['name']]);
            $stmt = $pdo->prepare("INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, 'trip_shared', ?, ?, ?)");
            $stmt->execute([$notifId, $shared_with, 'Trip Shared With You', $trip['owner'] . " shared trip '" . $trip['name'] . "' with you", $notifData]);

            echo json_encode(['success' => true]);
            break;
        }

        case 'get_shared_users': {
            $trip_id = isset($_GET['trip_id']) ? $_GET['trip_id'] : '';
            $stmt = $pdo->prepare("SELECT ts.*, u.full_name, u.email FROM trip_shares ts LEFT JOIN users u ON ts.shared_with = u.username WHERE ts.trip_id = ?");
            $stmt->execute([$trip_id]);
            $shares = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'shares' => $shares]);
            break;
        }

        case 'remove_share': {
            $trip_id = isset($input['trip_id']) ? $input['trip_id'] : '';
            $shared_with = isset($input['shared_with']) ? $input['shared_with'] : '';
            $stmt = $pdo->prepare("DELETE FROM trip_shares WHERE trip_id = ? AND shared_with = ?");
            $stmt->execute([$trip_id, $shared_with]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'export_trip': {
            $trip_id = isset($_GET['trip_id']) ? $_GET['trip_id'] : '';
            $stmt = $pdo->prepare("SELECT * FROM trips WHERE id = ?");
            $stmt->execute([$trip_id]);
            $trip = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$trip) {
                echo json_encode(['success' => false, 'message' => 'Trip not found']);
                break;
            }

            $stmt = $pdo->prepare("SELECT * FROM schedules WHERE trip_id = ? ORDER BY date");
            $stmt->execute([$trip_id]);
            $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $stmt = $pdo->prepare("SELECT * FROM friends WHERE trip_id = ?");
            $stmt->execute([$trip_id]);
            $friends = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $trip['totalPlanBudget'] = (float)($trip['totalplanbudget'] ?? $trip['totalPlanBudget'] ?? 0);
            $trip['tripCode'] = $trip['tripcode'] ?? $trip['tripCode'] ?? '';
            unset($trip['totalplanbudget'], $trip['tripcode']);

            foreach($schedules as &$s) {
                $s['isCompleted'] = (bool)($s['iscompleted'] ?? $s['isCompleted'] ?? 0);
                $s['planBudget'] = (float)($s['planbudget'] ?? $s['planBudget'] ?? 0);
                $s['realBudget'] = (float)($s['realbudget'] ?? $s['realBudget'] ?? 0);
                $s['imageUrl'] = $s['imageurl'] ?? $s['imageUrl'] ?? null;
                // Decode photos JSON for export
                if ($s['imageUrl']) {
                    $decoded = json_decode($s['imageUrl'], true);
                    $s['photos'] = is_array($decoded) ? $decoded : [$s['imageUrl']];
                } else {
                    $s['photos'] = [];
                }
                unset($s['iscompleted'], $s['planbudget'], $s['realbudget'], $s['imageurl']);
            }

            $exportData = [
                'version' => '1.0',
                'exported_at' => date('Y-m-d H:i:s'),
                'trip' => $trip,
                'schedules' => $schedules,
                'friends' => $friends
            ];

            echo json_encode(['success' => true, 'data' => $exportData]);
            break;
        }

        case 'import_trip': {
            $owner = isset($input['owner']) ? $input['owner'] : '';
            $importData = isset($input['data']) ? $input['data'] : null;

            if (!isset($importData['trip']) || !isset($importData['schedules'])) {
                echo json_encode(['success' => false, 'message' => 'Invalid import data']);
                break;
            }

            $newTripId = generateId();
            $newTripCode = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

            $stmt = $pdo->prepare("INSERT INTO trips (id, owner, name, totalPlanBudget, tripCode, category_id) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $newTripId, $owner,
                $importData['trip']['name'] . ' (Imported)',
                $importData['trip']['totalPlanBudget'],
                $newTripCode,
                isset($importData['trip']['category_id']) ? $importData['trip']['category_id'] : null
            ]);

            foreach ($importData['schedules'] as $schedule) {
                $newScheduleId = generateId();
                $stmt = $pdo->prepare("INSERT INTO schedules (id, trip_id, date, time, title, planBudget, realBudget, isCompleted, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $newScheduleId, $newTripId,
                    $schedule['date'], 
                    isset($schedule['time']) ? $schedule['time'] : null,
                    $schedule['title'], $schedule['planBudget'],
                    isset($schedule['realBudget']) ? $schedule['realBudget'] : 0,
                    isset($schedule['isCompleted']) && $schedule['isCompleted'] ? 1 : 0,
                    isset($schedule['imageUrl']) ? $schedule['imageUrl'] : null
                ]);
            }

            if (isset($importData['friends'])) {
                foreach ($importData['friends'] as $friend) {
                    $stmt = $pdo->prepare("INSERT INTO friends (id, trip_id, name, email) VALUES (?, ?, ?, ?)");
                    $stmt->execute([generateId(), $newTripId, $friend['name'], $friend['email']]);
                }
            }

            echo json_encode(['success' => true, 'trip_id' => $newTripId]);
            break;
        }

        case 'get_notifications': {
            $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : '';
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?");
            $stmt->execute([$user_id, $limit]);
            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($notifications as &$n) {
                $n['is_read'] = (bool)$n['is_read'];
                if ($n['data']) {
                    $n['data'] = json_decode($n['data'], true);
                }
            }
            echo json_encode(['success' => true, 'notifications' => $notifications]);
            break;
        }

        case 'mark_notification_read': {
            $id = isset($input['id']) ? $input['id'] : '';
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'mark_all_notifications_read': {
            $user_id = isset($input['user_id']) ? $input['user_id'] : '';
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?");
            $stmt->execute([$user_id]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'get_unread_count': {
            $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : '';
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0");
            $stmt->execute([$user_id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'count' => (int)$result['count']]);
            break;
        }

        case 'get_profile': {
            $username = isset($_GET['username']) ? $_GET['username'] : '';
            $stmt = $pdo->prepare("SELECT id, username, email, full_name, avatar, created_at FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user) {
                unset($user['id']);
                echo json_encode(['success' => true, 'profile' => $user]);
            } else {
                echo json_encode(['success' => false, 'message' => 'User not found']);
            }
            break;
        }

        case 'update_profile': {
            $username = isset($input['username']) ? $input['username'] : '';
            $full_name = isset($input['full_name']) ? $input['full_name'] : null;
            $email = isset($input['email']) ? $input['email'] : null;
            $avatar = isset($input['avatar']) ? $input['avatar'] : null;

            $stmt = $pdo->prepare("UPDATE users SET full_name = ?, email = ?, avatar = ? WHERE username = ?");
            $stmt->execute([$full_name, $email, $avatar, $username]);
            echo json_encode(['success' => true]);
            break;
        }

        case 'change_password': {
            $username = isset($input['username']) ? $input['username'] : '';
            $old_password = isset($input['old_password']) ? $input['old_password'] : '';
            $new_password = isset($input['new_password']) ? $input['new_password'] : '';

            $stmt = $pdo->prepare("SELECT password FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($old_password, $user['password'])) {
                echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
                break;
            }

            $hashedPassword = password_hash($new_password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE username = ?");
            $stmt->execute([$hashedPassword, $username]);
            echo json_encode(['success' => true]);
            break;
        }

        default:
            echo json_encode(['success' => false, 'message' => 'Unknown action: ' . $action]);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
