<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

class AuthAPI {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        switch ($method) {
            case 'POST':
                if ($action === 'login') {
                    $this->login();
                } elseif ($action === 'register') {
                    $this->register();
                } elseif ($action === 'logout') {
                    $this->logout();
                }
                break;
            case 'GET':
                if ($action === 'verify') {
                    $this->verifySession();
                }
                break;
        }
    }

    private function login() {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($username)) {
            $this->sendResponse(['success' => false, 'message' => 'Username is required']);
            return;
        }

        try {
            $query = "SELECT id, username, password FROM users WHERE username = :username";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->sendResponse(['success' => false, 'message' => 'User not found']);
                return;
            }

            // Check if password is required
            if ($user['password']) {
                if (empty($password)) {
                    $this->sendResponse(['success' => false, 'message' => 'Password required']);
                    return;
                }
                
                if (!password_verify($password, $user['password'])) {
                    $this->sendResponse(['success' => false, 'message' => 'Invalid credentials']);
                    return;
                }
            }

            // Create session
            $sessionToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

            $sessionQuery = "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (:user_id, :token, :expires)";
            $sessionStmt = $this->conn->prepare($sessionQuery);
            $sessionStmt->bindParam(':user_id', $user['id']);
            $sessionStmt->bindParam(':token', $sessionToken);
            $sessionStmt->bindParam(':expires', $expiresAt);
            $sessionStmt->execute();

            $this->sendResponse([
                'success' => true,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username']
                ],
                'token' => $sessionToken
            ]);

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Login failed']);
        }
    }

    private function register() {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($username)) {
            $this->sendResponse(['success' => false, 'message' => 'Username is required']);
            return;
        }

        if (strtolower($username) === 'csjjpfp') {
            $this->sendResponse(['success' => false, 'message' => 'Username is reserved']);
            return;
        }

        try {
            // Check if username exists
            $checkQuery = "SELECT id FROM users WHERE username = :username";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bindParam(':username', $username);
            $checkStmt->execute();

            if ($checkStmt->fetch()) {
                $this->sendResponse(['success' => false, 'message' => 'Username already taken']);
                return;
            }

            // Create user
            $hashedPassword = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;
            
            $insertQuery = "INSERT INTO users (username, password, storage_used) VALUES (:username, :password, 0)";
            $insertStmt = $this->conn->prepare($insertQuery);
            $insertStmt->bindParam(':username', $username);
            $insertStmt->bindParam(':password', $hashedPassword);
            $insertStmt->execute();

            $userId = $this->conn->lastInsertId();

            // Create session
            $sessionToken = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

            $sessionQuery = "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (:user_id, :token, :expires)";
            $sessionStmt = $this->conn->prepare($sessionQuery);
            $sessionStmt->bindParam(':user_id', $userId);
            $sessionStmt->bindParam(':token', $sessionToken);
            $sessionStmt->bindParam(':expires', $expiresAt);
            $sessionStmt->execute();

            $this->sendResponse([
                'success' => true,
                'user' => [
                    'id' => $userId,
                    'username' => $username
                ],
                'token' => $sessionToken
            ]);

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Registration failed']);
        }
    }

    private function logout() {
        $headers = getallheaders();
        $token = $headers['Authorization'] ?? '';
        $token = str_replace('Bearer ', '', $token);

        if ($token) {
            try {
                $query = "DELETE FROM user_sessions WHERE session_token = :token";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':token', $token);
                $stmt->execute();
            } catch (Exception $e) {
                // Silent fail
            }
        }

        $this->sendResponse(['success' => true]);
    }

    private function verifySession() {
        $headers = getallheaders();
        $token = $headers['Authorization'] ?? '';
        $token = str_replace('Bearer ', '', $token);

        if (empty($token)) {
            $this->sendResponse(['success' => false, 'message' => 'No token provided']);
            return;
        }

        try {
            $query = "SELECT u.id, u.username, u.storage_used FROM users u 
                     JOIN user_sessions s ON u.id = s.user_id 
                     WHERE s.session_token = :token AND s.expires_at > NOW()";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                $this->sendResponse([
                    'success' => true,
                    'user' => $user
                ]);
            } else {
                $this->sendResponse(['success' => false, 'message' => 'Invalid or expired token']);
            }

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Session verification failed']);
        }
    }

    private function sendResponse($data) {
        echo json_encode($data);
        exit;
    }
}

$api = new AuthAPI();
$api->handleRequest();
?>