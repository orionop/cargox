// Example of using the CargoX API in your frontend
import { importContainers, importItems, placeItems, retrieveItem, getContainers } from './api.js';

// DOM elements
const containerFileInput = document.getElementById('container-file');
const itemFileInput = document.getElementById('item-file');
const uploadContainersBtn = document.getElementById('upload-containers');
const uploadItemsBtn = document.getElementById('upload-items');
const runPlacementBtn = document.getElementById('run-placement');
const statusDiv = document.getElementById('status');

// Function to display status messages
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.style.color = isError ? 'red' : 'green';
}

// Upload containers when button is clicked
uploadContainersBtn.addEventListener('click', async () => {
  if (!containerFileInput.files || containerFileInput.files.length === 0) {
    showStatus('Please select a containers CSV file', true);
    return;
  }

  const file = containerFileInput.files[0];
  
  try {
    showStatus('Uploading containers...');
    const result = await importContainers(file);
    
    if (result.success) {
      showStatus(`Successfully imported ${result.containers_count} containers`);
    } else {
      showStatus(`Failed to import containers: ${result.message}`, true);
    }
  } catch (error) {
    showStatus(`Error uploading containers: ${error.message}`, true);
  }
});

// Upload items when button is clicked
uploadItemsBtn.addEventListener('click', async () => {
  if (!itemFileInput.files || itemFileInput.files.length === 0) {
    showStatus('Please select an items CSV file', true);
    return;
  }

  const file = itemFileInput.files[0];
  
  try {
    showStatus('Uploading items...');
    const result = await importItems(file);
    
    if (result.success) {
      showStatus(`Successfully imported ${result.items_count} items`);
    } else {
      showStatus(`Failed to import items: ${result.message}`, true);
    }
  } catch (error) {
    showStatus(`Error uploading items: ${error.message}`, true);
  }
});

// Run placement algorithm when button is clicked
runPlacementBtn.addEventListener('click', async () => {
  try {
    showStatus('Running placement algorithm...');
    const result = await placeItems();
    
    if (result.success) {
      showStatus(result.message);
      
      // Load and display container data if placement was successful
      displayContainerData();
    } else {
      showStatus(`Placement failed: ${result.message}`, true);
    }
  } catch (error) {
    showStatus(`Error running placement algorithm: ${error.message}`, true);
  }
});

// Function to display container data
async function displayContainerData() {
  try {
    const containers = await getContainers();
    console.log('Container data:', containers);
    
    // Here you would update your UI with the container data
    // For example:
    // updateVisualization(containers);
  } catch (error) {
    console.error('Error fetching container data:', error);
  }
} 