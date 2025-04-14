import React, { useState } from 'react';
import { placeItemAfterUse } from '../frontend-api';
import { Loader, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface PlaceItemFormProps {
  itemId: string;
  itemName: string;
  onPlaceSuccess: (message: string) => void;
  onAddLog: (message: string) => void;
  onCancel: () => void;
}

const PlaceItemForm: React.FC<PlaceItemFormProps> = ({
  itemId,
  itemName,
  onPlaceSuccess,
  onAddLog,
  onCancel
}) => {
  const [containerId, setContainerId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [astronaut, setAstronaut] = useState<string>('');
  const [containerError, setContainerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setContainerError(null);
    
    try {
      onAddLog(`INITIATING PLACEMENT OF ITEM ${itemId} INTO CONTAINER ${containerId}...`);
      onAddLog(`AUTO-CALCULATING OPTIMAL POSITION COORDINATES...`);
      
      const response = await placeItemAfterUse({
        item_id: itemId,
        container_id: containerId,
        // Let backend auto-calculate coordinates
        position_x: -1,
        position_y: -1,
        position_z: -1,
        astronaut: astronaut || 'system'
      });
      
      if (response.success) {
        onAddLog(`SUCCESS: ITEM ${itemId} PLACED IN CONTAINER ${containerId}`);
        if (response.item && response.item.position) {
          const { x, y, z } = response.item.position;
          onAddLog(`CALCULATED POSITION: X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}`);
        }
        onAddLog(`NEW LOCATION REGISTERED IN SYSTEM DATABASE`);
        onPlaceSuccess(`Item ${itemName} has been successfully placed in container ${containerId}.`);
      } else {
        // Check if container is full
        if (response.message && response.message.includes("at capacity")) {
          setContainerError(`Container ${containerId} is full. Please select another container.`);
          onAddLog(`ERROR: CONTAINER ${containerId} IS AT CAPACITY - PLACEMENT FAILED`);
        } else if (response.message && response.message.includes("not found")) {
          setContainerError(`Container ${containerId} not found. Please check the ID and try again.`);
          onAddLog(`ERROR: CONTAINER ${containerId} NOT FOUND`);
        } else {
          setContainerError(response.message || "Unknown error occurred");
          onAddLog(`ERROR: FAILED TO PLACE ITEM - ${response.message}`);
        }
      }
    } catch (error: any) {
      console.error('Error placing item:', error);
      setContainerError(error.message || "Unknown error occurred");
      onAddLog(`ERROR: PLACEMENT FAILED - ${error.message || 'UNKNOWN ERROR'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-950 p-5 rounded-md border border-green-800/30 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-green-400">PLACE RETRIEVED ITEM</h2>
        <div className="px-2 py-1 bg-blue-900/20 text-blue-400 text-xs rounded border border-blue-500/20">
          RETRIEVAL COMPLETE
        </div>
      </div>
      
      <p className="text-sm text-green-300 mb-4">
        Enter container ID to place item <span className="text-yellow-400">{itemName}</span> (ID: {itemId})
      </p>
      
      {containerError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md">
          <div className="flex items-center text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            {containerError}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-green-400 mb-2">
            {'>'} ENTER DESTINATION CONTAINER ID:
          </label>
          <input
            type="text"
            value={containerId}
            onChange={(e) => {
              setContainerId(e.target.value);
              setContainerError(null); // Clear error when user types
            }}
            className="w-full px-3 py-2 bg-black/50 border border-green-800/50 rounded-md focus:ring-green-500 focus:border-green-500 text-green-300"
            placeholder="Enter container ID"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Coordinates will be automatically calculated for optimal placement
          </p>
        </div>
        
        <div>
          <label className="block text-sm text-green-400 mb-2">
            {'>'} ASTRONAUT ID (OPTIONAL):
          </label>
          <input
            type="text"
            value={astronaut}
            onChange={(e) => setAstronaut(e.target.value)}
            className="w-full px-3 py-2 bg-black/50 border border-green-800/50 rounded-md focus:ring-green-500 focus:border-green-500 text-green-300"
            placeholder="Enter astronaut ID"
            disabled={loading}
          />
        </div>
        
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={loading || !containerId}
            className="flex-1 px-4 py-2 bg-green-900/70 text-green-400 rounded-md hover:bg-green-800/70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                PROCESSING...
              </>
            ) : (
              <>
                <ArrowRight className="h-5 w-5 mr-2" />
                PLACE ITEM
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-md hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlaceItemForm; 