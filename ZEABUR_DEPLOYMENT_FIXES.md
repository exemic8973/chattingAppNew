# Zeabur Deployment - Fix History

## Overview
This document tracks all issues encountered and fixes applied during the Zeabur production deployment process.

---

## Issue #1: PostgreSQL SSL Connection Error
**Date:** 2025-12-10
**Branch:** production

### Error Message:
```
Failed to initialize database: Error: The server does not support SSL connections
```

### Root Cause:
- PostgreSQL connection was forcing SSL with `ssl: { rejectUnauthorized: false }`
- Zeabur's PostgreSQL service doesn't support SSL connections

### Solution:
**File:** `server/db.js` (Lines 34-43)
- Made SSL optional and disabled by default
- Added `DATABASE_SSL` environment variable for opt-in SSL
- SSL defaults to `false` unless explicitly enabled

```javascript
const sslConfig = process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: sslConfig
});
```

**Commit:** `872bff3` - "Fix PostgreSQL SSL connection for Zeabur"

---

## Issue #2: Missing Frontend in Deployment
**Date:** 2025-12-10
**Branch:** production

### Problem:
- Initial deployment only deployed the backend server
- No frontend was accessible when visiting the Zeabur URL

### Root Cause:
- Dockerfile only copied and started the backend
- Frontend needed to be built and served as static files

### Solution:
**Files Modified:**
1. **`Dockerfile`** - Build and include frontend
2. **`server/index.js`** - Serve static frontend files
3. **`src/App.jsx`** - Environment-aware socket connection

#### Changes:

**Dockerfile:**
```dockerfile
# Build frontend
RUN npm run build

# Serve static files in production
if (isProduction) {
    const distDir = path.join(__dirname, '..', 'dist');
    app.use(express.static(distDir));
}
```

**App.jsx:**
```javascript
// Development: connects to localhost:3001
// Production: connects to same origin
const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
const socketUrl = isDevelopment
  ? `https://${window.location.hostname}:3001`
  : window.location.origin;
```

**Commit:** `cc65fb9` - "Add frontend to production deployment"

---

## Issue #3: Vite Not Found During Build
**Date:** 2025-12-10
**Branch:** production

### Error Message:
```
sh: 1: vite: not found
exit code: 127
```

### Root Cause:
- `npm ci` was only installing production dependencies
- Vite is a devDependency needed for building
- Zeabur sets `NODE_ENV=production` at build time, causing npm to skip devDependencies

### Debug Process:
1. Switched from `npm install` to `npm ci`
2. Added verbose logging to see what was installed
3. Discovered `npm list` showed no vite package
4. Identified that devDependencies were being skipped

### Solution:
**File:** `Dockerfile` (Lines 10-21)

```dockerfile
# Force development mode for npm ci to install devDependencies
# Zeabur sets NODE_ENV=production at build time which skips devDependencies
ENV NODE_ENV=development

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy all source code
COPY . .

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Set production environment for runtime
ENV NODE_ENV=production
```

**Commits:**
- `e1b11d3` - "Fix Docker build: Use npm ci instead of npm install"
- `ddc888c` - "Debug and fix Docker build vite issue"
- `5504193` - "Add comprehensive debugging for npm ci failure"
- `7079491` - "Fix: Force NODE_ENV=development during npm ci"

---

## Issue #4: SSL Certificate Files Not Found
**Date:** 2025-12-10
**Branch:** production

### Error Message:
```
Error: ENOENT: no such file or directory, open './key.pem'
```

### Root Cause:
- `vite.config.js` unconditionally tried to read `key.pem` and `cert.pem`
- These SSL certificate files only exist in local development
- Docker build environment doesn't have these files

### Solution:
**File:** `vite.config.js` (Lines 10-16)

```javascript
// Only use HTTPS if certificate files exist (local development)
https: fs.existsSync('./key.pem') && fs.existsSync('./cert.pem')
  ? {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    }
  : undefined,
