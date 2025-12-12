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

## Issue #10: Voice/Video Call System Bugs
**Date:** 2025-12-12
**Branch:** production

### Problems Identified:
1. **No Audio in Voice Calls**: After WebRTC connection established, no audio could be heard
2. **Voice Stays Active After Call**: Microphone stayed active after leaving call, required page refresh
3. **Second Call Doesn't Notify**: Second call attempt didn't notify the recipient
4. **No Call Accept/Decline Flow**: Missing incoming call notification UI

### Root Causes:

#### Bug 1: No Audio in Calls
**File:** `src/components/VideoCall.jsx` (Lines 223-260)
- Video component tried to attach streams to refs after track events already fired
- No separate audio element for voice-only mode
- Audio tracks were being added but not properly rendered

#### Bug 2: Voice Stays Active After Call
**File:** `src/components/VideoCall.jsx` (Lines 10, 20, 80-87)
- useEffect cleanup function captured stale `stream` state variable
- Cleanup couldn't access current stream to stop tracks
- Resulted in microphone staying active even after component unmount

#### Bug 3: Second Call Doesn't Notify
**File:** `src/App.jsx` (Lines 192-195)
- Socket listeners in App.jsx never cleaned up, accumulated on each render
- Multiple listeners prevented proper event handling
- Second call events were blocked by stale listeners

#### Bug 4: No Call Accept/Decline Flow
**Files:** Missing `IncomingCallModal.jsx`, incomplete socket events
- No UI to notify users of incoming calls
- No way to accept or decline calls
- Calls auto-started without user consent

### Solutions Implemented:

#### Fix 1: Separate Audio/Video Elements
**File:** `src/components/VideoCall.jsx` (Lines 223-260)

```javascript
const Video = ({ peer, isVoiceOnly }) => {
    const videoRef = useRef();
    const audioRef = useRef();

    useEffect(() => {
        if (peer.stream) {
            if (isVoiceOnly) {
                // Voice only: use audio element
                if (audioRef.current) {
                    audioRef.current.srcObject = peer.stream;
                }
            } else {
                // Video call: use video element
                if (videoRef.current) {
                    videoRef.current.srcObject = peer.stream;
                }
            }
        }
    }, [peer.stream, isVoiceOnly]);

    return (
        <>
            {isVoiceOnly ? (
                <>
                    <div>👤</div>
                    <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
                </>
            ) : (
                <video playsInline ref={videoRef} autoPlay />
            )}
        </>
    );
};
```

#### Fix 2: Stream Ref for Cleanup
**File:** `src/components/VideoCall.jsx` (Lines 10, 20, 80-87)

```javascript
const streamRef = useRef(null); // Store stream in ref for cleanup

navigator.mediaDevices.getUserMedia({ video: !isVoiceOnly, audio: true })
    .then((currentStream) => {
        streamRef.current = currentStream; // Store in ref for reliable cleanup
        setStream(currentStream);
        // ...
    });

return () => {
    // Stop all tracks using ref (not stale closure)
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.kind);
        });
        streamRef.current = null;
    }
};
```

#### Fix 3: Proper Socket Cleanup
**File:** `src/App.jsx` (Lines 196-217, 256-272)

```javascript
// Added incoming call notification system
socket.on("incoming_call", ({ from, isVideo, channelId }) => {
    setIncomingCall({ from, isVideo, channelId });
});

socket.on("call_cancelled", () => {
    setIncomingCall(null);
});

// Proper cleanup
return () => {
    socket.off("incoming_call");
    socket.off("call_cancelled");
    socket.off("call_accepted");
    socket.off("call_declined");
    socket.off("call_failed");
    // ... other cleanup
};
```

#### Fix 4: Incoming Call Modal
**File:** `src/components/IncomingCallModal.jsx` (NEW)

Created new component with:
- Accept/Decline buttons
- Caller name display
- Ringing sound effect (audio loop)
- Animated modal with pulse effect
- Call type indicator (voice/video)

