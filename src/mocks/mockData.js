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
    note: 'Scene 24 - The Awakening' 
  },
  { 
    id: 102, 
    projectId: 1, 
    date: '2026-04-09', 
    time: '14:00', 
    location: 'Cafeteria', 
    status: 'Pending', 
    type: 'Meeting', 
    note: 'Crew briefing' 
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
    aiSummary: 'Excellent lighting, but requires noise insulation.' 
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
  startDate: new Date(),
  endDate: new Date(),
  note: '',
  members: [],
  creator_type: 'travel_creator',
  creator_name: 'Minji Kim',
  region_preference: [],
  categories: [],
  top_k: 5,
  use_embedding: true,
  use_rerank: false
};

