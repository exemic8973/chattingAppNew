import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import {
    logSocketEvent,
    logSecurityEvent,
    logAuthEvent,
    logMessageEvent,
    logDatabaseOperation,
    logChannelEvent,
    logError
} from './logging.js';

// Create DOMPurify instance for server-side XSS sanitization
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Active sessions (keep in memory)
const users = {}; // socket.id -> { username, room }

// Rate limiting for Socket.IO connections
const connectionAttempts = new Map(); // IP -> { count, lastAttempt }

// Rate limiting for messages
const messageAttempts = new Map(); // username -> { count, lastMessage }

const checkMessageRateLimit = (username) => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxMessages = 30; // Max 30 messages per minute

  if (!messageAttempts.has(username)) {
    messageAttempts.set(username, { count: 1, lastMessage: now });
    return true;
  }

  const attempts = messageAttempts.get(username);
  
  // Reset if window has passed
  if (now - attempts.lastMessage > windowMs) {
    messageAttempts.set(username, { count: 1, lastMessage: now });
    return true;
  }

  // Check if exceeded limit
  if (attempts.count >= maxMessages) {
    return false;
  }

  // Increment count
  attempts.count++;
  attempts.lastMessage = now;
  return true;
};

const checkConnectionRateLimit = (socket) => {
  const clientIP = socket.handshake.address;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute (reduced from 15 minutes)
  const maxAttempts = 100; // Max 100 connection attempts per minute (increased from 10)

  if (!connectionAttempts.has(clientIP)) {
    connectionAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return true;
  }

  const attempts = connectionAttempts.get(clientIP);
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > windowMs) {
    connectionAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if exceeded limit
  if (attempts.count >= maxAttempts) {
    return false;
  }

  // Increment count
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
};

