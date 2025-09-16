/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TYPES & CONSTANTS ---
const STORAGE_KEY = 'cirravoConnectData';
const THEME_KEY = 'cirravoConnectTheme';
const ADMIN_USERNAME = 'csjjpfp';
const ADMIN_PASSWORD = 'yadavGIRI@7499';
const USER_QUOTA_MB = 50;
const USER_QUOTA_BYTES = USER_QUOTA_MB * 1024 * 1024;

interface StoredFile {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string; // Base64 for files, plain text for snippets
}

interface User {
    id: string;
    username: string;
    password?: string; // Password is now optional
    storageUsed: number;
    files: StoredFile[];
}

interface AppData {
    users: User[];
    currentUser: string | null; // Stores the current user's ID
}

// --- DOM ELEMENTS ---
const root = document.getElementById('root') as HTMLElement;

// --- STATE MANAGEMENT ---
let state: AppData = {
    users: [],
    currentUser: null,
};

// --- DATABASE (IndexedDB) ABSTRACTION ---
const DB_NAME = 'CirravoConnectDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';
const STATE_KEY = 'mainState';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(`Error opening IndexedDB: ${request.error}`);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const db = {
    load: async (): Promise<AppData> => {
        try {
            const dbInstance = await openDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(STATE_KEY);

            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result && request.result.data) {
                        const parsedData = request.result.data;
                         if (parsedData.users && Array.isArray(parsedData.users)) {
                            resolve(parsedData);
                        } else {
                             resolve({ users: [], currentUser: null });
                        }
                    } else {
                        resolve({ users: [], currentUser: null });
                    }
                };
                request.onerror = () => {
                     console.error("Failed to load data from IndexedDB", request.error);
                     resolve({ users: [], currentUser: null }); // Resolve with default on error
                };
            });
        } catch (error) {
            console.error("Failed to initialize IndexedDB", error);
            // Fallback for browsers that might not support it well.
            return { users: [], currentUser: null };
        }
    },
    save: async () => {
        try {
            const dbInstance = await openDB();
            const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.put({ id: STATE_KEY, data: state });

            return new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => {
                    console.error("Failed to save data to IndexedDB", transaction.error);
                    alert("Could not save data. There was a database error.");
                    reject(transaction.error);
                };
            });
        } catch (error) {
            console.error("Failed to save data to IndexedDB", error);
            alert("Could not save data. Your browser's storage might be full or unsupported.");
        }
    }
};

// --- THEME MANAGEMENT ---
const applyTheme = (theme: 'light' | 'dark') => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.innerHTML = theme === 'dark' 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>` // Moon
            : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`; // Sun
    }
};

const toggleTheme = () => {
    const currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
};

const loadInitialTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    applyTheme(savedTheme || 'dark'); // Default to dark
};


