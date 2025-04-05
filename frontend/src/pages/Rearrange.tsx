import React, { useState, useEffect } from 'react';
import { getRearrangementSuggestions, executeRearrangementPlan } from '../frontend-api';
import { Loader, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface RearrangementItem {
  item_id: string;
  item_name: string;
  from_container: string;
  to_container: string;
}

interface RearrangementSuggestion {
  full_containers: string[];
  moveable_items_count: number;
  rearrangement_plan: RearrangementItem[];
}

interface RearrangementResult {
  success: boolean;
  message: string;
  results: Array<RearrangementItem & { success: boolean; message: string }>;
}

const RearrangePage = () => {
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RearrangementSuggestion | null>(null);
  const [executionResult, setExecutionResult] = useState<RearrangementResult | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setExecutionResult(null);
    
    try {
      const data = await getRearrangementSuggestions();
      setSuggestions(data);
    } catch (err) {
      console.error('Error fetching rearrangement suggestions:', err);
      setError('Failed to load rearrangement suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!suggestions || !suggestions.rearrangement_plan.length) {
      return;
    }
    
    setExecuting(true);
    setError(null);
    
    try {
      const result = await executeRearrangementPlan(suggestions.rearrangement_plan);
      setExecutionResult(result);
      
      // Refresh suggestions after execution
      await fetchSuggestions();
    } catch (err) {
      console.error('Error executing rearrangement plan:', err);
      setError('Failed to execute rearrangement plan');
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <div className="text-green-500 text-xl font-bold">
          # CARGO REARRANGEMENT OPTIMIZER
        </div>
        
        <button 
          onClick={fetchSuggestions}
          disabled={loading || executing}
          className={`flex items-center px-3 py-1.5 rounded text-sm ${
            loading 
              ? 'bg-gray-800 text-gray-500 cursor-wait' 
              : 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-500/30'
          }`}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {loading ? 'CALCULATING...' : 'REFRESH SUGGESTIONS'}
        </button>
      </div>

      {executionResult && (
        <div className={`mb-6 p-4 rounded-md border ${
          executionResult.success 
            ? 'border-green-500/30 bg-green-900/10' 
            : 'border-red-500/30 bg-red-900/10'
        }`}>
          <div className="flex items-center">
            {executionResult.success 
              ? <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              : <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            }
            <div className={executionResult.success ? 'text-green-400' : 'text-red-400'}>
              {executionResult.message}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px] text-center">
          <div>
            <Loader className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
            <div className="text-green-400 animate-pulse">CALCULATING OPTIMAL ARRANGEMENTS</div>
            <div className="text-xs text-gray-500 mt-2">ANALYZING CONTAINER UTILIZATION</div>
          </div>
        </div>
      ) : error ? (
        <div className="border border-red-500/30 bg-red-900/10 rounded-md p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-xs text-gray-400">ERROR CODE: CARGO-REARRANGE-001</p>
        </div>
      ) : !suggestions || (suggestions.rearrangement_plan.length === 0 && suggestions.full_containers.length === 0) ? (
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-md p-6 text-center">
          <Info className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-400 mb-2">NO REARRANGEMENT NEEDED</p>
          <p className="text-xs text-gray-400">All containers are efficiently organized</p>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="text-green-400 text-sm font-bold mb-3">{'// CONTAINER STATUS'}</div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">FULL OR NEARLY FULL CONTAINERS</div>
                  {suggestions.full_containers.length > 0 ? (
                    <div className="bg-red-900/20 border border-red-900/30 rounded p-2">
                      {suggestions.full_containers.map((container, index) => (
                        <span key={container} className="inline-block bg-black/40 text-red-400 text-xs px-2 py-1 rounded mr-2 mb-2">
                          {container}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-green-900/20 border border-green-900/30 rounded p-2 text-green-400 text-xs">
                      No containers at capacity
                    </div>
                  )}
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-1">MOVEABLE ITEMS</div>
                  <div className="text-green-400">
                    {suggestions.moveable_items_count} low-priority items can be relocated
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="text-green-400 text-sm font-bold mb-3">{'// OPTIMIZATION METRICS'}</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">SUGGESTED MOVES:</div>
                  <div className="text-green-400">{suggestions.rearrangement_plan.length}</div>
                </div>
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">OPTIMIZATION STATUS:</div>
                  <div className={suggestions.rearrangement_plan.length > 0 ? "text-yellow-400" : "text-green-400"}>
                    {suggestions.rearrangement_plan.length > 0 ? "OPTIMIZATION AVAILABLE" : "FULLY OPTIMIZED"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {suggestions.rearrangement_plan.length > 0 && (
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-green-400 text-sm font-bold">{'// REARRANGEMENT PLAN'}</div>
                <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
                  {suggestions.rearrangement_plan.length} MOVES
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b border-gray-800">
                    <tr>
                      <th className="text-left py-2">ITEM ID</th>
                      <th className="text-left py-2">ITEM NAME</th>
                      <th className="text-left py-2">CURRENT LOCATION</th>
                      <th className="text-left py-2">TARGET LOCATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.rearrangement_plan.map((move, index) => (
                      <tr key={index} className="border-b border-gray-900">
                        <td className="py-2 text-green-400">{move.item_id}</td>
                        <td className="py-2 text-gray-400">{move.item_name}</td>
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 bg-red-900/20 text-red-400 rounded text-xs">
                            {move.from_container}
                          </span>
                        </td>
                        <td className="py-2 flex items-center">
                          <ArrowRight className="h-3 w-3 text-gray-600 mr-2" />
                          <span className="px-1.5 py-0.5 bg-green-900/20 text-green-400 rounded text-xs">
                            {move.to_container}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 text-center">
                <button 
                  onClick={handleExecutePlan}
                  disabled={executing}
                  className={`bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-500/30 px-4 py-2 rounded text-sm
                    ${executing ? 'opacity-50 cursor-wait' : 'hover:scale-105 transition-transform'}`}
                >
                  {executing ? 'EXECUTING PLAN...' : 'EXECUTE REARRANGEMENT PLAN'}
                </button>
                <div className="text-xs text-gray-500 mt-2">
                  This will automatically move items according to the suggested plan
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-8 text-xs text-gray-500 border-t border-green-600/30 pt-4">
        <div className="flex justify-between">
          <div>LAST OPTIMIZATION: {new Date().toLocaleTimeString()}</div>
          <div>SYSTEM: CARGO-REARRANGEMENT-OPTIMIZER-v1.0</div>
        </div>
      </div>
    </div>
  );
};

export default RearrangePage; 