```

**Commit:** `983dda1` - "Fix vite build: Make SSL certificates optional"

---

## Issue #5: Express 5.x Route Syntax Error
**Date:** 2025-12-10
**Branch:** production

### Error Message:
```
PathError [TypeError]: Missing parameter name at index 1: *
at file:///app/server/index.js:113:9
originalPath: '*'
```

### Root Cause:
- Express 5.x changed route syntax and doesn't support `app.get('*', ...)` wildcard
- The catch-all route for serving frontend caused a PathError

### Solution:
**File:** `server/index.js` (Lines 111-118)

Changed from:
```javascript
app.get('*', (req, res) => { ... })
```

To:
```javascript
// Express 5.x compatible syntax
app.use((req, res) => {
    const distDir = path.join(__dirname, '..', 'dist');
    res.sendFile(path.join(distDir, 'index.html'));
});
```

**Commit:** `b656975` - "Fix Express 5.x catch-all route syntax"

---

## Current Deployment Architecture

### Production Environment (Zeabur)
```
┌─────────────────────────────────────┐
│         Zeabur Container            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │     Express Server           │  │
│  │     (Port from env)          │  │
│  │                              │  │
│  │  • Serves static frontend    │  │
│  │  • API routes (/api/*)       │  │
│  │  • File uploads (/uploads/*) │  │
│  │  • WebSocket (Socket.io)     │  │
│  │  • Catch-all → index.html    │  │
│  └──────────────────────────────┘  │
│              ↓                      │
│  ┌──────────────────────────────┐  │
│  │   PostgreSQL Database        │  │
│  │   (No SSL)                   │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Development Environment (Local)
```
┌─────────────────────┐    ┌─────────────────────┐
│  Vite Dev Server    │    │  Express Server     │
│  localhost:5173     │◄──►│  localhost:3001     │
│  (HTTPS)            │    │  (HTTPS)            │
│                     │    │                     │
│  • Hot reload       │    │  • API routes       │
│  • Proxy /api       │    │  • Socket.io        │
│  • Proxy /uploads   │    │  • File uploads     │
└─────────────────────┘    └─────────────────────┘
                                     ↓
                           ┌─────────────────────┐
                           │  SQLite Database    │
                           │  (chat.db)          │
                           └─────────────────────┘
```

---

## Key Configuration Files

### Dockerfile
- Uses `node:20` (full image, not slim)
- Sets `NODE_ENV=development` during build
- Installs all dependencies including devDependencies
- Builds frontend with `npm run build`
- Prunes devDependencies after build
- Sets `NODE_ENV=production` for runtime

### server/db.js
- Environment-based database selection (PostgreSQL/SQLite)
- PostgreSQL SSL disabled by default
- Supports both `DATABASE_URL` and individual `POSTGRES_*` variables
- Creates wrapper to match SQLite API for PostgreSQL

### server/index.js
- HTTP in production (Zeabur handles SSL)
- HTTPS in development (self-signed certs)
- Serves static frontend files in production
- Express 5.x compatible catch-all route

### vite.config.js
- Conditional HTTPS based on certificate file existence
- Proxy configuration for local development
- Only reads SSL certificates if files exist

### src/App.jsx
- Environment-aware socket connection
- Uses same origin in production
- Uses localhost:3001 in development

---

## Environment Variables (Zeabur)

### Required:
- `POSTGRES_HOST` - PostgreSQL host
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DATABASE` - Database name

### Optional:
- `DATABASE_URL` - Full PostgreSQL connection string (alternative to individual vars)
- `DATABASE_SSL` - Set to 'true' to enable SSL (default: false)
- `PORT` - Server port (Zeabur sets this automatically)

---

## Deployment Checklist

### Before Deploying:
- [ ] Ensure all changes are committed to production branch
- [ ] Push production branch to GitHub
- [ ] Verify package.json and package-lock.json are committed

### Zeabur Configuration:
- [ ] Create PostgreSQL service in Zeabur
- [ ] Create Node.js service in Zeabur
- [ ] Link both services in same project
- [ ] Connect GitHub repository (production branch)
- [ ] Zeabur will auto-detect Dockerfile
- [ ] Environment variables are automatically set by Zeabur

### After Deployment:
- [ ] Check build logs for any errors
- [ ] Verify frontend is accessible
- [ ] Test user registration/login
- [ ] Test channel creation and messaging
- [ ] Test file uploads
- [ ] Test search functionality
- [ ] Test WebSocket connections

---

## Current Status

### ✅ Completed Fixes:
1. PostgreSQL SSL connection
2. Frontend deployment and serving
3. DevDependencies installation in Docker
4. SSL certificate handling in vite.config.js
5. Express 5.x route compatibility

### 🎯 Expected Behavior:
- **Frontend**: Accessible at Zeabur URL root
- **Backend API**: Available at `/api/*` endpoints
- **WebSocket**: Real-time messaging working
- **Database**: PostgreSQL connected without SSL
- **File Uploads**: Working at `/uploads/*`

### 📊 Architecture:
- **Single Service Deployment**: Frontend and backend on same origin
- **No CORS Issues**: Same-origin policy satisfied
- **Optimized Build**: DevDependencies removed after build
- **Environment-Aware**: Different configs for dev/prod

---

## Branch Strategy

### Main Branch:
- Development environment
- Uses SQLite database
- HTTPS with self-signed certificates
- No production deployment files

### Production Branch:
- Production environment
- Uses PostgreSQL database
- HTTP (Zeabur handles SSL)
- Includes Dockerfile and deployment configs

### Syncing:
- Code changes merged from production → main
- Production-specific files (Dockerfile, etc.) stay in production branch only
- Database configuration differs between branches

---

## Lessons Learned

1. **Environment Variables in Docker**: Build-time vs runtime environment variables matter
   - Zeabur sets `NODE_ENV=production` at build time
   - Must override to install devDependencies

2. **Express Version Breaking Changes**: Express 5.x has different route syntax
   - `app.get('*')` → `app.use()`
   - Always check framework version compatibility

3. **Conditional Configuration**: Make configs environment-aware
   - Check file existence before reading
   - Use different configs for dev/prod

4. **PostgreSQL SSL**: Not all providers require/support SSL
   - Make SSL optional
   - Default to no SSL for maximum compatibility

5. **Full vs Slim Docker Images**: Use full Node image when building
   - `node:20-slim` may miss build dependencies
   - `node:20` ensures all tools are available

---

## Additional Resources

- **Zeabur Documentation**: https://zeabur.com/docs
- **Express 5.x Migration Guide**: https://expressjs.com/en/guide/migrating-5.html
- **Vite Production Build**: https://vitejs.dev/guide/build.html
- **PostgreSQL Node.js**: https://node-postgres.com/

---

## Contact & Support

For issues or questions about this deployment:
1. Check this document first
2. Review git commit history for detailed changes
3. Check Zeabur build logs for deployment issues
4. Verify environment variables are set correctly

Last Updated: 2025-12-10
