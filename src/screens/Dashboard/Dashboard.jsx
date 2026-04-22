import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  ChevronRight
} from 'lucide-react';
import ProjectWizard from '../../components/ProjectWizard/ProjectWizard';
import { mockProjects } from '../../mocks/mockData';
import { getDDay } from '../../utils/logic';
import './Dashboard.css';



const Dashboard = ({ onSelectProject, isWizardOpen, setIsWizardOpen }) => {
  const [projects, setProjects] = useState(mockProjects);
  const handleProjectCreated = (projectToAdd) => {
    setProjects(prev => [...prev, projectToAdd]);
    if (onSelectProject) {
      onSelectProject(projectToAdd);
    }
  };



  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h2>Active Projects</h2>
          <p>You have {projects.length} projects in progress.</p>
        </div>
        <button className="add-project-btn" onClick={() => setIsWizardOpen(true)}>
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
                <span>{project.members?.length || 0} members</span>
              </div>
            </div>

            <div className="project-footer">
              <div className="member-avatars">
                {(project.members || []).map((m, i) => (
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

        <button className="add-project-card" onClick={() => setIsWizardOpen(true)}>
          <div className="add-icon"><Plus size={24} /></div>
          <span>Create New Project</span>
        </button>
      </div>

      {/* New Project Wizard Component */}
      <ProjectWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};

export default Dashboard;
