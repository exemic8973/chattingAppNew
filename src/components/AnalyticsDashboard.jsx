import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

const AnalyticsDashboard = () => {
  const { t } = useI18n();
  const [timeRange, setTimeRange] = useState('7d');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      // const response = await fetch(`/api/analytics?range=${timeRange}`);
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockData = {
        overview: {
          totalUsers: 1247,
          activeUsers: 892,
          totalMessages: 15678,
          totalChannels: 45,
          averageSessionTime: '24m 32s',
          peakActiveTime: '14:30',
          growthRate: '+12.3%'
        },
        users: {
          dailyActive: [120, 145, 132, 189, 167, 201, 178],
          newSignups: [12, 18, 15, 22, 19, 28, 24],
          retention: {
            day1: 0.85,
            day7: 0.68,
            day30: 0.42
          },
          demographics: {
            desktop: 0.62,
            mobile: 0.38,
            pwa: 0.15
          }
        },
        engagement: {
          messagesPerDay: [145, 167, 132, 189, 201, 178, 156],
          reactionsPerDay: [45, 52, 38, 67, 71, 62, 58],
          averageMessagesPerUser: 12.4,
          topChannels: [
            { name: 'General', messages: 3421, activity: 0.78 },
            { name: 'Random', messages: 2856, activity: 0.65 },
            { name: 'Standup', messages: 1234, activity: 0.41 }
          ]
        },
        performance: {
          averageResponseTime: 145,
          uptime: 0.998,
          errorRate: 0.002,
          serverLoad: 0.45,
          memoryUsage: 0.67
        },
        channels: {
          total: 45,
          public: 32,
          private: 13,
          active: 38,
          averageMembers: 23.5
        }
      };
      
      setAnalytics(mockData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="analytics-overview">
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-icon">👥</div>
          <div className="analytics-content">
            <h3>{analytics.overview.totalUsers}</h3>
            <p>{t('analytics.totalUsers')}</p>
            <span className="analytics-trend positive">{analytics.overview.growthRate}</span>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">🟢</div>
          <div className="analytics-content">
            <h3>{analytics.overview.activeUsers}</h3>
            <p>{t('analytics.activeUsers')}</p>
            <span className="analytics-subtitle">{t('analytics.last24h')}</span>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">💬</div>
          <div className="analytics-content">
            <h3>{analytics.overview.totalMessages.toLocaleString()}</h3>
            <p>{t('analytics.totalMessages')}</p>
            <span className="analytics-subtitle">{t('analytics.allTime')}</span>
          </div>
        </div>
        
        <div className="analytics-card">
          <div className="analytics-icon">📊</div>
          <div className="analytics-content">
            <h3>{analytics.overview.averageSessionTime}</h3>
            <p>{t('analytics.avgSessionTime')}</p>
            <span className="analytics-subtitle">{t('analytics.perUser')}</span>
          </div>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="chart-container">
          <h4>{t('analytics.dailyActiveUsers')}</h4>
          <div className="simple-chart">
            {analytics.users.dailyActive.map((value, index) => (
              <div key={index} className="chart-bar" style={{ height: `${(value / 250) * 100}%` }}>
                <span className="chart-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="chart-container">
          <h4>{t('analytics.userDemographics')}</h4>
          <div className="demographics-chart">
            <div className="demographic-item">
              <span>{t('analytics.desktop')}</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analytics.users.demographics.desktop * 100}%` }} />
              </div>
              <span>{Math.round(analytics.users.demographics.desktop * 100)}%</span>
            </div>
            <div className="demographic-item">
              <span>{t('analytics.mobile')}</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analytics.users.demographics.mobile * 100}%` }} />
              </div>
              <span>{Math.round(analytics.users.demographics.mobile * 100)}%</span>
            </div>
            <div className="demographic-item">
              <span>{t('analytics.pwa')}</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analytics.users.demographics.pwa * 100}%` }} />
              </div>
              <span>{Math.round(analytics.users.demographics.pwa * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="analytics-users">
      <div className="user-retention">
        <h4>{t('analytics.userRetention')}</h4>
        <div className="retention-metrics">
          <div className="retention-item">
            <span>{t('analytics.day1')}</span>
            <div className="retention-bar">
              <div className="retention-fill" style={{ width: `${analytics.users.retention.day1 * 100}%` }} />
            </div>
            <span>{Math.round(analytics.users.retention.day1 * 100)}%</span>
          </div>
          <div className="retention-item">
            <span>{t('analytics.day7')}</span>
            <div className="retention-bar">
              <div className="retention-fill" style={{ width: `${analytics.users.retention.day7 * 100}%` }} />
            </div>
            <span>{Math.round(analytics.users.retention.day7 * 100)}%</span>
          </div>
          <div className="retention-item">
            <span>{t('analytics.day30')}</span>
            <div className="retention-bar">
              <div className="retention-fill" style={{ width: `${analytics.users.retention.day30 * 100}%` }} />
            </div>
            <span>{Math.round(analytics.users.retention.day30 * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="new-signups">
        <h4>{t('analytics.newSignups')}</h4>
        <div className="simple-chart">
          {analytics.users.newSignups.map((value, index) => (
            <div key={index} className="chart-bar signup" style={{ height: `${(value / 30) * 100}%` }}>
              <span className="chart-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEngagement = () => (
    <div className="analytics-engagement">
      <div className="engagement-metrics">
        <div className="metric-card">
          <h4>{t('analytics.messagesPerUser')}</h4>
          <div className="metric-value">{analytics.engagement.averageMessagesPerUser}</div>
        </div>
        <div className="metric-card">
          <h4>{t('analytics.topChannels')}</h4>
          <div className="top-channels">
            {analytics.engagement.topChannels.map((channel, index) => (
              <div key={index} className="channel-item">
                <span className="channel-name">{channel.name}</span>
                <span className="channel-messages">{channel.messages}</span>
                <div className="channel-activity">
                  <div className="activity-bar" style={{ width: `${channel.activity * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="analytics-performance">
      <div className="performance-grid">
        <div className="performance-card">
          <h4>{t('analytics.responseTime')}</h4>
          <div className="performance-value">{analytics.performance.averageResponseTime}ms</div>
          <div className="performance-status good">Good</div>
        </div>
        <div className="performance-card">
          <h4>{t('analytics.uptime')}</h4>
          <div className="performance-value">{(analytics.performance.uptime * 100).toFixed(2)}%</div>
          <div className="performance-status excellent">Excellent</div>
        </div>
        <div className="performance-card">
          <h4>{t('analytics.errorRate')}</h4>
          <div className="performance-value">{(analytics.performance.errorRate * 100).toFixed(2)}%</div>
          <div className="performance-status good">Good</div>
        </div>
        <div className="performance-card">
          <h4>{t('analytics.serverLoad')}</h4>
          <div className="performance-value">{(analytics.performance.serverLoad * 100).toFixed(0)}%</div>
          <div className="performance-status good">Normal</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="analytics-dashboard loading">
        <div className="loading-spinner">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>{t('analytics.title')}</h2>
        <div className="analytics-controls">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="24h">{t('analytics.last24h')}</option>
            <option value="7d">{t('analytics.last7d')}</option>
            <option value="30d">{t('analytics.last30d')}</option>
            <option value="90d">{t('analytics.last90d')}</option>
          </select>
        </div>
      </div>

      <div className="analytics-tabs">
        <button
          className={`tab-button ${selectedMetric === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('overview')}
        >
          {t('analytics.overview')}
        </button>
        <button
          className={`tab-button ${selectedMetric === 'users' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('users')}
        >
          {t('analytics.users')}
        </button>
        <button
          className={`tab-button ${selectedMetric === 'engagement' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('engagement')}
        >
          {t('analytics.engagement')}
        </button>
        <button
          className={`tab-button ${selectedMetric === 'performance' ? 'active' : ''}`}
          onClick={() => setSelectedMetric('performance')}
        >
          {t('analytics.performance')}
        </button>
      </div>

      <div className="analytics-content">
        {selectedMetric === 'overview' && renderOverview()}
        {selectedMetric === 'users' && renderUsers()}
        {selectedMetric === 'engagement' && renderEngagement()}
        {selectedMetric === 'performance' && renderPerformance()}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;