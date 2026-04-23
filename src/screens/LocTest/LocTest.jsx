import React, { useState, useEffect, useRef } from 'react';
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
  Edit3,
  Send,
  Loader
} from 'lucide-react';
import './LocTest.css';

const API_BASE = 'http://localhost:8080';

const LocTest = ({ project, locations, setLocations, schedules, setSchedules, onUnresolvedCount }) => {
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

  // m2 상태
  const [recruitingId, setRecruitingId] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);  // 발송 중인 loc.id
  const [actionAnswers, setActionAnswers] = useState({});
  const [detailOpen, setDetailOpen] = useState({});
  const pollRef = useRef(null);

  // 미해결 액션 아이템 카운트 → 사이드바 뱃지
  useEffect(() => {
    const mockActionItems = [{ id: 'mock-1' }, { id: 'mock-2' }];
    const count = locations.filter(loc => {
      if (loc.m2Status === 'FOLLOWUP_SENT') return false;
      const items = loc.actionItems?.length > 0 ? loc.actionItems : (loc.m2Status ? mockActionItems : []);
      return items.length > 0 && !items.every(i => actionAnswers[i.id]?.trim());
    }).length;
    onUnresolvedCount?.(count);
  }, [locations, actionAnswers]);

  const toggleExpand = (id) => {
    setExpandedLocId(expandedLocId === id ? null : id);
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

  useEffect(() => {
    if (editingLoc && newRequest.note !== initialNote) {
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
      setSchedules(schedules.filter(s => s.locationId !== locationData.id));
    }

    setIsModalOpen(false);
    setEditingLoc(null);

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
        author: 'Crew (You)',
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

      return {
        ...loc,
        requests: newRequests,
        cardStatus: 'coordinator_pending'
      };
    });

    setLocations(updatedLocations);
    setCommentInput('');
    setReplyInput('');
    setActiveReplyId(null);
    setIsAddingNewThread(false);
  };

  // ── m2 폴링: req_id가 있는 장소 상태를 주기적으로 업데이트
  useEffect(() => {
    const hasActive = locations.some(l => l.req_id);
    if (!hasActive) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/flow`);
        const data = await res.json();
        const flows = data.flows || {};

        setLocations(prev => prev.map(loc => {
          if (!loc.req_id || !flows[loc.req_id]) return loc;
          const flow = flows[loc.req_id];
          const step2 = flow.step2 || {};
          const step3 = flow.step3 || null;
          const step4 = flow.step4 || null;
          const step5 = flow.step5 || null;

          // 대화 배열 조립
          const conversation = [];
          if (step2.initial_email_body) {
            conversation.push({
              direction: 'outbound',
              subject: step2.initial_email_subject,
              body: step2.initial_email_body,
              timestamp: step2.initial_email_at,
            });
          }
          if (step3?.latest_body) {
            conversation.push({
              direction: 'inbound',
              body: step3.latest_body,
              timestamp: step3.latest_at,
            });
          }
          if (step5?.draft_text) {
            conversation.push({
              direction: 'outbound',
              body: step5.draft_text,
              subject: step5.subject,
              timestamp: step5.created_at,
              status: step5.status,
            });
          }

          return {
            ...loc,
            m2Status: step2.status || loc.m2Status,
            actionItems: step4 ? step4.pending_actions : [],
            conversation: conversation.length > 0 ? conversation : loc.conversation,
          };
        }));
      } catch (e) {
        console.warn('[LocTest] 폴링 실패:', e.message);
      }
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [locations]);

  // ── m2 섭외 트리거
  const handleRecruit = async (loc) => {
    if (!loc.creator_request_id || !loc.timeline_item_contact_id) {
      alert('섭외에 필요한 ID 정보가 없습니다.');
      return;
    }
    setRecruitingId(loc.id);
    try {
      const res = await fetch(`${API_BASE}/api/new-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_request_id: loc.creator_request_id,
          timeline_item_contact_id: loc.timeline_item_contact_id,
          contact_type: 'email',
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setLocations(prev => prev.map(l =>
          l.id === loc.id
            ? { ...l, req_id: data.req_id, m2Status: 'EMAIL_SENT', actionItems: [] }
            : l
        ));
      } else {
        alert(`섭외 실패: ${data.message}`);
      }
    } catch (e) {
      alert(`서버 연결 실패: ${e.message}`);
    } finally {
      setRecruitingId(null);
    }
  };

  // ── m2 액션 아이템 답변 제출
  const handleResolveActions = async (loc) => {
    if (!loc.req_id || !loc.actionItems?.length) return;
    setSubmittingId(loc.id);
    try {
      const res = await fetch(`${API_BASE}/api/resolve-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          req_id: loc.req_id,
          answers: actionAnswers,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setLocations(prev => prev.map(l =>
          l.id === loc.id ? { ...l, m2Status: 'FOLLOWUP_SENT', actionItems: [] } : l
        ));
        setActionAnswers({});
      } else {
        alert(`제출 실패: ${data.message}`);
      }
    } catch (e) {
      alert(`서버 연결 실패: ${e.message}`);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="location-container">
      <div className="location-header">
        <div className="header-info">
          <h2>Location Scouting <span className="test-badge">TEST</span></h2>
          <p>{project?.title || 'General'} Locations & Scouting status</p>
        </div>
        <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Add Location Request</span>
        </button>
      </div>

      <div className="location-list">
        {locations.map((loc) => {
          const mockConversation = [
            { direction: 'outbound', subject: '[Modern Apartment] 촬영 협조 요청', body: '안녕하세요, Kim Scout님.\n\n저희는 영화 "Alpha" 제작팀입니다. 해당 장소에서 4월 25일 오후 2시~6시 촬영을 진행하고 싶습니다.\n\n자연광이 풍부한 공간으로 알고 있는데, 촬영 허가 및 조건 안내 부탁드립니다.\n\n감사합니다.', timestamp: '2026-04-23T09:00:00Z' },
            { direction: 'inbound', body: '안녕하세요!\n\n네, 해당 날짜 촬영 가능합니다. 몇 가지 확인이 필요합니다.\n\n1. 삼각대 및 조명 장비 반입 예정이신가요?\n2. 촬영 인원이 몇 명인가요?\n\n확인 후 계약서 보내드리겠습니다.', timestamp: '2026-04-23T11:30:00Z' },
            { direction: 'outbound', subject: 'Re: [Modern Apartment] 촬영 협조 요청', body: '답변 감사합니다!\n\n1. 삼각대 2개, 소형 LED 조명 사용 예정입니다.\n2. 총 5명 입장 예정입니다 (감독, 촬영감독, 조명, 배우 2명).\n\n잘 부탁드립니다.', timestamp: '2026-04-23T14:00:00Z', status: 'DRAFT' },
          ];
          const mockActionItems = [
            { id: 'mock-1', item_order: 1, action_text: '삼각대 및 조명 장비 반입 예정이신가요?' },
            { id: 'mock-2', item_order: 2, action_text: '촬영 인원이 몇 명인가요?' },
          ];
          const displayConversation = loc.conversation?.length > 0 ? loc.conversation : mockConversation;
          const displayActionItems = loc.actionItems?.length > 0 ? loc.actionItems : mockActionItems;
          const isDetailOpen = detailOpen[loc.id] || false;
          const allAnswered = displayActionItems.length > 0 && displayActionItems.every(i => actionAnswers[i.id]?.trim());
          const needsAction = loc.m2Status !== 'FOLLOWUP_SENT' && submittingId !== loc.id && displayActionItems.length > 0 && !allAnswered;

          const isEmailSent = !!loc.m2Status; // m2Status 없으면 미발송

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
                    {!isEmailSent && (
                      <button
                        className="action-icon-btn recruit"
                        onClick={() => handleRecruit(loc)}
                        title="섭외 이메일 발송"
                        disabled={recruitingId === loc.id}
                      >
                        {recruitingId === loc.id ? <Loader size={16} className="spin" /> : <Mail size={16} />}
                      </button>
                    )}
                    <button className="action-icon-btn edit" onClick={() => openEditModal(loc)} title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button className="action-icon-btn delete" onClick={() => handleDelete(loc.id)} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {needsAction && (
                    <button
                      className="needs-action-badge"
                      onClick={(e) => { e.stopPropagation(); setExpandedLocId(loc.id); }}
                    >
                      ! 확인 필요
                    </button>
                  )}
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
                  {loc.m2Status && (
                    <span className={`card-status-label m2-${loc.m2Status.toLowerCase()}`}>
                      {loc.m2Status}
                    </span>
                  )}
                  {!loc.m2Status && loc.cardStatus && (
                    <span className={`card-status-label ${loc.cardStatus}`}>
                      {loc.cardStatus === 'coordinator_pending' ? 'Co-ord Pending' : loc.cardStatus === 'crew_pending' ? 'Crew Pending' : loc.cardStatus}
                    </span>
                  )}
                </div>
              </div>

              {expandedLocId === loc.id && (
                <div className="location-details-drawer">
                  <div className="details-section">
                    <div className="comm-header">
                      <div className="section-label">Communication History</div>
                      <button
                        className="detail-toggle-btn"
                        onClick={() => setDetailOpen(prev => ({ ...prev, [loc.id]: !prev[loc.id] }))}
                      >
                        {isDetailOpen ? '간략히' : '자세히'}
                      </button>
                    </div>

                    {isDetailOpen ? (
                      /* ── 자세히: 이메일 전문 + 답변 입력 */
                      <>
                        <div className="email-conversation">
                          {displayConversation.map((msg, idx) => (
                            <div key={idx} className={`conv-bubble-wrap ${msg.direction}`}>
                              <div className="conv-bubble">
                                {msg.subject && <div className="conv-subject">{msg.subject}</div>}
                                <p className="conv-body">{msg.body}</p>
                                <div className="conv-meta">
                                  <span>{msg.direction === 'outbound' ? '나' : '상대방'}</span>
                                  {msg.timestamp && (
                                    <span>{new Date(msg.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                  )}
                                  {msg.status === 'DRAFT' && <span className="draft-tag">초안</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 자세히 뷰 액션 아이템 입력 */}
                        {loc.m2Status !== 'FOLLOWUP_SENT' && submittingId !== loc.id && displayActionItems.length > 0 && (
                          <div className="detail-action-section">
                            <div className="section-label" style={{ marginBottom: '12px' }}>답변 입력</div>
                            {displayActionItems.map(item => (
                              <div key={item.id} className="action-item-row">
                                <span className="action-item-text">{item.item_order}. {item.action_text}</span>
                                <textarea
                                  className="action-item-input"
                                  placeholder="답변을 입력하세요..."
                                  value={actionAnswers[item.id] || ''}
                                  onChange={e => setActionAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                />
                              </div>
                            ))}
                            <button
                              className="submit-actions-btn"
                              onClick={() => handleResolveActions(loc)}
                              disabled={!allAnswered}
                            >
                              <Send size={14} />
                              <span>후속 이메일 발송</span>
                            </button>
                          </div>
                        )}

                        {submittingId === loc.id && (
                          <div className="summary-item sending" style={{ padding: '12px 0' }}>
                            <div className="summary-dot sending-pulse" />
                            <div className="summary-content">
                              <span className="summary-label">발송 중...</span>
                              <span className="summary-time">후속 이메일을 생성하고 있습니다</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* ── 간략히: 타임라인 요약 */
                      <div className="comm-summary">
                        <div className="summary-item sent">
                          <div className="summary-dot" />
                          <div className="summary-content">
                            <span className="summary-label">제안을 보냄</span>
                            <span className="summary-time">
                              {displayConversation[0]?.timestamp && new Date(displayConversation[0].timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {displayConversation.some(m => m.direction === 'inbound') && loc.m2Status !== 'FOLLOWUP_SENT' && submittingId !== loc.id && (
                          <div className="summary-item received">
                            <div className="summary-dot" />
                            <div className="summary-content">
                              <span className="summary-label">답장 수신 — 답변 필요</span>
                              <ul className="summary-action-list">
                                {displayActionItems.map(item => (
                                  <li key={item.id}>
                                    <span className="action-q">{item.item_order}. {item.action_text}</span>
                                    <input
                                      className="summary-action-input"
                                      type="text"
                                      placeholder="답변 입력..."
                                      value={actionAnswers[item.id] || ''}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => setActionAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    />
                                  </li>
                                ))}
                              </ul>
                              {allAnswered && (
                                <button
                                  className="submit-actions-btn"
                                  style={{ marginTop: '10px' }}
                                  onClick={e => { e.stopPropagation(); handleResolveActions(loc); }}
                                >
                                  <Send size={14} />
                                  <span>후속 이메일 발송</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {submittingId === loc.id && (
                          <div className="summary-item sending">
                            <div className="summary-dot sending-pulse" />
                            <div className="summary-content">
                              <span className="summary-label">발송 중...</span>
                              <span className="summary-time">후속 이메일을 생성하고 있습니다</span>
                            </div>
                          </div>
                        )}

                        {loc.m2Status === 'FOLLOWUP_SENT' && (
                          <div className="summary-item sent">
                            <div className="summary-dot" />
                            <div className="summary-content">
                              <span className="summary-label">후속 이메일 발송됨</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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

export default LocTest;