export function setupSocket(io) {
    const db = getDb();

    // Helper function to check if user is admin based on role in database
    const isAdmin = async (username) => {
        try {
            const user = await db.get('SELECT role FROM users WHERE username = ?', username);
            return user && (user.role === 'admin' || user.role === 'system' || username === 'system');
        } catch (e) {
            console.error('Error checking admin role:', e);
            return false;
        }
    };

    io.on('connection', (socket) => {
        // Check connection rate limiting
        if (!checkConnectionRateLimit(socket)) {
            logSecurityEvent('CONNECTION_RATE_LIMITED', {
                ip: socket.handshake.address,
                userAgent: socket.handshake.headers['user-agent']
            });
            socket.emit('connection_error', {
                error: 'Too many connection attempts. Please try again later.',
                retryAfter: '15 minutes'
            });
            socket.disconnect(true);
            return;
        }

        logSocketEvent('USER_CONNECTED', socket.id, {
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']
        });

        // Helper to broadcast user list
        const broadcastUserList = async () => {
            try {
                const allDbUsers = await db.all('SELECT id, username, avatar_url FROM users');
                const onlineUsernames = new Set(Object.values(users).map(u => u.username));

                const finalUserList = allDbUsers.map(dbUser => ({
                    id: dbUser.id,
                    name: dbUser.username,
                    avatar: dbUser.avatar_url,
                    status: onlineUsernames.has(dbUser.username) ? 'online' : 'offline'
                }));

                io.emit('update_user_list', finalUserList);
            } catch (e) {
                console.error("Error broadcasting user list:", e);
            }
        };

        const broadcastChannelList = async () => {
            try {
                const channels = await db.all('SELECT * FROM channels');
                const sanitizedChannels = channels.map(c => ({
                    id: c.id,
                    name: c.name,
                    hasPasscode: !!c.passcode,
                    host: c.host
                }));
                io.emit('update_channel_list', sanitizedChannels);
            } catch (e) {
                console.error("Broadcast channels error:", e);
            }
        };

        const broadcastChannelMembers = async (channelId) => {
            try {
                // Get all users currently in this channel
                const channelMembers = Object.values(users)
                    .filter(user => user.room === channelId)
                    .map(user => user.username);

                // Remove duplicates
                const uniqueUsernames = [...new Set(channelMembers)];

                // Get user details from database
                const membersWithDetails = await Promise.all(
                    uniqueUsernames.map(async (username) => {
                        const userDetails = await db.get(
                            'SELECT username, avatar_url FROM users WHERE username = ?',
                            username
                        );
                        // Check if user is host-assist
                        const hostAssistInvite = await db.get(
                            'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                            channelId, username, 'host_assist', 'accepted'
                        );
                        return {
                            username: userDetails?.username || username,
                            avatar: userDetails?.avatar_url || null,
                            isTyping: false,
                            isHostAssist: !!hostAssistInvite
                        };
                    })
                );

                // Get channel host
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                const host = channel?.host;

                // Mark who is the host
                const membersWithHost = membersWithDetails.map(member => ({
                    ...member,
                    isHost: member.username === host
                }));

                // Emit to all users in the channel
                io.to(channelId).emit('channel_members_update', {
                    channelId,
                    members: membersWithHost
                });
            } catch (e) {
                console.error("Error broadcasting channel members:", e);
            }
        };

        // Check user role
        socket.on('check_user_role', async (data) => {
            const { username } = data;
            try {
                const user = await db.get('SELECT role FROM users WHERE username = ?', username);
                if (user) {
                    socket.emit('user_role', {
                        username,
                        role: user.role || 'user'
                    });
                }
            } catch (e) {
                console.error('Error checking user role:', e);
            }
        });

        // Get thread messages
        socket.on('get_thread_messages', async (data) => {
            const { channelId, threadId } = data;
            try {
                const messages = await db.all(
                    'SELECT * FROM messages WHERE channel_id = ? AND thread_id = ? ORDER BY timestamp ASC',
                    channelId, threadId
                );
                socket.emit('thread_messages', { messages });
            } catch (e) {
                console.error('Error getting thread messages:', e);
                socket.emit('thread_messages', { messages: [] });
            }
        });

        // ===== Soul Voice Room Events =====

        // Get all soul rooms
        socket.on('get_soul_rooms', async () => {
            try {
                const rooms = await db.all('SELECT * FROM soul_voice_rooms WHERE is_active = 1 ORDER BY created_at DESC');
                socket.emit('soul_rooms_updated', rooms);
            } catch (e) {
                console.error('Error getting soul rooms:', e);
                socket.emit('soul_rooms_updated', []);
            }
        });

        // Join a soul room
        socket.on('join_soul_room', async (data) => {
            const { roomId, username } = data;
            const socketId = socket.id;

            try {
                const room = await db.get('SELECT * FROM soul_voice_rooms WHERE id = ?', roomId);
                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                if (room.is_private && room.password !== data.password) {
                    socket.emit('error', { message: 'Invalid password' });
                    return;
                }

                // Check if room is full
                const participants = await db.all('SELECT * FROM soul_room_participants WHERE room_id = ?', roomId);
                if (participants.length >= room.max_participants) {
                    socket.emit('error', { message: 'Room is full' });
                    return;
                }

                // Join socket room
                socket.join(`soul_${roomId}`);

                // Add participant to database
                await db.run(
                    'INSERT INTO soul_room_participants (room_id, socket_id, username, joined_at, is_muted) VALUES (?, ?, ?, ?, 1)',
                    roomId, socketId, username, Date.now()
                );

                // Get updated participant list
                const updatedParticipants = await db.all('SELECT * FROM soul_room_participants WHERE room_id = ?', roomId);

                socket.emit('soul_room_joined', { room, participants: updatedParticipants });
                io.to(`soul_${roomId}`).emit('soul_participant_joined', {
                    id: socketId,
                    username,
                    joinedAt: Date.now(),
                    isMuted: true,
                    isSpeaking: false
                });
            } catch (e) {
                console.error('Error joining soul room:', e);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // Leave a soul room
        socket.on('leave_soul_room', async (data) => {
            const { roomId, username } = data;
            const socketId = socket.id;

            try {
                // Check if the user is the host
                const room = await db.get('SELECT * FROM soul_voice_rooms WHERE id = ?', roomId);
                
                if (room && room.host === username) {
                    // Host is leaving - close the room
                    console.log(`Host ${username} is leaving soul room ${roomId} - closing room`);
                    
                    // Mark room as inactive
                    await db.run('UPDATE soul_voice_rooms SET is_active = 0 WHERE id = ?', roomId);
                    
                    // Remove all participants
                    await db.run('DELETE FROM soul_room_participants WHERE room_id = ?', roomId);
                    
                    // Notify all participants that room is closed
                    io.to(`soul_${roomId}`).emit('soul_room_closed', { message: '主持人已关闭房间' });
                    
                    // Make everyone leave the socket room
                    io.in(`soul_${roomId}`).socketsLeave(`soul_${roomId}`);
                    
                    // Broadcast updated room list
                    const rooms = await db.all('SELECT * FROM soul_voice_rooms WHERE is_active = 1 ORDER BY created_at DESC');
                    io.emit('soul_rooms_updated', rooms);
                    
                    socket.emit('soul_room_left');
                } else {
                    // Regular participant leaving
                    await db.run('DELETE FROM soul_room_participants WHERE room_id = ? AND socket_id = ?', roomId, socketId);
                    
                    socket.leave(`soul_${roomId}`);
                    socket.emit('soul_room_left');
                    io.to(`soul_${roomId}`).emit('soul_participant_left', socketId);
                    
                    // Check if room is now empty and close it
                    const remainingParticipants = await db.all('SELECT * FROM soul_room_participants WHERE room_id = ?', roomId);
                    if (remainingParticipants.length === 0) {
                        await db.run('UPDATE soul_voice_rooms SET is_active = 0 WHERE id = ?', roomId);
                        const rooms = await db.all('SELECT * FROM soul_voice_rooms WHERE is_active = 1 ORDER BY created_at DESC');
                        io.emit('soul_rooms_updated', rooms);
                    }
                }
            } catch (e) {
                console.error('Error leaving soul room:', e);
            }
        });

        // Update speaking status
        socket.on('soul_speaking_status', (data) => {
            const { roomId, isSpeaking } = data;
            const socketId = socket.id;

            try {
                db.run(
                    'UPDATE soul_room_participants SET is_speaking = ? WHERE room_id = ? AND socket_id = ?',
                    isSpeaking ? 1 : 0, roomId, socketId
                );

                io.to(`soul_${roomId}`).emit('soul_participant_speaking', {
                    participantId: socketId,
                    isSpeaking
                });
            } catch (e) {
                console.error('Error updating speaking status:', e);
            }
        });

        // Update mute status
        socket.on('soul_mute_status', async (data) => {
            const { roomId, isMuted } = data;
            const socketId = socket.id;

            try {
                await db.run(
                    'UPDATE soul_room_participants SET is_muted = ? WHERE room_id = ? AND socket_id = ?',
                    isMuted ? 1 : 0, roomId, socketId
                );

                // Broadcast to all participants
                const participants = await db.all('SELECT * FROM soul_room_participants WHERE room_id = ?', roomId);
                io.to(`soul_${roomId}`).emit('soul_participants_updated', participants);
            } catch (e) {
                console.error('Error updating mute status:', e);
            }
        });

        // Invite user to soul room
        socket.on('soul_invite_user', async (data) => {
            const { roomId, fromUsername, targetUsername, roomName } = data;

            try {
                // Find target user's socket
                const targetSocket = Object.values(users).find(u => u.username === targetUsername);
                
                if (targetSocket) {
                    io.to(targetSocket.socketId).emit('soul_room_invitation', {
                        roomId,
                        roomName,
                        fromUsername,
                        message: `${fromUsername} 邀请您加入语音房间 "${roomName}"`
                    });
                    console.log(`Soul room invitation sent from ${fromUsername} to ${targetUsername}`);
                } else {
                    socket.emit('error', { message: '用户不在线' });
                }
            } catch (e) {
                console.error('Error sending soul room invitation:', e);
            }
        });

        // Create a new soul room
        socket.on('create_soul_room', async (data) => {
            const { name, description, category, maxParticipants, isPrivate, password, username } = data;

            console.log('create_soul_room data:', { name, description, category, maxParticipants, isPrivate, password, username });

            if (!username) {
                console.error('Username is required for creating soul room');
                socket.emit('error', { message: 'Username is required' });
                return;
            }

            try {
                const roomId = `soul_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                await db.run(
                    'INSERT INTO soul_voice_rooms (id, name, description, category, host, max_participants, is_private, password, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
                    roomId, name, description, category, username, maxParticipants, isPrivate ? 1 : 0, password, Date.now()
                );

                // Broadcast updated room list to all users
                const rooms = await db.all('SELECT * FROM soul_voice_rooms WHERE is_active = 1 ORDER BY created_at DESC');
                io.emit('soul_rooms_updated', rooms);

                socket.emit('soul_room_created', { roomId });
                console.log(`Soul room created successfully: ${name} (${roomId})`);
            } catch (e) {
                console.error('Error creating soul room:', e);
                socket.emit('error', { message: 'Failed to create room' });
            }
        });

        // Auth Events
        socket.on('signup', async (data) => {
            const { username, password } = data;
            const normalizedUser = username.toLowerCase();

            try {
                const existing = await db.get('SELECT * FROM users WHERE lower(username) = ?', normalizedUser);
                if (existing) {
                    logAuthEvent('SIGNUP_FAILED_USERNAME_EXISTS', username, {
                        socketId: socket.id,
                        ip: socket.handshake.address
                    });
                    socket.emit('signup_error', 'Username already exists');
                } else {
                    const hashedPassword = await bcrypt.hash(password, 12); // Increased from 10 to 12 for stronger security
                    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', username, hashedPassword);
                    
                    logAuthEvent('USER_REGISTERED', username, {
                        socketId: socket.id,
                        ip: socket.handshake.address
                    });
                    
                    socket.emit('signup_success', 'Account created successfully! You can now login.');

                    // Refresh user list for everyone (new offline user)
                    broadcastUserList();
                }
            } catch (e) {
                logError(e, { 
                    context: 'Signup error', 
                    username, 
                    socketId: socket.id 
                });
                socket.emit('signup_error', 'Server error');
            }
        });

        socket.on('login', async (data) => {
            const { username, password } = data;

            try {
                const user = await db.get('SELECT * FROM users WHERE lower(username) = ?', username.toLowerCase());

                if (user) {
                    const match = await bcrypt.compare(password, user.password);
                    if (match) {
                        logAuthEvent('USER_LOGIN_SUCCESS', username, {
                            socketId: socket.id,
                            ip: socket.handshake.address
                        });
                        socket.emit('login_success', user.username);
                    } else {
                        logSecurityEvent('LOGIN_FAILED_INVALID_PASSWORD', {
                            username,
                            socketId: socket.id,
                            ip: socket.handshake.address
                        });
                        socket.emit('login_error', 'Invalid username or password');
                    }
                } else {
                    logSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', {
                        username,
                        socketId: socket.id,
                        ip: socket.handshake.address
                    });
                    socket.emit('login_error', 'Invalid username or password');
                }
            } catch (e) {
                logError(e, { 
                    context: 'Login error', 
                    username, 
                    socketId: socket.id 
                });
                socket.emit('login_error', 'Server error');
            }
        });

        socket.on('join_channel', async (data) => {
            const { username, channelId } = data;
            socket.join(channelId);

            // Update user info
            users[socket.id] = { username, room: channelId, socketId: socket.id };

            // Broadcast updated user list
            broadcastUserList();

            // Broadcast channel members to all in the channel
            broadcastChannelMembers(channelId);

            // Send system message to channel that user joined
            io.to(channelId).emit('receive_message', {
                id: Date.now(),
                channel_id: channelId,
                sender: 'System',
                text: `${username} joined the channel`,
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                isSystem: true
            });

            // Fetch history from DB (Limit 50)
            try {
                const history = await db.all(`
                    SELECT * FROM (
                        SELECT * FROM messages
                        WHERE channel_id = ?
                        ORDER BY timestamp DESC
                        LIMIT 50
                    ) ORDER BY timestamp ASC
                `, channelId);
                socket.emit('receive_history', history);
            } catch (e) {
                console.error("Fetch history error:", e);
            }

            console.log(`User ${username} joined channel ${channelId}`);
        });

        socket.on('load_more_messages', async (data) => {
            const { channelId, beforeTimestamp } = data;
            try {
                const history = await db.all(`
                    SELECT * FROM (
                        SELECT * FROM messages 
                        WHERE channel_id = ? AND timestamp < ?
                        ORDER BY timestamp DESC 
                        LIMIT 50
                    ) ORDER BY timestamp ASC
                `, channelId, beforeTimestamp);
                socket.emit('more_messages_loaded', history);
            } catch (e) {
                console.error("Load more messages error:", e);
            }
        });

        socket.on('send_message', async (data) => {
            const { channelId, message } = data;

            // Check message rate limiting
            if (!checkMessageRateLimit(message.sender)) {
                logSecurityEvent('MESSAGE_RATE_LIMITED', {
                    username: message.sender,
                    channelId,
                    socketId: socket.id
                });
                socket.emit('message_error', {
                    error: 'You are sending messages too quickly. Please wait a moment.',
                    retryAfter: '1 minute'
                });
                return;
            }

            try {
                // Sanitize message text to prevent XSS attacks
                const sanitizedText = DOMPurify.sanitize(message.text);

                // Create sanitized message object
                const sanitizedMessage = {
                    ...message,
                    text: sanitizedText
                };

                await db.run(
                    'INSERT INTO messages (channel_id, sender, text, time, timestamp) VALUES (?, ?, ?, ?, ?)',
                    channelId, sanitizedMessage.sender, sanitizedMessage.text, sanitizedMessage.time, Date.now()
                );

                logMessageEvent('MESSAGE_SENT', channelId, sanitizedMessage.sender, {
                    messageId: sanitizedMessage.id,
                    messageLength: sanitizedMessage.text.length
                });

                // Broadcast to everyone in the room (including sender)
                io.to(channelId).emit('receive_message', sanitizedMessage);
            } catch (e) {
                logError(e, {
                    context: 'Send message error',
                    username: message.sender,
                    channelId,
                    socketId: socket.id
                });
                socket.emit('message_error', {
                    error: 'Failed to send message. Please try again.'
                });
            }
        });

        // Reply to message
        socket.on('reply_to_message', async (data) => {
            const { channelId, message, replyToId } = data;

            // Check message rate limiting
            if (!checkMessageRateLimit(message.sender)) {
                socket.emit('message_error', {
                    error: 'You are sending messages too quickly. Please wait a moment.',
                    retryAfter: '1 minute'
                });
                return;
            }

            try {
                // Sanitize message text to prevent XSS attacks
                const sanitizedText = DOMPurify.sanitize(message.text);

                // Get the original message to determine thread_id
                const originalMessage = await db.get('SELECT thread_id FROM messages WHERE id = ?', replyToId);

                const threadId = originalMessage?.thread_id || replyToId;

                await db.run(
                    'INSERT INTO messages (channel_id, sender, text, time, timestamp, reply_to, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    channelId, message.sender, sanitizedText, message.time, Date.now(), replyToId, threadId
                );

                // Add reply info to message with sanitized text
                const replyMessage = { ...message, text: sanitizedText, reply_to: replyToId, thread_id: threadId };

                // Broadcast to everyone in the room
                io.to(channelId).emit('receive_message', replyMessage);

                // Notify about the reply
                io.to(channelId).emit('message_replied', {
                    originalMessageId: replyToId,
                    reply: replyMessage
                });

                // Broadcast new thread message for real-time thread view updates
                io.to(channelId).emit('new_thread_message', replyMessage);

                console.log(`User ${message.sender} replied to message ${replyToId} in channel ${channelId}`);
            } catch (e) {
                console.error("Reply to message error:", e);
                socket.emit('message_error', {
                    error: 'Failed to send reply. Please try again.'
                });
            }
        });

        // Get thread messages
        socket.on('get_thread_messages', async (data) => {
            const { channelId, threadId } = data;
            
            try {
                const threadMessages = await db.all(
                    `SELECT * FROM messages 
                     WHERE channel_id = ? AND thread_id = ? 
                     ORDER BY timestamp ASC`,
                    channelId, threadId
                );
                
                socket.emit('thread_messages', {
                    threadId,
                    messages: threadMessages
                });
            } catch (e) {
                console.error("Get thread messages error:", e);
                socket.emit('message_error', {
                    error: 'Failed to load thread messages.'
                });
            }
        });

        // Admin functionality
        socket.on('admin_get_stats', async () => {
            const username = users[socket.id]?.username;
            
            // Check if user is admin based on role in database
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) {
                logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', {
                    username,
                    socketId: socket.id,
                    ip: socket.handshake.address
                });
                return;
            }

            try {
                const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
                const totalMessages = await db.get('SELECT COUNT(*) as count FROM messages');
                const totalChannels = await db.get('SELECT COUNT(*) as count FROM channels');
                const bannedUsers = await db.get("SELECT COUNT(*) as count FROM channel_invites WHERE status = 'banned'");
                
                const stats = {
                    totalUsers: totalUsers.count,
                    onlineUsers: Object.keys(users).length,
                    totalMessages: totalMessages.count,
                    totalChannels: totalChannels.count,
                    bannedUsers: bannedUsers.count,
                    serverUptime: process.uptime() ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : '0h 0m'
                };

                socket.emit('admin_stats', stats);
                logSocketEvent('ADMIN_STATS_ACCESSED', socket.id, { username });
            } catch (e) {
                logError(e, { context: 'Admin get stats error', username });
            }
        });

        socket.on('admin_get_users', async () => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                const allUsers = await db.all('SELECT id, username FROM users');
                const usersWithStatus = allUsers.map(user => ({
                    ...user,
                    status: Object.values(users).some(u => u.username === user.username) ? 'online' : 'offline',
                    lastSeen: null // You might want to track last seen times
                }));

                socket.emit('admin_users', usersWithStatus);
            } catch (e) {
                logError(e, { context: 'Admin get users error', username });
            }
        });

        socket.on('admin_get_channels', async () => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                const channels = await db.all(`
                    SELECT c.*, COUNT(ci.username) as memberCount 
                    FROM channels c 
                    LEFT JOIN channel_invites ci ON c.id = ci.channel_id AND ci.status = 'accepted'
                    GROUP BY c.id
                `);

                socket.emit('admin_channels', channels);
            } catch (e) {
                logError(e, { context: 'Admin get channels error', username });
            }
        });

        socket.on('admin_get_logs', async () => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                // In a real implementation, you would read from log files
                const logs = [
                    { level: 'info', message: 'Server started successfully', timestamp: Date.now() - 3600000 },
                    { level: 'warn', message: 'High memory usage detected', timestamp: Date.now() - 1800000 },
                    { level: 'error', message: 'Database connection timeout', timestamp: Date.now() - 900000 }
                ];

                socket.emit('admin_logs', logs);
            } catch (e) {
                logError(e, { context: 'Admin get logs error', username });
            }
        });

        socket.on('admin_get_banned_users', async () => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                const bannedUsers = await db.all(`
                    SELECT DISTINCT ci.username, ci.timestamp as bannedAt, ci.invited_by as bannedBy
                    FROM channel_invites ci 
                    WHERE ci.status = 'banned'
                `);

                socket.emit('admin_banned_users', bannedUsers);
            } catch (e) {
                logError(e, { context: 'Admin get banned users error', username });
            }
        });

        socket.on('admin_ban_user', async (data) => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) {
                logSecurityEvent('UNAUTHORIZED_BAN_ATTEMPT', {
                    username,
                    targetUser: data.username,
                    socketId: socket.id
                });
                return;
            }

            try {
                // Add ban to all channels
                const channels = await db.all('SELECT id FROM channels');
                for (const channel of channels) {
                    await db.run(`
                        INSERT OR REPLACE INTO channel_invites 
                        (channel_id, username, invited_by, timestamp, status, role) 
                        VALUES (?, ?, ?, ?, 'banned', 'member')
                    `, channel.id, data.username, username, Date.now());
                }

                // Kick user if online
                const targetSocket = Object.entries(users).find(([, u]) => u.username === data.username);
                if (targetSocket) {
                    const [socketId] = targetSocket;
                    io.to(socketId).emit('banned', { reason: data.reason });
                    io.sockets.sockets.get(socketId)?.disconnect();
                }

                logSecurityEvent('USER_BANNED', {
                    bannedUser: data.username,
                    bannedBy: username,
                    reason: data.reason,
                    duration: data.duration
                });

                // Refresh banned users list
                socket.emit('admin_get_banned_users');
            } catch (e) {
                logError(e, { context: 'Admin ban user error', username });
            }
        });

        socket.on('admin_unban_user', async (data) => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                await db.run("DELETE FROM channel_invites WHERE username = ? AND status = 'banned'", data.username);

                logSecurityEvent('USER_UNBANNED', {
                    unbannedUser: data.username,
                    unbannedBy: username
                });

                socket.emit('admin_get_banned_users');
            } catch (e) {
                logError(e, { context: 'Admin unban user error', username });
            }
        });

        socket.on('admin_mute_user', async (data) => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                // You would implement actual muting logic here
                // This could involve setting a mute flag in the database or in memory
                logSecurityEvent('USER_MUTED', {
                    mutedUser: data.username,
                    mutedBy: username,
                    duration: data.duration
                });

                // Notify the user they've been muted
                const targetSocket = Object.entries(users).find(([, u]) => u.username === data.username);
                if (targetSocket) {
                    const [socketId] = targetSocket;
                    io.to(socketId).emit('muted', { duration: data.duration, reason: 'Admin mute' });
                }
            } catch (e) {
                logError(e, { context: 'Admin mute user error', username });
            }
        });

        socket.on('admin_delete_channel', async (data) => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                await db.run('DELETE FROM channels WHERE id = ?', data.channelId);
                await db.run('DELETE FROM messages WHERE channel_id = ?', data.channelId);
                await db.run('DELETE FROM channel_invites WHERE channel_id = ?', data.channelId);

                logChannelEvent('CHANNEL_DELETED_BY_ADMIN', data.channelId, username);

                // Notify all users
                io.emit('channel_deleted', { channelId: data.channelId });

                socket.emit('admin_get_channels');
            } catch (e) {
                logError(e, { context: 'Admin delete channel error', username });
            }
        });

        socket.on('admin_announcement', async (data) => {
            const username = users[socket.id]?.username;
            const userIsAdmin = await isAdmin(username);

            if (!userIsAdmin) return;

            try {
                // Send announcement to all users
                io.emit('announcement', {
                    message: data.message,
                    from: username,
                    timestamp: Date.now()
                });

                logSocketEvent('ADMIN_ANNOUNCEMENT', socket.id, { username, message: data.message });
            } catch (e) {
                logError(e, { context: 'Admin announcement error', username });
            }
        });

        socket.on('admin_restart_warning', async () => {
            const username = users[socket.id]?.username;
            const isAdmin = username === 'admin' || username === 'system';
            
            if (!isAdmin) return;

            try {
                io.emit('server_restart_warning', {
                    message: 'Server will restart in 5 minutes. Please save your work.',
                    timestamp: Date.now()
                });

                logSocketEvent('ADMIN_RESTART_WARNING', socket.id, { username });
            } catch (e) {
                logError(e, { context: 'Admin restart warning error', username });
            }
        });

        socket.on('typing', (data) => {
            const { channelId, username } = data;
            // Broadcast to everyone ELSE in the room
            socket.to(channelId).emit('user_typing', { username });
        });

        socket.on('stop_typing', (data) => {
            const { channelId, username } = data;
            socket.to(channelId).emit('user_stopped_typing', { username });
        });

        // Delete message (sender only)
        socket.on('delete_message', async (data) => {
            const { messageId, channelId, username } = data;
            try {
                const msg = await db.get('SELECT sender FROM messages WHERE id = ?', messageId);
                if (msg && msg.sender === username) {
                    await db.run('DELETE FROM messages WHERE id = ?', messageId);
                    await db.run('DELETE FROM reactions WHERE message_id = ?', messageId);
                    io.to(channelId).emit('message_deleted', { messageId });
                    console.log(`Message ${messageId} deleted by ${username}`);
                }
            } catch (e) {
                console.error("Delete message error:", e);
            }
        });

        // Edit message (sender only)
        socket.on('edit_message', async (data) => {
            const { messageId, channelId, username, newText } = data;
            try {
                const msg = await db.get('SELECT sender FROM messages WHERE id = ?', messageId);
                if (msg && msg.sender === username) {
                    // Sanitize the new text to prevent XSS attacks
                    const sanitizedText = DOMPurify.sanitize(newText);
                    const editedText = sanitizedText + ' (edited)';

                    await db.run('UPDATE messages SET text = ? WHERE id = ?', editedText, messageId);
                    io.to(channelId).emit('message_edited', { messageId, newText: editedText });
                    console.log(`Message ${messageId} edited by ${username}`);
                }
            } catch (e) {
                console.error("Edit message error:", e);
            }
        });

        // Reaction events
        socket.on('add_reaction', async (data) => {
            const { messageId, channelId, emoji, username } = data;
            try {
                await db.run(
                    'INSERT OR IGNORE INTO reactions (message_id, channel_id, username, emoji, timestamp) VALUES (?, ?, ?, ?, ?)',
                    messageId, channelId, username, emoji, Date.now()
                );
                // Fetch all reactions for this message
                const reactions = await db.all(
                    'SELECT emoji, username FROM reactions WHERE message_id = ?',
                    messageId
                );
                // Broadcast to everyone in the channel
                io.to(channelId).emit('reaction_updated', { messageId, reactions });
            } catch (e) {
                console.error("Add reaction error:", e);
            }
        });

        socket.on('remove_reaction', async (data) => {
            const { messageId, channelId, emoji, username } = data;
            try {
                await db.run(
                    'DELETE FROM reactions WHERE message_id = ? AND username = ? AND emoji = ?',
                    messageId, username, emoji
                );
                // Fetch updated reactions
                const reactions = await db.all(
                    'SELECT emoji, username FROM reactions WHERE message_id = ?',
                    messageId
                );
                io.to(channelId).emit('reaction_updated', { messageId, reactions });
            } catch (e) {
                console.error("Remove reaction error:", e);
            }
        });

        // Read receipts
        socket.on('mark_read', async (data) => {
            const { messageIds, channelId, username } = data;
            try {
                for (const msgId of messageIds) {
                    await db.run(
                        'INSERT OR IGNORE INTO message_reads (message_id, channel_id, username, read_at) VALUES (?, ?, ?, ?)',
                        msgId, channelId, username, Date.now()
                    );
                }
                // Broadcast read receipts to channel
                const readData = await db.all(
                    `SELECT message_id, username FROM message_reads WHERE channel_id = ? AND message_id IN (${messageIds.join(',')})`,
                    channelId
                );
                io.to(channelId).emit('messages_read', { channelId, reads: readData });
            } catch (e) {
                console.error("Mark read error:", e);
            }
        });

        // Leave channel
        socket.on('leave_channel', (data) => {
            const { channelId, username } = data;

            // Send system message before leaving
            io.to(channelId).emit('receive_message', {
                id: Date.now(),
                channel_id: channelId,
                sender: 'System',
                text: `${username} left the channel`,
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                isSystem: true
            });

            socket.leave(channelId);
            if (users[socket.id]) {
                users[socket.id].room = null;
            }

            // Notify channel
            io.to(channelId).emit('user_left_channel', { username, channelId });

            // Update channel members list
            broadcastChannelMembers(channelId);

            console.log(`User ${username} left channel ${channelId}`);
        });

        // Kick user (host or host-assist)
        socket.on('kick_user', async (data) => {
            const { channelId, targetUsername, hostUsername } = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);

                // Check if user is host or host-assist
                const isHost = channel && channel.host === hostUsername;
                const hostAssistInvite = await db.get(
                    'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                    channelId, hostUsername, 'host_assist', 'accepted'
                );
                const isHostAssist = !!hostAssistInvite;

                if (isHost || isHostAssist) {
                    // Ban the user (create or update invite to banned status)
                    await db.run(
                        'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, status, role) VALUES (?, ?, ?, ?, ?, ?)',
                        channelId, targetUsername, hostUsername, Date.now(), 'banned', 'member'
                    );

                    // Send system message
                    io.to(channelId).emit('receive_message', {
                        id: Date.now(),
                        channel_id: channelId,
                        sender: 'System',
                        text: `${targetUsername} was kicked by ${hostUsername}`,
                        time: new Date().toLocaleTimeString(),
                        timestamp: Date.now(),
                        isSystem: true
                    });

                    // Find target socket and move them to default room
                    const targetSocketEntry = Object.entries(users).find(([, u]) => u.username === targetUsername && u.room === channelId);
                    if (targetSocketEntry) {
                        const [targetSocketId] = targetSocketEntry;
                        const targetSocket = io.sockets.sockets.get(targetSocketId);
                        if (targetSocket) {
                            // Leave current channel
                            targetSocket.leave(channelId);

                            // Auto-join default channel (c1 - General)
                            const defaultChannelId = 'c1';
                            targetSocket.join(defaultChannelId);
                            users[targetSocketId].room = defaultChannelId;

                            // Notify the kicked user
                            io.to(targetSocketId).emit('kicked_from_channel', {
                                channelId,
                                by: hostUsername,
                                redirectTo: defaultChannelId
                            });

                            // Send system message to default channel
                            io.to(defaultChannelId).emit('receive_message', {
                                id: Date.now() + 1,
                                channel_id: defaultChannelId,
                                sender: 'System',
                                text: `${targetUsername} joined the channel`,
                                time: new Date().toLocaleTimeString(),
                                timestamp: Date.now(),
                                isSystem: true
                            });

                            // Broadcast members update for default channel
                            broadcastChannelMembers(defaultChannelId);
                        }
                    }
                    io.to(channelId).emit('user_kicked', { username: targetUsername, by: hostUsername });

                    // Update channel members for the channel user was kicked from
                    broadcastChannelMembers(channelId);

                    console.log(`User ${targetUsername} kicked from ${channelId} by ${hostUsername}`);
                }
            } catch (e) {
                console.error("Kick user error:", e);
            }
        });

        // Make host (host only)
        socket.on('make_host', async (data) => {
            const { channelId, targetUsername, currentHost} = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (channel && channel.host === currentHost) {
                    // Update channel host in database
                    await db.run('UPDATE channels SET host = ? WHERE id = ?', targetUsername, channelId);

                    // Send system message
                    io.to(channelId).emit('receive_message', {
                        id: Date.now(),
                        channel_id: channelId,
                        sender: 'System',
                        text: `${targetUsername} is now the host`,
                        time: new Date().toLocaleTimeString(),
                        timestamp: Date.now(),
                        isSystem: true
                    });

                    // Notify everyone about host change
                    io.to(channelId).emit('host_changed', { channelId, newHost: targetUsername });

                    // Update channel members to reflect new host
                    broadcastChannelMembers(channelId);

                    console.log(`${targetUsername} is now host of ${channelId}`);
                }
            } catch (e) {
                console.error("Make host error:", e);
            }
        });

        // Invite user to be host-assist (host only)
        socket.on('invite_host_assist', async (data) => {
            const { channelId, channelName, targetUsername, fromUsername } = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (channel && channel.host === fromUsername) {
                    // Create host-assist invite
                    await db.run(
                        'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                        channelId, targetUsername, fromUsername, Date.now(), 'host_assist', 'invited'
                    );
                    console.log(`Created host-assist invite for ${targetUsername} to ${channelId}`);

                    // Find target user's socket and notify them
                    const targetSocketEntry = Object.entries(users).find(([, u]) => u.username === targetUsername);
                    if (targetSocketEntry) {
                        const [socketId] = targetSocketEntry;
                        io.to(socketId).emit('host_assist_invitation_received', {
                            from: fromUsername,
                            channelName,
                            channelId
                        });
                        console.log(`Sent host-assist invitation to ${targetUsername}`);
                    }
                }
            } catch (e) {
                console.error("Invite host-assist error:", e);
            }
        });

        // Respond to host-assist invitation
        socket.on('respond_host_assist', async (data) => {
            const { channelId, username, accepted } = data;
            try {
                if (accepted) {
                    // Update status to accepted
                    await db.run(
                        'UPDATE channel_invites SET status = ? WHERE channel_id = ? AND username = ? AND role = ?',
                        'accepted', channelId, username, 'host_assist'
                    );

                    // Send system message
                    io.to(channelId).emit('receive_message', {
                        id: Date.now(),
                        channel_id: channelId,
                        sender: 'System',
                        text: `${username} is now a host-assist`,
                        time: new Date().toLocaleTimeString(),
                        timestamp: Date.now(),
                        isSystem: true
                    });

                    // Update channel members
                    broadcastChannelMembers(channelId);

                    console.log(`${username} accepted host-assist for ${channelId}`);
                } else {
                    // Delete the invite if rejected
                    await db.run(
                        'DELETE FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ?',
                        channelId, username, 'host_assist'
                    );
                    console.log(`${username} rejected host-assist for ${channelId}`);
                }
            } catch (e) {
                console.error("Respond host-assist error:", e);
            }
        });

        // Delete channel (host only)
        socket.on('delete_channel', async (data) => {
            const { channelId, username } = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (channel && channel.host === username) {
                    // Delete channel and related data
                    await db.run('DELETE FROM channels WHERE id = ?', channelId);
                    await db.run('DELETE FROM messages WHERE channel_id = ?', channelId);
                    await db.run('DELETE FROM channel_invites WHERE channel_id = ?', channelId);
                    await db.run('DELETE FROM reactions WHERE channel_id = ?', channelId);
                    await db.run('DELETE FROM message_reads WHERE channel_id = ?', channelId);

                    // Notify all users in the channel
                    io.to(channelId).emit('channel_deleted', { channelId, deletedBy: username });

                    // Update channel list for all users
                    broadcastChannelList();

                    console.log(`Channel ${channelId} deleted by ${username}`);
                } else {
                    socket.emit('delete_channel_error', 'Only the host can delete this channel');
                }
            } catch (e) {
                console.error("Delete channel error:", e);
                socket.emit('delete_channel_error', 'Failed to delete channel');
            }
        });

        // Mute user (host only)
        socket.on('mute_user', async (data) => {
            const { channelId, targetUsername, hostUsername, muted } = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (channel && channel.host === hostUsername) {
                    io.to(channelId).emit('user_muted', { username: targetUsername, muted, by: hostUsername });
                    console.log(`User ${targetUsername} ${muted ? 'muted' : 'unmuted'} in ${channelId} by ${hostUsername}`);
                }
            } catch (e) {
                console.error("Mute user error:", e);
            }
        });

        socket.on('get_channels', async () => {
            try {
                const channels = await db.all('SELECT * FROM channels');
                const sanitizedChannels = channels.map(c => ({
                    id: c.id,
                    name: c.name,
                    hasPasscode: !!c.passcode,
                    host: c.host
                }));
                socket.emit('update_channel_list', sanitizedChannels);
            } catch (e) {
                console.error("Get channels error:", e);
            }
        });

        socket.on('create_channel', async (data) => {
            const { name, passcode, host } = data;
            const newId = `c${Date.now()}`;

            try {
                await db.run(
                    'INSERT INTO channels (id, name, passcode, host) VALUES (?, ?, ?, ?)',
                    newId, name, passcode || null, host
                );
                broadcastChannelList();
                console.log(`Channel Created: ${name} (ID: ${newId})`);
            } catch (e) {
                console.error("Create channel error:", e);
            }
        });

        // Invite user to a channel
        socket.on('invite_user', async (data) => {
            const { channelId, channelName, targetUsername, fromUsername } = data;
            try {
                // Store/update the invite in database (clear any ban status)
                await db.run(
                    'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                    channelId, targetUsername, fromUsername, Date.now(), 'member', 'invited'
                );
                console.log(`Stored invite for ${targetUsername} to ${channelId}`);

                // Find target user's socket and notify them
                console.log('Looking for user:', targetUsername, 'in users:', Object.values(users).map(u => u.username));
                const targetSocketEntry = Object.entries(users).find(([, u]) => u.username === targetUsername);
                if (targetSocketEntry) {
                    const [socketId] = targetSocketEntry;
                    console.log(`Sending invitation to socket ${socketId}`);
                    io.to(socketId).emit('invitation_received', {
                        from: fromUsername,
                        channelName,
                        channelId
                    });
                } else {
                    console.log(`User ${targetUsername} not currently online`);
                }
            } catch (e) {
                console.error("Invite user error:", e);
            }
        });

        socket.on('join_channel_request', async (data) => {
            const { channelId, passcode, username } = data;

            try {
                const channel = await db.get('SELECT * FROM channels WHERE id = ?', channelId);

                if (!channel) {
                    socket.emit("join_channel_error", "Channel not found");
                    return;
                }

                // Check if banned
                let isBanned = false;
                let isInvited = false;
                try {
                    const invite = await db.get('SELECT * FROM channel_invites WHERE channel_id = ? AND username = ?',
                        channelId, username);
                    if (invite) {
                        console.log(`Invite found for ${username} in ${channelId}:`, invite);
                        if (invite.status === 'banned') {
                            isBanned = true;
                        } else if (invite.status === 'invited' || invite.status === 'accepted') {
                            isInvited = true;
                        }
                    } else {
                        console.log(`No invite found for ${username} in ${channelId}`);
                    }
                } catch (e) {
                    console.error("ERROR checking invite - This likely means the database schema is missing columns:", e);
                    console.error("Stack trace:", e.stack);
                    // If there's a database error, emit it to the client
                    socket.emit("join_channel_error", `Database error: ${e.message}. Please contact administrator.`);
                    return;
                }

                // Reject if banned
                if (isBanned) {
                    socket.emit("join_channel_error", "You have been banned from this channel");
                    return;
                }

                // Grant access if invited OR host OR (no passcode OR passcode matches)
                if (isInvited || channel.host === username || !channel.passcode || channel.passcode === passcode) {
                    // Mark invite as accepted if it exists, or create one if user joined with passcode
                    if (isInvited) {
                        await db.run('UPDATE channel_invites SET status = ? WHERE channel_id = ? AND username = ?',
                            'accepted', channelId, username);
                    } else if (channel.passcode && channel.passcode === passcode) {
                        // User joined with correct passcode - create accepted invite so they don't need passcode again
                        await db.run(
                            'INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                            channelId, username, channel.host, Date.now(), 'member', 'accepted'
                        );
                        console.log(`Created accepted invite for ${username} in ${channelId} (joined with passcode)`);
                    }
                    socket.emit("join_channel_success", channelId);
                } else {
                    // Return object with needsPasscode flag if passcode was null
                    if (passcode === null) {
                        socket.emit("join_channel_error", { msg: "Invalid passcode", channelId, needsPasscode: true });
                    } else {
                        socket.emit("join_channel_error", "Invalid passcode");
                    }
                }
            } catch (e) {
                console.error("Join channel request error:", e);
            }

            // Also send existing users in the room for WebRTC discovery if needed
            const room = io.sockets.adapter.rooms.get(channelId);
            const otherUsers = room ? Array.from(room).filter(id => id !== socket.id) : [];
            if (otherUsers.length > 0) {
                socket.emit("all_users", otherUsers);
            }
        });

        // --- Video Call Signaling ---

        socket.on("join_video", (channelId) => {
            const room = io.sockets.adapter.rooms.get(channelId);
            const otherUsers = room ? Array.from(room).filter(id => id !== socket.id) : [];
            socket.emit("all_users", otherUsers);
        });

        socket.on("call_user", (data) => {
            io.to(data.userToCall).emit("call_received", {
                signal: data.signal,
                from: data.from
            });
        });

        socket.on("answer_call", (data) => {
            io.to(data.to).emit("call_answered", {
                signal: data.signal,
                from: data.from
            });
        });

        socket.on("ice_candidate", (data) => {
            io.to(data.to).emit("ice_candidate_received", {
                candidate: data.candidate,
                from: data.from
            });
        });

        // --- Call Notification System (1-on-1 Calls) ---

        socket.on("initiate_call", (data) => {
            const { to, channelId, from, isVideo } = data;

            // Find recipient socket
            let recipientSocketId;
            if (to) {
                // 1-on-1 call - find user's socket
                const recipientEntry = Object.entries(users).find(([, u]) => u.username === to);
                if (recipientEntry) {
                    recipientSocketId = recipientEntry[0];
                }
            } else {
                // Broadcast to channel (for future group calls)
                io.to(channelId).emit("incoming_call", {
                    from,
                    isVideo,
                    channelId
                });
                return;
            }

            if (recipientSocketId) {
                io.to(recipientSocketId).emit("incoming_call", {
                    from,
                    isVideo,
                    channelId
                });

                // Store call state for cancellation
                socket.callState = { to, channelId, isVideo };
                console.log(`Call initiated from ${from} to ${to} (${isVideo ? 'video' : 'voice'})`);
            } else {
                socket.emit("call_failed", { reason: "User not online" });
            }
        });

        socket.on("accept_call", (data) => {
            const { from, channelId } = data;

            // Find caller's socket
            const callerEntry = Object.entries(users).find(([, u]) => u.username === from);
            if (callerEntry) {
                const [callerSocketId] = callerEntry;
                const caller = users[callerSocketId];

                // Emit to both caller and accepter
                io.to(callerSocketId).emit("call_accepted", {
                    channelId,
                    isVideo: caller.callState?.isVideo || false
                });
                socket.emit("call_accepted", {
                    channelId,
                    isVideo: caller.callState?.isVideo || false
                });

                console.log(`Call accepted by ${users[socket.id]?.username} from ${from}`);

                // Clear call state
                if (users[callerSocketId]) {
                    delete users[callerSocketId].callState;
                }
            }
        });

        socket.on("decline_call", (data) => {
            const { from } = data;

            // Find caller's socket
            const callerEntry = Object.entries(users).find(([, u]) => u.username === from);
            if (callerEntry) {
                const [callerSocketId] = callerEntry;
                io.to(callerSocketId).emit("call_declined", { by: users[socket.id]?.username });
                console.log(`Call declined by ${users[socket.id]?.username} from ${from}`);

                // Clear call state
                if (users[callerSocketId]) {
                    delete users[callerSocketId].callState;
                }
            }
        });

        // Note: Call cancellation on disconnect is handled in the main disconnect handler below

        // --- Group Voice Channel Events ---

        socket.on("join_voice", async (data) => {
            const { channelId, username } = data;

            try {
                // Check if user is in the text channel first
                if (!users[socket.id] || users[socket.id].room !== channelId) {
                    socket.emit("voice_error", { message: "You must be in the channel to join voice" });
                    return;
                }

                // Get channel info
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (!channel) {
                    socket.emit("voice_error", { message: "Channel not found" });
                    return;
                }

                const isHost = channel.host === username;
                const hostAssistInvite = await db.get(
                    'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                    channelId, username, 'host_assist', 'accepted'
                );
                const isHostAssist = !!hostAssistInvite;

                // Check if user has permission
                const hasPermission = isHost || isHostAssist;
                const permissionRecord = await db.get(
                    'SELECT * FROM voice_permissions WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Add to voice session
                await db.run(
                    'INSERT OR REPLACE INTO voice_sessions (channel_id, username, is_muted, can_unmute, joined_at) VALUES (?, ?, ?, ?, ?)',
                    channelId, username, 1, hasPermission || !!permissionRecord ? 1 : 0, Date.now()
                );

                // Join voice room (for WebRTC signaling)
                const voiceRoomId = `voice_${channelId}`;
                socket.join(voiceRoomId);

                // Get all users currently in voice
                const voiceUsers = await db.all(
                    'SELECT * FROM voice_sessions WHERE channel_id = ?',
                    channelId
                );

                // Notify everyone in voice
                io.to(voiceRoomId).emit("voice_user_joined", {
                    channelId,
                    username,
                    users: voiceUsers
                });

                // Send WebRTC peer list to new user
                const room = io.sockets.adapter.rooms.get(voiceRoomId);
                const otherUsers = room ? Array.from(room).filter(id => id !== socket.id) : [];
                socket.emit("voice_peers", { users: otherUsers });

                console.log(`${username} joined voice in ${channelId}`);
            } catch (e) {
                console.error("Join voice error:", e);
                socket.emit("voice_error", { message: "Failed to join voice" });
            }
        });

        socket.on("leave_voice", async (data) => {
            const { channelId, username } = data;

            try {
                // Remove from voice session
                await db.run(
                    'DELETE FROM voice_sessions WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Leave voice room
                const voiceRoomId = `voice_${channelId}`;
                socket.leave(voiceRoomId);

                // Get remaining users
                const voiceUsers = await db.all(
                    'SELECT * FROM voice_sessions WHERE channel_id = ?',
                    channelId
                );

                // Notify everyone
                io.to(voiceRoomId).emit("voice_user_left", {
                    channelId,
                    username,
                    users: voiceUsers
                });

                console.log(`${username} left voice in ${channelId}`);
            } catch (e) {
                console.error("Leave voice error:", e);
            }
        });

        socket.on("toggle_mute", async (data) => {
            const { channelId, username, isMuted } = data;

            try {
                // Check if user can unmute
                const session = await db.get(
                    'SELECT can_unmute FROM voice_sessions WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                if (!session) {
                    socket.emit("voice_error", { message: "Not in voice session" });
                    return;
                }

                // If trying to unmute but don't have permission
                if (!isMuted && !session.can_unmute) {
                    socket.emit("voice_error", { message: "You don't have permission to unmute" });
                    return;
                }

                // Update mute status
                await db.run(
                    'UPDATE voice_sessions SET is_muted = ? WHERE channel_id = ? AND username = ?',
                    isMuted ? 1 : 0, channelId, username
                );

                // Notify everyone in voice
                const voiceRoomId = `voice_${channelId}`;
                io.to(voiceRoomId).emit("voice_user_muted", {
                    channelId,
                    username,
                    isMuted
                });

                console.log(`${username} ${isMuted ? 'muted' : 'unmuted'} in ${channelId}`);
            } catch (e) {
                console.error("Toggle mute error:", e);
            }
        });

        socket.on("request_unmute_permission", async (data) => {
            const { channelId, username } = data;

            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (!channel) return;

                // Find host and host-assists
                const hostAssists = await db.all(
                    'SELECT username FROM channel_invites WHERE channel_id = ? AND role = ? AND status = ?',
                    channelId, 'host_assist', 'accepted'
                );

                const admins = [channel.host, ...hostAssists.map(ha => ha.username)];

                // Notify all admins
                admins.forEach(adminUsername => {
                    const adminEntry = Object.entries(users).find(([, u]) => u.username === adminUsername);
                    if (adminEntry) {
                        const [adminSocketId] = adminEntry;
                        io.to(adminSocketId).emit("unmute_permission_requested", {
                            channelId,
                            username,
                            timestamp: Date.now()
                        });
                    }
                });

                socket.emit("permission_request_sent");
                console.log(`${username} requested unmute permission in ${channelId}`);
            } catch (e) {
                console.error("Request permission error:", e);
            }
        });

        socket.on("grant_unmute_permission", async (data) => {
            const { channelId, username, grantedBy } = data;

            try {
                // Verify granter is host or host-assist
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                const hostAssistInvite = await db.get(
                    'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                    channelId, grantedBy, 'host_assist', 'accepted'
                );

                const isHost = channel && channel.host === grantedBy;
                const isHostAssist = !!hostAssistInvite;

                if (!isHost && !isHostAssist) {
                    socket.emit("voice_error", { message: "You don't have permission to grant unmute" });
                    return;
                }

                // Grant permission
                await db.run(
                    'INSERT OR REPLACE INTO voice_permissions (channel_id, username, granted_by, granted_at) VALUES (?, ?, ?, ?)',
                    channelId, username, grantedBy, Date.now()
                );

                // Update voice session
                await db.run(
                    'UPDATE voice_sessions SET can_unmute = 1 WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Notify the user
                const userEntry = Object.entries(users).find(([, u]) => u.username === username);
                if (userEntry) {
                    const [userSocketId] = userEntry;
                    io.to(userSocketId).emit("unmute_permission_granted", {
                        channelId,
                        grantedBy
                    });
                }

                // Notify voice room
                const voiceRoomId = `voice_${channelId}`;
                io.to(voiceRoomId).emit("voice_permission_updated", {
                    channelId,
                    username,
                    canUnmute: true
                });

                console.log(`${grantedBy} granted unmute permission to ${username} in ${channelId}`);
            } catch (e) {
                console.error("Grant permission error:", e);
            }
        });

        socket.on("revoke_unmute_permission", async (data) => {
            const { channelId, username, revokedBy } = data;

            try {
                // Verify revoker is host or host-assist
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                const hostAssistInvite = await db.get(
                    'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                    channelId, revokedBy, 'host_assist', 'accepted'
                );

                const isHost = channel && channel.host === revokedBy;
                const isHostAssist = !!hostAssistInvite;

                if (!isHost && !isHostAssist) {
                    socket.emit("voice_error", { message: "You don't have permission to revoke unmute" });
                    return;
                }

                // Revoke permission
                await db.run(
                    'DELETE FROM voice_permissions WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Update voice session and force mute
                await db.run(
                    'UPDATE voice_sessions SET can_unmute = 0, is_muted = 1 WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Notify the user
                const userEntry = Object.entries(users).find(([, u]) => u.username === username);
                if (userEntry) {
                    const [userSocketId] = userEntry;
                    io.to(userSocketId).emit("unmute_permission_revoked", {
                        channelId,
                        revokedBy
                    });
                }

                // Notify voice room
                const voiceRoomId = `voice_${channelId}`;
                io.to(voiceRoomId).emit("voice_permission_updated", {
                    channelId,
                    username,
                    canUnmute: false,
                    isMuted: true
                });

                console.log(`${revokedBy} revoked unmute permission from ${username} in ${channelId}`);
            } catch (e) {
                console.error("Revoke permission error:", e);
            }
        });

        socket.on("server_mute_user", async (data) => {
            const { channelId, username, mutedBy } = data;

            try {
                // Verify muter is host or host-assist
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                const hostAssistInvite = await db.get(
                    'SELECT * FROM channel_invites WHERE channel_id = ? AND username = ? AND role = ? AND status = ?',
                    channelId, mutedBy, 'host_assist', 'accepted'
                );

                const isHost = channel && channel.host === mutedBy;
                const isHostAssist = !!hostAssistInvite;

                if (!isHost && !isHostAssist) {
                    socket.emit("voice_error", { message: "You don't have permission to mute others" });
                    return;
                }

                // Force mute
                await db.run(
                    'UPDATE voice_sessions SET is_muted = 1 WHERE channel_id = ? AND username = ?',
                    channelId, username
                );

                // Notify the user (client must stop their audio track)
                const userEntry = Object.entries(users).find(([, u]) => u.username === username);
                if (userEntry) {
                    const [userSocketId] = userEntry;
                    io.to(userSocketId).emit("force_muted", {
                        channelId,
                        by: mutedBy
                    });
                }

                // Notify voice room
                const voiceRoomId = `voice_${channelId}`;
                io.to(voiceRoomId).emit("voice_user_muted", {
                    channelId,
                    username,
                    isMuted: true,
                    forcedBy: mutedBy
                });

                console.log(`${mutedBy} force muted ${username} in ${channelId}`);
            } catch (e) {
                console.error("Server mute error:", e);
            }
        });

        socket.on('invite_user', async (data) => {
            const { targetUsername, channelId, fromUsername } = data;

            // Store the invitation
            try {
                await db.run('INSERT OR REPLACE INTO channel_invites (channel_id, username, invited_by, timestamp) VALUES (?, ?, ?, ?)',
                    channelId, targetUsername, fromUsername, Date.now());
                console.log(`Stored invite for ${targetUsername} to ${channelId}`);
            } catch (e) {
                console.error("Error storing invite:", e);
            }

            // Find the socket ID of the target user
            const targetSocket = Object.values(users).find(u => u.username === targetUsername);

            if (targetSocket) {
                // We need to fetch channel name for the notification
                db.get('SELECT name FROM channels WHERE id = ?', channelId).then(channel => {
                    if (channel) {
                        io.to(targetSocket.socketId).emit("invitation_received", {
                            from: fromUsername,
                            channelName: channel.name,
                            channelId: channelId
                        });
                    }
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('User Disconnected', socket.id);

            // Cancel any pending calls
            if (socket.callState) {
                const { to } = socket.callState;
                const recipientEntry = Object.entries(users).find(([, u]) => u.username === to);
                if (recipientEntry) {
                    const [recipientSocketId] = recipientEntry;
                    io.to(recipientSocketId).emit("call_cancelled");
                }
                delete socket.callState;
            }

            // Get user info before deleting
            const user = users[socket.id];
            if (user && user.room) {
                // Send system message to channel
                io.to(user.room).emit('receive_message', {
                    id: Date.now(),
                    channel_id: user.room,
                    sender: 'System',
                    text: `${user.username} disconnected`,
                    time: new Date().toLocaleTimeString(),
                    timestamp: Date.now(),
                    isSystem: true
                });

                // Update channel members
                broadcastChannelMembers(user.room);
            }

            delete users[socket.id];
            broadcastUserList();
        });
    });
}
