import React, { useEffect, useState } from 'react';
import { getContainers } from '../api';
import { Loader, Box, Layers, AlertTriangle, Info } from 'lucide-react';

interface Container {
  id: string;
  width: number;
  height: number;
  depth: number;
  capacity: number;
  items: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    depth: number;
    weight: number;
    is_placed: boolean;
    container_id: string;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  }>;
}

const ContainersPage = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        console.log('Fetching containers...');
        // Try to access API directly first for debugging
        const checkResponse = await fetch('http://localhost:8001/containers');
        const checkData = await checkResponse.json();
        console.log('Direct fetch response:', checkData);
        
        // Now try with the API function
        const response = await getContainers();
        console.log('Container data via API:', response.data);
        setContainers(response.data);
        if (response.data.length > 0) {
          setSelectedContainer(response.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching containers:', err);
        setError('Failed to load containers');
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
  }, []);

  const getSelectedContainer = () => {
    return containers.find(c => c.id === selectedContainer);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center">
        <div>
          <Loader className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <div className="text-green-400 animate-pulse">LOADING CONTAINER DATA...</div>
          <div className="text-xs text-gray-500 mt-2">PLEASE WAIT</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400 mb-2">{error}</p>
        <p className="text-xs text-gray-500">ERROR CODE: CARGO-FETCH-001</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-green-500 text-xl mb-4 font-bold">
        # CARGO CONTAINER FLEET <span className="text-xs text-green-600">[CONTAINERS: {containers.length}]</span>
      </div>

      {containers.length === 0 ? (
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-md p-6 text-center">
          <Info className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-400 mb-2">NO CONTAINER DATA AVAILABLE</p>
          <p className="text-xs text-gray-400">UPLOAD CONTAINER MANIFEST TO BEGIN</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="text-green-400 text-sm font-bold mb-3">{'// CONTAINER REGISTRY'}</div>
              <div className="space-y-2">
                {containers.map((container) => (
                  <button
                    key={container.id}
                    onClick={() => setSelectedContainer(container.id)}
                    className={`w-full text-left px-3 py-2 rounded-sm text-sm flex items-center ${
                      selectedContainer === container.id
                        ? 'bg-green-900/30 text-green-400 border-l-2 border-green-500'
                        : 'text-gray-400 hover:text-green-400 hover:bg-green-900/10'
                    }`}
                  >
                    <Box className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">CARGO_POD_{container.id}</span>
                    <span className="ml-auto text-xs text-gray-500">{container.items.length} ITEMS</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {selectedContainer && (
              <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-green-400 text-sm font-bold">
                    {'// POD_'}{getSelectedContainer()?.id} SPECIFICATIONS
                  </div>
                  <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
                    ACTIVE
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-black/30 p-3 rounded-md">
                    <div className="text-xs text-gray-500 mb-1">DIMENSIONS</div>
                    <div className="text-green-400">
                      {getSelectedContainer()?.width}W × {getSelectedContainer()?.height}H × {getSelectedContainer()?.depth}D
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-md">
                    <div className="text-xs text-gray-500 mb-1">CAPACITY</div>
                    <div className="text-green-400">
                      {getSelectedContainer()?.capacity} UNITS
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-md">
                    <div className="text-xs text-gray-500 mb-1">UTILIZATION</div>
                    <div className="text-green-400">
                      {Math.round((getSelectedContainer()?.items.length || 0) / (getSelectedContainer()?.capacity || 1) * 100)}%
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-500">STORED CARGO ({getSelectedContainer()?.items.length})</div>
                    <div className="text-xs text-gray-500">
                      {getSelectedContainer()?.items.length}/{getSelectedContainer()?.capacity} UNITS
                    </div>
                  </div>
                  
                  {getSelectedContainer()?.items.length === 0 ? (
                    <div className="text-gray-500 text-xs p-2 text-center">NO CARGO STORED IN THIS CONTAINER</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="text-gray-500 border-b border-gray-800">
                          <tr>
                            <th className="text-left py-2">ID</th>
                            <th className="text-left py-2">ITEM</th>
                            <th className="text-left py-2">POSITION</th>
                            <th className="text-left py-2">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSelectedContainer()?.items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-900">
                              <td className="py-2 text-gray-400">{item.id}</td>
                              <td className="py-2 text-green-400">{item.name}</td>
                              <td className="py-2 text-gray-400">
                                {item.position ? `${item.position.x}, ${item.position.y}, ${item.position.z}` : "N/A"}
                              </td>
                              <td className="py-2">
                                <span className="px-1.5 py-0.5 bg-green-900/20 text-green-500 rounded text-xs">
                                  {item.is_placed ? "STORED" : "PENDING"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-8 text-xs text-gray-500 border-t border-green-600/30 pt-4">
        <div className="flex justify-between">
          <div>LAST SYNC: {new Date().toLocaleTimeString()}</div>
          <div>SYSTEM: CARGO-CONTAINER-MONITOR-v1.2</div>
        </div>
      </div>
    </div>
  );
};

export default ContainersPage;