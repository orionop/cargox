import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader, Terminal, ArrowRight, CheckCircle, AlertTriangle, CircleOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { retrieveItem, trackItemUsage } from '../frontend-api';
import RetrievalAnimation from '../components/RetrievalAnimation';

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
  const [itemId, setItemId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [retrieving, setRetrieving] = useState<boolean>(false);
  const [locatedItem, setLocatedItem] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retrievalLogs, setRetrievalLogs] = useState<string[]>([]);
  const [startRetrieveAnimation, setStartRetrieveAnimation] = useState<boolean>(false);
  const [showAnimationComplete, setShowAnimationComplete] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [logsPerPage] = useState<number>(10);

  const addLog = (message: string) => {
    setRetrievalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleLocate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLocatedItem(null);
    setStartRetrieveAnimation(false);
    setShowAnimationComplete(false);
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
    if (!locatedItem || !locatedItem.found || !locatedItem.location) return;

    setRetrieving(true);
    setError(null);
    setSuccess(null);
    setShowAnimationComplete(false);
    addLog(`INITIATING RETRIEVAL SEQUENCE FOR CARGO_ID: ${itemId}`);
    addLog(`ACTIVATING DOCKING MECHANISM...`);
    setStartRetrieveAnimation(true);

    try {
      // Call the actual retrieve endpoint to mark item as retrieved
      const retrieveResponse = await trackItemUsage(itemId, 'system') as RetrieveApiResponse;
      
      console.log('Retrieval data:', retrieveResponse);
      addLog(`RETRIEVAL DATA RECEIVED FROM SERVER`);
      
      if (retrieveResponse.success) {
        // Keep the animation running until it completes
      } else {
        setError(retrieveResponse.message || 'Failed to retrieve item');
        addLog(`ERROR: RETRIEVAL FAILED - ${retrieveResponse.message}`);
        setStartRetrieveAnimation(false);
        setRetrieving(false);
      }
      
    } catch (err: any) {
      console.error(err);
      setError(`Failed to retrieve item: ${err.message}`);
      addLog(`ERROR: RETRIEVAL SEQUENCE FAILED - CHECK SYSTEM LOG`);
      setStartRetrieveAnimation(false);
      setRetrieving(false);
    }
  };

  const handleAnimationComplete = () => {
    addLog(`DOCKING MECHANISM CYCLE COMPLETE.`);
    addLog(`CARGO SUCCESSFULLY RETRIEVED FROM STORAGE.`);
    addLog(`CARGO NOW AVAILABLE FOR USE.`);

    setRetrieving(false);
    setSuccess(`Item ${itemId} has been successfully retrieved and is ready for use.`);
    setShowAnimationComplete(true);

    if (locatedItem && locatedItem.location) {
      setLocatedItem(prev => prev ? ({
        ...prev,
        location: undefined,
        item: {
          ...prev.item!,
          is_placed: false,
          container_id: undefined,
          position: undefined
        }
      }) : null);
    }

    setTimeout(() => {
      setStartRetrieveAnimation(false);
    }, 100); 
  };

  const resetAll = () => {
    setItemId('');
    setLocatedItem(null);
    setError(null);
    setSuccess(null);
    setRetrievalLogs([]);
    setStartRetrieveAnimation(false);
    setShowAnimationComplete(false);
  };

  // Calculate the logs for the current page
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = retrievalLogs.slice(indexOfFirstLog, indexOfLastLog);
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => {
    if (currentPage < Math.ceil(retrievalLogs.length / logsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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
            <div className="mt-6 bg-gray-900/40 border border-green-500/30 p-4 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-green-500 font-mono">SYSTEM_LOGS</div>
                <button
                  className="text-xs text-gray-500 hover:text-green-400"
                  onClick={() => setRetrievalLogs([])}
                >
                  CLEAR LOGS
                </button>
              </div>
              <div className="bg-black/50 p-3 rounded font-mono text-xs h-60 overflow-y-auto">
                {currentLogs.map((log, index) => (
                  <div key={indexOfFirstLog + index} className="text-green-300 mb-1">{log}</div>
                ))}
              </div>
              {retrievalLogs.length > logsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded text-xs bg-gray-800/50 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800/70"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-gray-400">
                    Page {currentPage} of {Math.ceil(retrievalLogs.length / logsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(retrievalLogs.length / logsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(retrievalLogs.length / logsPerPage)}
                    className="px-3 py-1 rounded text-xs bg-gray-800/50 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800/70"
                  >
                    Next
                  </button>
                </div>
              )}
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
          
          {success && !retrieving && (
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

          {locatedItem && !error && (
            <div className="bg-gray-950 p-5 rounded-md border border-green-800/30 mt-6 md:mt-0">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-green-400">CARGO.STATUS</h2>
                {locatedItem.location ? (
                  <div className="px-2 py-1 bg-blue-900/20 text-blue-400 text-xs rounded border border-blue-500/20">
                    LOCATED
                  </div>
                ) : locatedItem.found ? (
                   <div className="px-2 py-1 bg-yellow-900/20 text-yellow-400 text-xs rounded border border-yellow-500/20">
                     AVAILABLE (NOT IN STORAGE)
                   </div>
                ) : (
                  <div className="px-2 py-1 bg-red-900/20 text-red-400 text-xs rounded border border-red-500/20">
                    NOT FOUND
                  </div>
                )}
              </div>

              {(startRetrieveAnimation || showAnimationComplete) && locatedItem.location && (
                <div className="mb-4 p-4 bg-black/30 rounded border border-green-900/50 relative">
                   <div className="absolute top-2 left-2 text-xs text-green-600 font-mono">[ DOCKING MECHANISM ACTIVE ]</div>
                   <RetrievalAnimation
                    startAnimation={startRetrieveAnimation}
                    onAnimationComplete={handleAnimationComplete}
                  />
                  {showAnimationComplete && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                       <CheckCircle className="h-16 w-16 text-green-500 opacity-80" />
                     </div>
                   )}
                </div>
              )}

              {!locatedItem.found && (
                <div className="text-yellow-400 flex items-center">
                  <CircleOff className="h-5 w-5 mr-2" />
                  Cargo ID '{locatedItem.item_id}' not found in the system registry.
                </div>
              )}

              {locatedItem.found && locatedItem.item && (
                <div className="space-y-3 text-sm">
                  <p><span className="text-gray-500">CARGO_ID:</span> {locatedItem.item.id}</p>
                  <p><span className="text-gray-500">NAME:</span> {locatedItem.item.name}</p>
                  
                  {locatedItem.location ? (
                    <>
                      <p><span className="text-gray-500">LOCATION:</span> CONTAINER <span className="text-yellow-400">{locatedItem.location.container}</span></p>
                      <p><span className="text-gray-500">COORDS:</span> X:{locatedItem.location.position.x.toFixed(1)} Y:{locatedItem.location.position.y.toFixed(1)} Z:{locatedItem.location.position.z.toFixed(1)}</p>
                      {locatedItem.disturbed_items.length > 0 && (
                        <p><span className="text-gray-500">OBSTRUCTIONS:</span> {locatedItem.disturbed_items.join(', ')}</p>
                      )}
                      <p><span className="text-gray-500">EST. RETRIEVAL:</span> {locatedItem.retrieval_time || 'N/A'}</p>
                      {!retrieving && !startRetrieveAnimation && !showAnimationComplete && (
                        <button
                          onClick={handleRetrieve}
                          disabled={retrieving || startRetrieveAnimation}
                          className="w-full mt-4 px-4 py-2 bg-green-900/70 text-green-400 rounded-md hover:bg-green-800/70 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {retrieving || startRetrieveAnimation ? (
                            <>
                              <Loader className="h-5 w-5 mr-2 animate-spin" />
                              RETRIEVING...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="h-5 w-5 mr-2" />
                              RETRIEVE CARGO
                            </>
                          )}
                        </button>
                      )}
                      {(retrieving || startRetrieveAnimation) && !showAnimationComplete && (
                         <div className="mt-4 text-center text-green-500 text-sm animate-pulse">
                           Engaging retrieval mechanism...
                         </div>
                      )}
                      {showAnimationComplete && (
                        <div className="mt-4 text-center text-green-400 text-sm font-bold flex items-center justify-center">
                           <CheckCircle className="h-5 w-5 mr-2 text-green-500"/> RETRIEVAL COMPLETE
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-yellow-400 flex items-center mt-4">
                       <CheckCircle className="h-5 w-5 mr-2" />
                       Item is already available and not in storage.
                    </div>
                  )}
                </div>
              )}

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