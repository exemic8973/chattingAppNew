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

---

## Issue #6: Database Schema Missing Columns
**Date:** 2025-12-10
**Branch:** production

### Error Message:
```
Error: SQLITE_ERROR: no such column: role
Error: table channel_invites has no column named role
Error: table channel_invites has no column named status
```

### Root Cause:
- Schema updates added `role` and `status` columns to `channel_invites` table
- Existing databases (both SQLite and PostgreSQL) didn't have these columns
- Code tried to query/insert these new columns, causing SQL errors

### Problem Impact:
- Members not displaying in channel list
- Invitation system not working
- Kick user functionality broken

### Solution:
**File:** `server/db.js` (Lines 206-220)

Added automatic database migration logic that runs on server startup:

```javascript
// Migration: Add role column to channel_invites if it doesn't exist
try {
    await db.run('ALTER TABLE channel_invites ADD COLUMN role TEXT DEFAULT \'member\'');
    console.log('Migration: Added role column to channel_invites table');
} catch (e) {
    // Column already exists, ignore error
}

// Migration: Add status column to channel_invites if it doesn't exist
try {
    await db.run('ALTER TABLE channel_invites ADD COLUMN status TEXT DEFAULT \'invited\'');
    console.log('Migration: Added status column to channel_invites table');
} catch (e) {
    // Column already exists, ignore error
}
```

**Migration Strategy:**
- Runs automatically on database initialization
- Safe for both new and existing databases
- Uses try-catch to ignore errors if columns already exist
- Default values ensure backward compatibility

**Benefits:**
- No manual database updates required
- Works for all deployment environments
- Preserves existing data
- Automatic for all users

**Commit:** `7a85c24` - "Add responsive design and internationalization support"

---

## Update #7: Responsive Design and Mobile Support
**Date:** 2025-12-10
**Branch:** production

### Implementation:
Added comprehensive responsive CSS to support mobile and tablet devices.

### Changes:

**File:** `src/index.css` (Lines 551-756)

**Breakpoints:**
1. **Tablet (≤1024px):**
   - Reduced sidebar width to 240px
   - Reduced channel members panel to 220px
   - Adjusted message bubbles to 75% max-width
   - Smaller button padding and font sizes

2. **Mobile (≤768px):**
   - Sidebar becomes horizontal at top (40vh max height)
   - Channel members panel hidden completely
   - Full-width chat area
   - Adjusted spacing and typography
   - Smaller input fields and buttons
   - Optimized login page for mobile

3. **Small Mobile (≤480px):**
   - Further reduced sidebar height to 35vh
   - Hid button text labels (icons only)
   - Increased message bubble max-width to 90%
   - Minimal padding and spacing

**Benefits:**
- Mobile-first design approach
- Optimized touch targets
- Better use of screen space on small devices
- Consistent experience across all devices

**Commit:** `7a85c24` - "Add responsive design and internationalization support"

---

## Update #8: Internationalization (i18n) System
**Date:** 2025-12-10
**Branch:** production

### Implementation:
Added complete i18n system with English and Chinese (Simplified) translation support.

### New Files Created:
1. **`src/i18n/I18nContext.jsx`** - i18n context provider with auto-detection
2. **`src/i18n/locales/en.json`** - English translations
3. **`src/i18n/locales/zh-CN.json`** - Chinese (Simplified) translations
4. **`src/components/LanguageSwitcher.jsx`** - Language selection dropdown

### Components Updated:
All UI components updated to use `useI18n()` hook and `t()` translation function:
- Login.jsx
- Header.jsx
- Sidebar.jsx
- ChatArea.jsx
- InviteUserModal.jsx

### Features:
- **Auto Language Detection**: Detects browser language on first visit
- **Language Persistence**: Saves preference to localStorage
- **Full Coverage**: All UI text translated (500+ strings)
- **Easy Switching**: Dropdown in header for language selection
- **Fallback System**: Falls back to English if translation missing

### Supported Languages:
1. **English** (en)
2. **Chinese Simplified** (zh-CN)

### Usage:
```javascript
import { useI18n } from '../i18n/I18nContext';

const MyComponent = () => {
    const { t } = useI18n();
    return <button>{t('button.submit')}</button>;
};
```

**Commit:** `7a85c24` - "Add responsive design and internationalization support"

---

## Update #9: Enhanced Channel Management
**Date:** 2025-12-10
**Branch:** production

### New Features Implemented:

#### 1. Passcode Persistence
**File:** `server/socket.js` (Lines 666-680)

- Users now only enter passcode once per channel
- System creates "accepted" invite record after successful passcode entry
- Passcode not required on subsequent joins (unless user is kicked)

```javascript
if (channel.passcode && channel.passcode === passcode) {
    // Create accepted invite so they don't need passcode again
    await db.run(
        'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        channelId, username, channel.host, Date.now(), 'member', 'accepted'
    );
}
```

#### 2. Ban System for Kicked Users
**File:** `server/socket.js` (Lines 343-416)

