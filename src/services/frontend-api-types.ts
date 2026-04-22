// Frontend-facing API type definitions for the current backend module.
// Field names follow backend JSON contracts (snake_case).

export interface ApiErrorResponse {
  detail: string | Record<string, unknown>;
}

export interface HealthResponse {
  status: "ok" | string;
}

export interface RootResponse {
  message: string;
}

export interface RecommendationCreatorPayload {
  creator_type: string;
  creator_name: string;
  identity?: string[];
  content_purpose: string;
  region_preference?: string[];
  concept: string;
  shoot_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  people_count: number;
  transport_mode: string;
  budget_level: string;
  categories?: string[];
  must_have?: string[];
  avoid?: string[];
  language?: string;
}

export interface RecommendationGenerateRequest {
  request_id?: number | null;
  creator_request?: RecommendationCreatorPayload | null;
  top_k?: number;
  use_embedding?: boolean;
  use_rerank?: boolean;
}

export interface RecommendationItemResponse {
  place_id: number;
  name: string;
  category?: string | null;
  region?: string | null;
  score: number;
  recommendation_reason: string;
  rank: number;
  is_address_verified: boolean;
}

export interface RecommendationWeekdayExcludedItem {
  place_id: number;
  name: string;
  reason: string;
}

export interface RecommendationGenerateResponse {
  request_id: number;
  total_candidates: number;
  selected_count: number;
  weekday?: string | null;
  weekday_filter_note?: string | null;
  excluded_by_weekday?: RecommendationWeekdayExcludedItem[];
  items: RecommendationItemResponse[];
}

export interface TimelineCreateRequest {
  request_id: number;
  title?: string | null;
  use_saved_recommendations?: boolean;
}

export interface TimelineCandidatePlace {
  recommendation_result_id?: number;
  place_id?: number;
  name?: string;
  category?: string;
  score?: number;
  rank?: number;
  [key: string]: unknown;
}

export interface TimelineItemResponse {
  item_order: number;
  category?: string | null;
  start_time?: string | null; // HH:mm:ss
  end_time?: string | null; // HH:mm:ss
  selected_place_id?: number | null;
  candidate_places_json?: TimelineCandidatePlace[];
  memo?: string | null;
}

export interface TimelineResponse {
  timeline_id: number;
  request_id: number;
  title: string;
  status: string;
  total_duration_minutes?: number | null;
  items?: TimelineItemResponse[];
}

export interface CreatorRequestResponse {
  id: number;
  creator_type: string;
  creator_name: string;
  identity_json?: string[] | null;
  content_purpose: string;
  concept?: string | null;
  shoot_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  people_count: number;
  transport_mode?: string | null;
  budget_level?: string | null;
  categories_json?: string[] | null;
  region_preference_json?: string[] | null;
  must_have_json?: string[] | null;
  avoid_json?: string[] | null;
  language: string;
  raw_request_json?: Record<string, unknown> | null;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface TourFetchRequest {
  region?: string | null;
  region_preference?: string[] | null;
  keyword?: string | null;
  category?: string | null;
  sigungu_code?: string | null;
  content_type_id?: string | null;
  sync_mode?: "full" | "incremental";
  modifiedtime_from?: string | null; // YYYYMMDD or YYYYMMDDHHMMSS
  sync_key?: string | null;
  detail_enrich_on_changed?: boolean;
  num_of_rows?: number;
  page_no?: number;
}

export interface TourFetchResponse {
  fetched_count: number;
  saved_count: number;
  skipped_count: number;
  source: string;
  sample_items?: Record<string, unknown>[];
}

export interface PlaceFetchRequest {
  category: string;
  keyword?: string | null;
  region?: string | null;
  region_preference?: string[] | null;
  sigungu_code?: string | null;
  content_type_id?: string | null;
  sync_mode?: "full" | "incremental";
  modifiedtime_from?: string | null; // YYYYMMDD or YYYYMMDDHHMMSS
  sync_key?: string | null;
  detail_enrich_on_changed?: boolean;
  num_of_rows?: number;
  page_no?: number;
}

export interface PlaceFetchResponse {
  fetched_count: number;
  saved_count: number;
  skipped_count: number;
  source: string;
  category: string;
  sample_items?: Record<string, unknown>[];
}
