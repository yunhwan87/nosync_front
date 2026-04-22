import type {
  ApiErrorResponse,
  CreatorRequestResponse,
  HealthResponse,
  PlaceFetchRequest,
  PlaceFetchResponse,
  RecommendationGenerateRequest,
  RecommendationGenerateResponse,
  RootResponse,
  TimelineCreateRequest,
  TimelineResponse,
  TourFetchRequest,
  TourFetchResponse,
} from './frontend-api-types';

export class ApiClientError extends Error {
  status: number;
  detail?: string | Record<string, unknown>;

  constructor(status: number, message: string, detail?: string | Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = detail;
  }
}

export class BackendApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      throw new ApiClientError(0, `Network error @ ${path}`, message);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const err = isJson ? (body as ApiErrorResponse | null) : null;
      const detail = err?.detail ?? (typeof body === 'string' ? body : undefined);
      const message = `API ${response.status} ${response.statusText} @ ${path}`;
      throw new ApiClientError(response.status, message, detail);
    }

    return body as T;
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { method: 'GET' });
  }

  root(): Promise<RootResponse> {
    return this.request<RootResponse>('/', { method: 'GET' });
  }

  generateRecommendations(
    payload: RecommendationGenerateRequest
  ): Promise<RecommendationGenerateResponse> {
    return this.request<RecommendationGenerateResponse>('/api/v1/recommendations/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getRecommendations(requestId: number): Promise<RecommendationGenerateResponse> {
    return this.request<RecommendationGenerateResponse>(`/api/v1/recommendations/${requestId}`, {
      method: 'GET',
    });
  }

  createTimeline(payload: TimelineCreateRequest): Promise<TimelineResponse> {
    return this.request<TimelineResponse>('/api/v1/timelines/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getTimeline(timelineId: number): Promise<TimelineResponse> {
    return this.request<TimelineResponse>(`/api/v1/timelines/${timelineId}`, {
      method: 'GET',
    });
  }

  getCreatorRequest(requestId: number): Promise<CreatorRequestResponse> {
    return this.request<CreatorRequestResponse>(`/api/v1/requests/${requestId}`, {
      method: 'GET',
    });
  }

  fetchTour(payload: TourFetchRequest): Promise<TourFetchResponse> {
    return this.request<TourFetchResponse>('/api/v1/tour/fetch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  fetchPlaces(payload: PlaceFetchRequest): Promise<PlaceFetchResponse> {
    return this.request<PlaceFetchResponse>('/api/v1/places/fetch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
