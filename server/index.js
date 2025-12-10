import express from 'express';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { initializeDatabase } from './db.js';
import { setupSocket } from './socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files in production
if (isProduction) {
    const distDir = path.join(__dirname, '..', 'dist');
    app.use(express.static(distDir));
}

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Default route for server health check
app.get('/', (req, res) => {
    res.send('Chat Server is running. Use Socket.io client to connect.');
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the URL to access the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
});

// Avatar upload endpoint
app.post('/api/avatar', upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    try {
        const { getDb } = await import('./db.js');
        const db = getDb();
        await db.run('UPDATE users SET avatar_url = ? WHERE username = ?', avatarUrl, username);
        res.json({ url: avatarUrl });
    } catch (e) {
        console.error('Avatar update error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Message search endpoint
app.get('/api/search', async (req, res) => {
    const { q, channelId } = req.query;
    if (!q) {
        return res.json({ results: [] });
    }
    try {
        const { getDb } = await import('./db.js');
        const db = getDb();
        const results = await db.all(
            `SELECT * FROM messages 
             WHERE channel_id = ? AND text LIKE ? 
             ORDER BY timestamp DESC LIMIT 50`,
            channelId, `%${q}%`
        );
        res.json({ results });
    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Catch-all route to serve frontend in production (must be after all API routes)
if (isProduction) {
    app.get('*', (req, res) => {
        const distDir = path.join(__dirname, '..', 'dist');
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

// Use HTTP in production (Zeabur handles SSL), HTTPS in development
let server;
if (isProduction) {
    server = createHttpServer(app);
} else {
    const httpsOptions = {
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    };
    server = createHttpsServer(httpsOptions, app);
}

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize DB then start server
initializeDatabase().then(() => {
    // Setup socket events after DB is ready
    setupSocket(io);

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`SERVER RUNNING ON PORT ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
