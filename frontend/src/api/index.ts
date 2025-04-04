import axios from 'axios';

const API_BASE_URL = 'http://localhost:8001';

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

export const runPlacementAlgorithm = async () => {
  return api.post('/place-items');
};

export const getContainers = async () => {
  return api.get('/containers');
};

export const retrieveItem = async (itemId: string) => {
  return api.get(`/retrieve/${itemId}`);
};

export const checkApiHealth = async () => {
  return api.get('/');
};