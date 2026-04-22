import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MapPin,
  Calendar,
  Clock,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Building2,
  Loader2,
  Sparkles,
  Search,
  ArrowRight,
  Info
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import {
  initialProjectState
} from '../../mocks/mockData';
import { REGION_DATA } from '../../constants/regionData';
import { calculateTotalDays, formatDate } from '../../utils/logic';
import RecommendationCard from '../RecommendationCard/RecommendationCard';
import { generateRecommendations, createTimeline } from '../../services/api';
import { ApiClientError } from '../../services/frontend-api-client';
import './ProjectWizard.css';

const koreaRegions = [
  { id: 'seoul', name: '서울특별시', en: 'Seoul', lat: 37.5665, lng: 126.9780 },
  { id: 'busan', name: '부산광역시', en: 'Busan', lat: 35.1796, lng: 129.0756 },
  { id: 'daegu', name: '대구광역시', en: 'Daegu', lat: 35.8714, lng: 128.6014 },
  { id: 'incheon', name: '인천광역시', en: 'Incheon', lat: 37.4563, lng: 126.7052 },
  { id: 'gwangju', name: '광주광역시', en: 'Gwangju', lat: 35.1595, lng: 126.8526 },
  { id: 'daejeon', name: '대전광역시', en: 'Daejeon', lat: 36.3504, lng: 127.3845 },
  { id: 'ulsan', name: '울산광역시', en: 'Ulsan', lat: 35.5384, lng: 129.3114 },
  { id: 'sejong', name: '세종특별자치시', en: 'Sejong', lat: 36.4800, lng: 127.2890 },
  { id: 'gyeonggi', name: '경기도', en: 'Gyeonggi', lat: 37.4138, lng: 127.5183 },
  { id: 'gangwon', name: '강원특별자치도', en: 'Gangwon', lat: 37.8228, lng: 128.1555 },
  { id: 'chungbuk', name: '충청북도', en: 'Chungbuk', lat: 36.6353, lng: 127.4913 },
  { id: 'chungnam', name: '충청남도', en: 'Chungnam', lat: 36.6588, lng: 126.6730 },
  { id: 'jeonbuk', name: '전북특별자치도', en: 'Jeonbuk', lat: 35.8204, lng: 127.1088 },
  { id: 'jeonnam', name: '전라남도', en: 'Jeonnam', lat: 34.8160, lng: 126.4629 },
  { id: 'gyeongbuk', name: '경상북도', en: 'Gyeongbuk', lat: 36.5760, lng: 128.5058 },
  { id: 'gyeongnam', name: '경상남도', en: 'Gyeongnam', lat: 35.2383, lng: 128.6924 },
  { id: 'jeju', name: '제주특별자치도', en: 'Jeju', lat: 33.3617, lng: 126.5292 },
];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 35.9,
  lng: 127.8
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
  ],
};

