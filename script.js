const API_URL = 'http://localhost:3000/api';
let token = null;
let currentUser = null;

// ============= API FUNCTIONS =============
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API Error');
    }
    
    return response.json();
}

// ============= AUTH =============
async function login(username, password) {
    const data = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    return data;
}

async function register(username, password) {
    const data = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    return data;
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderUI();
}

// ============= POSTS =============
async function getPosts() {
    return await apiCall('/posts');
}

async function createPost(title, content) {
    return await apiCall('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, content })
    });
}

async function updatePost(id, title, content) {
    return await apiCall(`/posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content })
    });
}

async function deletePost(id) {
    return await apiCall(`/posts/${id}`, { method: 'DELETE' });
}

// ============= MESSAGES - এখানে মেসেজ সার্ভারে সেভ হচ্ছে! =============
async function getMessages() {
    return await apiCall('/messages');
}

async function sendMessage(text) {
    return await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({ text })
    });
}

// ============= REACTIONS =============
async function addReaction(postId, type) {
    return await apiCall('/reactions', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, type })
    });
}

// ============= UI RENDERING =============
let posts = [];
let messages = [];

async function loadData() {
    if (token) {
        try {
            posts = await getPosts();
            messages = await getMessages();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
}

async function renderUI() {
    renderAuth();
    await renderPosts();
    await renderMessages();
    toggleAdminPanel();
    updateCounters();
}

function renderAuth() {
    const authArea = document.getElementById('authArea');
    if (!authArea) return;
    
    if (currentUser) {
        authArea.innerHTML = `
            <div class="user-badge">
                <i class="fas fa-user-circle"></i> ${currentUser.username}
                ${currentUser.role === 'admin' ? '<span style="font-size:0.7rem;">👑</span>' : ''}
            </div>
            <button id="logoutBtn" class="btn btn-outline">Logout</button>
        `;
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    } else {
        authArea.innerHTML = `
            <button id="loginBtn" class="btn btn-primary">Login</button>
            <button id="registerBtn" class="btn btn-outline">Register</button>
        `;
        document.getElementById('loginBtn')?.addEventListener('click', showLoginModal);
        document.getElementById('registerBtn')?.addEventListener('click', showRegisterModal);
    }
}

function showLoginModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Login</h3>
            <input type="text" id="loginUsername" placeholder="Username" style="width:100%; margin-bottom:10px;">
            <input type="password" id="loginPassword" placeholder="Password" style="width:100%; margin-bottom:20px;">
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="closeModal" class="btn btn-outline">Cancel</button>
                <button id="submitLogin" class="btn btn-primary">Login</button>
            </div>
            <div style="margin-top: 10px; font-size:0.8rem; text-align:center;">
                Demo: admin/admin123 | alex_user/user123
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const close = () => modal.remove();
    document.getElementById('closeModal')?.addEventListener('click', close);
    document.getElementById('submitLogin')?.addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        try {
            await login(username, password);
            await loadData();
            await renderUI();
            close();
            showToast(`Welcome ${username}!`);
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });
}

function showRegisterModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Register</h3>
            <input type="text" id="regUsername" placeholder="Username" style="width:100%; margin-bottom:10px;">
            <input type="password" id="regPassword" placeholder="Password" style="width:100%; margin-bottom:20px;">
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="closeModal" class="btn btn-outline">Cancel</button>
                <button id="submitReg" class="btn btn-primary">Register</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const close = () => modal.remove();
    document.getElementById('closeModal')?.addEventListener('click', close);
    document.getElementById('submitReg')?.addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        if (!username || !password) {
            alert('Username and password required');
            return;
        }
        try {
            await register(username, password);
            await loadData();
            await renderUI();
            close();
            showToast(`Welcome ${username}!`);
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    });
}

async function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = '<div class="empty-state">Please login to view posts</div>';
        return;
    }
    
    if (posts.length === 0) {
        container.innerHTML = '<div class="empty-state">No posts yet</div>';
        return;
    }
    
    const isAdmin = currentUser?.role === 'admin';
    
    container.innerHTML = posts.map(post => `
        <div class="post-card">
            <div class="post-title">${escapeHtml(post.title)}</div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            <div class="post-meta">
                <span>${new Date(post.created_at).toLocaleString()}</span>
                ${isAdmin ? `
                    <div>
                        <button class="edit-post btn btn-sm" data-id="${post.id}" style="background:#ffc107; margin-right:5px;">Edit</button>
                        <button class="delete-post btn btn-sm" data-id="${post.id}" style="background:#dc3545; color:white;">Delete</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    if (isAdmin) {
        document.querySelectorAll('.edit-post').forEach(btn => {
            btn.addEventListener('click', () => editPost(btn.dataset.id));
        });
        document.querySelectorAll('.delete-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this post?')) {
                    await deletePost(btn.dataset.id);
                    await loadData();
                    await renderUI();
                    showToast('Post deleted');
                }
            });
        });
    }
}

async function editPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    const newTitle = prompt('Edit title:', post.title);
    if (!newTitle) return;
    const newContent = prompt('Edit content:', post.content);
    if (!newContent) return;
    
    await updatePost(postId, newTitle, newContent);
    await loadData();
    await renderUI();
    showToast('Post updated');
}

async function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = '<div class="empty-state">Please login to view messages</div>';
        return;
    }
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state">No messages yet</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="message-card">
            <div class="message-sender"><i class="fas fa-user"></i> ${escapeHtml(msg.username)}</div>
            <div class="message-text">${escapeHtml(msg.text)}</div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (panel) {
        panel.style.display = currentUser?.role === 'admin' ? 'block' : 'none';
    }
}

function updateCounters() {
    const postCount = document.getElementById('postCount');
    const msgCount = document.getElementById('msgCount');
    if (postCount) postCount.textContent = posts.length;
    if (msgCount) msgCount.textContent = messages.length;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (toast) toast.remove();
    const div = document.createElement('div');
    div.className = 'toast';
    div.innerHTML = `<i class="fas fa-bell"></i> ${msg}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    
    try {
        await sendMessage(text);
        await loadData();
        await renderMessages();
        input.value = '';
        showToast('Message sent to server!');
    } catch (error) {
        alert('Failed to send message: ' + error.message);
    }
}

async function handleCreatePost() {
    const title = document.getElementById('postTitle').value.trim();
    const content = document.getElementById('postContent').value.trim();
    if (!title || !content) {
        alert('Title and content required');
        return;
    }
    
    try {
        await createPost(title, content);
        await loadData();
        await renderPosts();
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        showToast('Post published!');
    } catch (error) {
        alert('Failed to create post: ' + error.message);
    }
}

function bindEvents() {
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }
    
    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }
    
    const createBtn = document.getElementById('createPostBtn');
    if (createBtn) {
        createBtn.addEventListener('click', handleCreatePost);
    }
}

// Check for saved token on load
const savedToken = localStorage.getItem('token');
const savedUser = localStorage.getItem('user');
if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
}

// Initialize
async function init() {
    await loadData();
    await renderUI();
    bindEvents();
    showToast('🚀 Connected to server!');
}

init();