import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './SoulRecommendations.css';

const SoulRecommendations = ({ socket, username, onJoinRoom }) => {
  const { t } = useI18n();
  const [recommendations, setRecommendations] = useState([]);
  const [trendingRooms, setTrendingRooms] = useState([]);
  const [matchedRooms, setMatchedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: '全部', icon: '🌟' },
    { id: 'social', name: '社交', icon: '💬' },
    { id: 'music', name: '音乐', icon: '🎵' },
    { id: 'game', name: '游戏', icon: '🎮' },
    { id: 'study', name: '学习', icon: '📚' },
    { id: 'emotion', name: '情感', icon: '💝' },
    { id: 'random', name: '随机匹配', icon: '🎲' }
  ];

  useEffect(() => {
    loadRecommendations();
  }, [selectedCategory]);

  const loadRecommendations = async () => {
    setLoading(true);
    
    try {
      // Get personalized recommendations
      socket.emit('get_soul_recommendations', {
        username: username,
        category: selectedCategory === 'all' ? null : selectedCategory
      });

      // Listen for recommendation data
      socket.on('soul_recommendations', (data) => {
        setRecommendations(data.personalized || []);
        setTrendingRooms(data.trending || []);
        setMatchedRooms(data.matched || []);
        setLoading(false);
      });

    } catch (error) {
      console.error('Error loading recommendations:', error);
      setLoading(false);
    }
  };

  const handleQuickMatch = () => {
    socket.emit('soul_quick_match', { username });
  };

  const handleJoinRoom = (room) => {
    if (onJoinRoom) {
      onJoinRoom(room);
    }
  };

  const renderQuickMatch = () => (
    <div className="quick-match-section">
      <div className="quick-match-card">
        <div className="match-icon">🎲</div>
        <h3>随机匹配</h3>
        <p>系统将为你匹配最适合的语音房间</p>
        <button onClick={handleQuickMatch} className="match-btn">
          开始匹配
        </button>
      </div>
    </div>
  );

  const renderPersonalizedRecommendations = () => (
    <div className="recommendations-section">
      <h3>🎯 为你推荐</h3>
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>正在分析你的喜好...</p>
        </div>
      ) : (
        <div className="recommendation-grid">
          {recommendations.map((room, index) => (
            <div key={room.id} className="recommendation-card">
              <div className="recommendation-header">
                <div className="room-category">
                  {categories.find(c => c.id === room.category)?.icon}
                </div>
                <div className="match-score">
                  匹配度 {room.matchScore}%
                </div>
              </div>
              <h4>{room.name}</h4>
              <p>{room.description}</p>
              <div className="recommendation-tags">
                {room.tags?.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
              <div className="room-stats">
                <span>👥 {room.participantCount}/{room.maxParticipants}</span>
                <span>🔥 {room.activityLevel}</span>
              </div>
              <button 
                onClick={() => handleJoinRoom(room)}
                className="join-btn"
              >
                进入房间
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTrendingRooms = () => (
    <div className="trending-section">
      <h3>🔥 热门房间</h3>
      <div className="trending-list">
        {trendingRooms.map((room, index) => (
          <div key={room.id} className="trending-item">
            <div className="trending-rank">
              #{index + 1}
            </div>
            <div className="trending-info">
              <h4>{room.name}</h4>
              <p>{room.description}</p>
              <div className="trending-stats">
                <span>👥 {room.participantCount}人</span>
                <span>💬 {room.messageCount}条消息</span>
                <span>🎁 {room.giftCount}个礼物</span>
              </div>
            </div>
            <button 
              onClick={() => handleJoinRoom(room)}
              className="join-btn"
            >
              进入
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMatchedRooms = () => (
    <div className="matched-section">
      <h3>💝 灵魂匹配</h3>
      <div className="matched-rooms">
        {matchedRooms.map((room) => (
          <div key={room.id} className="matched-room">
            <div className="match-reason">
              {room.matchReason}
            </div>
            <div className="room-preview">
              <h4>{room.name}</h4>
              <p>{room.description}</p>
              <div className="compatibility-score">
                <div className="score-circle">
                  {room.compatibilityScore}
                </div>
                <span>灵魂契合度</span>
              </div>
            </div>
            <button 
              onClick={() => handleJoinRoom(room)}
              className="soul-connect-btn"
            >
              灵魂连接
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="soul-recommendations">
      <div className="recommendations-header">
        <h2>🎭 发现精彩房间</h2>
        <div className="category-filter">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="recommendations-content">
        {renderQuickMatch()}
        {renderPersonalizedRecommendations()}
        {renderTrendingRooms()}
        {renderMatchedRooms()}
      </div>
    </div>
  );
};

export default SoulRecommendations;