/**
 * CargoX API Client for frontend at http://localhost:5173
 * This file should be added to your frontend project
 */

// Configuration - make sure this points to your Docker backend
const API_BASE_URL = 'http://localhost:8003';

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
    
    const response = await fetch(`${API_BASE_URL}/api/import/containers`, {
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
    
    const response = await fetch(`${API_BASE_URL}/api/import/items`, {
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
    const response = await fetch(`${API_BASE_URL}/api/placement`, {
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
    const response = await fetch(`${API_BASE_URL}/api/search?itemId=${itemId}`);
    const data = await response.json();
    
    // Construct a result object compatible with the retrieve page expectations
    if (data && data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        found: true,
        item_id: item.id,
        path: [],
        disturbed_items: [],
        location: item.is_placed ? {
          container: item.container_id,
          position: {
            x: item.position_x,
            y: item.position_y,
            z: item.position_z
          }
        } : null,
        retrieval_time: new Date().toISOString(),
        retrieved_by: "system",
        item: item
      };
    } else {
      return {
        found: false,
        item_id: itemId,
        path: [],
        disturbed_items: [],
        location: null,
        retrieval_time: new Date().toISOString(),
        retrieved_by: "system"
      };
    }
  } catch (error) {
    console.error(`Error retrieving item ${itemId}:`, error);
    throw error;
  }
}

/**
 * Track usage of an item when it's retrieved
 * @param {string} itemId - The ID of the item to retrieve
 * @param {string} userId - ID of the person retrieving the item
 * @returns {Promise<Object>} - Updated item information
 */
export async function trackItemUsage(itemId, userId = "system") {
  try {
    const response = await fetch(`${API_BASE_URL}/api/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId, userId })
    });
    
    const data = await response.json();
    
    // If there was an error like 404, still return a structured response
    if (!response.ok) {
      return {
        success: false,
        message: data.detail || `Error retrieving item ${itemId}`,
        item: null
      };
    }
    
    return data;
  } catch (error) {
    console.error(`Error tracking usage for item ${itemId}:`, error);
    return {
      success: false,
      message: `Error retrieving item: ${error.message}`,
      item: null
    };
  }
}

/**
 * Place an item back in a container after use
 * @param {Object} itemPlacement - The placement information
 * @returns {Promise<Object>} - Updated item information
 */
export async function placeItemAfterUse(itemPlacement) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/place`, {
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
    const response = await fetch(`${API_BASE_URL}/api/containers`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching containers:', error);
    // Return a fallback with sample zones
    return {
      containers: [
        { id: "SB01", zone: "Sanitation_Bay" },
        { id: "CC01", zone: "Command_Center" },
        { id: "EB01", zone: "Engineering_Bay" },
        { id: "CQ01", zone: "Crew_Quarters" },
        { id: "MB01", zone: "Medical_Bay" },
        { id: "G01", zone: "Greenhouse" }
      ],
      count: 6,
      message: "Fallback container data"
    };
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
    
    const response = await fetch(`${API_BASE_URL}/api/search?${queryParams.toString()}`);
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
    const response = await fetch(`${API_BASE_URL}/api/waste/identify`);
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
export async function generateWasteReturnPlan(zoneId = "W") {
  try {
    const response = await fetch(`${API_BASE_URL}/api/waste/return-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ zoneId })
    });
    return await response.json();
  } catch (error) {
    console.error('Error generating waste return plan:', error);
    throw error;
  }
}

/**
 * Complete the undocking of waste containers
 * @param {string[]} containerIds - IDs of containers to undock
 * @param {boolean} removeItems - Whether to remove items from the system
 * @returns {Promise<Object>} - Result of the undocking operation
 */
export async function completeWasteUndocking(containerIds, removeItems = true) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/waste/complete-undocking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ containerIds, removeItems })
    });
    return await response.json();
  } catch (error) {
    console.error('Error completing waste undocking:', error);
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
    const response = await fetch(`${API_BASE_URL}/api/simulate/day`, {
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
    
    const response = await fetch(`${API_BASE_URL}/api/logs?${queryParams.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
}

/**
 * Export the current arrangement as CSV
 * @returns {Promise<Blob>} - CSV file as blob
 */
export async function exportArrangement() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export/arrangement`);
    return await response.blob();
  } catch (error) {
    console.error('Error exporting arrangement:', error);
    throw error;
  }
}

/**
 * Get container rearrangement recommendations
 * @returns {Promise<Object>} - Rearrangement suggestions
 */
export async function getRearrangementSuggestions() {
  try {
    const response = await fetch(`${API_BASE_URL}/rearrangement-recommendation`, {
      method: 'POST'
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error getting rearrangement suggestions:', error);
    throw error;
  }
}

/**
 * Execute a rearrangement plan by moving the specified items
 * @param {Array} rearrangementPlan - The plan to execute, containing item moves
 * @returns {Promise<Object>} - Result of the rearrangement operation
 */
export async function executeRearrangementPlan(rearrangementPlan) {
  try {
    // We'll implement this by moving each item to its target container
    // This requires multiple API calls (one per item)
    const results = [];
    
    for (const move of rearrangementPlan) {
      // Call the place API for each item
      const response = await fetch(`${API_BASE_URL}/api/place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: move.item_id,
          containerId: move.to_container,
          positionX: 0, // Default positions - the backend will find the best place
          positionY: 0,
          positionZ: 0,
          userId: "system"
        }),
      });
      
      const result = await response.json();
      results.push({
        ...move,
        success: result.success,
        message: result.message
      });
    }
    
    return {
      success: true,
      message: `Successfully moved ${results.filter(r => r.success).length}/${rearrangementPlan.length} items`,
      results
    };
  } catch (error) {
    console.error('Error executing rearrangement plan:', error);
    throw error;
  }
}

/**
 * Get all items
 * @returns {Promise<Object>} - All items
 */
export async function getAllItems() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching all items:', error);
    throw error;
  }
} 