<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

class FilesAPI {
    private $db;
    private $conn;
    private $uploadDir = '../uploads/';
    private $maxFileSize = 52428800; // 50MB
    private $userQuota = 52428800; // 50MB per user

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        
        // Create uploads directory if it doesn't exist
        if (!file_exists($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }
    }

    public function handleRequest() {
        $user = $this->authenticateUser();
        if (!$user) {
            $this->sendResponse(['success' => false, 'message' => 'Unauthorized'], 401);
            return;
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        switch ($method) {
            case 'POST':
                if ($action === 'upload') {
                    $this->uploadFile($user);
                } elseif ($action === 'text') {
                    $this->saveText($user);
                }
                break;
            case 'GET':
                if ($action === 'list') {
                    $this->listFiles($user);
                } elseif ($action === 'download') {
                    $this->downloadFile($user);
                } elseif ($action === 'admin-users' && $user['username'] === 'csjjpfp') {
                    $this->getAdminUsers();
                } elseif ($action === 'admin-user-files' && $user['username'] === 'csjjpfp') {
                    $this->getAdminUserFiles();
                }
                break;
            case 'DELETE':
                $this->deleteFile($user);
                break;
        }
    }

    private function authenticateUser() {
        $headers = getallheaders();
        $token = $headers['Authorization'] ?? '';
        $token = str_replace('Bearer ', '', $token);

        if (empty($token)) {
            return null;
        }

        try {
            $query = "SELECT u.id, u.username, u.storage_used FROM users u 
                     JOIN user_sessions s ON u.id = s.user_id 
                     WHERE s.session_token = :token AND s.expires_at > NOW()";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            return null;
        }
    }

    private function uploadFile($user) {
        if (!isset($_FILES['file'])) {
            $this->sendResponse(['success' => false, 'message' => 'No file uploaded']);
            return;
        }

        $file = $_FILES['file'];
        
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $this->sendResponse(['success' => false, 'message' => 'Upload error']);
            return;
        }

        if ($file['size'] > $this->maxFileSize) {
            $this->sendResponse(['success' => false, 'message' => 'File too large']);
            return;
        }

        if ($user['storage_used'] + $file['size'] > $this->userQuota) {
            $this->sendResponse(['success' => false, 'message' => 'Storage quota exceeded']);
            return;
        }

        try {
            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = uniqid() . '_' . time() . '.' . $extension;
            $filepath = $this->uploadDir . $filename;

            if (move_uploaded_file($file['tmp_name'], $filepath)) {
                // Save to database
                $query = "INSERT INTO files (user_id, filename, original_name, file_type, file_size, file_path) 
                         VALUES (:user_id, :filename, :original_name, :file_type, :file_size, :file_path)";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':user_id', $user['id']);
                $stmt->bindParam(':filename', $filename);
                $stmt->bindParam(':original_name', $file['name']);
                $stmt->bindParam(':file_type', $file['type']);
                $stmt->bindParam(':file_size', $file['size']);
                $stmt->bindParam(':file_path', $filepath);
                $stmt->execute();

                // Update user storage
                $updateQuery = "UPDATE users SET storage_used = storage_used + :size WHERE id = :user_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':size', $file['size']);
                $updateStmt->bindParam(':user_id', $user['id']);
                $updateStmt->execute();

                $this->sendResponse(['success' => true, 'message' => 'File uploaded successfully']);
            } else {
                $this->sendResponse(['success' => false, 'message' => 'Failed to save file']);
            }
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Upload failed']);
        }
    }

