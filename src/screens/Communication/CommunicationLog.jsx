import React, { useState } from 'react';
import {
  Bell,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  ExternalLink,
  Send,
  Inbox,
  FileCheck
} from 'lucide-react';
import './CommunicationLog.css';

const CommunicationLog = ({ locations = [], projects = [] }) => {
  const [activeFilter, setActiveFilter] = useState('received'); // Default to received

  // Aggregate and classify requests from locations
  const processedLogs = locations.map(loc => {
    const lastRequest = loc.requests?.[loc.requests.length - 1];
    const isSentByMe = lastRequest?.author === 'Crew (You)';
    const isResolved = loc.status === 'confirmed' || loc.status === 'finished';

    return {
      id: `loc-${loc.id}`,
      type: 'location',
      title: isSentByMe ? 'Request Sent' : 'Message Received',
      subTitle: loc.title,
      content: lastRequest?.text || 'No communication history.',
      status: loc.cardStatus || 'pending',
      timestamp: lastRequest?.timestamp || new Date().toISOString(),
      priority: isResolved ? 'low' : (loc.cardStatus === 'coordinator_pending' ? 'medium' : 'high'),
      isSentByMe,
      isResolved,
      originalData: loc
    };
  });

  // Filter logs based on active tab
  const filteredLogs = processedLogs.filter(log => {
    if (activeFilter === 'received') return !log.isSentByMe && !log.isResolved;
    if (activeFilter === 'sent') return log.isSentByMe && !log.isResolved;
    if (activeFilter === 'resolved') return log.isResolved;
    return true;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const getStatusIcon = (status) => {
    switch (status) {
      case 'coordinator_pending': return <Clock size={16} className="status-icon pending" />;
      case 'confirmed': return <CheckCircle2 size={16} className="status-icon success" />;
      default: return <AlertCircle size={16} className="status-icon warning" />;
    }
  };

  const getTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="comm-log-container">
      <div className="comm-log-header">
        <div className="header-left">
          <h2>Communication Center</h2>
          <p>Manage all interactions and request statuses in one place.</p>
        </div>
      </div>

      <div className="log-stats-row">
        <div className={`stat-box ${activeFilter === 'received' ? 'active' : ''}`} onClick={() => setActiveFilter('received')}>
          <span className="count">{processedLogs.filter(l => !l.isSentByMe && !l.isResolved).length}</span>
          <span className="label">Received</span>
        </div>
        <div className={`stat-box ${activeFilter === 'sent' ? 'active' : ''}`} onClick={() => setActiveFilter('sent')}>
          <span className="count">{processedLogs.filter(l => l.isSentByMe && !l.isResolved).length}</span>
          <span className="label">Sent</span>
        </div>
        <div className={`stat-box ${activeFilter === 'resolved' ? 'active' : ''}`} onClick={() => setActiveFilter('resolved')}>
          <span className="count">{processedLogs.filter(l => l.isResolved).length}</span>
          <span className="label">Resolved</span>
        </div>
      </div>

      <div className="log-filters-premium">
        <button
          className={`filter-tab ${activeFilter === 'received' ? 'active' : ''}`}
          onClick={() => setActiveFilter('received')}
        >
          <Inbox size={16} />
          <span>Received Requests</span>
        </button>
        <button
          className={`filter-tab ${activeFilter === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveFilter('sent')}
        >
          <Send size={16} />
          <span>Sent Requests</span>
        </button>
        <button
          className={`filter-tab ${activeFilter === 'resolved' ? 'active' : ''}`}
          onClick={() => setActiveFilter('resolved')}
        >
          <FileCheck size={16} />
          <span>Resolved</span>
        </button>
      </div>

      <div className="log-list">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className={`log-entry-premium ${log.priority}`}>
              <div className="log-icon-wrapper">
                {log.isSentByMe ? <Send size={18} /> : <Inbox size={18} />}
              </div>

              <div className="log-content-area">
                <div className="log-upper">
                  <span className="log-category-tag">{log.isSentByMe ? 'Outgoing' : 'Incoming'}</span>
                  <span className="log-dot-separator">•</span>
                  <span className="log-date-text">{getTimeAgo(log.timestamp)}</span>
                </div>
                <h4 className="log-item-title">{log.subTitle}</h4>
                <p className="log-snippet">{log.content}</p>

                <div className="log-footer-meta">
                  <div className="status-indicator">
                    {getStatusIcon(log.status)}
                    <span>{log.status.toUpperCase()}</span>
                  </div>
                  <div className="requester-info">
                    <User size={12} />
                    <span>{log.isSentByMe ? 'Coordinator' : (log.originalData?.managerName || 'Admin')}</span>
                  </div>
                </div>
              </div>

              <div className="log-entry-actions">
                <button className="primary-action-btn">
                  <span>Open Thread</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state-log">
            <div className="empty-icon-circle">
              <Bell size={32} />
            </div>
            <h3>No {activeFilter} requests</h3>
            <p>Once you start communicating or receive responses, they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationLog;

