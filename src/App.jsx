import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  MessageSquare,
  Bell,
  PlusCircle,
  Settings,
  User
} from 'lucide-react';
import Dashboard from './screens/Dashboard/Dashboard';
import Schedule from './screens/Schedule/Schedule';
import Location from './screens/Location/Location';
import Chat from './screens/Chat/Chat';
import './styles/App.css';

/**
 * ChatGPT-style Layout for OnSync
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentProject, setCurrentProject] = useState(null);
  
  const handleProjectSelect = (project) => {
    setCurrentProject(project);
    setActiveTab('schedule');
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
    { id: 'location', icon: MapPin, label: 'Locations' },
    { id: 'communication', icon: Bell, label: 'Requests' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">O</div>
            <span>OnSync</span>
          </div>
          <button className="new-chat-btn">
            <PlusCircle size={18} />
            <span>New Project</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Today</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="user-profile">
            <div className="avatar">DK</div>
            <div className="user-info">
              <span className="user-name">David Kim</span>
              <span className="user-plan">Premium Plan</span>
            </div>
            <Settings size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="content-header">
          <h1>{menuItems.find(i => i.id === activeTab)?.label}</h1>
          <div className="header-actions">
            <button className="icon-btn"><User size={20} /></button>
          </div>
        </header>

        <section className="content-body">
          {activeTab === 'dashboard' && <Dashboard onSelectProject={handleProjectSelect} />}
          {activeTab === 'schedule' && <Schedule project={currentProject} />}
          {activeTab === 'location' && <Location project={currentProject} />}
          {activeTab === 'chat' && <Chat project={currentProject} />}

          {!['dashboard', 'schedule', 'location', 'chat'].includes(activeTab) && (
            <div className="empty-state">
              <p>{activeTab.toUpperCase()} screen is under construction.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
