export const mockProjects = [
  {
    id: 1,
    title: 'Movie "Alpha"',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    totalDays: 91,
    members: ['John', 'Alice', 'Bob'],
    status: 'In Production',
    note: 'Sci-fi thriller about AI.'
  },
  {
    id: 2,
    title: 'Commercial "Sync"',
    startDate: '2026-04-10',
    endDate: '2026-04-15',
    totalDays: 6,
    members: ['Eve', 'Charlie'],
    status: 'Pre-production',
    note: 'Brand sync commercial.'
  }
];

export const mockSchedules = [
  {
    id: 101,
    projectId: 1,
    date: '2026-04-09',
    time: '09:00',
    location: 'Studio A',
    status: 'Confirmed',
    type: 'Shooting',
    note: 'Scene 24 - The Awakening',
    budget: '1,200,000 KRW',
    reason: 'Advanced lighting control and soundproofing optimized for sci-fi sequences.'
  },
  {
    id: 102,
    projectId: 1,
    date: '2026-04-09',
    time: '14:00',
    location: 'Cafeteria',
    status: 'Pending',
    type: 'Meeting',
    note: 'Crew briefing',
    budget: '50,000 KRW',
    reason: 'Natural gathering point with enough space for the full production team.'
  }
];

export const mockLocations = [
  {
    id: 201,
    projectId: 1,
    title: 'Modern Apartment',
    managerName: 'Kim Scout',
    phone: '010-1234-5678',
    email: 'kim@scout.com',
    cost: '500,000 KRW',
    depositStatus: 'Paid',
    note: 'Natural light preferred.',
    aiSummary: 'Excellent lighting, but requires noise insulation.',
    creator_request_id: 1,
    timeline_item_contact_id: 'tic-uuid-0001',
    m2Status: 'EMAIL_SENT'
  }
];

export const creatorTypes = [
  { id: 'travel_creator', label: 'Travel Creator' },
  { id: 'business_creator', label: 'Business' },
  { id: 'lifestyle_creator', label: 'Lifestyle' }
];

export const categoryOptions = ['cafe', 'viewpoint', 'street', 'dinner', 'shopping', 'activity', 'nature'];

export const initialProjectState = {
  title: '',
  contents: '',
  concept: '',
  identity: '',
  must_have: '',
  avoid: '',
  startDate: new Date(),
  endDate: new Date(),
  note: '',
  members: [],
  creator_type: 'travel_creator',
  creator_name: 'Minji Kim',
  region_preference: [],
  categories: [],
  transport_mode: 'public_transport',
  budget_level: 'medium',
  people_count: 2,
  language: 'ko',
  start_time: '10:00:00',
  end_time: '18:00:00',
  top_k: 5,
  use_embedding: true,
  use_rerank: false,
  ignore_weekday_filter: false
};