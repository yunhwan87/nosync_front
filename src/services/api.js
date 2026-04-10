/**
 * OnSync API Service Layer
 * Designed for interaction with AWS / FastAPI backend
 */

const API_BASE_URL = 'https://api.onsync-aws.com'; // Placeholder for AWS/FastAPI URL

// Generic fetch wrapper with error handling
const fetchAPI = async (endpoint, options = {}) => {
  try {
    // Current: Simulate AWS response with delay
    // Future: Replace with actual fetch to FastAPI
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: null });
      }, 500);
    });

    /* Actual implementation placeholder:
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await response.json();
    return { success: response.ok, data };
    */
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message };
  }
};

export const projectService = {
  getProjects: () => fetchAPI('/projects'),
  getProjectById: (id) => fetchAPI(`/projects/${id}`),
  createProject: (data) => fetchAPI('/projects', { method: 'POST', body: JSON.stringify(data) }),
};

export const scheduleService = {
  getSchedules: (projectId) => fetchAPI(`/schedules?project_id=${projectId}`),
  createSchedule: (data) => fetchAPI('/schedules', { method: 'POST', body: JSON.stringify(data) }),
};

export const locationService = {
  getLocations: (projectId) => fetchAPI(`/locations?project_id=${projectId}`),
  updateLocation: (id, data) => fetchAPI(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
