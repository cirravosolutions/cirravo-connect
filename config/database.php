<?php
// Database configuration for InfinityFree
class Database {
    private $host = 'sql200.infinityfree.com'; // Replace with your InfinityFree MySQL host
    private $db_name = 'if0_37000000_cirravoconnect'; // Replace with your database name
    private $username = 'if0_37000000'; // Replace with your database username
    private $password = 'your_password'; // Replace with your database password
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