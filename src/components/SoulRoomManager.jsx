import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './SoulRoomManager.css';

const SoulRoomManager = ({ socket, username }) => {
  const { t } = useI18n();
  const [myRooms, setMyRooms] = useState([]);
  const [followedRooms, setFollowedRooms] = useState([]);
  const [roomHistory, setRoomHistory] = useState([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [roomStats, setRoomStats] = useState(null);

  useEffect(() => {
    // Listen for room management events
    socket.on('soul_my_rooms', (rooms) => {
      setMyRooms(rooms);
    });

    socket.on('soul_followed_rooms', (rooms) => {
      setFollowedRooms(rooms);
    });

    socket.on('soul_room_history', (history) => {
      setRoomHistory(history);
    });

    socket.on('soul_room_stats', (stats) => {
      setRoomStats(stats);
    });

    // Get initial data
    socket.emit('get_soul_my_rooms');
    socket.emit('get_soul_followed_rooms');
    socket.emit('get_soul_room_history');

    return () => {
      socket.off('soul_my_rooms');
      socket.off('soul_followed_rooms');
      socket.off('soul_room_history');
      socket.off('soul_room_stats');
    };
  }, [socket]);

  const deleteRoom = (roomId) => {
    if (confirm('确定要删除这个房间吗？')) {
      socket.emit('delete_soul_room', { roomId, username });
    }
  };

  const followRoom = (roomId) => {
    socket.emit('follow_soul_room', { roomId, username });
  };

  const unfollowRoom = (roomId) => {
    socket.emit('unfollow_soul_room', { roomId, username });
  };

  const getRoomAnalytics = (roomId) => {
    socket.emit('get_soul_room_stats', { roomId });
    setShowAnalytics(true);
  };

  const renderMyRooms = () => (
    <div className="manager-section">
      <h3>🏠 我的房间</h3>
      <div className="room-grid">
        {myRooms.map(room => (
          <div key={room.id} className="room-card manager">
            <div className="room-header">
              <h4>{room.name}</h4>
              <div className="room-actions">
                <button onClick={() => getRoomAnalytics(room.id)} title="查看统计">
                  📊
                </button>
                <button onClick={() => deleteRoom(room.id)} title="删除房间">
                  🗑️
                </button>
              </div>
            </div>
            <p>{room.description}</p>
            <div className="room-stats">
              <span>👥 {room.participantCount}/{room.maxParticipants}</span>
              <span>⏱️ {formatDuration(room.createdAt)}</span>
            </div>
            <div className="room-status">
              <span className={`status ${room.isActive ? 'active' : 'inactive'}`}>
                {room.isActive ? '🟢 运行中' : '🔴 已关闭'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {myRooms.length === 0 && (
        <div className="empty-state">
          <p>你还没有创建任何房间</p>
          <button onClick={() => window.location.href = '/soul-rooms'}>
            创建房间
          </button>
        </div>
      )}
    </div>
  );

  const renderFollowedRooms = () => (
    <div className="manager-section">
      <h3>⭐ 关注的房间</h3>
      <div className="room-grid">
        {followedRooms.map(room => (
          <div key={room.id} className="room-card followed">
            <div className="room-header">
              <h4>{room.name}</h4>
              <button 
                onClick={() => unfollowRoom(room.id)}
                className="unfollow-btn"
                title="取消关注"
              >
                💔
              </button>
            </div>
            <p>{room.description}</p>
            <div className="room-stats">
              <span>👥 {room.participantCount}/{room.maxParticipants}</span>
              <span>🏠 主持人: {room.host}</span>
            </div>
            <button 
              onClick={() => window.location.href = `/soul-rooms?join=${room.id}`}
              className="join-btn"
            >
              进入房间
            </button>
          </div>
        ))}
      </div>
      {followedRooms.length === 0 && (
        <div className="empty-state">
          <p>你还没有关注任何房间</p>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="manager-section">
      <h3>📜 历史记录</h3>
      <div className="history-list">
        {roomHistory.map((entry, index) => (
          <div key={index} className="history-item">
            <div className="history-info">
              <h4>{entry.roomName}</h4>
              <p>参与时间: {formatDate(entry.joinedAt)}</p>
              <p>停留时长: {formatDuration(entry.joinedAt, entry.leftAt)}</p>
            </div>
            <div className="history-actions">
              <button onClick={() => followRoom(entry.roomId)}>
                ⭐ 关注
              </button>
              <button onClick={() => window.location.href = `/soul-rooms?join=${entry.roomId}`}>
                🔄 重访
              </button>
            </div>
          </div>
        ))}
      </div>
      {roomHistory.length === 0 && (
        <div className="empty-state">
          <p>暂无历史记录</p>
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    if (!roomStats) return null;

    return (
      <div className="analytics-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h3>📊 房间统计</h3>
            <button onClick={() => setShowAnalytics(false)}>
              ✕
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>总参与人数</h4>
              <p>{roomStats.totalParticipants}</p>
            </div>
            <div className="stat-card">
              <h4>平均停留时间</h4>
              <p>{formatDuration(roomStats.avgStayTime)}</p>
            </div>
            <div className="stat-card">
              <h4>消息总数</h4>
              <p>{roomStats.totalMessages}</p>
            </div>
            <div className="stat-card">
              <h4>礼物总数</h4>
              <p>{roomStats.totalGifts}</p>
            </div>
          </div>
          <div className="chart-container">
            <h4>参与度趋势</h4>
            <div className="simple-chart">
              {roomStats.participationTrend?.map((value, index) => (
                <div 
                  key={index} 
                  className="chart-bar" 
                  style={{ height: `${(value / 100) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatDuration = (startTime, endTime = Date.now()) => {
    const duration = endTime - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="soul-room-manager">
      <div className="manager-header">
        <h2>🎭 Soul房间管理</h2>
        <div className="header-actions">
          <button onClick={() => window.location.href = '/soul-rooms'}>
            ➕ 创建房间
          </button>
          <button onClick={() => window.location.href = '/soul-rooms'}>
            🎮 浏览房间
          </button>
        </div>
      </div>

      <div className="manager-tabs">
        <button className="tab active">我的房间</button>
        <button className="tab">关注房间</button>
        <button className="tab">历史记录</button>
      </div>

      <div className="manager-content">
        {renderMyRooms()}
        {renderFollowedRooms()}
        {renderHistory()}
      </div>

      {showAnalytics && renderAnalytics()}
    </div>
  );
};

export default SoulRoomManager;