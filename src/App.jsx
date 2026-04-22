import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  MessageSquare,
  Bell,
  PlusCircle,
  Settings,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Dashboard from './screens/Dashboard/Dashboard';
import Schedule from './screens/Schedule/Schedule';
import Location from './screens/Location/Location';
import Chat from './screens/Chat/Chat';
import CommunicationLog from './screens/Communication/CommunicationLog';
import { mockLocations, mockSchedules } from './mocks/mockData';
import './styles/App.css';

/**
 * ChatGPT-style Layout for OnSync - Responsive Version with Desktop Toggle
 */
const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentProject, setCurrentProject] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  
  // Lifted state for menu integration
  const [locations, setLocations] = useState(mockLocations);
  const [schedules, setSchedules] = useState(mockSchedules);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // On desktop, we can keep the previous state (user preference)
      // On mobile, we usually start closed
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleProjectSelect = (project) => {
    setCurrentProject(project);
    handleTabChange('schedule');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
    { id: 'location', icon: MapPin, label: 'Locations' },
    { id: 'communication', icon: Bell, label: 'Requests' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
  ];

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">O</div>
            <span>OnSync</span>
          </div>
          
          {/* Desktop Toggle Button */}
          {!isMobile && (
            <button className="sidebar-toggle-desktop" onClick={toggleSidebar} title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}>
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          )}

          <button 
            className="new-chat-btn"
            onClick={() => {
              setActiveTab('dashboard');
              setIsWizardOpen(true);
            }}
          >
            <PlusCircle size={18} />
            <span>New Project</span>
          </button>
          
          {/* Mobile Close Button */}
          {isMobile && (
            <button className="sidebar-close-mobile" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">Today</div>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabChange(item.id)}
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

        {/* Boundary Click Trigger */}
        {!isMobile && (
          <div className="sidebar-resizer-toggle" onClick={toggleSidebar}>
            <div className="resizer-handle"></div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-left-group">
            {/* Mobile Hamburger */}
            {isMobile && (
              <button className="hamburger-menu" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={24} />
              </button>
            )}
            
            <h1>{menuItems.find(i => i.id === activeTab)?.label}</h1>
          </div>
          
          <div className="header-actions">
            <button className="icon-btn mobile-hidden"><Bell size={20} /></button>
            <button className="icon-btn"><User size={20} /></button>
          </div>
        </header>

        <section className="content-body">
          {activeTab === 'dashboard' && (
            <Dashboard 
              onSelectProject={handleProjectSelect} 
              isWizardOpen={isWizardOpen}
              setIsWizardOpen={setIsWizardOpen}
            />
          )}
          {activeTab === 'schedule' && (
            <Schedule 
              project={currentProject} 
              schedules={schedules} 
              setSchedules={setSchedules} 
            />
          )}
          {activeTab === 'location' && (
            <Location 
              project={currentProject} 
              locations={locations} 
              setLocations={setLocations} 
              schedules={schedules} 
              setSchedules={setSchedules} 
            />
          )}
          {activeTab === 'chat' && <Chat project={currentProject} />}
          {activeTab === 'communication' && (
            <CommunicationLog 
              locations={locations} 
              project={currentProject} 
            />
          )}

          {!['dashboard', 'schedule', 'location', 'chat', 'communication'].includes(activeTab) && (
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
