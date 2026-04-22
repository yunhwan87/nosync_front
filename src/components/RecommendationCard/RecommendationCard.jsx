import React from 'react';
import { MapPin, Info, DollarSign, Accessibility, Star, CheckCircle2 } from 'lucide-react';
import './RecommendationCard.css';

/**
 * Premium Recommendation Card Component
 * Displays detailed information about a recommended filming location
 */
const RecommendationCard = ({ 
  place, 
  isSelected, 
  onToggle 
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  if (!place) return null;

  return (
    <div 
      className={`recommendation-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onToggle(place.id)}
    >
      <div className="card-image-container">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="place-image" />
        ) : (
          <div className="place-image-placeholder">
            <MapPin size={32} />
          </div>
        )}
        <div className="card-overlay">
          {isSelected && <div className="selected-badge"><CheckCircle2 size={16} /> Selected</div>}
          {place.is_address_verified && (
            <div className="verified-badge" title="Address manually verified by OnSync Team">
              <CheckCircle2 size={12} />
              <span>Verified</span>
            </div>
          )}
          <div className="place-score">
            <Star size={12} fill="currentColor" />
            <span>{place.score ? place.score.toFixed(2) : '4.80'}</span>
          </div>
        </div>
      </div>

      <div className="card-content">
        <div className="card-header">
          <h4 className="place-name">{place.name}</h4>
          <div className="place-location">
            <MapPin size={12} />
            <span>{place.address || 'Location Details'}</span>
          </div>
        </div>

        <div className={`place-reason-wrapper ${isExpanded ? 'expanded' : ''}`}>
          <p className="place-reason">
            <Info size={14} className="reason-icon" />
            {place.reason || 'No specific reason provided.'}
          </p>
          {place.reason && place.reason.length > 80 && (
            <button 
              className="expand-btn" 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? 'Show Less' : 'Read More...'}
            </button>
          )}
        </div>

        <div className="place-meta">
          <div className="meta-item">
            <DollarSign size={14} />
            <span>{place.cost_range || 'Contact info needed'}</span>
          </div>
          <div className="meta-item">
            <Accessibility size={14} />
            <span>{place.accessibility || 'Good'}</span>
          </div>
        </div>

        <div className="place-tags">
          {place.tags && place.tags.map((tag, idx) => (
            <span key={idx} className="place-tag">{tag}</span>
          ))}
          {!place.tags && <span className="place-tag">Premium Location</span>}
        </div>
      </div>
      
      {/* Decorative Selection indicator */}
      <div className="selection-indicator"></div>
    </div>
  );
};

export default RecommendationCard;
