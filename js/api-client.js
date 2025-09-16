// API Client for CirravoConnect PHP Backend
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(username, password) {
        const response = await this.request('/api/auth.php?action=login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.success && response.token) {
            this.token = response.token;
            localStorage.setItem('auth_token', this.token);
        }
        
        return response;
    }

    async register(username, password) {
        const response = await this.request('/api/auth.php?action=register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.success && response.token) {
            this.token = response.token;
            localStorage.setItem('auth_token', this.token);
        }
        
        return response;
    }

    async logout() {
        const response = await this.request('/api/auth.php?action=logout', {
            method: 'POST'
        });
        
        this.token = null;
        localStorage.removeItem('auth_token');
        
        return response;
    }

    async verifySession() {
        if (!this.token) {
            return { success: false, message: 'No token' };
        }
        
        try {
            return await this.request('/api/auth.php?action=verify');
        } catch (error) {
            this.token = null;
            localStorage.removeItem('auth_token');
            return { success: false, message: error.message };
        }
    }

    // File management methods
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        return await this.request('/api/files.php?action=upload', {
            method: 'POST',
            headers: {
                // Remove Content-Type to let browser set it with boundary
                Authorization: `Bearer ${this.token}`
            },
            body: formData
        });
    }

    async saveText(text) {
        return await this.request('/api/files.php?action=text', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    async listFiles() {
        return await this.request('/api/files.php?action=list');
    }

    async downloadFile(fileId) {
        const url = `${this.baseURL}/api/files.php?action=download&id=${fileId}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        return response;
    }

    async deleteFile(fileId) {
        return await this.request(`/api/files.php?id=${fileId}`, {
            method: 'DELETE'
        });
    }

    // Admin methods
    async getAdminUsers() {
        return await this.request('/api/files.php?action=admin-users');
    }

    async getAdminUserFiles(userId) {
        return await this.request(`/api/files.php?action=admin-user-files&user_id=${userId}`);
    }

    async deleteUser(userId) {
        return await this.request(`/api/admin.php?action=user&user_id=${userId}`, {
            method: 'DELETE'
        });
    }

    async deleteUserFile(fileId) {
        return await this.request(`/api/admin.php?action=file&file_id=${fileId}`, {
            method: 'DELETE'
        });
    }

    async getSystemStats() {
        return await this.request('/api/admin.php?action=stats');
    }
}

// Export for use in your main application
window.APIClient = APIClient;