// --- UTILITY FUNCTIONS ---
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const downloadFile = (file: StoredFile) => {
    const link = document.createElement('a');
    link.href = file.content;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- RENDER FUNCTIONS ---
const clearRoot = () => {
    root.innerHTML = '';
};

const renderHeader = (user: User | null) => {
    const header = document.createElement('header');
    header.className = 'header';

    const title = document.createElement('h1');
    title.textContent = 'CirravoConnect';
    header.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'header-controls';

    if (user) {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `<span>Welcome, <strong>${user.username}</strong></span>`;
        controls.appendChild(userInfo);
        
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Logout';
        logoutButton.className = 'btn btn-secondary';
        logoutButton.style.width = 'auto';
        logoutButton.style.padding = '0.5rem 1rem';
        logoutButton.onclick = async () => {
            state.currentUser = null;
            await db.save();
            render();
        };
        controls.appendChild(logoutButton);
    }
    
    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.className = 'theme-toggle-btn';
    themeToggleBtn.id = 'theme-toggle-btn';
    themeToggleBtn.title = 'Toggle theme';
    themeToggleBtn.onclick = toggleTheme;
    controls.appendChild(themeToggleBtn);
    
    header.appendChild(controls);
    
    // Call applyTheme again to ensure icon is correct after element is in DOM
    applyTheme(localStorage.getItem(THEME_KEY) as 'light' | 'dark' || 'dark');
    return header;
};

const renderLogin = (error?: string) => {
    clearRoot();
    const container = document.createElement('div');
    container.className = 'auth-container';
    container.innerHTML = `
        <form class="auth-form">
            <h2>Login</h2>
            ${error ? `<p class="error-message">${error}</p>` : ''}
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" class="form-control" required>
            </div>
            <div class="form-group" id="password-group" style="display: none;">
                <label for="password">Password</label>
                <input type="password" id="password" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
            <div class="auth-switch">
                <p>No account? <button type="button" id="show-register">Register here</button></p>
            </div>
        </form>
    `;

    root.appendChild(renderHeader(null));
    root.appendChild(container);

    const form = container.querySelector('form') as HTMLFormElement;
    const usernameInput = container.querySelector('#username') as HTMLInputElement;
    const passwordGroup = container.querySelector('#password-group') as HTMLDivElement;
    const passwordInput = container.querySelector('#password') as HTMLInputElement;

    usernameInput.oninput = () => {
        const username = usernameInput.value.trim().toLowerCase();
        const user = state.users.find(u => u.username.toLowerCase() === username);

        if (username === ADMIN_USERNAME || (user && user.password)) {
            passwordGroup.style.display = 'block';
        } else {
            passwordGroup.style.display = 'none';
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        // Admin Login
        if (username.toLowerCase() === ADMIN_USERNAME) {
            if (password === ADMIN_PASSWORD) {
                let admin = state.users.find(u => u.username.toLowerCase() === ADMIN_USERNAME);
                if (!admin) {
                     admin = { id: Date.now().toString(), username: ADMIN_USERNAME, password: ADMIN_PASSWORD, storageUsed: 0, files: [] };
                     state.users.push(admin);
                }
                state.currentUser = admin.id;
                await db.save();
                render();
            } else {
                renderLogin('Invalid admin credentials.');
            }
            return;
        }

        // Regular User Login
        const user = state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            renderLogin('User not found.');
            return;
        }

        if (user.password) {
            // Password required
            if (password === user.password) {
                state.currentUser = user.id;
                await db.save();
                render();
            } else {
                renderLogin('Invalid username or password.');
            }
        } else {
            // No password required
            state.currentUser = user.id;
            await db.save();
            render();
        }
    };
    
    (container.querySelector('#show-register') as HTMLButtonElement).onclick = () => renderRegister();
};

const renderRegister = (error?: string) => {
    clearRoot();
    const container = document.createElement('div');
    container.className = 'auth-container';
    container.innerHTML = `
        <form class="auth-form">
            <h2>Register</h2>
            ${error ? `<p class="error-message">${error}</p>` : ''}
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" class="form-control" required>
            </div>
            <div class="form-group">
                <label for="password">Password (Optional)</label>
                <input type="password" id="password" class="form-control">
            </div>
            <button type="submit" class="btn btn-primary">Register</button>
            <div class="auth-switch">
                <p>Already have an account? <button type="button" id="show-login">Login here</button></p>
            </div>
        </form>
    `;
    root.appendChild(renderHeader(null));
    root.appendChild(container);

    const form = container.querySelector('form') as HTMLFormElement;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = (container.querySelector('#username') as HTMLInputElement).value.trim();
        const password = (container.querySelector('#password') as HTMLInputElement).value;

        if (!username) {
            renderRegister('Username cannot be empty.');
            return;
        }
         if (username.toLowerCase() === ADMIN_USERNAME) {
            renderRegister('This username is reserved.');
            return;
        }
        if (state.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            renderRegister('Username already taken.');
            return;
        }

        const newUser: User = {
            id: Date.now().toString(),
            username,
            storageUsed: 0,
            files: []
        };
        
        if (password) {
            newUser.password = password;
        }

        state.users.push(newUser);
        state.currentUser = newUser.id;
        await db.save();
        render();
    };

    (container.querySelector('#show-login') as HTMLButtonElement).onclick = () => renderLogin();
};

