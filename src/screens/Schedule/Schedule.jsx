import React, { useState, useEffect } from 'react';
import { mockSchedules } from '../../mocks/mockData';
import { Clock, MapPin, MoreVertical, Filter, AlertCircle, DollarSign, Info, Loader2, Utensils, Coffee, Camera, Landmark, TreePine, Map, Activity, Sparkles, Plus } from 'lucide-react';
import { getDayNumber } from '../../utils/logic';
import { getTimeline } from '../../services/api';
import './Schedule.css';

const Schedule = ({ project, schedules, setSchedules }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localSchedules, setLocalSchedules] = useState([]);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'recommendations'

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!project || !project.timelineId) {
        setLocalSchedules([]);
        return;
      }

      setIsLoading(true);
      try {
        const result = await getTimeline(project.timelineId);
        
        // Map backend timeline items to frontend schedule format
        const mappedSchedules = (result.items || []).map(item => ({
          id: `be-${item.item_order}`,
          projectId: project.id,
          date: project.startDate, // Default to start date for now
          time: `${item.start_time?.substring(0, 5)} - ${item.end_time?.substring(0, 5)}`,
          type: item.category || 'Event',
          location: item.memo || 'TBD',
          note: item.memo || 'Automated Slot',
          status: 'Confirmed',
          budget: 'TBD'
        }));
        
        setLocalSchedules(mappedSchedules);
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
        // Fallback to mock if it's a mock project, or show empty
        setLocalSchedules([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();
  }, [project]);

  if (!project) {
    return (
      <div className="empty-state">
        <AlertCircle size={40} />
        <p>Please select a project from the Dashboard first.</p>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div className="header-left">
          <h2>{project.title} Schedule</h2>
          <p>Duration: {project.startDate} ~ {project.endDate} (Total {project.totalDays} Days)</p>
        </div>
        <div className="header-right">
          <div className="view-toggle-premium">
            <button 
              className={`toggle-opt ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </button>
            <button 
              className={`toggle-opt ${viewMode === 'recommendations' ? 'active' : ''}`}
              onClick={() => setViewMode('recommendations')}
            >
              Recommended Places
            </button>
          </div>
          <button className="primary-btn">Add Slot</button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="timeline-view">
          <div className="timeline-header">
            <div className="time-col">Day / Time</div>
            <div className="event-col">Event & Location</div>
            <div className="status-col">Status</div>
          </div>

          <div className="timeline-body">
            {isLoading ? (
              <div className="schedule-loading">
                <Loader2 className="animate-spin" size={32} />
                <p>Fetching optimized timeline...</p>
              </div>
            ) : (
              (localSchedules.length > 0 ? localSchedules : (schedules || []).filter(s => s.projectId === project.id))
              .map((item) => (
                <div key={item.id} className="timeline-row">
                  <div className="time-col">
                    <div className="day-time-vertical">
                      <span className="day-label">Day {getDayNumber(item.date, project.startDate)}</span>
                      <span className="time-label">{item.time}</span>
                    </div>
                  </div>
                  <div className="event-col">
                    <div className="event-card">
                      <div className="event-info">
                        <span className={`event-type-tag ${item.type.toLowerCase()}`}>
                          {item.type}
                        </span>
                        <h4>{item.note}</h4>
                        <div className="event-meta">
                          <div className="meta-item location">
                            <MapPin size={12} />
                            <span>{item.location}</span>
                          </div>
                          {item.budget && item.budget !== 'TBD' && (
                            <div className="meta-item budget">
                              <DollarSign size={12} />
                              <span>{item.budget}</span>
                            </div>
                          )}
                          {item.reason && (
                            <div className="meta-item reason" title={item.reason}>
                              <Info size={12} />
                              <span>AI Recommendation Point</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button className="more-btn"><MoreVertical size={16} /></button>
                    </div>
                  </div>
                  <div className="status-col">
                    <span className={`status-dot ${item.status.toLowerCase()}`}></span>
                    <span>{item.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="recommendations-view-schedule">
          {project.recommendations && project.recommendations.length > 0 ? (
            <div className="recommendations-grid-minimal">
              {['restaurant', 'cafe', 'viewpoint', 'cultural_tour', 'nature', 'activity', 'street'].map(cat => {
                const catItems = project.recommendations.filter(p => p.category?.toLowerCase() === cat);
                if (catItems.length === 0) return null;
                
                const CategoryIcon = cat === 'restaurant' ? Utensils :
                                     cat === 'cafe' ? Coffee :
                                     cat === 'viewpoint' ? Camera :
                                     cat === 'cultural_tour' ? Landmark :
                                     cat === 'nature' ? TreePine :
                                     cat === 'activity' ? Activity : Map;

                return (
                  <div key={cat} className="category-group-card">
                    <div className="category-group-header">
                      <CategoryIcon size={18} />
                      <h3>{cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}s</h3>
                      <span className="count-badge">{catItems.length}</span>
                    </div>
                    <div className="category-items-list">
                      {catItems.map(item => (
                        <div key={item.id} className="recommendation-list-item">
                          <div className="item-main">
                            <h4>{item.title}</h4>
                            <p className="item-address"><MapPin size={12} /> {item.region || 'Location details'}</p>
                            <p className="item-reason">"{item.recommendation_reason}"</p>
                          </div>
                          <button className="add-to-schedule-btn">
                            <Plus size={14} />
                            <span>Add to Day</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-recommendations">
              <Sparkles size={40} />
              <p>No specific recommendations found for this project. Use the Wizard to generate some!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Schedule;
