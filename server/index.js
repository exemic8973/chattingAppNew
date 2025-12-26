import express from 'express';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './db.js';
import { setupSocket } from './socket.js';
import logger, { createRequestLogger, logRateLimit, logFileUpload, logError } from './logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors());
app.use(createRequestLogger());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Rate limit hit handler removed - not supported in this version

// Apply stricter rate limiting to auth-related endpoints
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

// Apply upload rate limiting
app.use('/api/upload', uploadLimiter);
app.use('/api/avatar', uploadLimiter);

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

// Allowed MIME types for security
const ALLOWED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed'
];

// Allowed file extensions as additional validation
const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.rar'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit (reduced from 50MB)

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        // Check MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`), false);
        }

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new Error(`Invalid file extension: ${ext}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
        }

        // Additional security: check for file signature (magic bytes)
        // This prevents file type spoofing
        const allowedMimeForExt = ALLOWED_MIME_TYPES.filter(mime => ALLOWED_EXTENSIONS.includes(ext));
        if (!allowedMimeForExt.includes(file.mimetype)) {
            return cb(new Error('File type mismatch. File extension does not match content type.'), false);
        }

        cb(null, true);
    }
});

// Default route for server health check
app.get('/', (req, res) => {
    res.send('Chat Server is running. Use Socket.io client to connect.');
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        logger.warn('File upload attempted without file', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Log successful file upload
    logFileUpload(req.file.filename, req.body.username || 'anonymous', {
        size: req.file.size,
        mimetype: req.file.mimetype,
        ip: req.ip
    });

    // Return the URL to access the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
});

// Multer error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files uploaded' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    if (err) {
        // Handle custom file filter errors
        if (err.message.includes('Invalid file type') || err.message.includes('Invalid file extension')) {
            return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Server error during file upload' });
    }

    next();
});

// Avatar upload endpoint (images only)
app.post('/api/avatar', upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate that avatar is an image
    const allowedImageMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    if (!allowedImageMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Avatar must be an image file (JPG, PNG, GIF, or WebP)' });
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

// Error logging endpoint
app.post('/api/log-error', async (req, res) => {
    try {
        const { message, stack, componentStack, timestamp, userAgent, url } = req.body;
        
        // Log client error with structured format
        logger.error('CLIENT_ERROR', {
            message,
            stack,
            componentStack,
            timestamp,
            userAgent,
            url,
            ip: req.ip
        });

        res.json({ success: true });
    } catch (e) {
        logError(e, { context: 'Error logging endpoint failed' });
        res.status(500).json({ error: 'Failed to log error' });
    }
});

// Catch-all route to serve frontend in production (must be after all API routes)
// Express 5.x compatible syntax
if (isProduction) {
    app.use((req, res) => {
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
    logger.info('Database initialized successfully');
    
    // Setup socket events after DB is ready
    setupSocket(io);

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        logger.info(`Server started successfully`, {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            platform: process.platform
        });
    });
}).catch(err => {
    logError(err, { context: 'Database initialization failed' });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logError(error, { context: 'Uncaught Exception' });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    // logError(new Error(reason), { 
    //     context: 'Unhandled Promise Rejection',
    //     promise: promise.toString()
    // });
    process.exit(1);
});
