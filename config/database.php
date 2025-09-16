<?php
// Database configuration for InfinityFree
class Database {
    private $host = 'sql105.infinityfree.com';
    private $db_name = 'if0_39847784_connections';
    private $username = 'if0_39847784';
    private $password = 'O5kkBVmu90R9I';
    private $conn;

    public function getConnection() {
        $this->conn = null;
        
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password,
                array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
            );
        } catch(PDOException $exception) {
            echo "Connection error: " . $exception->getMessage();
        }
        
        return $this->conn;
    }
}
?>