const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// ============= AUTH MIDDLEWARE =============
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// ============= AUTH ROUTES =============
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const id = 'u' + Date.now();
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(
        'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)',
        [id, username, hashedPassword, 'user'],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            
            const token = jwt.sign(
                { id, username, role: 'user' },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            res.json({
                token,
                user: { id, username, role: 'user' }
            });
        }
    );
});

// ============= POSTS ROUTES =============
app.get('/api/posts', (req, res) => {
    db.all(`
        SELECT p.*, 
               COUNT(r.id) as reaction_count,
               GROUP_CONCAT(r.type) as reaction_types
        FROM posts p
        LEFT JOIN reactions r ON p.id = r.post_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `, (err, posts) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(posts);
    });
});

app.post('/api/posts', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can create posts' });
    }
    
    const { title, content } = req.body;
    const id = 'p' + Date.now();
    
    db.run(
        'INSERT INTO posts (id, title, content, user_id) VALUES (?, ?, ?, ?)',
        [id, title, content, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id, title, content, created_at: new Date().toISOString() });
        }
    );
});

app.put('/api/posts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can edit posts' });
    }
    
    const { title, content } = req.body;
    const { id } = req.params;
    
    db.run(
        'UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, content, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

app.delete('/api/posts/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can delete posts' });
    }
    
    const { id } = req.params;
    
    db.run('DELETE FROM posts WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ============= MESSAGES ROUTES - এখানে মেসেজ সেভ হবে! =============
app.get('/api/messages', authenticateToken, (req, res) => {
    let query = 'SELECT * FROM messages ORDER BY timestamp DESC';
    let params = [];
    
    if (req.user.role !== 'admin') {
        query = 'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC';
        params = [req.user.id];
    }
    
    db.all(query, params, (err, messages) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(messages);
    });
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Message text required' });
    }
    
    const id = 'msg' + Date.now() + Math.random().toString(36).substr(2, 6);
    
    db.run(
        'INSERT INTO messages (id, user_id, username, text, timestamp) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, req.user.username, text.trim(), new Date().toISOString()],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                id, 
                user_id: req.user.id, 
                username: req.user.username, 
                text: text.trim(),
                timestamp: new Date().toISOString()
            });
        }
    );
});

// ============= REACTIONS ROUTES =============
app.post('/api/reactions', authenticateToken, (req, res) => {
    const { post_id, type } = req.body;
    
    db.get(
        'SELECT * FROM reactions WHERE post_id = ? AND user_id = ?',
        [post_id, req.user.id],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (existing) {
                // Remove existing reaction
                db.run(
                    'DELETE FROM reactions WHERE post_id = ? AND user_id = ?',
                    [post_id, req.user.id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ action: 'removed', type: existing.type });
                    }
                );
            } else {
                // Add new reaction
                const id = 'r' + Date.now() + Math.random().toString(36).substr(2, 6);
                db.run(
                    'INSERT INTO reactions (id, post_id, user_id, type) VALUES (?, ?, ?, ?)',
                    [id, post_id, req.user.id, type],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ action: 'added', type });
                    }
                );
            }
        }
    );
});

app.get('/api/reactions/:post_id', (req, res) => {
    const { post_id } = req.params;
    
    db.all(
        'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = ? GROUP BY type',
        [post_id],
        (err, reactions) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(reactions);
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});