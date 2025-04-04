/**
 * CargoX API Client for frontend at http://localhost:5173
 * This file should be added to your frontend project
 */

// Configuration - make sure this points to your Docker backend
const API_BASE_URL = 'http://localhost:8000';

/**
 * Import containers from a CSV file
 * @param {File} file - The CSV file to upload
 * @returns {Promise<Object>} - API response
 */
export async function importContainers(file) {
  console.log('Importing containers to:', API_BASE_URL);
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/import/containers`, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error importing containers:', error);
    throw error;
  }
}

/**
 * Import items from a CSV file
 * @param {File} file - The CSV file to upload
 * @returns {Promise<Object>} - API response
 */
export async function importItems(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/import/items`, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error importing items:', error);
    throw error;
  }
}

/**
 * Run the placement algorithm to place items in containers
 * @returns {Promise<Object>} - Placement results
 */
export async function placeItems() {
  try {
    const response = await fetch(`${API_BASE_URL}/place-items`, {
      method: 'POST'
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error placing items:', error);
    throw error;
  }
}

/**
 * Get retrieval path for a specific item
 * @param {string} itemId - The ID of the item to retrieve
 * @returns {Promise<Object>} - Retrieval path information
 */
export async function retrieveItem(itemId) {
  try {
    const response = await fetch(`${API_BASE_URL}/retrieve/${itemId}`);
    return await response.json();
  } catch (error) {
    console.error(`Error retrieving item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Get all containers and their items
 * @returns {Promise<Object>} - Container data with items
 */
export async function getContainers() {
  try {
    const response = await fetch(`${API_BASE_URL}/containers`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching containers:', error);
    throw error;
  }
} 