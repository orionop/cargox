import React, { useState } from 'react';
import { Search, Loader, Terminal, ArrowRight, CheckCircle, AlertTriangle, CircleOff } from 'lucide-react';
import { retrieveItem } from '../api';

interface RetrievalResult {
  found: boolean;
  item_id: string;
  path: string[];
  disturbed_items: string[];
  location?: {
    container: string;
    position: {
      x: number;
      y: number;
      z: number;
    };
  };
}

const RetrievePage = () => {
  const [itemId, setItemId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrievalLogs, setRetrievalLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setRetrievalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    addLog(`INITIATING RETRIEVAL SEQUENCE FOR CARGO_ID: ${itemId}`);

    try {
      const response = await retrieveItem(itemId);
      const data = response.data;
      console.log('Retrieval data:', data);
      
      addLog(`RETRIEVAL DATA RECEIVED FROM SERVER`);
      setTimeout(() => {
        setResult(data);
        if (data.found) {
          addLog(`SUCCESS: CARGO LOCATED IN CONTAINER ${data.location?.container}`);
          addLog(`EXTRACTION PATH CALCULATED WITH ${data.disturbed_items?.length || 0} ITEMS REQUIRING REPOSITIONING`);
        } else {
          addLog(`WARNING: CARGO ID ${itemId} NOT FOUND IN SYSTEM`);
        }
        setLoading(false);
      }, 1000); // Simulate processing time for effect
    } catch (err) {
      setError('Failed to retrieve item information');
      addLog(`ERROR: RETRIEVAL SEQUENCE FAILED - CHECK SYSTEM LOG`);
      console.error(err);
      setLoading(false);
    }
  };

  const resetAll = () => {
    setItemId('');
    setResult(null);
    setError(null);
    setRetrievalLogs([]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-green-500 text-xl mb-4 font-bold flex justify-between items-center">
        <div># CARGO RETRIEVAL SYSTEM</div>
        {(result || retrievalLogs.length > 0) && (
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

            <form onSubmit={handleSubmit} className="space-y-4">
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
                PROCESSING RETRIEVAL REQUEST...
              </div>
            )}
          </div>

          {retrievalLogs.length > 0 && (
            <div className="bg-gray-950 p-4 rounded-md border border-green-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="text-green-400 text-sm font-bold">RETRIEVAL.LOG</div>
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
                  <p className="text-red-400 mb-1 font-bold">RETRIEVAL ERROR</p>
                  <p className="text-red-300 text-sm">{error}</p>
                  <p className="text-xs text-gray-500 mt-2">ERROR CODE: CARGO-RETRIEVAL-001</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-green-400 text-sm font-bold">RETRIEVAL RESULTS</div>
                <div className={`px-2 py-1 ${result.found ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-400'} text-xs rounded border ${result.found ? 'border-green-500/20' : 'border-red-500/20'}`}>
                  {result.found ? 'CARGO LOCATED' : 'NOT FOUND'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  {result.found ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />
                  ) : (
                    <CircleOff className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-1" />
                  )}
                  <div>
                    <div className="text-sm mb-2">
                      <span className="text-gray-500">STATUS:</span>{' '}
                      <span className={result.found ? 'text-green-400' : 'text-red-400'}>
                        {result.found ? 'CARGO FOUND' : 'CARGO NOT FOUND'}
                      </span>
                    </div>
                    {!result.found && (
                      <div className="text-xs text-gray-500 bg-black/30 p-2 rounded">
                        RECOMMENDED ACTION: VERIFY CARGO ID AND CHECK MANIFEST
                      </div>
                    )}
                  </div>
                </div>

                {result.location && (
                  <div className="bg-black/30 p-3 rounded-md">
                    <div className="text-xs text-gray-500 mb-2">LOCATION DATA</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">CONTAINER</div>
                        <div className="text-green-400 font-bold">
                          {result.location.container}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">POSITION (X,Y,Z)</div>
                        <div className="text-green-400 font-mono">
                          {`${result.location.position.x}, ${result.location.position.y}, ${result.location.position.z}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {result.found && (
                  <div className="bg-black/30 p-3 rounded-md">
                    <div className="text-xs text-gray-500 mb-2">RETRIEVAL PATH</div>
                    <div className="space-y-2">
                      {result.path.map((step, index) => (
                        <div key={index} className="flex items-center">
                          <div className="text-green-500 w-6 text-center">{index + 1}</div>
                          <ArrowRight className="h-3 w-3 text-green-600 mx-2" />
                          <div className="text-green-300 text-sm">{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.disturbed_items && result.disturbed_items.length > 0 && (
                  <div className="bg-yellow-900/10 p-3 rounded-md border border-yellow-700/30">
                    <div className="text-xs text-yellow-500 mb-2">ITEMS TO BE TEMPORARILY DISPLACED</div>
                    <div className="grid grid-cols-3 gap-2">
                      {result.disturbed_items.map((item, index) => (
                        <div key={index} className="text-yellow-400 text-xs bg-black/30 px-2 py-1 rounded">
                          {item}
                        </div>
                      ))}
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
          <div>CARGO RETRIEVAL MODULE v1.3.4</div>
          <div>ACCESS LEVEL: AUTHORIZED</div>
        </div>
      </div>
    </div>
  );
};

export default RetrievePage;