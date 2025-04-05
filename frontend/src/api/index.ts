import axios from 'axios';

const API_BASE_URL = 'http://localhost:8003';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadContainers = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/import/containers', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadItems = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/api/import/items', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const fetchContainers = async (containerId?: string, containerType?: string) => {
  const params: Record<string, string> = {};
  if (containerId) params.containerId = containerId;
  if (containerType) params.containerType = containerType;
  return api.get('/api/containers', { params });
};

export const runPlacementAlgorithm = async () => {
  return api.post('/api/placement');
};

export const retrieveItem = async (itemId: string, userId: string = 'system') => {
  return api.post('/api/retrieve', { itemId, userId });
};

export const searchItems = async (params: { itemId?: string, itemName?: string, userId?: string }) => {
  return api.get('/api/search', { params });
};

export const placeItem = async (itemData: {
  itemId: string,
  containerId: string,
  position: { x: number, y: number, z: number },
  userId?: string
}) => {
  return api.post('/api/place', itemData);
};

export const checkApiHealth = async () => {
  return api.get('/');
};

export const identifyWaste = async () => {
  return api.get('/api/waste/identify');
};

export const generateWasteReturnPlan = async (zoneId: string = 'W') => {
  return api.post('/api/waste/return-plan', { zoneId });
};

export const completeWasteUndocking = async (containerIds: string[], removeItems: boolean = true) => {
  return api.post('/api/waste/complete-undocking', { containerIds, removeItems });
};

export const simulateDay = async (days: number = 1, usagePlan: Record<string, number> = {}) => {
  return api.post('/api/simulate/day', { days, usage_plan: usagePlan });
};

export const getLogs = async (params: {
  startDate?: string,
  endDate?: string,
  itemId?: string,
  userId?: string,
  actionType?: string
}) => {
  return api.get('/api/logs', { params });
};

export const exportArrangement = async () => {
  return api.get('/api/export/arrangement', { responseType: 'blob' });
};

/**
 * Get all items from the backend
 * @returns Promise with all items
 */
export const getAllItems = async () => {
  const response = await fetch(`${API_BASE_URL}/api/search`);
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status}`);
  }
  return response.json();
};