**File:** `server/socket.js` (Lines 739-818)

Added new socket events:
- `initiate_call`: Start a call to another user
- `incoming_call`: Notify recipient of incoming call
- `accept_call`: Recipient accepts the call
- `decline_call`: Recipient declines the call
- `call_cancelled`: Caller cancels before answer

**Commit:** `46ec314` - "Fix voice/video call bugs and add call notification system"

---

## Update #11: Group Voice Channel Backend Infrastructure
**Date:** 2025-12-12
**Branch:** production

### Implementation:
Added complete backend infrastructure for Discord-style group voice channels with permission management.

### Database Schema:
**File:** `server/db.js` (PostgreSQL: Lines 98-113, SQLite: Lines 212-227)

Added two new tables:

```sql
-- Voice session tracking
CREATE TABLE IF NOT EXISTS voice_sessions (
    channel_id TEXT,
    username TEXT,
    is_muted BOOLEAN DEFAULT true,
    can_unmute BOOLEAN DEFAULT false,
    joined_at BIGINT,
    PRIMARY KEY (channel_id, username)
);

-- Voice permission grants
CREATE TABLE IF NOT EXISTS voice_permissions (
    channel_id TEXT,
    username TEXT,
    granted_by TEXT,
    granted_at BIGINT,
    PRIMARY KEY (channel_id, username)
);
```

### Socket Events:
**File:** `server/socket.js` (Lines 824-1158)

Implemented 7 new socket events:

1. **`join_voice`** - User joins voice channel
   - Auto-detects host/host-assist for immediate unmute permission
   - Creates voice session with default muted state
   - Broadcasts user list to all participants

2. **`leave_voice`** - User leaves voice channel
   - Cleans up voice session
   - Removes temporary permissions
   - Notifies remaining users

3. **`toggle_mute`** - Toggle mute/unmute
   - Permission-checked (only allowed if user has unmute permission)
   - Updates session state
   - Broadcasts mute status to all participants

4. **`request_unmute_permission`** - Regular user requests permission to speak
   - Creates permission request
   - Notifies host and host-assists
   - Queues request in UI

5. **`grant_unmute_permission`** - Host grants permission
   - Updates user's `can_unmute` flag
   - Records who granted the permission
   - Notifies user they can now unmute

6. **`revoke_unmute_permission`** - Host revokes permission
   - Removes `can_unmute` flag
   - Force mutes the user
   - Notifies user of revocation

7. **`server_mute_user`** - Host force-mutes user
   - Overrides user's mute state
   - Works even if user is currently unmuted
   - Cannot be overridden by user until permission granted

### Permission System:
- **Host**: Auto-granted unmute permission, can mute/unmute anyone
- **Host-Assist**: Auto-granted unmute permission, can mute/unmute anyone
- **Regular Members**: Must request permission from host/host-assist
- **Temporary Permissions**: Reset when user leaves voice or channel

### Features:
- Default muted state for all users
- Role-based auto-permissions
- Request/grant workflow for regular users
- Force mute capability for moderators
- Clean session management on disconnect

**Commit:** `3442bc0` - "Add group voice channel backend infrastructure"

---

## Update #12: Group Voice Channel UI and Integration
**Date:** 2025-12-12
**Branch:** production

### Implementation:
Created complete voice channel UI component with Discord-style features and WebRTC audio signaling.

### New Components:
**Files Created:**
1. `src/components/VoiceChannel.jsx` - Main voice UI component
2. `src/components/VoiceChannel.css` - Voice panel styles with animations

### Component Features:
**File:** `src/components/VoiceChannel.jsx` (Lines 1-292)

#### Core Functionality:
- **Auto-Join Voice**: Joins voice session on component mount
- **Microphone Access**: Requests getUserMedia permissions
- **WebRTC Audio**: Peer-to-peer audio connections
- **Mute Control**: Toggle with permission checks
- **Permission Management**: Request/grant workflow

