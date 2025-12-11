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

        const broadcastChannelMembers = async (channelId) => {
            try {
                // Get all users currently in this channel
                const channelMembers = Object.values(users)
                    .filter(user => user.room === channelId)
                    .map(user => user.username);

                // Get user details from database
                const membersWithDetails = await Promise.all(
                    channelMembers.map(async (username) => {
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
                        if (invite.status === 'banned') {
                            isBanned = true;
                        } else if (invite.status === 'invited' || invite.status === 'accepted') {
                            isInvited = true;
                        }
                    }
                } catch (e) {
                    console.error("Error checking invite:", e);
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
