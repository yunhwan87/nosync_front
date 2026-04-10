import React from 'react';
import { mockSchedules } from '../../mocks/mockData';
import { Clock, MapPin, MoreVertical, Filter, AlertCircle } from 'lucide-react';
import { getDayNumber } from '../../utils/logic';
import './Schedule.css';

const Schedule = ({ project }) => {
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
          <button className="filter-btn">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="primary-btn">Add Slot</button>
        </div>
      </div>

      <div className="timeline-view">
        <div className="timeline-header">
          <div className="time-col">Day / Time</div>
          <div className="event-col">Event & Location</div>
          <div className="status-col">Status</div>
        </div>

        <div className="timeline-body">
          {mockSchedules
            .filter(s => s.projectId === project.id)
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
                      <div className="meta-item">
                        <MapPin size={12} />
                        <span>{item.location}</span>
                      </div>
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schedule;