#### UI Elements:
1. **Voice Users List**:
   - Grid display of all users in voice
   - Avatar with first letter of username
   - Mute status indicator (🔇/🎤)
   - Speaking animation (green glow when unmuted)

2. **Control Buttons**:
   - **For users with permission**: Mute/unmute toggle
   - **For users without permission**: Request permission button
   - **For host/host-assist**: Grant permission and force mute buttons

3. **Permission Requests Queue**:
   - Alert badge showing pending requests
   - Expandable list of requesting users
   - One-click grant buttons

#### Visual Indicators:
**File:** `src/components/VoiceChannel.css` (Lines 1-318)

```css
/* Speaking indicator with animation */
.voice-user-avatar.speaking {
    box-shadow: 0 0 0 2px #2ecc71, 0 0 15px rgba(46, 204, 113, 0.5);
    animation: speak-pulse 1s infinite;
}

@keyframes speak-pulse {
    0%, 100% {
        box-shadow: 0 0 0 2px #2ecc71, 0 0 15px rgba(46, 204, 113, 0.5);
    }
    50% {
        box-shadow: 0 0 0 3px #2ecc71, 0 0 20px rgba(46, 204, 113, 0.7);
    }
}
```

### Integration:
**File:** `src/App.jsx` (Lines 597-606)

```javascript
{showVoiceChannel && !selectedUserId && selectedChannelId && (
    <VoiceChannel
        socket={socket}
        channelId={selectedChannelId}
        username={username}
        isHost={selectedChannel?.host === username}
        isHostAssist={channelMembers.find(m => m.username === username)?.isHostAssist || false}
    />
)}
```

**File:** `src/components/Header.jsx`

Added voice button in channel header:
- Toggle voice UI on/off
- Visual indicator when in voice (🎤✓ with accent color)
- Separate from 1-on-1 call buttons

### WebRTC Audio Setup:
- Uses same RTCPeerConnection as video calls
- STUN server: `stun:stun.l.google.com:19302`
- Audio-only streams (no video track)
- Automatic peer discovery and connection
- ICE candidate exchange via Socket.IO

### Mobile Responsive:
```css
@media (max-width: 768px) {
    .voice-channel-overlay {
        max-height: 70vh;
    }
    .voice-user-avatar {
        width: 50px;
        height: 50px;
    }
}
```

**Commit:** `89d7450` - "Add group voice channel UI and integration"

---

## Update #13: Discord-Style Voice Panel Redesign
**Date:** 2025-12-12
**Branch:** production

### Problem:
Original voice channel implementation used a full-screen overlay that blocked text chat, unlike Discord where users can chat while seeing who's in voice.

### Solution:
Redesigned voice channel as a **persistent bottom panel** similar to Discord's voice interface.

### Changes Made:

#### Component Redesign:
**File:** `src/components/VoiceChannel.jsx`

**Key Changes:**
- Removed `onClose` prop (no longer a closable overlay)
- Added `isCollapsed` state for expand/collapse functionality
- Changed from grid layout to compact horizontal list
- Added collapse button with arrow indicator (◀/▶)
- Simplified to panel-style component

```javascript
const [isCollapsed, setIsCollapsed] = useState(false);

return (
    <div className={`voice-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="voice-panel-header">
            <h4>🎤 Voice ({voiceUsers.length})</h4>
            <button
                className="collapse-btn"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expand" : "Collapse"}
            >
                {isCollapsed ? '◀' : '▶'}
            </button>
        </div>
        {!isCollapsed && (
            <>
                {/* Voice users list */}
                {/* Control buttons */}
            </>
        )}
    </div>
);
```

#### Styling Overhaul:
**File:** `src/components/VoiceChannel.css`

**From Overlay to Panel:**
```css
/* OLD: Full-screen overlay */
.voice-channel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
}