const ProjectWizard = ({ isOpen, onClose, onProjectCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [newProject, setNewProject] = useState(initialProjectState);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [weekdayNote, setWeekdayNote] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [requestId, setRequestId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [lastGenerateMeta, setLastGenerateMeta] = useState(null);
  const [regionInput, setRegionInput] = useState('');
  const [mapZoom, setMapZoom] = useState(7);
  const [mapCenter, setMapCenter] = useState(center);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) || ""
  });

  const getEnName = (krName) => {
    if (REGION_DATA[krName]) return REGION_DATA[krName].en;
    for (const prov in REGION_DATA) {
      const sub = REGION_DATA[prov].subRegions.find(s => s.kr === krName);
      if (sub) return sub.en;
    }
    return krName;
  };


  const getReadableError = (error, fallbackMessage) => {
    if (error instanceof ApiClientError) {
      const detail = typeof error.detail === 'string'
        ? error.detail
        : (error.detail ? JSON.stringify(error.detail) : '');
      return detail
        ? `${fallbackMessage} (${error.status}): ${detail}`
        : `${fallbackMessage} (${error.status})`;
    }

    if (error instanceof Error && error.message) {
      return `${fallbackMessage}: ${error.message}`;
    }

    return fallbackMessage;
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const { title, contents, concept, identity, must_have, avoid } = newProject;
      if (!title || !contents || !concept || !identity || !must_have || !avoid) {
        alert("Please fill in all required fields: Title, Contents, Concept, Identity, Must Have, and Avoid.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (newProject.region_preference.length === 0) {
        alert("Please select a region on the map.");
        return;
      }
      
      // Validation: Ensure a specific sub-city is selected, not just the large province
      const currentSelection = newProject.region_preference[0];
      const isProvinceOnly = koreaRegions.some(region => region.id === currentSelection);
      
      if (isProvinceOnly) {
        alert("Please select a specific city or district within the region (e.g., click a city card after selecting a province).");
        return;
      }
      
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!newProject.startDate) {
        alert("Please select a shoot date.");
        return;
      }
      
      if (newProject.categories.length === 0) {
        alert("Please select at least one preferred category.");
        return;
      }

      if (newProject.start_time >= newProject.end_time) {
        alert("End time must be later than start time.");
        return;
      }

      setApiError(null);
      setIsGenerating(true);
      setLastGenerateMeta(null);
      setCurrentStep(4);

      try {
        const parseToList = (input) => {
          if (!input) return [];
          return String(input).split(',').map(s => s.trim()).filter(Boolean);
        };

        const formatTime = (timeStr) => {
          if (!timeStr) return "10:00:00";
          const parts = timeStr.split(':');
          if (parts.length === 2) return `${timeStr}:00`;
          return timeStr;
        };

        const engRegions = newProject.region_preference.map(r => getEnName(r).toLowerCase());
        const regionsWithCountry = [...new Set([...engRegions, 'south korea'])];

        const payloadToBackend = {
          creator_type: newProject.creator_type,
          creator_name: newProject.creator_name || "Minji Kim",
          identity: parseToList(newProject.identity),
          content_purpose: newProject.contents,
          region_preference: regionsWithCountry,
          concept: newProject.concept,
          shoot_date: newProject.startDate instanceof Date 
            ? newProject.startDate.toISOString().split('T')[0] 
            : String(newProject.startDate).split('T')[0],
          start_time: formatTime(newProject.start_time),
          end_time: formatTime(newProject.end_time),
          people_count: newProject.people_count,
          transport_mode: newProject.transport_mode,
          budget_level: newProject.budget_level,
          categories: newProject.categories,
          must_have: parseToList(newProject.must_have),
          avoid: parseToList(newProject.avoid),
          language: newProject.language.toLowerCase(),
          ignore_weekday_filter: newProject.ignore_weekday_filter
        };
        console.log("=== [STEP 1] ProjectWizard Payload ===");
        console.log(payloadToBackend);
        
        const result = await generateRecommendations(payloadToBackend);

        const mappedItems = (result.items || []).map(item => ({
          ...item,
          id: item.place_id,
          reason: item.recommendation_reason,
          address: item.region || 'Location Details',
          tags: [item.category].filter(Boolean)
        }));

        const resolvedRequestId = result.requestId || result.request_id;
        setRecommendations(mappedItems);
        setRequestId(resolvedRequestId);
        setWeekdayNote(result.weekday_filter_note || null);
        setSelectedPlaceIds(mappedItems.map(p => p.id));
        setApiError(null);
        setLastGenerateMeta({
          requestId: resolvedRequestId ?? null,
          totalCandidates: result.total_candidates ?? null,
          selectedCount: result.selected_count ?? mappedItems.length,
        });
      } catch (error) {
        console.error("Failed to generate recommendations:", error);
        setRecommendations([]);
        setSelectedPlaceIds([]);
        setRequestId(null);
        setLastGenerateMeta(null);
        setApiError(getReadableError(error, 'Failed to fetch recommendations from backend'));
        setWeekdayNote(null);
      } finally {
        setIsGenerating(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => setCurrentStep(prev => prev - 1);

  const togglePlaceSelection = (placeId) => {
    setSelectedPlaceIds(prev =>
      prev.includes(placeId)
        ? prev.filter(id => id !== placeId)
        : [...prev, placeId]
    );
  };

  const handleCreateProject = async () => {
    if (!newProject.title) return alert('Please enter a project title');
    if (!requestId || recommendations.length === 0) {
      alert('No recommendation result available yet. Please run Analyze Locations again.');
      return;
    }

    setApiError(null);
    setIsGenerating(true);

    try {
      const timelineResult = await createTimeline(requestId, newProject.title);

      const projectToAdd = {
        ...newProject,
        id: Date.now(),
        timelineId: timelineResult.timeline_id,
        status: 'Pre-production',
        startDate: formatDate(newProject.startDate),
        endDate: formatDate(newProject.endDate),
        totalDays: calculateTotalDays(newProject.startDate, newProject.endDate),
        members: ['David Kim'],
        recommendations: recommendations.filter(p => selectedPlaceIds.includes(p.id))
      };

      onProjectCreated(projectToAdd);
      onClose();
      // Reset state for next time
      setCurrentStep(1);
      setNewProject(initialProjectState);
      setSelectedProvince(null);
    } catch (error) {
      console.error("Failed to create project timeline:", error);
      const readable = getReadableError(error, 'Timeline creation failed');
      setApiError(readable);
      alert(readable);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleRegion = (regionName, enName) => {
    setSelectedProvince(regionName);
    if (enName) {
      const val = enName.toLowerCase();
      
      // Zoom into the province
      const province = koreaRegions.find(r => r.id === enName);
      if (province) {
        setMapCenter({ lat: province.lat, lng: province.lng });
        setMapZoom(10);
      }

      setNewProject(prev => ({
        ...prev,
        region_preference: [val]
      }));
    }
  };

  const resetMap = () => {
    setMapCenter(center);
    setMapZoom(7);
    setSelectedProvince(null);
  };

  const handleAddRegion = () => {
    const trimmed = regionInput.trim();
    if (trimmed && !newProject.region_preference.includes(trimmed)) {
      setNewProject({
        ...newProject,
        region_preference: [...newProject.region_preference, trimmed]
      });
      setRegionInput('');
    }
  };

  const handleRemoveRegion = (regionName) => {
    setNewProject({
      ...newProject,
      region_preference: newProject.region_preference.filter(r => r !== regionName)
    });
  };

  const renderStep1 = () => {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="modal-body"
      >
        <div className="form-group">
          <label>Project Name <span className="required-badge">(Required)</span></label>
          <input
            type="text"
            placeholder="e.g. Shoot in Seoul 2026"
            value={newProject.title}
            onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Contents <span className="required-badge">(Required)</span></label>
          <textarea
            placeholder="Describe the main content of your project..."
            value={newProject.contents}
            onChange={(e) => setNewProject({ ...newProject, contents: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Concept <span className="required-badge">(Required)</span></label>
            <input
              type="text"
              placeholder="e.g. Day trip, Food tour"
              value={newProject.concept}
              onChange={(e) => setNewProject({ ...newProject, concept: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Creator Type</label>
            <select
              className="form-select-premium"
              value={newProject.creator_type}
              onChange={(e) => setNewProject({ ...newProject, creator_type: e.target.value })}
            >
              <option value="travel_creator">Travel Creator</option>
              <option value="business_creator">Business</option>
              <option value="lifestyle_creator">Lifestyle</option>
              <option value="general_creator">General</option>
            </select>
          </div>
        </div>

        {/* Identity Section */}
        <div className="form-group">
          <label>Identity <span className="required-badge">(Required)</span></label>
          <input
            type="text"
            placeholder="e.g. Professional traveler, Vlogger"
            value={newProject.identity}
            onChange={(e) => setNewProject({ ...newProject, identity: e.target.value })}
          />
        </div>

        <div className="form-row">
          {/* Must Have Section */}
          <div className="form-group">
            <label>Must Have <span className="required-badge">(Required)</span></label>
            <input
              type="text"
              placeholder="e.g. Parking, Natural light, Quiet"
              value={newProject.must_have}
              onChange={(e) => setNewProject({ ...newProject, must_have: e.target.value })}
            />
          </div>

          {/* Avoid Section */}
          <div className="form-group">
            <label>Avoid <span className="required-badge">(Required)</span></label>
            <input
              type="text"
              placeholder="e.g. Noisy, Expensive, Crowded"
              value={newProject.avoid}
              onChange={(e) => setNewProject({ ...newProject, avoid: e.target.value })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Transport Mode</label>
            <select
              className="form-select-premium"
              value={newProject.transport_mode}
              onChange={(e) => setNewProject({ ...newProject, transport_mode: e.target.value })}
            >
              <option value="public_transport">Public Transport</option>
              <option value="private_car">Private Car</option>
              <option value="walking">Walking</option>
            </select>
          </div>
          <div className="form-group">
            <label>Budget Level</label>
            <select
              className="form-select-premium"
              value={newProject.budget_level}
              onChange={(e) => setNewProject({ ...newProject, budget_level: e.target.value })}
            >
              <option value="low">Low (Budget)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Premium)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>People Count</label>
            <input
              type="number"
              min="1"
              max="50"
              value={newProject.people_count}
              onChange={(e) => setNewProject({ ...newProject, people_count: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="form-group">
            <label>Language</label>
            <select
              className="form-select-premium"
              value={newProject.language}
              onChange={(e) => setNewProject({ ...newProject, language: e.target.value })}
            >
              <option value="ko">Korean (ko)</option>
              <option value="en">English (en)</option>
            </select>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="modal-body"
    >
      <div className="map-selection-container">
        {/* 
        <div className="form-group">
          <label>Target Regions</label>
          <div className="region-input-wrapper" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="text"
              placeholder="e.g. Seoul, Jeonju-si"
              value={regionInput}
              onChange={(e) => setRegionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRegion()}
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #3c4453', backgroundColor: '#1a2235', color: '#fff' }}
            />
            <button 
              className="submit-btn" 
              style={{ width: 'auto', padding: '0 16px', margin: 0 }} 
              onClick={handleAddRegion}
            >
              Add
            </button>
          </div>
          <div className="helper-text" style={{ fontSize: '0.85rem', color: '#9ca5b3', marginBottom: '16px' }}>
            Type a region name (e.g. Seoul, Jeonju) and press Enter or Add.
          </div>
        </div>
        */}

        <div className="member-tags">
          {newProject.region_preference.map(r => (
            <div key={r} className="member-tag region">
              <span>{r}</span>
              <X size={12} onClick={() => handleRemoveRegion(r)} style={{ cursor: 'pointer' }} />
            </div>
          ))}
          {newProject.region_preference.length === 0 && (
            <span className="no-selection">No regions added yet.</span>
          )}
        </div>

        <div className="form-group">
          <label>Target Regions (Select from Map)</label>
          <div className="region-selection-header">
            <p className="helper-text">Click on the markers to select regions in South Korea.</p>
            {selectedProvince && (
              <div className="selected-provinces-tab">
                <button
                  className="province-tab active"
                  onClick={resetMap}
                >
                  <ChevronLeft size={14} /> Back to Map
                </button>
                <span className="current-province-name">{getEnName(selectedProvince)}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`mock-map-view ${selectedProvince ? 'half' : ''}`}>
          {(!isLoaded) ? (
            <div className="map-loading">
              <Loader2 className="animate-spin" />
              <span>Loading Google Maps...</span>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={mapZoom}
              options={mapOptions}
            >
              {!selectedProvince ? (
                koreaRegions.map((region) => (
                  <MarkerF
                    key={region.id}
                    position={{ lat: region.lat, lng: region.lng }}
                    label={{
                      text: region.en,
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: '600',
                      className: 'marker-label-map'
                    }}
                    onClick={() => toggleRegion(region.name, region.id)}
                    icon={{
                      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                      fillColor: selectedProvince === region.name ? "#10a37f" : "#4f46e5",
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: "#ffffff",
                      scale: 0.9,
                      anchor: { x: 12, y: 22 }
                    }}
                  />
                ))
              ) : (
                <>
                  {/* Reset view button inside map or separate */}
                  {REGION_DATA[selectedProvince]?.subRegions.map((sub, idx) => (
                    sub.lat && sub.lng && (
                      <MarkerF
                        key={`${sub.en}-${idx}`}
                        position={{ lat: sub.lat, lng: sub.lng }}
                        label={{
                          text: sub.en,
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: '600',
                          className: 'marker-label-map sub'
                        }}
                        onClick={() => {
                          const val = sub.en.toLowerCase();
                          setNewProject(prev => ({
                            ...prev,
                            region_preference: [val]
                          }));
                        }}
                        icon={{
                          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                          fillColor: newProject.region_preference.includes(sub.en.toLowerCase()) ? "#10a37f" : "#f59e0b",
                          fillOpacity: 1,
                          strokeWeight: 1,
                          strokeColor: "#ffffff",
                          scale: 0.7,
                          anchor: { x: 12, y: 22 }
                        }}
                      />
                    )
                  ))}
                </>
              )}
            </GoogleMap>
          )}
        </div>

        {selectedProvince && REGION_DATA[selectedProvince] && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="sub-cities-container"
          >
            <div className="sub-cities-header">
              <Building2 size={18} />
              <h4>Regions in {REGION_DATA[selectedProvince].en}</h4>
            </div>
            <div className="sub-cities-list">
              {REGION_DATA[selectedProvince].subRegions.map(city => (
                <div
                  key={city.en}
                  className={`sub-city-card ${newProject.region_preference.includes(city.en.toLowerCase()) ? 'selected' : ''}`}
                  onClick={() => {
                    const val = city.en.toLowerCase();
                    setNewProject(prev => ({
                      ...prev,
                      region_preference: [val]
                    }));
                  }}
                >
                  <div className="city-name-row">
                    <span className="city-dot"></span>
                    <span className="city-name">{city.en}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  const renderStep3 = () => {
    const categoryOptions = ['cafe', 'cultural_tour', 'restaurant', 'viewpoint', 'street', 'nature', 'activity'];

    const toggleCategory = (cat) => {
      const updated = newProject.categories.includes(cat)
        ? newProject.categories.filter(c => c !== cat)
        : [...newProject.categories, cat];
      setNewProject({ ...newProject, categories: updated });
    };

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="modal-body"
      >
        <div className="form-group">
          <label>Shoot Date <span className="required-badge">(Required)</span></label>
          <input
            type="date"
            className="full-width-input"
            value={newProject.startDate instanceof Date ? newProject.startDate.toISOString().split('T')[0] : newProject.startDate}
            onChange={(e) => setNewProject({ ...newProject, startDate: new Date(e.target.value) })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="time"
              step="1"
              value={newProject.start_time}
              onChange={(e) => setNewProject({ ...newProject, start_time: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <input
              type="time"
              step="1"
              value={newProject.end_time}
              onChange={(e) => setNewProject({ ...newProject, end_time: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Preferred Categories</label>
          <div className="category-chips">
            {categoryOptions.map(cat => (
              <button
                key={cat}
                className={`category-chip ${newProject.categories.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Options</label>
          <div className="checkbox-group-premium">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={newProject.ignore_weekday_filter}
                onChange={(e) => setNewProject({ ...newProject, ignore_weekday_filter: e.target.checked })}
              />
              <span className="checkbox-text">Ignore holiday/closed day filter (Load all places)</span>
            </label>
          </div>
        </div>

        <div className="step-note">
          <Info size={14} />
          <span>Setting precise time and categories helps AI match the best schedule.</span>
        </div>
      </motion.div>
    );
  };

  const renderStep4 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="modal-body"
    >
      <div className="recommendations-view-container">
        {isGenerating ? (
          <div className="generating-state">
            <div className="sparkle-animation">
              <Sparkles className="sparkle-icon" size={48} />
              <div className="pulse-ring"></div>
            </div>
            <h4>AI Analyzing Best Locations</h4>
            <p>Matching your project needs with over 5,000 professional filming spots...</p>
            <div className="generation-progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="recommendation-header-row">
              <div className="header-info">
                <label>Recommended Places</label>
                <p>We found {recommendations.length} ideal locations for your {newProject.contents} project.</p>
              </div>
              <div className="selection-count">
                {selectedPlaceIds.length} Selected
              </div>
            </div>

            {weekdayNote && (
              <div className="weekday-notice">
                <Calendar size={14} />
                <span>{weekdayNote}</span>
              </div>
            )}


            {apiError && (
              <div className="weekday-notice" style={{ borderColor: '#ef4444' }}>
                <Info size={14} />
                <span>{apiError}</span>
              </div>
            )}

            {lastGenerateMeta && (
              <div className="weekday-notice">
                <Info size={14} />
                <span>
                  request_id={lastGenerateMeta.requestId ?? 'N/A'}, total_candidates={lastGenerateMeta.totalCandidates ?? 'N/A'}, selected_count={lastGenerateMeta.selectedCount ?? 'N/A'}
                </span>
              </div>
            )}

            <div className="recommendations-grid">
              {recommendations.length > 0 ? (
                recommendations.map((place) => (
                  <RecommendationCard
                    key={place.id}
                    place={place}
                    isSelected={selectedPlaceIds.includes(place.id)}
                    onToggle={togglePlaceSelection}
                  />
                ))
              ) : (
                <div className="no-recommendations">
                  <Search size={40} />
                  <p>No specific matches found for current criteria. Try adjusting filters or regions.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-content-premium wizard step-${currentStep}`}>
        <div className="modal-header">
          <h3>Create New Project</h3>
          {/* Skip progress bar in results step to save space or keep it */}
          <div className="wizard-progress">
            <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
              <div className="step-number">{currentStep > 1 ? <Check size={14} /> : 1}</div>
              <span className="step-label">Details</span>
            </div>
            <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
              <div className="step-number">{currentStep > 2 ? <Check size={14} /> : 2}</div>
              <span className="step-label">Location</span>
            </div>
            <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
              <div className="step-number">{currentStep > 3 ? <Check size={14} /> : 3}</div>
              <span className="step-label">Settings</span>
            </div>
            <div className={`step-indicator ${currentStep >= 4 ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <span className="step-label">Results</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <AnimatePresence mode="wait">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </AnimatePresence>

        <div className="modal-footer">
          <div className="nav-buttons">
            {currentStep === 1 ? (
              <button className="cancel-btn" onClick={onClose}>Cancel</button>
            ) : (
              <button className="prev-btn" onClick={handlePrev}>
                <ChevronLeft size={18} style={{ marginRight: '4px' }} />
                Prev
              </button>
            )}
          </div>

          <div className="nav-buttons">
            {currentStep < 4 ? (
              <button
                className="submit-btn"
                onClick={handleNext}
              >
                {currentStep === 3 ? 'Analyze Locations' : 'Next'}
                <ChevronRight size={18} style={{ marginLeft: '4px' }} />
              </button>
            ) : (
              <button className="confirm-btn" onClick={handleCreateProject} disabled={isGenerating || !requestId || recommendations.length === 0}>
                Confirm & Create
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectWizard;
