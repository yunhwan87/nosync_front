import React, { useState } from 'react';
import {
  mockProjects,
  creatorTypes,
  categoryOptions,
  initialProjectState
} from '../../mocks/mockData';
import {
  Calendar,
  Users,
  ChevronRight,
  Clock,
  Plus,
  X,
  Search,
  Check,
  MapPin
} from 'lucide-react';
import { getDDay, calculateTotalDays, formatDate } from '../../utils/logic';
import './Dashboard.css';

const Dashboard = ({ onSelectProject }) => {
  const [projects, setProjects] = useState(mockProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState(initialProjectState);
  const [memberQuery, setMemberQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Mock search simulation
  const handleSearch = (q) => {
    setMemberQuery(q);
    if (q.length > 1) {
      const allUsers = ['David Kim', 'Alice Park', 'Bob Lee', 'Charlie Jung', 'Eve Cho'];
      setSearchResults(allUsers.filter(u => u.toLowerCase().includes(q.toLowerCase())));
    } else {
      setSearchResults([]);
    }
  };

  const addMember = (name) => {
    if (!newProject.members.includes(name)) {
      setNewProject({ ...newProject, members: [...newProject.members, name] });
    }
    setMemberQuery('');
    setSearchResults([]);
  };

  const removeMember = (name) => {
    setNewProject({ ...newProject, members: newProject.members.filter(m => m !== name) });
  };

  const toggleCategory = (cat) => {
    const updated = newProject.categories.includes(cat)
      ? newProject.categories.filter(c => c !== cat)
      : [...newProject.categories, cat];
    setNewProject({ ...newProject, categories: updated });
  };

  const handleCreateProject = () => {
    if (!newProject.title) return alert('Please enter a project title');

    const projectToAdd = {
      ...newProject,
      id: Date.now(),
      status: 'Pre-production',
      startDate: formatDate(newProject.startDate),
      endDate: formatDate(newProject.endDate),
      totalDays: calculateTotalDays(newProject.startDate, newProject.endDate)
    };

    setProjects([...projects, projectToAdd]);
    setIsModalOpen(false);
    setNewProject(initialProjectState); // Reset form
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h2>Active Projects</h2>
          <p>You have {projects.length} projects in progress.</p>
        </div>
        <button className="add-project-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </div>

      <div className="project-grid">
        {projects.map((project) => (
          <div
            key={project.id}
            className="project-card-premium"
            onClick={() => onSelectProject && onSelectProject(project)}
          >
            <div className="project-card-header">
              <div className="header-top">
                <span className={`status-badge ${project.status.toLowerCase().replace(' ', '-')}`}>
                  {project.status}
                </span>
                <div className="d-day-badge">{getDDay(project.startDate)}</div>
              </div>
              <h3>{project.title}</h3>
            </div>

            <div className="project-details">
              <div className="detail-item">
                <Calendar size={14} />
                <span>{project.startDate} ~ {project.endDate}</span>
              </div>
              <div className="detail-item">
                <Clock size={14} />
                <span>Total {project.totalDays} Days</span>
              </div>
              <div className="detail-item">
                <Users size={14} />
                <span>{project.members.length} members</span>
              </div>
            </div>

            <div className="project-footer">
              <div className="member-avatars">
                {project.members.map((m, i) => (
                  <div key={i} className="mini-avatar" title={m}>{m[0]}</div>
                ))}
              </div>
              <button className="view-details-btn">
                <span>View Timeline</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        <button className="add-project-card" onClick={() => setIsModalOpen(true)}>
          <div className="add-icon"><Plus size={24} /></div>
          <span>Create New Project</span>
        </button>
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content-premium">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Paris Fashion Week 2026"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formatDate(newProject.startDate)}
                    onChange={(e) => setNewProject({ ...newProject, startDate: new Date(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formatDate(newProject.endDate)}
                    onChange={(e) => setNewProject({ ...newProject, endDate: new Date(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Creator Profile</label>
                <div className="form-row">
                  <select
                    className="form-select"
                    value={newProject.creator_type}
                    onChange={(e) => setNewProject({ ...newProject, creator_type: e.target.value })}
                  >
                    {creatorTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Creator Name"
                    value={newProject.creator_name}
                    onChange={(e) => setNewProject({ ...newProject, creator_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Target Regions</label>
                <div className="search-box">
                  <MapPin size={16} />
                  <input
                    type="text"
                    placeholder="e.g. Paris, Seoul (Press Enter to add)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        setNewProject({
                          ...newProject,
                          region_preference: [...newProject.region_preference, e.target.value]
                        });
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <div className="member-tags">
                  {newProject.region_preference.map(r => (
                    <div key={r} className="member-tag region">
                      <span>{r}</span>
                      <X size={12} onClick={() => setNewProject({
                        ...newProject,
                        region_preference: newProject.region_preference.filter(x => x !== r)
                      })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Categories</label>
                <div className="chips-group">
                  {categoryOptions.map(cat => (
                    <button
                      key={cat}
                      className={`chip ${newProject.categories.includes(cat) ? 'active' : ''}`}
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>AI Configuration</label>
                <div className="ai-config-grid">
                  <div className="ai-item">
                    <span>Recommendations (Top K)</span>
                    <input
                      type="number"
                      min="1" max="20"
                      value={newProject.top_k}
                      onChange={(e) => setNewProject({ ...newProject, top_k: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="ai-item toggle">
                    <span>Use Embedding</span>
                    <button
                      className={`toggle-btn ${newProject.use_embedding ? 'on' : ''}`}
                      onClick={() => setNewProject({ ...newProject, use_embedding: !newProject.use_embedding })}
                    >
                      <div className="toggle-slider"></div>
                    </button>
                  </div>
                  <div className="ai-item toggle">
                    <span>Use Rerank</span>
                    <button
                      className={`toggle-btn ${newProject.use_rerank ? 'on' : ''}`}
                      onClick={() => setNewProject({ ...newProject, use_rerank: !newProject.use_rerank })}
                    >
                      <div className="toggle-slider"></div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  placeholder="Additional production notes..."
                  value={newProject.note}
                  onChange={(e) => setNewProject({ ...newProject, note: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer">
              <div className="total-days-hint">
                Total Days: <strong>{calculateTotalDays(newProject.startDate, newProject.endDate)}</strong>
              </div>
              <button className="submit-btn" onClick={handleCreateProject}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
