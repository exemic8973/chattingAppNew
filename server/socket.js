import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

// Active sessions (keep in memory)
const users = {}; // socket.id -> { username, room }

export function setupSocket(io) {
    const db = getDb();

    io.on('connection', (socket) => {
        console.log(`User Connected: ${socket.id}`);

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

        // Auth Events
        socket.on('signup', async (data) => {
            const { username, password } = data;
            const normalizedUser = username.toLowerCase();

            try {
                const existing = await db.get('SELECT * FROM users WHERE lower(username) = ?', normalizedUser);
                if (existing) {
                    socket.emit('signup_error', 'Username already exists');
                } else {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', username, hashedPassword);
                    console.log(`New User Registered: ${username}`);
                    socket.emit('signup_success', 'Account created successfully! You can now login.');

                    // Refresh user list for everyone (new offline user)
                    broadcastUserList();
                }
            } catch (e) {
                console.error("Signup error:", e);
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
                        socket.emit('login_success', user.username);
                    } else {
                        socket.emit('login_error', 'Invalid username or password');
                    }
                } else {
                    socket.emit('login_error', 'Invalid username or password');
                }
            } catch (e) {
                console.error("Login error:", e);
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

            try {
                await db.run(
                    'INSERT INTO messages (channel_id, sender, text, time, timestamp) VALUES (?, ?, ?, ?, ?)',
                    channelId, message.sender, message.text, message.time, Date.now()
                );

                // Broadcast to everyone in the room (including sender)
                io.to(channelId).emit('receive_message', message);
            } catch (e) {
                console.error("Send message error:", e);
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
                    await db.run('UPDATE messages SET text = ? WHERE id = ?', newText + ' (edited)', messageId);
                    io.to(channelId).emit('message_edited', { messageId, newText: newText + ' (edited)' });
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
            socket.leave(channelId);
            if (users[socket.id]) {
                users[socket.id].room = null;
            }
            // Notify channel
            io.to(channelId).emit('user_left_channel', { username, channelId });
            console.log(`User ${username} left channel ${channelId}`);
        });

        // Kick user (host only)
        socket.on('kick_user', async (data) => {
            const { channelId, targetUsername, hostUsername } = data;
            try {
                const channel = await db.get('SELECT host FROM channels WHERE id = ?', channelId);
                if (channel && channel.host === hostUsername) {
                    // Remove invite so they need to be re-invited
                    await db.run('DELETE FROM channel_invites WHERE channel_id = ? AND username = ?', channelId, targetUsername);

                    // Find target socket and remove from room
                    const targetSocketEntry = Object.entries(users).find(([, u]) => u.username === targetUsername && u.room === channelId);
                    if (targetSocketEntry) {
                        const [targetSocketId] = targetSocketEntry;
                        io.sockets.sockets.get(targetSocketId)?.leave(channelId);
                        io.to(targetSocketId).emit('kicked_from_channel', { channelId, by: hostUsername });
                    }
                    io.to(channelId).emit('user_kicked', { username: targetUsername, by: hostUsername });
                    console.log(`User ${targetUsername} kicked from ${channelId} by ${hostUsername}`);
                }
            } catch (e) {
                console.error("Kick user error:", e);
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
                // Store the invite in database
                await db.run(
                    'INSERT OR IGNORE INTO channel_invites (channel_id, username, invited_by, timestamp) VALUES (?, ?, ?, ?)',
                    channelId, targetUsername, fromUsername, Date.now()
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

                // Check if invited
                let isInvited = false;
                try {
                    const invite = await db.get('SELECT * FROM channel_invites WHERE channel_id = ? AND username = ?',
                        channelId, username);
                    if (invite) isInvited = true;
                } catch (e) {
                    console.error("Error checking invite:", e);
                }

                // Grant access if invited OR (passcode matches OR host is user) OR no passcode
                if (isInvited || !channel.passcode || channel.passcode === passcode || channel.host === username) {
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
            delete users[socket.id];
            broadcastUserList();
        });
    });
}
