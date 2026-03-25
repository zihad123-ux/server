const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Posts table
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Messages table - যেখানে মেসেজ সেভ হবে!
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Reactions table
    db.run(`
        CREATE TABLE IF NOT EXISTS reactions (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(post_id, user_id)
        )
    `);
    
    // Insert default users
    const bcrypt = require('bcryptjs');
    const defaultUsers = [
        { id: 'u1', username: 'alex_user', password: 'user123', role: 'user' },
        { id: 'u2', username: 'admin', password: 'admin123', role: 'admin' }
    ];
    
    defaultUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        db.run(
            `INSERT OR IGNORE INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
            [user.id, user.username, hashedPassword, user.role]
        );
    });
    
    // Insert default posts
    db.run(`
        INSERT OR IGNORE INTO posts (id, title, content, user_id)
        VALUES 
            ('p1', 'Welcome to CollabSphere', 'Admins share important updates. Users can view posts and send messages!', 'u2'),
            ('p2', 'Platform Guidelines', 'Respectful communication is key. Admins will post announcements regularly.', 'u2')
    `);
    
    console.log('✅ Database initialized');
});

module.exports = db;