const renderDashboard = (user: User) => {
    clearRoot();
    const container = document.createElement('div');
    container.className = 'container';

    // Storage Quota Card
    const storageCard = document.createElement('div');
    storageCard.className = 'card';
    const usedPercent = (user.storageUsed / USER_QUOTA_BYTES) * 100;
    storageCard.innerHTML = `
        <div class="storage-quota">
             <div class="card-header" style="border: none; padding: 0; margin-bottom: 1rem;">
                <h3>Storage Usage</h3>
            </div>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${usedPercent.toFixed(2)}%;">${usedPercent > 10 ? usedPercent.toFixed(0)+'%' : ''}</div>
            </div>
            <p class="storage-info">${formatBytes(user.storageUsed)} / ${formatBytes(USER_QUOTA_BYTES)} used</p>
        </div>
    `;

    // Upload Card
    const uploadCard = document.createElement('div');
    uploadCard.className = 'card';
    uploadCard.innerHTML = `
        <div class="card-header">
            <h3>Add New File or Text</h3>
        </div>
        <div class="upload-actions">
            <input type="file" id="file-upload" class="form-control">
            <button id="upload-btn" class="btn btn-primary" style="width: auto;">Upload File</button>
        </div>
        <hr style="margin: 1.5rem 0; border-color: var(--border-color);">
        <textarea id="text-snippet" class="form-control text-snippet-area" placeholder="Paste or type your text snippet here..."></textarea>
        <button id="save-text-btn" class="btn btn-primary">Save Text Snippet</button>
    `;

    // Files List Card
    const filesCard = document.createElement('div');
    filesCard.className = 'card';
    filesCard.innerHTML = `
        <div class="card-header"><h3>Your Files</h3></div>
        <table class="file-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = filesCard.querySelector('tbody') as HTMLTableSectionElement;
    if (user.files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No files or text snippets yet.</td></tr>';
    } else {
        user.files.forEach((file, index) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${index * 50}ms`;
            tr.innerHTML = `
                <td data-label="Name">${file.name}</td>
                <td data-label="Type">${file.type}</td>
                <td data-label="Size">${formatBytes(file.size)}</td>
                <td data-label="Actions">
                    <div class="actions">
                        <button class="icon-btn view-btn" title="View/Download">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="icon-btn delete-btn" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            (tr.querySelector('.view-btn') as HTMLElement).onclick = () => viewFile(file);
            (tr.querySelector('.delete-btn') as HTMLElement).onclick = async () => {
                if(confirm(`Are you sure you want to delete "${file.name}"?`)){
                    user.storageUsed -= file.size;
                    user.files = user.files.filter(f => f.id !== file.id);
                    await db.save();
                    render();
                }
            };
            tbody.appendChild(tr);
        });
    }

    root.appendChild(renderHeader(user));
    container.appendChild(storageCard);
    container.appendChild(uploadCard);
    container.appendChild(filesCard);
    root.appendChild(container);

    // Add event listeners for upload card
    (uploadCard.querySelector('#upload-btn') as HTMLButtonElement).onclick = async () => {
        const fileInput = uploadCard.querySelector('#file-upload') as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) {
            alert('Please select a file to upload.');
            return;
        }
        if (user.storageUsed + file.size > USER_QUOTA_BYTES) {
            alert('Upload failed: Not enough storage space.');
            return;
        }
        try {
            const content = await fileToBase64(file);
            const newFile: StoredFile = {
                id: Date.now().toString(),
                name: file.name,
                type: file.type || 'unknown',
                size: file.size,
                content
            };
            user.files.push(newFile);
            user.storageUsed += file.size;
            await db.save();
            render();
        } catch (error) {
            alert('Failed to read file.');
            console.error(error);
        }
    };
    
    (uploadCard.querySelector('#save-text-btn') as HTMLButtonElement).onclick = async () => {
        const textArea = uploadCard.querySelector('#text-snippet') as HTMLTextAreaElement;
        const text = textArea.value;
        if (!text.trim()) {
            alert('Please enter some text to save.');
            return;
        }
        const textSize = new Blob([text]).size;
        if (user.storageUsed + textSize > USER_QUOTA_BYTES) {
            alert('Save failed: Not enough storage space.');
            return;
        }

        const newTextFile: StoredFile = {
            id: Date.now().toString(),
            name: `text-snippet-${Date.now()}.txt`,
            type: 'text/plain',
            size: textSize,
            content: `data:text/plain;base64,${btoa(text)}`
        };
        user.files.push(newTextFile);
        user.storageUsed += textSize;
        await db.save();
        render();
    };
};

const renderAdmin = (adminUser: User) => {
    clearRoot();
    const container = document.createElement('div');
    container.className = 'container';

    const usersCard = document.createElement('div');
    usersCard.className = 'card';
    usersCard.innerHTML = `
        <div class="card-header"><h3>All Users</h3></div>
        <table class="file-table">
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Storage Used</th>
                    <th>File Count</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = usersCard.querySelector('tbody') as HTMLTableSectionElement;
    const allUsers = state.users.filter(u => u.id !== adminUser.id);

    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No other users have registered.</td></tr>';
    } else {
        allUsers.forEach((user, index) => {
            const tr = document.createElement('tr');
            tr.style.animationDelay = `${index * 50}ms`;
            tr.innerHTML = `
                <td data-label="Username">${user.username}</td>
                <td data-label="Storage Used">${formatBytes(user.storageUsed)}</td>
                <td data-label="File Count">${user.files.length}</td>
                <td data-label="Actions">
                    <div class="actions">
                        <button class="btn btn-secondary view-files-btn">View Files</button>
                        <button class="btn btn-danger delete-user-btn">Delete</button>
                    </div>
                </td>
            `;
            (tr.querySelector('.view-files-btn') as HTMLElement).onclick = () => renderAdminUserFiles(adminUser, user);
            (tr.querySelector('.delete-user-btn') as HTMLElement).onclick = async () => {
                if(confirm(`Are you sure you want to delete user "${user.username}"? This cannot be undone.`)){
                    state.users = state.users.filter(u => u.id !== user.id);
                    await db.save();
                    render();
                }
            };
            tbody.appendChild(tr);
        });
    }

    root.appendChild(renderHeader(adminUser));
    container.appendChild(usersCard);
    root.appendChild(container);
};

