/**
 * CargoX API Client for frontend at http://localhost:5173
 * This file should be added to your frontend project
 */

// Configuration - make sure this points to your Docker backend
const API_BASE_URL = 'http://localhost:8001';

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
 * Track usage of an item when it's retrieved
 * @param {string} itemId - The ID of the item to retrieve
 * @param {string} astronaut - Name of the person retrieving the item
 * @returns {Promise<Object>} - Updated item information
 */
export async function trackItemUsage(itemId, astronaut = "system") {
  try {
    const response = await fetch(`${API_BASE_URL}/retrieve/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ astronaut })
    });
    return await response.json();
  } catch (error) {
    console.error(`Error tracking usage for item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Place an item back in a container after use
 * @param {Object} itemPlacement - The placement information
 * @returns {Promise<Object>} - Updated item information
 */
export async function placeItemAfterUse(itemPlacement) {
  try {
    const response = await fetch(`${API_BASE_URL}/place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemPlacement)
    });
    return await response.json();
  } catch (error) {
    console.error('Error placing item after use:', error);
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

/**
 * Search for items based on various criteria
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<Array>} - Matching items
 */
export async function searchItems(searchParams) {
  try {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== null && value !== undefined) {
        queryParams.append(key, value);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/search?${queryParams.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error searching items:', error);
    throw error;
  }
}

/**
 * Identify waste items based on expiry and usage
 * @returns {Promise<Object>} - Waste items information
 */
export async function identifyWaste() {
  try {
    const response = await fetch(`${API_BASE_URL}/waste/identify`);
    return await response.json();
  } catch (error) {
    console.error('Error identifying waste:', error);
    throw error;
  }
}

/**
 * Generate a plan for returning waste items
 * @param {string} targetZone - Zone where waste should be moved to
 * @returns {Promise<Object>} - Waste return plan
 */
export async function generateWasteReturnPlan(targetZone = "Storage_Bay") {
  try {
    const response = await fetch(`${API_BASE_URL}/waste/return-plan?target_zone=${targetZone}`);
    return await response.json();
  } catch (error) {
    console.error('Error generating waste return plan:', error);
    throw error;
  }
}

/**
 * Simulate a day with optional usage plan
 * @param {Object} usagePlan - Plan for item usage, keys are item IDs and values are usage counts
 * @returns {Promise<Object>} - Simulation results
 */
export async function simulateDay(usagePlan = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/simulate/day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usage_plan: usagePlan })
    });
    return await response.json();
  } catch (error) {
    console.error('Error simulating day:', error);
    throw error;
  }
}

/**
 * Get action logs with optional filters
 * @param {Object} filters - Log filters
 * @returns {Promise<Object>} - Log entries
 */
export async function getLogs(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        queryParams.append(key, value);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/logs?${queryParams.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
}

/**
 * Repack all items (clear placements and run placement algorithm again)
 * @returns {Promise<Object>} - Placement results
 */
export async function repackItems() {
  try {
    const response = await fetch(`${API_BASE_URL}/repack`, {
      method: 'POST'
    });
    return await response.json();
  } catch (error) {
    console.error('Error repacking items:', error);
    throw error;
  }
} 