import React, { useState, useEffect } from 'react';
import { getRearrangementSuggestions, executeRearrangementPlan } from '../frontend-api';
import { Loader, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface RearrangementItem {
  item_id: string;
  item_name: string;
  from_container: string;
  to_container: string;
  reason?: string;
}

interface SuggestedMove {
  item_id: string;
  from_container: string;
  suggested_containers: string[];
  reason: string;
}

interface DisorganizedContainer {
  container_id: string;
  efficiency: number;
  accessibility_issues: number;
  items_count: number;
}

interface RearrangementSuggestion {
  suggested_moves: SuggestedMove[];
  disorganized_containers: DisorganizedContainer[];
  reason: string;
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
  const [rearrangementPlan, setRearrangementPlan] = useState<RearrangementItem[]>([]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setExecutionResult(null);
    
    try {
      const data = await getRearrangementSuggestions();
      console.log("Rearrangement suggestions:", data);
      setSuggestions(data);
      
      // Convert suggested_moves to rearrangement_plan format
      if (data.suggested_moves && Array.isArray(data.suggested_moves)) {
        const plan = data.suggested_moves.map(move => ({
          item_id: move.item_id,
          item_name: move.item_id, // Use the ID as the name if no name is provided
          from_container: move.from_container,
          to_container: move.suggested_containers[0], // Use the first suggested container
          reason: move.reason
        }));
        
        setRearrangementPlan(plan);
      } else if (data.rearrangement_plan && Array.isArray(data.rearrangement_plan)) {
        // Fallback to old format if present
        setRearrangementPlan(data.rearrangement_plan);
      } else {
        setRearrangementPlan([]);
      }
    } catch (err) {
      console.error('Error fetching rearrangement suggestions:', err);
      setError('Failed to load rearrangement suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!rearrangementPlan || !rearrangementPlan.length) {
      return;
    }
    
    setExecuting(true);
    setError(null);
    
    try {
      const result = await executeRearrangementPlan(rearrangementPlan);
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

  // Helper function to determine if there are any rearrangement suggestions
  const hasRearrangementSuggestions = () => {
    if (!suggestions) return false;
    
    // Check for new format
    if (suggestions.suggested_moves) {
      return suggestions.suggested_moves.length > 0;
    }
    // Fallback to old format
    return false;
  };

  // Helper function to determine if there are any disorganized containers
  const hasDisorganizedContainers = () => {
    if (!suggestions) return false;
    
    // Check for new format
    if (suggestions.disorganized_containers) {
      return suggestions.disorganized_containers.length > 0;
    }
    // Fallback to old format
    return false;
  };

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
      ) : !suggestions || (!hasRearrangementSuggestions() && !hasDisorganizedContainers()) ? (
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
                  <div className="text-xs text-gray-500 mb-1">DISORGANIZED CONTAINERS</div>
                  {hasDisorganizedContainers() ? (
                    <div className="bg-orange-900/20 border border-orange-900/30 rounded p-2">
                      {suggestions.disorganized_containers.map((container) => (
                        <span key={container.container_id} className="inline-block bg-black/40 text-orange-400 text-xs px-2 py-1 rounded mr-2 mb-2">
                          {container.container_id} (Efficiency: {Math.round(container.efficiency * 100)}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-green-900/20 border border-green-900/30 rounded p-2 text-green-400 text-xs">
                      No disorganized containers detected
                    </div>
                  )}
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-1">MOVEABLE ITEMS</div>
                  <div className="text-green-400">
                    {rearrangementPlan.length} items can be optimally relocated
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-1">OVERALL REASON</div>
                  <div className="text-green-400">
                    {suggestions.reason || "Container optimization"}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="text-green-400 text-sm font-bold mb-3">{'// OPTIMIZATION METRICS'}</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">SUGGESTED MOVES:</div>
                  <div className="text-green-400">{rearrangementPlan.length}</div>
                </div>
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">OPTIMIZATION STATUS:</div>
                  <div className={rearrangementPlan.length > 0 ? "text-yellow-400" : "text-green-400"}>
                    {rearrangementPlan.length > 0 ? "OPTIMIZATION AVAILABLE" : "FULLY OPTIMIZED"}
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="text-xs text-gray-500">PRIMARY ISSUE:</div>
                  <div className="text-orange-400">
                    {hasDisorganizedContainers()
                      ? "ACCESS OPTIMIZATION NEEDED" 
                      : hasRearrangementSuggestions()
                        ? "POSITION OPTIMIZATION NEEDED" 
                        : "NO CRITICAL ISSUES"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {rearrangementPlan.length > 0 && (
            <div className="bg-gray-950 border border-green-800/30 rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-green-400 text-sm font-bold">{'// REARRANGEMENT PLAN'}</div>
                <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
                  {rearrangementPlan.length} MOVES
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b border-gray-800">
                    <tr>
                      <th className="text-left py-2">ITEM ID</th>
                      <th className="text-left py-2">CURRENT LOCATION</th>
                      <th className="text-left py-2">TARGET LOCATION</th>
                      <th className="text-left py-2">REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rearrangementPlan.map((move, index) => (
                      <tr key={index} className="border-b border-gray-900">
                        <td className="py-2 text-green-400">{move.item_id}</td>
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
                        <td className="py-2 text-xs text-orange-300">
                          {move.reason || "Container balancing"}
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