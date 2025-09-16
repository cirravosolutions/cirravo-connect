# CirravoConnect - InfinityFree Deployment Guide

## Prerequisites
1. InfinityFree hosting account
2. MySQL database created in your hosting panel
3. FTP client or File Manager access

## Deployment Steps

### 1. Database Setup
1. Log into your InfinityFree control panel
2. Go to MySQL Databases and create a new database
3. Note down your database credentials:
   - Host (usually sql200.infinityfree.com or similar)
   - Database name (format: if0_xxxxxxxx_cirravoconnect)
   - Username (format: if0_xxxxxxxx)
   - Password

### 2. Configure Database Connection
1. Edit `config/database.php`
2. Replace the placeholder values with your actual database credentials:
   ```php
   private $host = 'your_mysql_host';
   private $db_name = 'your_database_name';
   private $username = 'your_database_username';
   private $password = 'your_database_password';
   ```

### 3. Upload Files
Upload all PHP files to your InfinityFree public_html directory:
```
public_html/
├── api/
│   ├── auth.php
│   ├── files.php
│   └── admin.php
├── config/
│   └── database.php
├── uploads/ (create this directory)
├── index.html
├── index.css
├── index.tsx (if using TypeScript compilation)
└── .htaccess
```

### 4. Set Up Database Schema
1. Access your MySQL database through phpMyAdmin (available in InfinityFree control panel)
2. Run the SQL commands from `database/schema.sql`
3. This will create the necessary tables and insert the admin user

### 5. Set Directory Permissions
Ensure the `uploads/` directory has write permissions (755 or 777)

### 6. Update Frontend Configuration
You'll need to update your frontend JavaScript to use the PHP API endpoints instead of IndexedDB.

## API Endpoints

### Authentication
- `POST /api/auth.php?action=login` - User login
- `POST /api/auth.php?action=register` - User registration
- `POST /api/auth.php?action=logout` - User logout
- `GET /api/auth.php?action=verify` - Verify session token

### File Management
- `POST /api/files.php?action=upload` - Upload file
- `POST /api/files.php?action=text` - Save text snippet
- `GET /api/files.php?action=list` - List user files
- `GET /api/files.php?action=download&id=X` - Download file
- `DELETE /api/files.php?id=X` - Delete file

### Admin Functions
- `GET /api/files.php?action=admin-users` - Get all users (admin only)
- `GET /api/files.php?action=admin-user-files&user_id=X` - Get user files (admin only)
- `DELETE /api/admin.php?action=user&user_id=X` - Delete user (admin only)
- `DELETE /api/admin.php?action=file&file_id=X` - Delete user file (admin only)

## Security Notes
1. The admin password is hashed using PHP's password_hash()
2. Session tokens are generated using cryptographically secure random bytes
3. File uploads are validated for size and type
4. SQL injection protection through prepared statements
5. CORS headers are configured for cross-origin requests

## Default Admin Credentials
- Username: csjjpfp
- Password: yadavGIRI@7499

## Storage Limits
- Per user quota: 50MB
- Maximum file size: 50MB
- Session expiry: 30 days

## Troubleshooting
1. Check PHP error logs in your hosting control panel
2. Ensure database credentials are correct
3. Verify file permissions on uploads directory
4. Check that all required PHP extensions are enabled (PDO, MySQL)