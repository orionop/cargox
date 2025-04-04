import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadContainers = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/containers', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadItems = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const fetchContainers = async () => {
  return api.get('/containers');
};

export const runPlacementAlgorithm = async () => {
  return api.post('/place-items');
};

export const retrieveItem = async (itemId: string, astronaut: string = 'system') => {
  return api.get(`/retrieve/${itemId}?astronaut=${astronaut}`);
};

export const checkApiHealth = async () => {
  return api.get('/');
};

// New API endpoints for the hackathon requirements
export const getRearrangementRecommendation = async () => {
  return api.post('/rearrangement-recommendation');
};

export const manageWaste = async (undocking: boolean = false, maxWeight?: number) => {
  const params: any = { undocking };
  if (maxWeight) params.max_weight = maxWeight;
  return api.post('/waste-management', params);
};

export const simulateTime = async (days: number = 1, usagePlan: Record<string, number> = {}) => {
  return api.post('/simulate-time', { days, usage_plan: usagePlan });
};

export const simulateDay = async () => {
  return api.post('/simulate-day');
};

export const repackItems = async () => {
  return api.post('/repack');
};