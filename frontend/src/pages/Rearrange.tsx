import React, { useState, useEffect, useMemo } from 'react';
import { getRearrangementSuggestions, executeRearrangementPlan } from '../frontend-api';
import { Loader, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight } from 'lucide-react';

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
  inefficiency_score?: number;
  volume_utilization?: number;
  item_count?: number;
  high_priority_items?: number;
  low_priority_items?: number;
  recommended_actions?: string;
  efficiency?: number;
  accessibility_issues?: number;
  items_count?: number;
  zone?: string;
}

interface RearrangementSuggestion {
  suggested_moves?: SuggestedMove[];
  disorganized_containers?: DisorganizedContainer[];
  reason?: string;
  success?: boolean;
  message?: string;
  total_steps?: number;
  total_estimated_time?: number;
  space_optimization?: number;
  movements?: any[];
  rearrangement_plan?: RearrangementItem[];
}

interface RearrangementResult {
  success: boolean;
  message: string;
  results?: Array<RearrangementItem & { success: boolean; message: string }>;
}

const RearrangePage = () => {
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RearrangementSuggestion | null>(null);
  const [executionResult, setExecutionResult] = useState<RearrangementResult | null>(null);
  const [rearrangementPlan, setRearrangementPlan] = useState<RearrangementItem[]>([]);

  // Pagination state for disorganized containers
  const [disorganizedPage, setDisorganizedPage] = useState(1);
  const DISORGANIZED_ITEMS_PER_PAGE = 5;

  // Pagination state for suggested moves
  const [movesPage, setMovesPage] = useState(1);
  const MOVES_PER_PAGE = 5;

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    setExecutionResult(null);
    setDisorganizedPage(1); // Reset page on fetch
    setMovesPage(1); // Reset page on fetch
    
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
      } else if (data.movements && Array.isArray(data.movements)) {
        // Format may be from the newer API
        const plan = data.movements.map(move => ({
          item_id: move.item_id,
          item_name: move.item_name || move.item_id,
          from_container: move.from_container_id || move.from_container,
          to_container: move.to_container_id || move.to_container,
          reason: move.description || move.reason || 'Optimization'
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
      setSuggestions(null);
      setRearrangementPlan([]);
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
      // Use the original API call format - send the entire plan array
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

  // Memoized paginated data for disorganized containers
  const paginatedDisorganized = useMemo(() => {
    if (!suggestions?.disorganized_containers) return [];
    const startIndex = (disorganizedPage - 1) * DISORGANIZED_ITEMS_PER_PAGE;
    return suggestions.disorganized_containers.slice(startIndex, startIndex + DISORGANIZED_ITEMS_PER_PAGE);
  }, [suggestions, disorganizedPage]);

  const totalDisorganizedPages = useMemo(() => {
    if (!suggestions?.disorganized_containers) return 1;
    return Math.ceil(suggestions.disorganized_containers.length / DISORGANIZED_ITEMS_PER_PAGE);
  }, [suggestions]);

  // Memoized paginated data for suggested moves
  const paginatedMoves = useMemo(() => {
    if (!rearrangementPlan) return [];
    const startIndex = (movesPage - 1) * MOVES_PER_PAGE;
    return rearrangementPlan.slice(startIndex, startIndex + MOVES_PER_PAGE);
  }, [rearrangementPlan, movesPage]);

  const totalMovesPages = useMemo(() => {
    if (!rearrangementPlan) return 1;
    return Math.ceil(rearrangementPlan.length / MOVES_PER_PAGE);
  }, [rearrangementPlan]);

  const hasRearrangementSuggestions = () => {
    if (!suggestions) return false;
    
    // Check for plan
    return rearrangementPlan.length > 0;
  };

  const hasDisorganizedContainers = () => {
    if (!suggestions) return false;
    
    // Check for disorganized containers
    if (suggestions.disorganized_containers) {
      return suggestions.disorganized_containers.length > 0;
    }
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
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
        <div className="border border-green-500/30 bg-green-900/10 rounded-md p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
          <p className="text-green-400 mb-2">SYSTEM OPTIMIZED</p>
          <p className="text-xs text-gray-400">No rearrangement needed at this time.</p>
        </div>
      ) : (
        <div>
          {/* --- Disorganized Containers Section --- */}
          {hasDisorganizedContainers() && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-green-400 mb-3 border-b border-green-700/30 pb-1">DISORGANIZED CONTAINERS</h3>
              <div className="bg-gray-950 border border-green-800/30 rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-green-900/20 text-xs text-green-500 uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-4 py-2">Container ID</th>
                      <th scope="col" className="px-4 py-2">Efficiency (%)</th> 
                      <th scope="col" className="px-4 py-2">Accessibility</th>
                      <th scope="col" className="px-4 py-2">Items</th>
                      <th scope="col" className="px-4 py-2">Zone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-900/30">
                    {paginatedDisorganized.map((container) => (
                      <tr key={container.container_id} className="hover:bg-green-900/5">
                        <td className="px-4 py-2 font-medium text-green-300 whitespace-nowrap">{container.container_id}</td>
                        <td className="px-4 py-2 text-gray-300">
                          {/* Fallback to different property names based on API structure */}
                          {container.inefficiency_score !== undefined 
                            ? `${(100 - container.inefficiency_score * 100).toFixed(1)}` 
                            : container.efficiency !== undefined 
                              ? `${(container.efficiency * 100).toFixed(1)}` 
                              : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {container.accessibility_issues !== undefined 
                            ? container.accessibility_issues 
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {/* Fallback to different property names */}
                          {container.item_count !== undefined 
                            ? container.item_count 
                            : container.items_count !== undefined 
                              ? container.items_count 
                              : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{container.zone || 'N/A'}</td>
                      </tr>
                    ))}
                    {paginatedDisorganized.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-gray-500">No disorganized containers found in this view.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls for Disorganized Containers */}
              {totalDisorganizedPages > 1 && (
                <div className="flex justify-between items-center mt-3 text-sm text-gray-400">
                  <button
                    onClick={() => setDisorganizedPage(p => Math.max(1, p - 1))}
                    disabled={disorganizedPage === 1}
                    className="px-3 py-1 rounded bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </button>
                  <span>Page {disorganizedPage} of {totalDisorganizedPages}</span>
                  <button
                    onClick={() => setDisorganizedPage(p => Math.min(totalDisorganizedPages, p + 1))}
                    disabled={disorganizedPage === totalDisorganizedPages}
                    className="px-3 py-1 rounded bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* --- Suggested Moves Section --- */}
          {hasRearrangementSuggestions() && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-green-400 mb-3 border-b border-green-700/30 pb-1">SUGGESTED MOVES ({rearrangementPlan.length} total)</h3>
              <div className="bg-gray-950 border border-green-800/30 rounded-md overflow-hidden">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-green-900/20 text-xs text-green-500 uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="px-4 py-2">Item ID</th>
                          <th scope="col" className="px-4 py-2">Name</th>
                          <th scope="col" className="px-4 py-2">From Container</th>
                          <th scope="col" className="px-4 py-2">To Container</th>
                          <th scope="col" className="px-4 py-2">Reason</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-green-900/30">
                        {paginatedMoves.map((item, index) => (
                        <tr key={`${item.item_id}-${index}`} className="hover:bg-green-900/5">
                            <td className="px-4 py-2 font-medium text-green-300 whitespace-nowrap">{item.item_id}</td>
                            <td className="px-4 py-2 text-gray-300 truncate max-w-xs">{item.item_name}</td>
                            <td className="px-4 py-2 text-gray-300">{item.from_container}</td>
                            <td className="px-4 py-2 text-green-400 font-semibold">{item.to_container}</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">{item.reason || '-'}</td>
                        </tr>
                        ))}
                         {paginatedMoves.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-gray-500">No suggested moves found in this view.</td>
                          </tr>
                        )}
                    </tbody>
                 </table>
              </div>
               {/* Pagination Controls for Suggested Moves */}
              {totalMovesPages > 1 && (
                <div className="flex justify-between items-center mt-3 text-sm text-gray-400">
                  <button
                    onClick={() => setMovesPage(p => Math.max(1, p - 1))}
                    disabled={movesPage === 1}
                    className="px-3 py-1 rounded bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </button>
                  <span>Page {movesPage} of {totalMovesPages}</span>
                  <button
                    onClick={() => setMovesPage(p => Math.min(totalMovesPages, p + 1))}
                    disabled={movesPage === totalMovesPages}
                    className="px-3 py-1 rounded bg-green-900/30 hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              )}

              {/* Execute Plan Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleExecutePlan}
                  disabled={loading || executing || rearrangementPlan.length === 0}
                  className={`inline-flex items-center px-6 py-2 rounded-md font-semibold ${
                    executing 
                      ? 'bg-gray-800 text-gray-500 cursor-wait' 
                      : 'bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-500/30'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {executing ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin mr-2" />
                      EXECUTING...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-5 w-5 mr-2" />
                      EXECUTE REARRANGEMENT PLAN ({rearrangementPlan.length} moves)
                    </>
                  )}
                </button>
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