/* NEW: Bottom panel */
.voice-panel {
    position: fixed;
    bottom: 0;
    left: 280px; /* After sidebar */
    right: 260px; /* Before channel members */
    background: rgba(30, 30, 40, 0.98);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 100;
    max-height: 250px;
    transition: all 0.3s ease;
}

.voice-panel.collapsed {
    max-height: 45px;
}
```

**Compact User List:**
```css
.voice-user-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
}

.voice-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
}

.voice-user-info {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
```

**Speaking Indicators:**
```css
.voice-user-avatar.speaking {
    box-shadow: 0 0 0 2px #2ecc71, 0 0 15px rgba(46, 204, 113, 0.5);
    animation: speak-pulse 1s infinite;
}
```

**Mobile Responsive:**
```css
@media (max-width: 1024px) {
    .voice-panel {
        left: 0;
        right: 0;
    }
}

@media (max-width: 768px) {
    .voice-panel {
        max-height: 200px;
    }
    .voice-panel.collapsed {
        max-height: 40px;
    }
}
```

#### Integration Update:
**File:** `src/App.jsx` (Lines 597-605)

```javascript
// Removed onClose prop - panel stays visible while toggled on
{showVoiceChannel && !selectedUserId && selectedChannelId && (
    <VoiceChannel
        socket={socket}
        channelId={selectedChannelId}
        username={username}
        isHost={selectedChannel?.host === username}
        isHostAssist={channelMembers.find(m => m.username === username)?.isHostAssist || false}
    />
)}
```

### User Experience Improvements:

1. **Chat While in Voice**: Users can now see text chat and voice panel simultaneously
2. **Collapsible Panel**: Minimize to 45px header when needed
3. **Persistent Presence**: Voice panel stays visible until manually toggled off
4. **Compact Design**: Takes minimal screen space (250px max height)
5. **Speaking Indicators**: Green glow shows who's actively talking
6. **Hover Controls**: Admin controls appear on hover to reduce clutter

### Layout Integration:
```
┌─────────────────────────────────────────────────────┐
│                    Header                            │
├──────┬─────────────────────────────────┬────────────┤
│      │                                 │            │
│ Side │         Chat Messages           │  Channel   │
│ bar  │                                 │  Members   │
│      │                                 │            │
│      ├─────────────────────────────────┤            │
│      │  🎤 Voice Panel (collapsed)     │            │
│      │  ▶  (click to expand)           │            │
└──────┴─────────────────────────────────┴────────────┘
```

### Benefits:
- **Discord-like UX**: Familiar interface for users
- **No Chat Blocking**: Text messages visible while in voice
- **Space Efficient**: Minimal screen real estate usage
- **Mobile Optimized**: Adjusts width on smaller screens
- **Smooth Animations**: Expand/collapse with transitions

**Commit:** `f712e38` - "Redesign voice channel as Discord-style persistent panel"

---

## Current Status (Updated)

### ✅ All Fixes Completed:
1. PostgreSQL SSL connection
2. Frontend deployment and serving
3. DevDependencies installation in Docker
4. SSL certificate handling in vite.config.js
5. Express 5.x route compatibility
6. Database schema migrations
7. Responsive design for mobile/tablet
8. Internationalization (i18n) system
9. Enhanced channel management features
10. **Voice/video call bug fixes**
11. **Group voice channel backend**
12. **Group voice channel UI**
13. **Discord-style voice panel**

### 🎯 Current Features:
- **Frontend**: Fully responsive, accessible on all devices
- **i18n**: English and Chinese (Simplified) support
- **Backend API**: RESTful endpoints with Socket.IO
- **WebSocket**: Real-time messaging with typing indicators
- **Database**: Auto-migrating schema, PostgreSQL in production
- **File Uploads**: Image and file sharing
- **Channel Management**: Roles, passcodes, banning, deletion
- **1-on-1 Calls**: Voice and video calls with Accept/Decline flow
- **Group Voice**: Discord-style persistent voice channels with permission management
- **Audio Features**: WebRTC peer-to-peer audio, mute controls, speaking indicators

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
│  │  • Voice/Video WebRTC signaling       │ │
│  │  • Voice permission management        │ │
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
│  │  • Voice session tracking             │ │
│  │  • Voice permission grants            │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Version History

### Version 2.1.0 (Current) - 2025-12-12
**Major Update: Voice/Video Call System**

#### Features Added:
- 🎤 1-on-1 voice and video calls with proper call notification
- 📞 Incoming call modal with Accept/Decline buttons
- 🔊 Group voice channels (Discord-style)
- 🎚️ Permission-based mute control system
- 👥 Voice session management with real-time user list
- 🔇 Force mute and permission grant features
- 🎨 Discord-style persistent bottom voice panel
- ⚡ Speaking indicators with green glow animation
- 📱 Mobile-optimized voice UI

#### Bug Fixes:
- ✅ Fixed no audio in voice calls
- ✅ Fixed microphone staying active after call ends
- ✅ Fixed second call not notifying recipient
- ✅ Added proper call Accept/Decline flow
- ✅ Fixed WebRTC cleanup issues

#### Technical Improvements:
- WebRTC peer-to-peer audio with proper ref management
- Stale closure prevention in cleanup functions
- Proper socket event cleanup
- Voice session database schema
- Permission-based access control

#### Files Changed:
- 8 files modified
- 3 new files created
- 2,847 insertions
- 390 deletions

**Commits:**
- `46ec314` - "Fix voice/video call bugs and add call notification system"
- `3442bc0` - "Add group voice channel backend infrastructure"
- `89d7450` - "Add group voice channel UI and integration"
- `f712e38` - "Redesign voice channel as Discord-style persistent panel"

### Version 2.0.0 - 2025-12-10
**Major Update: Responsive Design & Internationalization**
- ✨ Responsive design for mobile and tablet devices
- 🌍 Internationalization (i18n) with Chinese support
- 🔒 Passcode persistence
- 🚫 Ban system for kicked users
- ⭐ Host-assist role
- 🗑️ Channel deletion

### Version 1.0.0 - 2025-12-09
**Initial Production Deployment**
- Basic chat functionality
- PostgreSQL integration
- Docker deployment

---

## Testing Checklist (Updated)

### Voice/Video Features:
- [ ] Test 1-on-1 voice call
  - [ ] Incoming call notification appears
  - [ ] Ringing sound plays
  - [ ] Accept call works
  - [ ] Decline call works
  - [ ] Audio is heard on both sides
  - [ ] Call ends cleanly, microphone stops
- [ ] Test 1-on-1 video call
  - [ ] Video feeds display correctly
  - [ ] Audio works in video mode
  - [ ] Leave call works properly
- [ ] Test group voice channel
  - [ ] Join voice channel button in header
  - [ ] Voice panel appears at bottom
  - [ ] Default muted state
  - [ ] Host/host-assist can unmute immediately
  - [ ] Regular user can request permission
  - [ ] Host can grant permission
  - [ ] Unmute works after permission granted
  - [ ] Force mute works
  - [ ] Speaking indicator shows green glow
  - [ ] Collapse/expand panel works
  - [ ] Leave voice cleans up session
- [ ] Test on multiple devices simultaneously
  - [ ] 3+ users can hear each other
  - [ ] Mute/unmute syncs across clients
  - [ ] Permission requests show in real-time

### Previous Features:
- [ ] Check build logs for migration messages
- [ ] Verify frontend loads on mobile devices
- [ ] Test language switching (EN ↔ ZH)
- [ ] Test user registration/login
- [ ] Test channel creation and messaging
- [ ] Test file uploads
- [ ] Test responsive design across breakpoints

---

Last Updated: 2025-12-12 (Version 2.1.0)
