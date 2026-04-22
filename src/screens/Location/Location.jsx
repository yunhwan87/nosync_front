import React, { useState, useEffect } from 'react';
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
  Clock,
  Edit3
} from 'lucide-react';
import './Location.css';

const Location = ({ project, locations, setLocations, schedules, setSchedules }) => {
  const [expandedLocId, setExpandedLocId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [initialNote, setInitialNote] = useState("");
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

  const [modalTab, setModalTab] = useState('details'); // 'details' or 'email'

  // Thread Communication States
  const [commentInput, setCommentInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [isAddingNewThread, setIsAddingNewThread] = useState(false);

  const toggleExpand = (id) => {
    setExpandedLocId(expandedLocId === id ? null : id);
    // Reset inputs when switching cards
    setCommentInput('');
    setReplyInput('');
    setActiveReplyId(null);
    setIsAddingNewThread(false);
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

  // TIP Logic: Card Status change based on memo/note editing
  useEffect(() => {
    if (editingLoc && newRequest.note !== initialNote) {
      // Logic from Project 02: 
      // If note changes, we set a temporary 'cardStatus' label
      // In a real app, logic would check who is editing. 
      // Here we'll simulate 'coordinator_pending' as default for edit.
      setNewRequest(prev => ({ ...prev, cardStatus: 'coordinator_pending' }));
    }
  }, [newRequest.note, editingLoc, initialNote]);

  const openEditModal = (loc) => {
    setEditingLoc(loc);
    setInitialNote(loc.note || '');
    setNewRequest({
      title: loc.title,
      date: loc.date || new Date().toISOString().split('T')[0],
      shootingTime: loc.shootingTime || '',
      status: loc.status || 'requested',
      contacts: [{ name: loc.managerName, phone: loc.phone, email: loc.email }],
      cost: loc.cost ? loc.cost.replace(/[^0-9]/g, '') : '',
      depositStatus: loc.depositStatus === 'Paid',
      depositAmount: loc.depositAmount || '',
      content: loc.content || '',
      note: loc.note || '',
      cardStatus: loc.cardStatus || 'pending'
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      setLocations(locations.filter(l => l.id !== id));
      // Link with Schedule: Remove from schedule if exists
      setSchedules(schedules.filter(s => s.locationId !== id));
    }
  };

  const handleSubmit = () => {
    if (!newRequest.title) return alert('Please enter a recruitment title.');

    const locationData = {
      id: editingLoc ? editingLoc.id : Date.now(),
      projectId: project?.id || 1,
      title: newRequest.title,
      date: newRequest.date,
      shootingTime: newRequest.shootingTime,
      status: newRequest.status,
      managerName: newRequest.contacts[0]?.name || 'Unknown',
      phone: newRequest.contacts[0]?.phone || '-',
      email: newRequest.contacts[0]?.email || '-',
      cost: newRequest.cost ? `${Number(newRequest.cost).toLocaleString()} KRW` : '0 KRW',
      depositStatus: newRequest.depositStatus ? 'Paid' : 'Pending',
      depositAmount: newRequest.depositAmount,
      note: newRequest.note || newRequest.content,
      aiSummary: editingLoc ? editingLoc.aiSummary : 'New recruitment request pending review.',
      cardStatus: newRequest.cardStatus || 'pending',
      requests: editingLoc ? editingLoc.requests : [
        {
          id: Date.now() + 1,
          author: 'System',
          text: `Recruitment request created for ${newRequest.title}. Status: ${newRequest.status.toUpperCase()}`,
          replies: []
        }
      ]
    };

    if (editingLoc) {
      setLocations(locations.map(l => l.id === editingLoc.id ? locationData : l));
      alert('Location information has been updated.');
    } else {
      setLocations([locationData, ...locations]);
      alert('Recruitment request has been successfully registered.');
    }

    // Link with Schedule: If status is 'confirmed', add to schedule if not already there
    if (newRequest.status === 'confirmed') {
      const existingSchedule = schedules.find(s => s.locationId === locationData.id);
      const newScheduleItem = {
        id: existingSchedule ? existingSchedule.id : Date.now() + 2,
        projectId: project?.id || 1,
        locationId: locationData.id,
        date: newRequest.date,
        time: newRequest.shootingTime || 'TBD',
        location: newRequest.title,
        status: 'Confirmed',
        type: 'Shooting',
        note: `Scene at ${newRequest.title}`,
        budget: locationData.cost
      };

      if (existingSchedule) {
        setSchedules(schedules.map(s => s.id === existingSchedule.id ? newScheduleItem : s));
      } else {
        setSchedules([...schedules, newScheduleItem]);
      }
    } else {
      // If status changed from confirmed to something else, remove from schedule
      setSchedules(schedules.filter(s => s.locationId !== locationData.id));
    }

    setIsModalOpen(false);
    setEditingLoc(null);

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

  const handleAddThread = (locId, text, isReply = false, threadId = null) => {
    if (!text.trim()) return;

    const updatedLocations = locations.map(loc => {
      if (loc.id !== locId) return loc;

      const newEntry = {
        id: Date.now(),
        author: 'Crew (You)', // Simulation current user
        role: 'crew',
        text: text.trim(),
        timestamp: new Date().toISOString(),
        replies: isReply ? undefined : []
      };

      let newRequests = [...(loc.requests || [])];

      if (isReply && threadId) {
        newRequests = newRequests.map(t =>
          t.id === threadId ? { ...t, replies: [...(t.replies || []), newEntry] } : t
        );
      } else {
        newRequests.push(newEntry);
      }

      // TIP: Logic from Project 02 - Update cardStatus based on interaction
      // If crew sends a message, it awaits coordinator response
      const newCardStatus = 'coordinator_pending';

      return {
        ...loc,
        requests: newRequests,
        cardStatus: newCardStatus
      };
    });

    setLocations(updatedLocations);
    setCommentInput('');
    setReplyInput('');
    setActiveReplyId(null);
    setIsAddingNewThread(false);
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
                    <MapPin size={24} color="var(--accent-blue-light)" />
                  </div>
                  <div className="location-info-cluster">
                    <h3>{loc.title}</h3>
                    <div className="poc-group">
                      <span className="manager-tag">{loc.managerName}</span>
                      <div className="poc-item"><Phone size={12} /> {loc.phone}</div>
                    </div>
                  </div>
                  <div className="card-actions-group" onClick={(e) => e.stopPropagation()}>
                    <button className="action-icon-btn edit" onClick={() => openEditModal(loc)} title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => handleDelete(loc.id)} title="Delete">
                      <Trash2 size={16} />
                    </button>
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
                  {loc.cardStatus && (
                    <span className={`card-status-label ${loc.cardStatus}`}>
                      {loc.cardStatus === 'coordinator_pending' ? 'Co-ord Pending' : loc.cardStatus === 'crew_pending' ? 'Crew Pending' : loc.cardStatus}
                    </span>
                  )}
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
                              <div className="bubble-header">
                                <span className="author">{thread.author}</span>
                                {thread.timestamp && <span className="timestamp">{new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                              </div>
                              <p className="text">{thread.text}</p>
                              <button className="reply-trigger-btn" onClick={() => setActiveReplyId(activeReplyId === thread.id ? null : thread.id)}>Reply</button>
                            </div>
                          </div>

                          {thread.replies && thread.replies.map((reply, rIdx) => (
                            <div key={rIdx} className="thread-reply">
                              <CornerDownRight size={14} className="reply-icon" />
                              <div className="thread-bubble reply">
                                <div className="bubble-header">
                                  <span className="author">{reply.author}</span>
                                  {reply.timestamp && <span className="timestamp">{new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                </div>
                                <p className="text">{reply.text}</p>
                              </div>
                            </div>
                          ))}

                          {activeReplyId === thread.id && (
                            <div className="thread-reply-input">
                              <CornerDownRight size={14} className="reply-icon" />
                              <div className="input-group">
                                <textarea
                                  placeholder="Write a reply..."
                                  value={replyInput}
                                  onChange={(e) => setReplyInput(e.target.value)}
                                  autoFocus
                                />
                                <div className="input-actions">
                                  <button className="cancel-btn" onClick={() => setActiveReplyId(null)}>Cancel</button>
                                  <button className="send-btn" onClick={() => handleAddThread(loc.id, replyInput, true, thread.id)}>Send</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {isAddingNewThread ? (
                        <div className="new-thread-input">
                          <textarea
                            placeholder="Type your request or question here..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            autoFocus
                          />
                          <div className="input-actions">
                            <button className="cancel-btn" onClick={() => setIsAddingNewThread(false)}>Cancel</button>
                            <button className="send-btn" onClick={() => handleAddThread(loc.id, commentInput)}>Start Thread</button>
                          </div>
                        </div>
                      ) : (
                        <button className="add-thread-btn" onClick={() => setIsAddingNewThread(true)}>
                          <MessageCircle size={14} />
                          <span>Add Request</span>
                        </button>
                      )}
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
              <h3>{editingLoc ? 'Edit Location Recruitment' : 'Add Location Request'}</h3>
              <button className="close-btn" onClick={() => { setIsModalOpen(false); setEditingLoc(null); }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-tabs">
              <button 
                className={`modal-tab ${modalTab === 'details' ? 'active' : ''}`}
                onClick={() => setModalTab('details')}
              >
                Request Details
              </button>
              <button 
                className={`modal-tab ${modalTab === 'email' ? 'active' : ''}`}
                onClick={() => setModalTab('email')}
              >
                Email History
              </button>
            </div>

            <div className="modal-body">
              {modalTab === 'details' ? (
                <>
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
                </>
              ) : (
                <div className="email-history-view">
                  {editingLoc && editingLoc.requests && editingLoc.requests.length > 0 ? (
                    <div className="email-threads">
                      {editingLoc.requests.map((req, idx) => (
                        <div key={idx} className={`email-item ${req.role === 'coordinator' ? 'received' : 'sent'}`}>
                          <div className="email-header">
                            <div className="email-meta">
                              <span className="sender">{req.author}</span>
                              <span className="email-address">{req.role === 'coordinator' ? editingLoc.email : 'you@onsync.com'}</span>
                            </div>
                            <span className="date">{req.timestamp ? new Date(req.timestamp).toLocaleString() : 'Recently'}</span>
                          </div>
                          <div className="email-subject">
                            {req.role === 'coordinator' ? 'Re: ' : 'Scouting: '}{editingLoc.title}
                          </div>
                          <div className="email-body">
                            {req.text}
                          </div>
                          {req.replies && req.replies.map((reply, rIdx) => (
                            <div key={rIdx} className="email-reply-nested">
                              <p className="reply-text"><span>Reply:</span> {reply.text}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-email-state">
                      <Mail size={40} opacity={0.2} />
                      <p>No email history found for this location.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => { setIsModalOpen(false); setEditingLoc(null); }}>Cancel</button>
              <button className="submit-btn" onClick={handleSubmit}>{editingLoc ? 'Save Changes' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Location;
