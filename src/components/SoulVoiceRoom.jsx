import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './SoulVoiceRoom.css';

const SoulVoiceRoom = ({ socket, username, onLeave }) => {
  const { t } = useI18n();
  const [currentRoom, setCurrentRoom] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(50);
  const [roomTheme, setRoomTheme] = useState('default');
  const [allUsers, setAllUsers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef(new Map());

  // Room categories like Soul
  const roomCategories = [
    { id: 'social', name: '社交', icon: '💬', color: '#FF6B6B' },
    { id: 'music', name: '音乐', icon: '🎵', color: '#4ECDC4' },
    { id: 'game', name: '游戏', icon: '🎮', color: '#45B7D1' },
    { id: 'study', name: '学习', icon: '📚', color: '#96CEB4' },
    { id: 'emotion', name: '情感', icon: '💝', color: '#FFEAA7' },
    { id: 'random', name: '随机匹配', icon: '🎲', color: '#DDA0DD' }
  ];

  useEffect(() => {
    // Initialize audio context for voice detection
    if (window.AudioContext || window.webkitAudioContext) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }

    // Listen for soul room events
    socket.on('soul_rooms_updated', (rooms) => {
      setAvailableRooms(rooms);
    });

    socket.on('soul_room_joined', (data) => {
      setCurrentRoom(data.room);
      setRoomParticipants(data.participants);
      setShowRoomList(false);
    });

    socket.on('soul_room_left', () => {
      setCurrentRoom(null);
      setRoomParticipants([]);
      setShowRoomList(true);
    });

    socket.on('soul_participant_joined', (participant) => {
      setRoomParticipants(prev => [...prev, participant]);
    });

    socket.on('soul_participant_left', (participantId) => {
      setRoomParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    socket.on('soul_participant_speaking', ({ participantId, isSpeaking }) => {
      setRoomParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, isSpeaking } : p
      ));
    });

    socket.on('soul_room_closed', ({ message }) => {
      alert(message || '房间已关闭');
      setCurrentRoom(null);
      setRoomParticipants([]);
      setShowRoomList(true);
    });

    socket.on('soul_room_invitation', ({ roomId, roomName, fromUsername, message }) => {
      const shouldJoin = confirm(`${message}\n\n是否加入？`);
      if (shouldJoin) {
        socket.emit('join_soul_room', { roomId, username });
      }
    });

    socket.on('update_user_list', (userList) => {
      setAllUsers(userList);
    });

    // Get initial rooms
    socket.emit('get_soul_rooms');

    return () => {
      socket.off('soul_rooms_updated');
      socket.off('soul_room_joined');
      socket.off('soul_room_left');
      socket.off('soul_participant_joined');
      socket.off('soul_participant_left');
      socket.off('soul_participant_speaking');
      socket.off('soul_room_closed');
      socket.off('soul_room_invitation');
      socket.off('update_user_list');
      
      // Cleanup audio
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [socket]);

  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        // Start voice detection
        detectVoiceActivity();
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return null;
    }
  };

  const detectVoiceActivity = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkVoiceActivity = () => {
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const isCurrentlySpeaking = average > 30; // Threshold for voice detection
      
      if (isCurrentlySpeaking !== isSpeaking) {
        setIsSpeaking(isCurrentlySpeaking);
        
        // Notify server about speaking status
        if (currentRoom) {
          socket.emit('soul_speaking_status', {
            roomId: currentRoom.id,
            isSpeaking: isCurrentlySpeaking
          });
        }
      }
      
      requestAnimationFrame(checkVoiceActivity);
    };
    
    checkVoiceActivity();
  };

  const joinRoom = async (room) => {
    if (!streamRef.current) {
      await initializeAudio();
    }
    
    socket.emit('join_soul_room', {
      roomId: room.id,
      username: username
    });
    
    setRoomTheme(room.category);
  };

  const leaveRoom = () => {
    if (currentRoom) {
      socket.emit('leave_soul_room', {
        roomId: currentRoom.id,
        username: username
      });
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const newMuted = !isMuted;
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
      setIsMuted(newMuted);
      
      if (currentRoom) {
        socket.emit('soul_mute_status', {
          roomId: currentRoom.id,
          isMuted: newMuted
        });
      }
    }
  };

  const createRoom = (roomData) => {
    socket.emit('create_soul_room', {
      ...roomData,
      username: username,
      maxParticipants: roomData.maxParticipants || 8
    });
    setShowCreateRoom(false);
  };

  const renderRoomList = () => (
    <div className="soul-room-list">
      <div className="soul-room-header">
        <h2>🎭 Soul语音房间</h2>
        <button 
          className="create-room-btn"
          onClick={() => setShowCreateRoom(true)}
        >
          ✨ 创建房间
        </button>
      </div>

      <div className="room-categories">
        {roomCategories.map(category => (
          <div 
            key={category.id}
            className="category-tab"
            style={{ color: category.color }}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
          </div>
        ))}
      </div>

      <div className="rooms-grid">
        {availableRooms.map(room => {
          const category = roomCategories.find(c => c.id === room.category);
          return (
            <div 
              key={room.id}
              className="room-card"
              onClick={() => joinRoom(room)}
              style={{ borderColor: category?.color }}
            >
              <div className="room-header">
                <div className="room-icon" style={{ background: category?.color }}>
                  {category?.icon}
                </div>
                <div className="room-info">
                  <h3>{room.name}</h3>
                  <p>{room.description}</p>
                </div>
              </div>
              
              <div className="room-stats">
                <span className="participant-count">
                  👥 {room.participantCount}/{room.maxParticipants}
                </span>
                <span className="room-status">
                  {room.participantCount >= room.maxParticipants ? '🔒满员' : '🟢开放'}
                </span>
              </div>

              {room.participants?.slice(0, 3).map((participant, index) => (
                <div 
                  key={participant.id}
                  className="mini-avatar"
                  style={{ left: `${index * 25}px` }}
                >
                  {participant.username[0].toUpperCase()}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {availableRooms.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎭</div>
          <h3>暂无房间</h3>
          <p>创建第一个Soul语音房间吧！</p>
        </div>
      )}
    </div>
  );

  const sendGift = () => {
    alert('礼物功能即将上线！');
  };

  const sendEmoji = () => {
    alert('表情功能即将上线！');
  };

  const inviteFriend = () => {
    setShowInviteModal(true);
    setSearchQuery('');
  };

  const inviteUser = (targetUser) => {
    if (currentRoom) {
      socket.emit('soul_invite_user', {
        roomId: currentRoom.id,
        fromUsername: username,
        targetUsername: targetUser,
        roomName: currentRoom.name
      });
      setShowInviteModal(false);
      alert(`已邀请 ${targetUser} 加入房间！`);
    }
  };

  const filteredUsers = allUsers.filter(user => 
    user.name !== username && 
    user.status === 'online' &&
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const followRoom = () => {
    const followedRooms = JSON.parse(localStorage.getItem('followedSoulRooms') || '[]');
    if (!followedRooms.includes(currentRoom.id)) {
      followedRooms.push(currentRoom.id);
      localStorage.setItem('followedSoulRooms', JSON.stringify(followedRooms));
      alert('已关注该房间！');
    } else {
      alert('您已经关注过该房间了');
    }
  };

  const renderVoiceRoom = () => {
    const category = roomCategories.find(c => c.id === currentRoom?.category);
    
    return (
      <div className="soul-voice-room" data-theme={roomTheme}>
        <div className="room-header">
          <div className="room-info">
            <div className="room-icon" style={{ background: category?.color }}>
              {category?.icon}
            </div>
            <div>
              <h3>{currentRoom?.name}</h3>
              <p>{currentRoom?.description}</p>
            </div>
          </div>
          
          <button className="leave-btn" onClick={leaveRoom}>
            👋 离开
          </button>
        </div>

        <div className="participants-circle">
          <div className="center-avatar">
            <div className="avatar-ring">
              {username[0].toUpperCase()}
            </div>
            <div className={`speaking-indicator ${isSpeaking ? 'speaking' : ''}`}>
              {isSpeaking ? '🎤' : '🔇'}
            </div>
          </div>
          
          {roomParticipants.map((participant, index) => {
            const angle = (360 / roomParticipants.length) * index;
            const radius = 120;
            const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
            const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
            
            return (
              <div
                key={participant.id}
                className="participant-avatar"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                <div className={`avatar-ring ${participant.isSpeaking ? 'speaking' : ''}`}>
                  {participant.username[0].toUpperCase()}
                </div>
                <div className="speaking-wave">
                  {participant.isSpeaking && '🎤'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="voice-controls">
          <div className="volume-control">
            <span>🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>
          
          <button 
            className={`mute-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          
          <button className="gift-btn" onClick={sendGift}>
            🎁 送礼物
          </button>
          
          <button className="emoji-btn" onClick={sendEmoji}>
            😊 表情
          </button>
        </div>

        <div className="room-actions">
          <button className="invite-btn" onClick={inviteFriend}>
            👥 邀请朋友
          </button>
          <button className="follow-btn" onClick={followRoom}>
            ⭐ 关注房间
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="soul-voice-container">
      {showRoomList && renderRoomList()}
      {currentRoom && renderVoiceRoom()}
      
      {showCreateRoom && (
        <CreateSoulRoom
          categories={roomCategories}
          onCreate={createRoom}
          onClose={() => setShowCreateRoom(false)}
        />
      )}

      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content invite-modal">
            <div className="modal-header">
              <h3>👥 邀请朋友</h3>
              <button className="close-btn" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            
            <div className="search-bar">
              <input
                type="text"
                placeholder="搜索用户名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="user-list">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <div key={user.id} className="user-item">
                    <div className="user-avatar">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <span>{user.name[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="user-info">
                      <span className="user-name">{user.name}</span>
                      <span className="user-status online">● 在线</span>
                    </div>
                    <button 
                      className="invite-user-btn"
                      onClick={() => inviteUser(user.name)}
                    >
                      邀请
                    </button>
                  </div>
                ))
              ) : (
                <div className="no-users">
                  {searchQuery ? '没有找到匹配的用户' : '没有在线用户'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSoulRoom = ({ categories, onCreate, onClose }) => {
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    category: 'social',
    maxParticipants: 8,
    isPrivate: false,
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomData.name.trim()) {
      onCreate(roomData);
    }
  };

  return (
    <div className="create-room-modal">
      <div className="modal-content">
        <h3>✨ 创建Soul语音房间</h3>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="房间名称"
            value={roomData.name}
            onChange={(e) => setRoomData({...roomData, name: e.target.value})}
            required
          />
          
          <textarea
            placeholder="房间描述"
            value={roomData.description}
            onChange={(e) => setRoomData({...roomData, description: e.target.value})}
          />
          
          <div className="category-selection">
            <label>选择分类:</label>
            <div className="category-grid">
              {categories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  className={`category-option ${roomData.category === category.id ? 'selected' : ''}`}
                  onClick={() => setRoomData({...roomData, category: category.id})}
                  style={{ borderColor: category.color }}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="room-settings">
            <label>
              最大人数:
              <select
                value={roomData.maxParticipants}
                onChange={(e) => setRoomData({...roomData, maxParticipants: parseInt(e.target.value)})}
              >
                <option value={4}>4人</option>
                <option value={6}>6人</option>
                <option value={8}>8人</option>
                <option value={12}>12人</option>
              </select>
            </label>
            
            <label>
              <input
                type="checkbox"
                checked={roomData.isPrivate}
                onChange={(e) => setRoomData({...roomData, isPrivate: e.target.checked})}
              />
              私人房间
            </label>
            
            {roomData.isPrivate && (
              <input
                type="password"
                placeholder="房间密码"
                value={roomData.password}
                onChange={(e) => setRoomData({...roomData, password: e.target.value})}
              />
            )}
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="submit">
              创建房间
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SoulVoiceRoom;