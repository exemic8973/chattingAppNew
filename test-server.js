import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Global user list that persists across connections
let globalUsers = [
  { id: 'u1', name: 'Alice', avatar: null, status: 'online' },
  { id: 'u2', name: 'Bob', avatar: null, status: 'online' },
  { id: 'u3', name: 'Charlie', avatar: null, status: 'offline' },
  { id: 'u4', name: 'David', avatar: null, status: 'online' }
];

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);
  
  // Send initial user list on connection
  socket.emit('update_user_list', globalUsers);
  
  // Authentication handlers
  socket.on('signup', async (data) => {
    const { username, password } = data;
    console.log('Signup attempt:', username);
    // For testing, always succeed
    socket.emit('signup_success', 'Account created successfully! You can now login.');
  });
  
  socket.on('login', async (data) => {
    const { username, password } = data;
    console.log('Login attempt:', username);
    // For testing, always succeed
    socket.emit('login_success', username);
    
    // Add this user to the global user list and broadcast to all
    const newUser = { id: 'socket-' + socket.id, name: username, avatar: null, status: 'online' };
    // Check if user already exists
    const existingUser = globalUsers.find(u => u.name === username);
    if (!existingUser) {
      globalUsers.push(newUser);
    } else {
      // Update existing user status
      existingUser.status = 'online';
      existingUser.id = 'socket-' + socket.id;
    }
    io.emit('update_user_list', globalUsers);
    
    // Send initial channels after login
    socket.emit('get_channels');
  });
  
  socket.on('get_channels', () => {
    const channels = [
      { id: 'c1', name: 'General', hasPasscode: false, host: 'system' },
      { id: 'c2', name: 'Standup', hasPasscode: false, host: 'system' },
      { id: 'c3', name: 'Random', hasPasscode: false, host: 'system' }
    ];
    socket.emit('update_channel_list', channels);
  });
  
  socket.on('create_channel', (data) => {
    const { name, passcode, host } = data;
    const newChannel = {
      id: `c${Date.now()}`,
      name: name,
      hasPasscode: !!passcode,
      host: host
    };
    console.log('Channel created:', newChannel);
    // Broadcast updated channel list to all users
    io.emit('update_channel_list', [
      { id: 'c1', name: 'General', hasPasscode: false, host: 'system' },
      { id: 'c2', name: 'Standup', hasPasscode: false, host: 'system' },
      { id: 'c3', name: 'Random', hasPasscode: false, host: 'system' },
      newChannel
    ]);
  });
  
  socket.on('join_channel', (data) => {
    const { username, channelId } = data;
    console.log('User joined channel:', username, channelId);
    socket.join(channelId);
    
    // Broadcast current global user list
    io.emit('update_user_list', globalUsers);
  });

  // Handle message sending
  socket.on('send_message', (data) => {
    const { channelId, message } = data;
    console.log('Message sent to', channelId, ':', message.text, 'by', message.sender);
    
    // Broadcast message to everyone in the channel/DM room
    io.to(channelId).emit('receive_message', {
      ...message,
      channel_id: channelId
    });
  });
  
  socket.on('join_voice', (data) => {
    console.log('Voice join test:', data);
    socket.emit('voice_user_joined', { users: [] });
  });
  
  socket.on('join_video', (data) => {
    console.log('Video join test:', data);
    socket.emit('all_users', []);
  });
  
  socket.on('call_user', (data) => {
    console.log('Call user test:', data);
    io.to(data.userToCall).emit('call_received', {
      signal: data.signal,
      from: data.from
    });
  });
  
  socket.on('answer_call', (data) => {
    console.log('Answer call test:', data);
    io.to(data.to).emit('call_answered', {
      signal: data.signal,
      from: data.from
    });
  });
  
  socket.on('ice_candidate', (data) => {
    console.log('ICE candidate test:', data);
    io.to(data.to).emit('ice_candidate_received', {
      candidate: data.candidate,
      from: data.from
    });
  });
  
  // Soul room handlers
  socket.on('get_soul_rooms', () => {
    const rooms = [
      {
        id: 'soul-1',
        name: '深夜聊天室',
        description: '一起聊聊心事',
        category: 'emotion',
        participantCount: 3,
        maxParticipants: 8,
        host: 'user1',
        participants: [
          { id: 'socket1', username: '小明', isSpeaking: false },
          { id: 'socket2', username: '小红', isSpeaking: true },
          { id: 'socket3', username: '小李', isSpeaking: false }
        ]
      },
      {
        id: 'soul-2',
        name: '音乐分享',
        description: '分享你喜欢的音乐',
        category: 'music',
        participantCount: 5,
        maxParticipants: 12,
        host: 'user2',
        participants: [
          { id: 'socket4', username: '音乐达人', isSpeaking: false },
          { id: 'socket5', username: '歌神', isSpeaking: false },
          { id: 'socket6', username: '麦霸', isSpeaking: true },
          { id: 'socket7', username: '听众', isSpeaking: false },
          { id: 'socket8', username: '粉丝', isSpeaking: false }
        ]
      }
    ];
    socket.emit('soul_rooms_updated', rooms);
  });
  
  socket.on('create_soul_room', (data) => {
    const roomId = `soul-${Date.now()}`;
    const room = {
      ...data,
      id: roomId,
      participantCount: 0,
      participants: [],
      createdAt: Date.now()
    };
    console.log('Soul room created:', room.name);
    socket.emit('soul_room_created', room);
  });
  
  socket.on('join_soul_room', (data) => {
    const { roomId, username } = data;
    console.log('Joining soul room:', roomId, username);
    
    const participant = {
      id: socket.id,
      username: username,
      isSpeaking: false,
      joinedAt: Date.now()
    };
    
    socket.emit('soul_room_joined', {
      room: {
        id: roomId,
        name: 'Test Room',
        description: 'A test room',
        category: 'social',
        participantCount: 1,
        maxParticipants: 8,
        participants: [participant]
      },
      participants: [participant]
    });
  });
  
  socket.on('leave_soul_room', (data) => {
    console.log('Leaving soul room:', data);
    socket.emit('soul_room_left');
  });
  
  socket.on('soul_speaking_status', (data) => {
    const { roomId, isSpeaking } = data;
    socket.to(`soul_${roomId}`).emit('soul_participant_speaking', {
      participantId: socket.id,
      isSpeaking: isSpeaking
    });
  });
  
  socket.on('soul_mute_status', (data) => {
    const { roomId, isMuted } = data;
    io.to(`soul_${roomId}`).emit('soul_participant_muted', {
      participantId: socket.id,
      isMuted: isMuted
    });
  });
  
  socket.on('soul_send_gift', (data) => {
    console.log('Gift sent:', data);
    io.to(`soul_${data.roomId}`).emit('soul_gift_received', {
      from: data.from || 'TestUser',
      to: data.targetUsername,
      giftType: data.giftType,
      timestamp: Date.now()
    });
  });
  
  socket.on('soul_send_emoji', (data) => {
    console.log('Emoji sent:', data);
    io.to(`soul_${data.roomId}`).emit('soul_emoji_received', {
      from: data.from || 'TestUser',
      emoji: data.emoji,
      timestamp: Date.now()
    });
  });
  
  socket.on('get_soul_my_rooms', () => {
    socket.emit('soul_my_rooms', []);
  });
  
  socket.on('get_soul_followed_rooms', () => {
    socket.emit('soul_followed_rooms', []);
  });
  
  socket.on('get_soul_room_history', () => {
    socket.emit('soul_room_history', []);
  });
  
  socket.on('get_soul_room_stats', (data) => {
    socket.emit('soul_room_stats', {
      totalParticipants: 15,
      avgStayTime: 1800000,
      totalMessages: 42,
      totalGifts: 8,
      participationTrend: [20, 35, 45, 60, 55, 70, 80]
    });
  });
  
  socket.on('get_soul_recommendations', (data) => {
    socket.emit('soul_recommendations', {
      personalized: [
        {
          id: 'soul-rec-1',
          name: '音乐爱好者',
          description: '分享你的音乐喜好',
          category: 'music',
          participantCount: 4,
          maxParticipants: 8,
          matchScore: 85,
          tags: ['音乐', '分享', '轻松'],
          activityLevel: '活跃'
        }
      ],
      trending: [
        {
          id: 'soul-1',
          name: '深夜聊天室',
          description: '一起聊聊心事',
          category: 'emotion',
          participantCount: 3,
          maxParticipants: 8,
          messageCount: 156,
          giftCount: 42
        },
        {
          id: 'soul-2',
          name: '音乐分享',
          description: '分享你喜欢的音乐',
          category: 'music',
          participantCount: 5,
          maxParticipants: 12,
          messageCount: 234,
          giftCount: 78
        }
      ],
      matched: [
        {
          id: 'soul-match-1',
          name: '灵魂伴侣',
          description: '寻找志同道合的朋友',
          category: 'social',
          matchReason: '基于你的兴趣爱好',
          compatibilityScore: 92
        }
      ]
    });
  });
  
  socket.on('soul_quick_match', (data) => {
    console.log('Quick match requested:', data);
    const matchedRoom = {
      id: `soul-quick-${Date.now()}`,
      name: '随机匹配房间',
      description: '系统为你匹配的最适合的语音房间',
      category: 'random',
      participantCount: 1,
      maxParticipants: 6
    };
    socket.emit('soul_quick_match_result', matchedRoom);
  });
  
  socket.on('follow_soul_room', (data) => {
    console.log('Follow room:', data);
  });
  
  socket.on('unfollow_soul_room', (data) => {
    console.log('Unfollow room:', data);
  });
  
  socket.on('delete_soul_room', (data) => {
    console.log('Delete room:', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    // Update user list to remove disconnected user from global list
    const userIndex = globalUsers.findIndex(u => u.id === 'socket-' + socket.id);
    if (userIndex !== -1) {
      globalUsers.splice(userIndex, 1);
    }
    io.emit('update_user_list', globalUsers);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});