    private function saveText($user) {
        $data = json_decode(file_get_contents('php://input'), true);
        $text = $data['text'] ?? '';

        if (empty($text)) {
            $this->sendResponse(['success' => false, 'message' => 'No text provided']);
            return;
        }

        $textSize = strlen($text);
        
        if ($user['storage_used'] + $textSize > $this->userQuota) {
            $this->sendResponse(['success' => false, 'message' => 'Storage quota exceeded']);
            return;
        }

        try {
            // Save text as file
            $filename = 'text_' . uniqid() . '_' . time() . '.txt';
            $filepath = $this->uploadDir . $filename;
            
            if (file_put_contents($filepath, $text)) {
                // Save to database
                $query = "INSERT INTO files (user_id, filename, original_name, file_type, file_size, file_path, is_text_snippet) 
                         VALUES (:user_id, :filename, :original_name, 'text/plain', :file_size, :file_path, 1)";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':user_id', $user['id']);
                $stmt->bindParam(':filename', $filename);
                $stmt->bindParam(':original_name', 'text-snippet-' . time() . '.txt');
                $stmt->bindParam(':file_size', $textSize);
                $stmt->bindParam(':file_path', $filepath);
                $stmt->execute();

                // Update user storage
                $updateQuery = "UPDATE users SET storage_used = storage_used + :size WHERE id = :user_id";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bindParam(':size', $textSize);
                $updateStmt->bindParam(':user_id', $user['id']);
                $updateStmt->execute();

                $this->sendResponse(['success' => true, 'message' => 'Text saved successfully']);
            } else {
                $this->sendResponse(['success' => false, 'message' => 'Failed to save text']);
            }
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Save failed']);
        }
    }

    private function listFiles($user) {
        try {
            $query = "SELECT id, filename, original_name, file_type, file_size, is_text_snippet, created_at 
                     FROM files WHERE user_id = :user_id ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $user['id']);
            $stmt->execute();

            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $this->sendResponse(['success' => true, 'files' => $files]);
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Failed to fetch files']);
        }
    }

    private function downloadFile($user) {
        $fileId = $_GET['id'] ?? '';
        
        if (empty($fileId)) {
            $this->sendResponse(['success' => false, 'message' => 'File ID required']);
            return;
        }

        try {
            $query = "SELECT * FROM files WHERE id = :id AND user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $fileId);
            $stmt->bindParam(':user_id', $user['id']);
            $stmt->execute();

            $file = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$file || !file_exists($file['file_path'])) {
                $this->sendResponse(['success' => false, 'message' => 'File not found']);
                return;
            }

            // Set appropriate headers
            header('Content-Type: ' . $file['file_type']);
            header('Content-Disposition: attachment; filename="' . $file['original_name'] . '"');
            header('Content-Length: ' . $file['file_size']);
            
            readfile($file['file_path']);
            exit;

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Download failed']);
        }
    }

    private function deleteFile($user) {
        $fileId = $_GET['id'] ?? '';
        
        if (empty($fileId)) {
            $this->sendResponse(['success' => false, 'message' => 'File ID required']);
            return;
        }

        try {
            $query = "SELECT * FROM files WHERE id = :id AND user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $fileId);
            $stmt->bindParam(':user_id', $user['id']);
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
            $deleteQuery = "DELETE FROM files WHERE id = :id";
            $deleteStmt = $this->conn->prepare($deleteQuery);
            $deleteStmt->bindParam(':id', $fileId);
            $deleteStmt->execute();

            // Update user storage
            $updateQuery = "UPDATE users SET storage_used = storage_used - :size WHERE id = :user_id";
            $updateStmt = $this->conn->prepare($updateQuery);
            $updateStmt->bindParam(':size', $file['file_size']);
            $updateStmt->bindParam(':user_id', $user['id']);
            $updateStmt->execute();

            $this->sendResponse(['success' => true, 'message' => 'File deleted successfully']);

        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Delete failed']);
        }
    }

    private function getAdminUsers() {
        try {
            $query = "SELECT id, username, storage_used, created_at,
                     (SELECT COUNT(*) FROM files WHERE user_id = users.id) as file_count
                     FROM users WHERE username != 'csjjpfp' ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();

            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $this->sendResponse(['success' => true, 'users' => $users]);
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Failed to fetch users']);
        }
    }

    private function getAdminUserFiles() {
        $userId = $_GET['user_id'] ?? '';
        
        if (empty($userId)) {
            $this->sendResponse(['success' => false, 'message' => 'User ID required']);
            return;
        }

        try {
            $query = "SELECT f.*, u.username FROM files f 
                     JOIN users u ON f.user_id = u.id 
                     WHERE f.user_id = :user_id ORDER BY f.created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();

            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $this->sendResponse(['success' => true, 'files' => $files]);
        } catch (Exception $e) {
            $this->sendResponse(['success' => false, 'message' => 'Failed to fetch user files']);
        }
    }

    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
}

$api = new FilesAPI();
$api->handleRequest();
?>