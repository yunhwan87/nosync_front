import { BackendApiClient } from './frontend-api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Singleton instance of the API Client
 */
export const apiClient = new BackendApiClient(API_BASE);

/**
 * Health check to verify server status
 */
export async function healthCheck() {
  return apiClient.health();
}

/**
 * Step 1 & 2 -> Step 3: Generate recommendations based on user inputs
 * @param {Object} payload
 */
export async function generateRecommendations(payload = {}) {
  const {
    top_k = 5,
    use_embedding = true,
    use_rerank = false,
    ignore_weekday_filter = false,
    ...creatorPayload
  } = payload;

  const formattedPayload = {
    creator_request: creatorPayload,
    top_k,
    use_embedding,
    use_rerank,
    ignore_weekday_filter,
  };

  console.log('=== [STEP 2] Formatted Payload for Backend ===');
  console.log(JSON.stringify(formattedPayload, null, 2));

  return apiClient.generateRecommendations(formattedPayload);
}

/**
 * Fetch recommendation details by request ID
 */
export async function getRecommendations(requestId) {
  return apiClient.getRecommendations(Number(requestId));
}

/**
 * Create a timeline (schedule) for a specific recommendation request
 */
export async function createTimeline(requestId, title = 'New Project Timeline') {
  return apiClient.createTimeline({
    request_id: Number(requestId),
    title,
    use_saved_recommendations: true,
  });
}

/**
 * Get full timeline details
 */
export async function getTimeline(timelineId) {
  return apiClient.getTimeline(Number(timelineId));
}

/**
 * Get request status and basic details
 */
export async function getRequestStatus(requestId) {
  return apiClient.getCreatorRequest(Number(requestId));
}
