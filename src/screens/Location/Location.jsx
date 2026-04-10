import React, { useState } from 'react';
import { mockLocations } from '../../mocks/mockData';
import {
  Phone,
  Mail,
  DollarSign,
  Sparkles,
  MapPin,
  ChevronRight,
  CheckCircle2,
  MessageCircle,
  CornerDownRight,
  User,
  X,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';
import './Location.css';

const Location = ({ project }) => {
  const [locations, setLocations] = useState(mockLocations);
  // Parsing original 'content' pattern (JSON threads) from mock
  const [expandedLocId, setExpandedLocId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    shootingTime: '',
    status: 'requested',
    contacts: [{ name: '', phone: '', email: '' }],
    cost: '',
    depositStatus: false,
    depositAmount: '',
    content: '',
    note: ''
  });

  const toggleExpand = (id) => {
    setExpandedLocId(expandedLocId === id ? null : id);
  };

  const handleAddContact = () => {
    setNewRequest({ ...newRequest, contacts: [...newRequest.contacts, { name: '', phone: '', email: '' }] });
  };

  const handleRemoveContact = (index) => {
    if (newRequest.contacts.length === 1) return;
    setNewRequest({ ...newRequest, contacts: newRequest.contacts.filter((_, i) => i !== index) });
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...newRequest.contacts];
    newContacts[index][field] = value;
    setNewRequest({ ...newRequest, contacts: newContacts });
  };

  const handleSubmit = () => {
    if (!newRequest.title) return alert('Please enter a recruitment title.');

    const locationToAdd = {
      id: Date.now(),
      projectId: project?.id || 1,
      title: newRequest.title,
      managerName: newRequest.contacts[0]?.name || 'Unknown',
      phone: newRequest.contacts[0]?.phone || '-',
      email: newRequest.contacts[0]?.email || '-',
      cost: newRequest.cost ? `${newRequest.cost} KRW` : '0 KRW',
      depositStatus: newRequest.depositStatus ? 'Paid' : 'Pending',
      note: newRequest.note || newRequest.content,
      aiSummary: 'New recruitment request pending review.',
      requests: [
        { 
          id: Date.now() + 1, 
          author: 'System', 
          text: `Recruitment request created for ${newRequest.title}. Status: ${newRequest.status.toUpperCase()}`,
          replies: []
        }
      ]
    };

    setLocations([locationToAdd, ...locations]);
    alert('Recruitment request has been successfully registered.');
    setIsModalOpen(false);
    
    // Reset form
    setNewRequest({
      title: '',
      date: new Date().toISOString().split('T')[0],
      shootingTime: '',
      status: 'requested',
      contacts: [{ name: '', phone: '', email: '' }],
      cost: '',
      depositStatus: false,
      depositAmount: '',
      content: '',
      note: ''
    });
  };

  return (
    <div className="location-container">
      <div className="location-header">
        <div className="header-info">
          <h2>Location Scouting</h2>
          <p>{project?.title || 'General'} Locations & Scouting status</p>
        </div>
        <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Add Location Request</span>
        </button>
      </div>

      <div className="location-list">
        {locations.map((loc) => {
          // Simulated thread parsing based on original serializeRequestsToContent logic
          const threads = loc.requests || [
            { id: 1, author: 'Director', text: 'Can we check the afternoon light here?', replies: [{ author: 'Kim Scout', text: 'Yes, it stays bright until 5 PM.' }] }
          ];

          return (
            <div key={loc.id} className={`location-card-premium ${expandedLocId === loc.id ? 'expanded' : ''}`}>
              <div className="location-main-content" onClick={() => toggleExpand(loc.id)}>
                <div className="location-main-row">
                  <div className="location-img-box">
                    <MapPin size={24} color="var(--accent-blue)" />
                  </div>
                  <div className="location-info-cluster">
                    <h3>{loc.title}</h3>
                    <div className="poc-group">
                      <span className="manager-tag">{loc.managerName}</span>
                      <div className="poc-item"><Phone size={12} /> {loc.phone}</div>
                    </div>
                  </div>
                  <div className={`status-badge-chip ${loc.depositStatus === 'Paid' ? 'paid' : ''}`}>
                    {loc.depositStatus === 'Paid' && <CheckCircle2 size={12} />}
                    <span>{loc.depositStatus}</span>
                  </div>
                  <ChevronRight
                    size={20}
                    className={`expand-arrow ${expandedLocId === loc.id ? 'rotated' : ''}`}
                  />
                </div>

                <div className="ai-insight-strip">
                  <Sparkles size={14} />
                  <span>AI Insight: {loc.aiSummary}</span>
                </div>
              </div>

              {expandedLocId === loc.id && (
                <div className="location-details-drawer">
                  <div className="details-section">
                    <div className="section-label">Communication History (Threads)</div>
                    <div className="threads-container">
                      {threads.map((thread) => (
                        <div key={thread.id} className="thread-group">
                          <div className="thread-root">
                            <div className="thread-avatar"><User size={12} /></div>
                            <div className="thread-bubble">
                              <span className="author">{thread.author}</span>
                              <p className="text">{thread.text}</p>
                            </div>
                          </div>
                          {thread.replies && thread.replies.map((reply, rIdx) => (
                            <div key={rIdx} className="thread-reply">
                              <CornerDownRight size={14} className="reply-icon" />
                              <div className="thread-bubble reply">
                                <span className="author">{reply.author}</span>
                                <p className="text">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      <button className="add-thread-btn">
                        <MessageCircle size={14} />
                        <span>Add Request</span>
                      </button>
                    </div>
                  </div>

                  <div className="details-footer">
                    <div className="cost-tag">
                      <DollarSign size={14} />
                      <span>{loc.cost}</span>
                    </div>
                    <div className="memo-area">
                      <strong>Note:</strong> {loc.note}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recruitment Request Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content-premium recruitment-modal">
            <div className="modal-header">
              <h3>New Location Recruitment Request</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* 기본 정보 */}
              <div className="form-section">
                <div className="section-title">Basic Information</div>
                <div className="form-group">
                  <label>Recruitment Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Shooting request for National Museum of Korea"
                    value={newRequest.title}
                    onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={newRequest.date}
                      onChange={(e) => setNewRequest({ ...newRequest, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Shooting Time</label>
                    <div className="input-with-icon">
                      <Clock size={16} />
                      <input
                        type="text"
                        placeholder="e.g. 14:00 - 18:00"
                        value={newRequest.shootingTime}
                        onChange={(e) => setNewRequest({ ...newRequest, shootingTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Recruitment Status</label>
                  <div className="status-selection">
                    {['requested', 'confirmed', 'hold'].map((s) => (
                      <button
                        key={s}
                        className={`status-opt ${newRequest.status === s ? 'active' : ''}`}
                        onClick={() => setNewRequest({ ...newRequest, status: s })}
                      >
                        {s === 'requested' ? 'Requested' : s === 'confirmed' ? 'Confirmed' : 'On Hold'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 담당자 정보 */}
              <div className="form-section">
                <div className="section-header-row">
                  <div className="section-title">Contact Information</div>
                  <button className="add-item-btn" onClick={handleAddContact}>
                    <Plus size={16} />
                  </button>
                </div>

                {newRequest.contacts.map((contact, index) => (
                  <div key={index} className="contact-card-form">
                    <div className="contact-card-header">
                      <span>Contact {index + 1}</span>
                      {newRequest.contacts.length > 1 && (
                        <button className="remove-btn" onClick={() => handleRemoveContact(index)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="contact-grid">
                      <div className="input-with-icon">
                        <User size={14} />
                        <input
                          type="text"
                          placeholder="Name"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="input-with-icon">
                        <Phone size={14} />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="input-with-icon full">
                      <Mail size={14} />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={contact.email}
                        onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 비용 및 상세 */}
              <div className="form-section">
                <div className="section-title">Cost & Detailed Information</div>
                <div className="form-group">
                  <label>Total Cost (KRW)</label>
                  <div className="input-with-icon">
                    <DollarSign size={16} />
                    <input
                      type="number"
                      placeholder="0"
                      value={newRequest.cost}
                      onChange={(e) => setNewRequest({ ...newRequest, cost: e.target.value })}
                    />
                  </div>
                </div>
                <div className="toggle-row">
                  <label>Deposit Required</label>
                  <button
                    className={`toggle-btn ${newRequest.depositStatus ? 'on' : ''}`}
                    onClick={() => setNewRequest({ ...newRequest, depositStatus: !newRequest.depositStatus })}
                  >
                    <div className="toggle-slider"></div>
                  </button>
                </div>
                {newRequest.depositStatus && (
                  <div className="form-group anim-fade">
                    <label>Deposit Amount (KRW)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newRequest.depositAmount}
                      onChange={(e) => setNewRequest({ ...newRequest, depositAmount: e.target.value })}
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Request Details</label>
                  <textarea
                    placeholder="Specific scouting requests and requirements..."
                    value={newRequest.content}
                    onChange={(e) => setNewRequest({ ...newRequest, content: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="submit-btn" onClick={handleSubmit}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Location;
