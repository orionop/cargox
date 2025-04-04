/**
 * CargoX API Client
 * A JavaScript client for interacting with the CargoX API
 */

// Base URL for API requests
const API_BASE_URL = 'http://localhost:8000';

/**
 * Check the health of the API
 * @returns {Promise<Object>} Health status info
 */
async function checkHealth() {
    const response = await fetch(`${API_BASE_URL}/`);
    return await response.json();
}

/**
 * Import container data from a CSV file
 * @param {File} file - The CSV file containing container data
 * @returns {Promise<Object>} Import results
 */
async function importContainers(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/import/containers`, {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}

/**
 * Import item data from a CSV file
 * @param {File} file - The CSV file containing item data
 * @returns {Promise<Object>} Import results
 */
async function importItems(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/import/items`, {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}

/**
 * Import both containers and items in a single request
 * @param {File} containersFile - The CSV file containing container data
 * @param {File} itemsFile - The CSV file containing item data
 * @returns {Promise<Object>} Import results
 */
async function importData(containersFile, itemsFile) {
    const formData = new FormData();
    if (containersFile) {
        formData.append('containers_file', containersFile);
    }
    if (itemsFile) {
        formData.append('items_file', itemsFile);
    }
    
    const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}

/**
 * Run the placement algorithm to arrange items in containers
 * @param {Object} [options] - Optional configuration for the placement algorithm
 * @returns {Promise<Object>} Placement results
 */
async function placeItems(options = {}) {
    const response = await fetch(`${API_BASE_URL}/place-items`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
    });
    
    return await response.json();
}

/**
 * Get a retrieval path for a specific item
 * @param {string} itemId - ID of the item to retrieve
 * @returns {Promise<Object>} Retrieval path information
 */
async function getRetrievalPath(itemId) {
    const response = await fetch(`${API_BASE_URL}/retrieve/${itemId}`);
    return await response.json();
}

/**
 * List all containers
 * @returns {Promise<Object>} List of containers
 */
async function listContainers() {
    const response = await fetch(`${API_BASE_URL}/containers`);
    return await response.json();
}

/**
 * List all items
 * @returns {Promise<Object>} List of items
 */
async function listItems() {
    const response = await fetch(`${API_BASE_URL}/items`);
    return await response.json();
}

/**
 * Get detailed information about a specific container
 * @param {string} containerId - ID of the container
 * @returns {Promise<Object>} Container details
 */
async function getContainer(containerId) {
    const response = await fetch(`${API_BASE_URL}/containers/${containerId}`);
    return await response.json();
}

/**
 * Get detailed information about a specific item
 * @param {string} itemId - ID of the item
 * @returns {Promise<Object>} Item details
 */
async function getItem(itemId) {
    const response = await fetch(`${API_BASE_URL}/items/${itemId}`);
    return await response.json();
}

// Export all functions
export {
    API_BASE_URL,
    checkHealth,
    importContainers,
    importItems,
    importData,
    placeItems,
    getRetrievalPath,
    listContainers,
    listItems,
    getContainer,
    getItem
}; 