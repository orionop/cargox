import React, { useState } from 'react';
import { Search, Loader, Terminal, ArrowRight, CheckCircle, AlertTriangle, CircleOff } from 'lucide-react';
import { retrieveItem, trackItemUsage } from '../frontend-api';

interface ItemPosition {
  x: number;
  y: number;
  z: number;
}

interface ItemData {
  id: string;
  name: string;
  is_placed: boolean;
  container_id?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  usage_count: number;
  usage_limit?: number;
  is_waste: boolean;
  last_retrieved?: string;
  last_retrieved_by?: string;
}

interface RetrievalResult {
  found: boolean;
  item_id: string;
  path: string[];
  disturbed_items: string[];
  location?: {
    container: string;
    position: ItemPosition;
  };
  retrieval_time: string;
  retrieved_by: string;
  item?: ItemData;
  error?: string;
}

interface RetrieveApiResponse {
  success: boolean;
  message: string;
  item?: ItemData;
}

const RetrievePage = () => {
  const [itemId, setItemId] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [locatedItem, setLocatedItem] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retrievalLogs, setRetrievalLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setRetrievalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleLocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLocatedItem(null);
    addLog(`INITIATING CARGO LOCATE SEQUENCE FOR CARGO_ID: ${itemId}`);

    try {
      // Get item information
      const itemData = await retrieveItem(itemId) as RetrievalResult;
      console.log('Item lookup data:', itemData);
      
      addLog(`CARGO LOOKUP COMPLETE`);
      
      if (itemData.error) {
        setError(itemData.error);
        addLog(`ERROR: ${itemData.error}`);
        setLocatedItem(itemData);
      } else if (itemData.found) {
        if (itemData.location) {
          addLog(`SUCCESS: CARGO LOCATED IN CONTAINER ${itemData.location.container}`);
          setSuccess(`Item ${itemId} has been located in container ${itemData.location.container}.`);
        } else {
          addLog(`SUCCESS: CARGO FOUND BUT NOT CURRENTLY PLACED IN STORAGE`);
          setSuccess(`Item ${itemId} is already available and not currently in storage.`);
        }
        setLocatedItem(itemData);
      } else {
        addLog(`WARNING: CARGO ID ${itemId} NOT FOUND IN SYSTEM`);
        setLocatedItem(itemData);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to locate item information');
      addLog(`ERROR: LOCATE SEQUENCE FAILED - ${err.message || 'CHECK SYSTEM LOG'}`);
      setLoading(false);
    }
  };

  const handleRetrieve = async () => {
    if (!locatedItem || !locatedItem.found) return;
    
    setRetrieving(true);
    setError(null);
    setSuccess(null);
    addLog(`INITIATING RETRIEVAL SEQUENCE FOR CARGO_ID: ${itemId}`);

    try {
      // Call the actual retrieve endpoint to mark item as retrieved
      const retrieveResponse = await trackItemUsage(itemId, 'system') as RetrieveApiResponse;
      
      console.log('Retrieval data:', retrieveResponse);
      addLog(`RETRIEVAL DATA RECEIVED FROM SERVER`);
      
      if (retrieveResponse.success) {
        // Update the located item to show it's no longer placed
        if (locatedItem && locatedItem.location) {
          setLocatedItem({
            ...locatedItem,
            location: undefined,
            item: {
              ...locatedItem.item!,
              is_placed: false,
              container_id: undefined,
              position: undefined
            }
          });
          
          setSuccess(`Item ${itemId} has been successfully retrieved and is ready for use.`);
          addLog(`CARGO SUCCESSFULLY RETRIEVED FROM STORAGE`);
          addLog(`CARGO NOW AVAILABLE FOR USE`);
        }
      } else {
        setError(retrieveResponse.message || 'Failed to retrieve item');
        addLog(`ERROR: RETRIEVAL FAILED - ${retrieveResponse.message}`);
      }
      
      setRetrieving(false);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to retrieve item: ${err.message}`);
      addLog(`ERROR: RETRIEVAL SEQUENCE FAILED - CHECK SYSTEM LOG`);
      setRetrieving(false);
    }
  };

  const resetAll = () => {
    setItemId('');
    setLocatedItem(null);
    setError(null);
    setSuccess(null);
    setRetrievalLogs([]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-green-500 text-xl mb-4 font-bold flex justify-between items-center">
        <div># CARGO RETRIEVAL SYSTEM</div>
        {(locatedItem || retrievalLogs.length > 0) && (
          <button 
            onClick={resetAll}
            className="text-xs text-gray-500 hover:text-green-400 px-3 py-1 border border-green-900/30 rounded-sm bg-black/20"
          >
            NEW SEARCH
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="bg-gray-950 p-5 rounded-md border border-green-800/30 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-green-400">CARGO.LOCATE</h2>
              <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
                ACTIVE
              </div>
            </div>

            <form onSubmit={handleLocate} className="space-y-4">
              <div>
                <label htmlFor="itemId" className="block text-sm text-green-400 mb-2">
                  {'>'} ENTER CARGO ID:
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="itemId"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black/50 border border-green-800/50 rounded-l-md focus:ring-green-500 focus:border-green-500 text-green-300"
                    placeholder="CARGO_ID"
                    required
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !itemId}
                    className="px-4 py-2 bg-green-900/70 text-green-400 rounded-r-md hover:bg-green-800/70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:bg-green-900/30 flex items-center"
                  >
                    {loading ? (
                      <Loader className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </form>

            {loading && (
              <div className="mt-4 text-sm text-green-500 animate-pulse flex items-center">
                <Terminal className="h-4 w-4 mr-2" />
                PROCESSING LOCATE REQUEST...
              </div>
            )}
          </div>

          {retrievalLogs.length > 0 && (
            <div className="bg-gray-950 p-4 rounded-md border border-green-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="text-green-400 text-sm font-bold">SYSTEM.LOG</div>
                <button 
                  className="text-xs text-gray-500 hover:text-green-400"
                  onClick={() => setRetrievalLogs([])}
                >
                  CLEAR LOGS
                </button>
              </div>
              <div className="bg-black/50 p-3 rounded font-mono text-xs h-60 overflow-y-auto">
                {retrievalLogs.map((log, index) => (
                  <div key={index} className="text-green-300 mb-1">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 mb-1 font-bold">ERROR</p>
                  <p className="text-red-300 text-sm">{error}</p>
                  <p className="text-xs text-gray-500 mt-2">ERROR CODE: CARGO-SYSTEM-001</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-md p-4 mb-6">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 mb-1 font-bold">SUCCESS</p>
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              </div>
            </div>
          )}

          {locatedItem && (
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-green-400 text-sm font-bold">LOCATE RESULTS</div>
                <div className={`px-2 py-1 ${locatedItem.found ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-400'} text-xs rounded border ${locatedItem.found ? 'border-green-500/20' : 'border-red-500/20'}`}>
                  {locatedItem.found ? 'CARGO LOCATED' : 'NOT FOUND'}
                </div>
              </div>

              <div className="space-y-4">
                {locatedItem.found ? (
                  <>
                    <div className="bg-black/30 p-3 rounded-md">
                      <div className="text-xs text-gray-500 mb-2">CARGO DETAILS</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">ID</div>
                          <div className="text-green-400 font-bold">
                            {locatedItem.item_id}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">NAME</div>
                          <div className="text-green-400 font-bold">
                            {locatedItem.item?.name || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {locatedItem.location ? (
                      <>
                        <div className="bg-black/30 p-3 rounded-md">
                          <div className="text-xs text-gray-500 mb-2">LOCATION DATA</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-500">CONTAINER</div>
                              <div className="text-green-400 font-bold">
                                {locatedItem.location.container}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">POSITION (X,Y,Z)</div>
                              <div className="text-green-400 font-mono">
                                {`${locatedItem.location.position.x.toFixed(2)}, ${locatedItem.location.position.y.toFixed(2)}, ${locatedItem.location.position.z.toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={handleRetrieve}
                          disabled={retrieving}
                          className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-md flex items-center justify-center disabled:opacity-50"
                        >
                          {retrieving ? (
                            <>
                              <Loader className="h-5 w-5 animate-spin mr-2" />
                              RETRIEVING...
                            </>
                          ) : (
                            'RETRIEVE CARGO'
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="bg-yellow-900/20 border border-yellow-700/30 p-3 rounded-md">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                          <div className="text-yellow-400">
                            CARGO IS NOT CURRENTLY PLACED IN A CONTAINER
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-start">
                    <CircleOff className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-sm mb-2">
                        <span className="text-gray-500">STATUS:</span>{' '}
                        <span className="text-red-400">CARGO NOT FOUND</span>
                      </div>
                      <div className="text-xs text-gray-500 bg-black/30 p-2 rounded">
                        RECOMMENDED ACTION: VERIFY CARGO ID AND CHECK MANIFEST
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-xs text-gray-500 border-t border-green-600/30 pt-4">
        <div className="flex justify-between">
          <div>CARGO RETRIEVAL MODULE v1.4.0</div>
          <div>ACCESS LEVEL: AUTHORIZED</div>
        </div>
      </div>
    </div>
  );
};

export default RetrievePage;