- Kicked users now have status set to 'banned'
- Banned users cannot rejoin the channel
- Auto-redirect to default channel (#general) when kicked
- System message sent to both channels

```javascript
// Ban the user
await db.run(
    'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, status, role) VALUES (?, ?, ?, ?, ?, ?)',
    channelId, targetUsername, hostUsername, Date.now(), 'banned', 'member'
);

// Auto-redirect to default channel
const defaultChannelId = 'c1';
targetSocket.join(defaultChannelId);
io.to(targetSocketId).emit('kicked_from_channel', {
    channelId,
    by: hostUsername,
    redirectTo: defaultChannelId
});
```

#### 3. Host-Assist Role
**File:** `server/socket.js` (Lines 456-525)

- New role between member and host
- Can kick users and manage members
- Cannot transfer host or delete channel
- Host can promote members to host-assist

#### 4. Channel Deletion
**File:** `server/socket.js` (Lines 527-554)

- Host can permanently delete channels
- Deletes all related data (messages, invites, reactions)
- All users in channel auto-redirected to default channel
- Confirmation required in UI

### Benefits:
- **Better UX**: Don't need to remember/re-enter passcodes
- **Security**: Banned users stay banned until re-invited
- **Moderation**: Host-assist helps manage large channels
- **Cleanup**: Unused channels can be removed

**Commit:** `7a85c24` - "Add responsive design and internationalization support"

---

## Current Status (Updated)

### ✅ All Fixes Completed:
1. PostgreSQL SSL connection
2. Frontend deployment and serving
3. DevDependencies installation in Docker
4. SSL certificate handling in vite.config.js
5. Express 5.x route compatibility
6. **Database schema migrations**
7. **Responsive design for mobile/tablet**
8. **Internationalization (i18n) system**
9. **Enhanced channel management features**

### 🎯 Current Features:
- **Frontend**: Fully responsive, accessible on all devices
- **i18n**: English and Chinese (Simplified) support
- **Backend API**: RESTful endpoints with Socket.IO
- **WebSocket**: Real-time messaging with typing indicators
- **Database**: Auto-migrating schema, PostgreSQL in production
- **File Uploads**: Image and file sharing
- **Channel Management**: Roles, passcodes, banning, deletion

### 📊 Production Architecture (Updated):
```
┌─────────────────────────────────────────────┐
│         Zeabur Container                     │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │     Express Server (Node.js)           │ │
│  │     Port: Auto-assigned by Zeabur      │ │
│  │                                        │ │
│  │  • Serves static React frontend       │ │
│  │  • API routes (/api/*)                │ │
│  │  • File uploads (/uploads/*)          │ │
│  │  • WebSocket (Socket.io)              │ │
│  │  • Responsive UI (mobile/tablet)      │ │
│  │  • i18n support (EN/ZH)               │ │
│  │  • Auto database migrations           │ │
│  │  • Advanced channel management        │ │
│  │  • Catch-all → index.html             │ │
│  └────────────────────────────────────────┘ │
│              ↓                               │
│  ┌────────────────────────────────────────┐ │
│  │   PostgreSQL Database                  │ │
│  │   (No SSL, Auto-migration enabled)    │ │
│  │                                        │ │
│  │  • Auto-adds missing columns          │ │
│  │  • Supports role-based permissions    │ │
│  │  • Ban system for kicked users        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Version History

### Version 2.0.0 (Current) - 2025-12-10
**Major Update: Responsive Design & Internationalization**

#### Features Added:
- ✨ Responsive design for mobile and tablet devices
- 🌍 Internationalization (i18n) with Chinese support
- 🔒 Passcode persistence (enter once per channel)
- 🚫 Ban system for kicked users
- ⭐ Host-assist role for channel management
- 🗑️ Channel deletion feature
- 🔄 Automatic database migrations
- 🎨 Enhanced mobile UX

#### Technical Improvements:
- Auto-migrating database schema
- Context-based i18n system
- Mobile-first responsive CSS
- Enhanced channel role system

#### Files Changed:
- 22 files modified
- 9 new files created
- 1,347 insertions
- 83 deletions

**Commit:** `7a85c24` - "Add responsive design and internationalization support"

### Version 1.0.0 - 2025-12-09
**Initial Production Deployment**
- Basic chat functionality
- PostgreSQL integration
- Docker deployment
- SSL fixes
- Express 5.x compatibility

---

## Testing Checklist (Updated)

### After Deployment:
- [ ] Check build logs for migration messages
- [ ] Verify frontend loads on mobile devices
- [ ] Test language switching (EN ↔ ZH)
- [ ] Test user registration/login
- [ ] Test channel creation with passcode
- [ ] Test passcode persistence (rejoin without passcode)
- [ ] Test kick user (verify ban and redirect)
- [ ] Test host-assist role permissions
- [ ] Test channel deletion
- [ ] Test file uploads
- [ ] Test message search
- [ ] Test WebSocket connections
- [ ] Verify responsive design on:
  - [ ] Desktop (>1024px)
  - [ ] Tablet (768px-1024px)
  - [ ] Mobile (480px-768px)
  - [ ] Small mobile (<480px)

---

Last Updated: 2025-12-10 (Version 2.0.0)
