<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

class AdminAPI {
    private $db;
    private $conn;
    private $uploadDir = '../uploads/';

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    public function handleRequest() {
        $user = $this->authenticateAdmin();
        if (!$user) {
            $this->sendResponse(['success' => false, 'message' => 'Admin access required'], 403);
            return;
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        switch ($method) {
            case 'DELETE':
                if ($action === 'user') {
                    $this->deleteUser();
                } elseif ($action === 'file') {
                    $this->deleteUserFile();
                }
                break;
            case 'GET':
                if ($action === 'stats') {
                    $this->getSystemStats();
                }
                break;
        }
    }

    private function authenticateAdmin() {
        $headers = getallheaders();
        $token = $headers['Authorization'] ?? '';
        $token = str_replace('Bearer ', '', $token);

        if (empty($token)) {
            return null;
        }

        try {
            $query = "SELECT u.id, u.username, u.storage_used FROM users u 
                     JOIN user_sessions s ON u.id = s.user_id 
                     WHERE s.session_token = :token AND s.expires_at > NOW() AND u.username = 'csjjpfp'";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            return null;
        }
    }

    private function deleteUser() {
        $userId = $_GET['user_id'] ?? '';
        
        if (empty($userId)) {
            $this->sendResponse(['success' => false, 'message' => 'User ID required']);
            return;
        }

        try {
            // Get user files to delete from filesystem
            $filesQuery = "SELECT file_path FROM files WHERE user_id = :user_id";
            $filesStmt = $this->conn->prepare($filesQuery);
            $filesStmt->bindParam(':user_id', $userId);
            $filesStmt->execute();
            
            $files = $filesStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Delete files from filesystem
            foreach ($files as $file) {
                if (file_exists($file['file_path'])) {
                    unlink($file['file_path']);
                }
            }

            // Delete user (CASCADE will handle files and sessions)
            $deleteQuery = "DELETE FROM users WHERE id = :user_id AND username != 'csjjpfp'";
            $deleteStmt = $this->conn->prepare($deleteQuery);
            $deleteStmt->bindParam(':user_id', $userId);
            $deleteStmt->execute();

            if ($deleteStmt->rowCount() > 0) {
                $this->sendResponse(['success' => true, 'message' => 'User deleted successfully']);
            } else {
                $this->sendResponse(['success' => false, 'message' => 'User not found or cannot delete admin']);
            }

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Delete failed']);
        }
    }

    private function deleteUserFile() {
        $fileId = $_GET['file_id'] ?? '';
        
        if (empty($fileId)) {
            $this->sendResponse(['success' => false, 'message' => 'File ID required']);
            return;
        }

        try {
            $query = "SELECT f.*, u.username FROM files f 
                     JOIN users u ON f.user_id = u.id 
                     WHERE f.id = :file_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':file_id', $fileId);
            $stmt->execute();

            $file = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$file) {
                $this->sendResponse(['success' => false, 'message' => 'File not found']);
                return;
            }

            // Delete file from filesystem
            if (file_exists($file['file_path'])) {
                unlink($file['file_path']);
            }

            // Delete from database
            $deleteQuery = "DELETE FROM files WHERE id = :file_id";
            $deleteStmt = $this->conn->prepare($deleteQuery);
            $deleteStmt->bindParam(':file_id', $fileId);
            $deleteStmt->execute();

            // Update user storage
            $updateQuery = "UPDATE users SET storage_used = storage_used - :size WHERE id = :user_id";
            $updateStmt = $this->conn->prepare($updateQuery);
            $updateStmt->bindParam(':size', $file['file_size']);
            $updateStmt->bindParam(':user_id', $file['user_id']);
            $updateStmt->execute();

            $this->sendResponse(['success' => true, 'message' => 'File deleted successfully']);

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Delete failed']);
        }
    }

    private function getSystemStats() {
        try {
            $statsQuery = "SELECT 
                (SELECT COUNT(*) FROM users WHERE username != 'csjjpfp') as total_users,
                (SELECT COUNT(*) FROM files) as total_files,
                (SELECT SUM(storage_used) FROM users) as total_storage_used,
                (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()) as active_sessions";
            
            $stmt = $this->conn->prepare($statsQuery);
            $stmt->execute();
            
            $stats = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $this->sendResponse(['success' => true, 'stats' => $stats]);
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Failed to fetch stats']);
        }
    }

    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}

$api = new AdminAPI();
$api->handleRequest();
?>