const renderAdminUserFiles = (adminUser: User, targetUser: User) => {
    clearRoot();
    const container = document.createElement('div');
    container.className = 'container';
    
    const backButton = document.createElement('button');
    backButton.className = 'btn btn-secondary';
    backButton.textContent = '← Back to Admin Panel';
    backButton.style.marginBottom = '1.5rem';
    backButton.style.width = 'auto';
    backButton.onclick = () => renderAdmin(adminUser);

    const filesCard = document.createElement('div');
    filesCard.className = 'card';
    filesCard.innerHTML = `
        <div class="card-header"><h3>Files for ${targetUser.username}</h3></div>
        <table class="file-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tbody = filesCard.querySelector('tbody') as HTMLTableSectionElement;
    if (targetUser.files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">This user has no files.</td></tr>';
    } else {
        targetUser.files.forEach(file => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Name">${file.name}</td>
                <td data-label="Type">${file.type}</td>
                <td data-label="Size">${formatBytes(file.size)}</td>
                <td data-label="Actions">
                    <div class="actions">
                        <button class="btn btn-secondary view-btn">View</button>
                        <button class="btn btn-danger delete-btn">Delete</button>
                    </div>
                </td>
            `;
            (tr.querySelector('.view-btn') as HTMLElement).onclick = () => viewFile(file);
            (tr.querySelector('.delete-btn') as HTMLElement).onclick = async () => {
                 if(confirm(`Are you sure you want to delete "${file.name}" from user ${targetUser.username}?`)){
                    targetUser.storageUsed -= file.size;
                    targetUser.files = targetUser.files.filter(f => f.id !== file.id);
                    await db.save();
                    renderAdminUserFiles(adminUser, targetUser); // Re-render this view
                }
            };
            tbody.appendChild(tr);
        });
    }

    root.appendChild(renderHeader(adminUser));
    container.appendChild(backButton);
    container.appendChild(filesCard);
    root.appendChild(container);
};

const viewFile = async (file: StoredFile) => {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    let contentHTML = '';
    if (file.type.startsWith('image/')) {
        contentHTML = `<img src="${file.content}" alt="${file.name}">`;
    } else if (file.type === 'text/plain') {
        const text = atob(file.content.split(',')[1]);
        contentHTML = `<pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    } else {
        contentHTML = `<p>Cannot preview this file type.</p><button id="download-btn-modal" class="btn btn-primary">Download ${file.name}</button>`;
    }
    
    modalContent.innerHTML = `
        <button class="modal-close">&times;</button>
        <h3>${file.name}</h3>
        <hr style="margin: 1rem 0; border-color: var(--border-color);">
        ${contentHTML}
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    };
    (modalContent.querySelector('.modal-close') as HTMLButtonElement).onclick = () => document.body.removeChild(modalOverlay);
    const downloadBtn = modalContent.querySelector('#download-btn-modal');
    if (downloadBtn) {
        (downloadBtn as HTMLButtonElement).onclick = () => downloadFile(file);
    }
};

// --- MAIN RENDER & INIT ---
const render = () => {
    const currentUser = state.users.find(u => u.id === state.currentUser);
    if (currentUser) {
        if (currentUser.username.toLowerCase() === ADMIN_USERNAME) {
            renderAdmin(currentUser);
        } else {
            renderDashboard(currentUser);
        }
    } else {
        renderLogin();
    }
};

const init = async () => {
    loadInitialTheme();
    state = await db.load();
    render();

    // Create and append footer if it doesn't exist
    if (!document.querySelector('body > footer.footer')) {
        const footer = document.createElement('footer');
        footer.className = 'footer';
        footer.innerHTML = `<p>Powered by Cirravo Solutions</p>`;
        document.body.appendChild(footer);
    }
};

// Start the app
init();
