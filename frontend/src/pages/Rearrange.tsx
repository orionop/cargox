import React, { useState, useEffect, useMemo } from 'react';
import { getRearrangementSuggestions, executeRearrangementPlan } from '../frontend-api';
import { Loader, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';

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
  efficiency_score?: number;
  accessibility_issues?: number;
  items_count?: number;
  zone?: string;
  total_items?: number;
  capacity?: number;
  available_space?: number;
  id?: string;
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
  const [rearrangementLogs, setRearrangementLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Pagination state for disorganized containers
  const [disorganizedPage, setDisorganizedPage] = useState(1);
  const DISORGANIZED_ITEMS_PER_PAGE = 5;

  // Pagination state for suggested moves
  const [movesPage, setMovesPage] = useState(1);
  const MOVES_PER_PAGE = 5;

  // Add log entries to track rearrangement actions (similar to retrieve page)
  const addLog = (message: string) => {
    setRearrangementLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      setExecutionResult(null);
      setDisorganizedPage(1);
      setMovesPage(1);
      setRearrangementLogs([]);
      addLog(`INITIATING REARRANGEMENT ANALYSIS`);
      console.log("Fetching rearrangement suggestions...");
      
      // Get suggestions from the API
      const response = await getRearrangementSuggestions(); 
      console.log("Rearrangement API response received:", response);
      addLog(`ANALYSIS COMPLETE: ${response.disorganized_containers?.length || 0} DISORGANIZED CONTAINERS IDENTIFIED`);
      
      setSuggestions(response);
      
      // Get container capacity map to validate moves
      let containerCapacityMap = {};
      if (response && response.disorganized_containers) {
        containerCapacityMap = response.disorganized_containers.reduce((map, container) => {
          if (container.container_id) {
            const capacity = container.capacity || 10;
            const totalItems = container.items_count || container.total_items || 0;
            const availableSpace = Math.max(0, capacity - totalItems);
            
            map[container.container_id] = {
              hasSpace: availableSpace > 0,
              capacity: capacity,
              available: availableSpace,
              totalItems: totalItems
            };
            console.log(`Container ${container.container_id} capacity: ${totalItems}/${capacity}, available space: ${availableSpace}`);
          }
          return map;
        }, {});
      }
      
      // First check for rearrangement_plan and then fallback to movements
      let plan = [];
      
      // Check for rearrangement_plan in the API response
      if (response?.rearrangement_plan && Array.isArray(response.rearrangement_plan) && response.rearrangement_plan.length > 0) {
        console.log("Using rearrangement_plan from API:", response.rearrangement_plan);
        plan = response.rearrangement_plan;
        addLog(`REARRANGEMENT PLAN GENERATED: ${response.rearrangement_plan.length} MOVES SUGGESTED`);
      } 
      // If no rearrangement_plan, check for movements
      else if (response?.movements && Array.isArray(response.movements) && response.movements.length > 0) {
        console.log("Converting movements from API to rearrangement plan:", response.movements);
        plan = response.movements.map(move => ({
          item_id: move.item_id,
          item_name: move.item_name || move.item_id,
          from_container: move.from_container_id,
          to_container: move.to_container_id,
          reason: move.description || "Optimize container space"
        }));
        addLog(`REARRANGEMENT PLAN GENERATED: ${response.movements.length} MOVES SUGGESTED`);
      } else {
        addLog(`NO REARRANGEMENT PLAN AVAILABLE: SYSTEM IS UNABLE TO GENERATE MOVE SUGGESTIONS`);
      }
      
      // Filter out moves to full containers
      if (plan.length > 0) {
        const originalPlanLength = plan.length;
        
        plan = plan.filter(move => {
          const toContainer = move.to_container;
          // If we have capacity info and container is full, filter it out
          if (containerCapacityMap[toContainer]) {
            const hasSpace = containerCapacityMap[toContainer].available > 0;
            if (!hasSpace) {
              console.log(`Filtering out move to full container: ${toContainer} (${containerCapacityMap[toContainer].totalItems}/${containerCapacityMap[toContainer].capacity})`);
              return false;
            }
          }
          return true;
        });
        
        const filteredCount = originalPlanLength - plan.length;
        if (filteredCount > 0) {
          addLog(`FILTERED ${filteredCount} MOVES TO FULL CONTAINERS`);
        }
        
        // If all moves were filtered out because of capacity issues but we had moves originally,
        // keep at least one move to maintain the UI section
        if (plan.length === 0 && (response.rearrangement_plan?.length > 0 || response.movements?.length > 0)) {
          console.log("All moves filtered out due to capacity - keeping first move to maintain UI");
          addLog(`ALL MOVES FILTERED OUT DUE TO CONTAINER CAPACITY ISSUES. SHOWING PLACEHOLDER MOVE.`);
          plan = [response.rearrangement_plan?.[0] || {
            item_id: response.movements[0].item_id,
            item_name: response.movements[0].item_name || response.movements[0].item_id,
            from_container: response.movements[0].from_container_id,
            to_container: response.movements[0].to_container_id,
            reason: response.movements[0].description || "Optimize container space"
          }];
        }
      }
      
      console.log("Setting rearrangement plan with:", plan);
      setRearrangementPlan(plan);
      
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setError("Failed to fetch rearrangement suggestions.");
      setSuggestions(null);
      setRearrangementPlan([]);
      addLog(`ERROR: FAILED TO FETCH REARRANGEMENT SUGGESTIONS - ${error.message || 'UNKNOWN ERROR'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!rearrangementPlan?.length) {
      return;
    }
    
    try {
      setExecuting(true);
      setError(null);
      
      // Store the current plan for reference
      const planToExecute = [...rearrangementPlan];
      
      addLog(`INITIATING REARRANGEMENT EXECUTION: ${planToExecute.length} MOVES`);
      
      // Execute the plan
      const results = await executeRearrangementPlan(planToExecute);
      console.log('Execution results:', results);
      
      // Calculate successful and alternative moves
      const successfulMoves = results.results?.filter(r => r.success) || [];
      const alternativeMoves = successfulMoves.filter(m => m.message?.includes('alternative')) || [];
      
      addLog(`REARRANGEMENT COMPLETE: ${successfulMoves.length}/${planToExecute.length} MOVES SUCCESSFUL`);
      if (alternativeMoves.length > 0) {
        addLog(`${alternativeMoves.length} ITEMS MOVED TO ALTERNATIVE CONTAINERS DUE TO SPACE CONSTRAINTS`);
      }
      
      // Report failed moves
      const failedMoves = results.results?.filter(r => !r.success) || [];
      if (failedMoves.length > 0) {
        addLog(`${failedMoves.length} MOVES FAILED`);
        failedMoves.forEach(move => {
          addLog(`FAILED: Item ${move.item_id} - ${move.message}`);
        });
      }
      
      // Show detailed notification with results
      setExecutionResult({
        success: results.success,
        message: `Plan executed: ${successfulMoves.length}/${planToExecute.length} items moved successfully. ${alternativeMoves.length > 0 ? `(${alternativeMoves.length} to alternative containers)` : ''}`
      });
      
      // Explicitly clear the rearrangement plan to avoid showing outdated moves
      setRearrangementPlan([]);
      
      // Just fetch new suggestions without reloading the page
      addLog(`REFRESHING CONTAINER DATA`);
      await fetchSuggestions();
      
    } catch (error) {
      console.error('Error executing plan:', error);
      setExecutionResult({
        success: false,
        message: 'Failed to execute plan: ' + (error.message || 'Unknown error')
      });
      addLog(`ERROR: REARRANGEMENT EXECUTION FAILED - ${error.message || 'UNKNOWN ERROR'}`);
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    // Immediately fetch suggestions when component mounts
    const loadRearrangementData = async () => {
      try {
        await fetchSuggestions();
      } catch (err) {
        console.error("Failed to load initial rearrangement data:", err);
        // Set a minimal error state but don't crash
        setError("Could not load rearrangement data. Please try refreshing.");
      }
    };
    
    loadRearrangementData();
  }, []);

  // Update the rearrangement plan whenever the suggestions change
  useEffect(() => {
    if (suggestions && suggestions.rearrangement_plan && suggestions.rearrangement_plan.length > 0) {
      console.log("Setting rearrangement plan from API response:", suggestions.rearrangement_plan);
      setRearrangementPlan(suggestions.rearrangement_plan);
    }
  }, [suggestions]);

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
    // Check if we have a rearrangement plan from the API
    const hasPlan = Boolean(rearrangementPlan && rearrangementPlan.length > 0);
    const hasApiPlan = Boolean(suggestions?.rearrangement_plan && suggestions.rearrangement_plan.length > 0);
    const hasDisorganizedData = hasDisorganizedContainers();
    
    console.log(`hasRearrangementSuggestions: 
      rearrangementPlan length = ${rearrangementPlan?.length || 0}
      API plan length = ${suggestions?.rearrangement_plan?.length || 0}
      movements length = ${suggestions?.movements?.length || 0}
      total_steps = ${suggestions?.total_steps || 0}
      has disorganized containers = ${hasDisorganizedData}`);
    
    // Return true if we have either a local plan or an API plan, or at minimum disorganized containers
    return hasPlan || hasApiPlan || hasDisorganizedData;
  };

  const hasDisorganizedContainers = () => {
    if (!suggestions) return false;
    
    // Check for disorganized containers
    if (suggestions.disorganized_containers && suggestions.disorganized_containers.length > 0) {
      // Verify containers have actual data, not just empty objects
      return suggestions.disorganized_containers.some(container => 
        (container.container_id || container.id) && 
        // Make sure the container has at least some data (efficiency or item count)
        (container.efficiency !== undefined || 
         container.efficiency_score !== undefined ||
         container.inefficiency_score !== undefined ||
         container.items_count !== undefined ||
         container.total_items !== undefined)
      );
    }
    return false;
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <div className="text-green-500 text-xl font-bold">
          # CARGO REARRANGEMENT OPTIMIZER
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className={`flex items-center px-3 py-1.5 rounded text-sm ${
              showLogs 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/80'
            }`}
          >
            <Terminal className="h-4 w-4 mr-2" />
            {showLogs ? 'HIDE LOGS' : 'SHOW LOGS'}
          </button>
          
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
      </div>

      {/* Show logs section if enabled */}
      {showLogs && rearrangementLogs.length > 0 && (
        <div className="mb-6 bg-black/40 border border-green-800/30 rounded-md p-4 h-64 overflow-y-auto font-mono text-xs">
          {rearrangementLogs.map((log, i) => (
            <div key={i} className="text-green-400 mb-1">{log}</div>
          ))}
        </div>
      )}

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
          <p className="text-xs text-gray-400">
            {!suggestions 
              ? "No container data available. Please try refreshing." 
              : "All containers are within optimal efficiency ranges."}
          </p>
        </div>
      ) : (
        <div>
          {/* --- Disorganized Containers Section --- */}
          {hasDisorganizedContainers() && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-green-400 mb-3 border-b border-green-700/30 pb-1">DISORGANIZED CONTAINERS</h3>
              
              {!hasRearrangementSuggestions() && (
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-md p-3 mb-4 text-blue-300 text-sm">
                  <div className="flex items-center">
                    <Info className="h-5 w-5 mr-2 text-blue-400" />
                    <div>
                      <strong>No rearrangement plan is available from the system.</strong> The containers below have efficiency issues, 
                      but the system could not automatically generate a rearrangement plan.
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-950 border border-green-800/30 rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-green-900/20 text-xs text-green-500 uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-4 py-2">Container ID</th>
                      <th scope="col" className="px-4 py-2">Efficiency (%)</th> 
                      <th scope="col" className="px-4 py-2">Accessibility</th>
                      <th scope="col" className="px-4 py-2">Items / Capacity</th>
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
                            ? `${Math.max(0, (100 - container.inefficiency_score)).toFixed(1)}` 
                            : container.efficiency_score !== undefined
                              ? `${Math.max(0, container.efficiency_score).toFixed(1)}`
                              : container.efficiency !== undefined 
                                ? `${Math.max(0, (container.efficiency * 100)).toFixed(1)}` 
                                : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {container.accessibility_issues !== undefined 
                            ? container.accessibility_issues 
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {/* Show current items / capacity */}
                          <span className={container.available_space <= 0 ? 'text-red-400 font-semibold' : ''}>
                            {container.items_count || container.total_items || 0} / {container.capacity || 10}
                            {container.available_space <= 0 && ' (FULL)'}
                          </span>
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
              <h3 className="text-lg font-semibold text-green-400 mb-3 border-b border-green-700/30 pb-1">
                SUGGESTED MOVES ({rearrangementPlan.length} total)
                {suggestions?.total_estimated_time && (
                  <span className="text-sm font-normal ml-2 text-gray-400">
                    (Est. time: ~{parseFloat(suggestions.total_estimated_time).toFixed(2)} seconds)
                  </span>
                )}
                {suggestions?.space_optimization && (
                  <span className="text-sm font-normal ml-2 text-gray-400">
                    | Space improvement: ~{parseFloat(suggestions.space_optimization).toFixed(3)}
                  </span>
                )}
              </h3>
              
              {/* Plan overview */}
              {suggestions?.message && (
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-md p-3 mb-4 text-blue-300 text-sm">
                  <div className="flex items-center">
                    <Info className="h-5 w-5 mr-2 text-blue-400" />
                    <div>
                      <strong>{suggestions.message}</strong>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Warning about containers being at capacity */}
              {suggestions?.rearrangement_plan && suggestions.rearrangement_plan.length > rearrangementPlan.length && (
                <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-md p-3 mb-4 text-yellow-300 text-sm">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-400 flex-shrink-0" />
                    <div>
                      <strong>Some target containers are at capacity.</strong> {suggestions.rearrangement_plan.length - rearrangementPlan.length} suggested moves were filtered out because the target containers are full. The system will try to find alternative containers during execution.
                    </div>
                  </div>
                </div>
              )}
              
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
                        {paginatedMoves.map((item, index) => {
                          // Find capacity info for the target container
                          const targetContainer = suggestions?.disorganized_containers?.find(c => 
                            c.container_id === item.to_container
                          );
                          const hasCapacityInfo = targetContainer && targetContainer.capacity !== undefined;
                          const isFull = hasCapacityInfo && (targetContainer.available_space || 0) <= 0;
                          
                          // Find the execution result for this specific move, if execution has happened
                          const moveResult = executionResult?.results?.find(r => r.item_id === item.item_id);
                          
                          return (
                            <tr 
                              key={`${item.item_id}-${index}`}
                              className={`hover:bg-green-900/5 ${
                                moveResult ? (moveResult.success ? 'opacity-70' : 'bg-red-900/10') : ''
                              }`}
                            >
                                <td className="px-4 py-2 font-medium text-green-300 whitespace-nowrap">{item.item_id}</td>
                                <td className="px-4 py-2 text-gray-300 truncate max-w-xs">{item.item_name}</td>
                                <td className="px-4 py-2 text-gray-300">{item.from_container}</td>
                                <td className="px-4 py-2 text-green-400 font-semibold">
                                  {item.to_container}
                                  {hasCapacityInfo && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      ({targetContainer.items_count || targetContainer.total_items || 0}/{targetContainer.capacity})
                                      {isFull && <span className="text-red-400 ml-1">(FULL)</span>}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-400 text-xs">
                                  {/* Show execution status/message if execution has been attempted */}
                                  {moveResult ? (
                                    <span className={`px-2 py-1 rounded ${moveResult.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                                      {moveResult.success ? 'Success' : `Failed: ${moveResult.message}`}
                                    </span>
                                  ) : item.reason ? (
                                    <span className="bg-green-900/20 px-2 py-1 rounded text-green-200">
                                      {item.reason}
                                    </span>
                                  ) : '-'}
                                </td>
                            </tr>
                          );
                        })}
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
                      EXECUTING MOVES...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-5 w-5 mr-2" />
                      EXECUTE REARRANGEMENT PLAN ({rearrangementPlan.length} moves)
                    </>
                  )}
                </button>
                <p className="text-gray-500 text-xs mt-2">
                  Container positions will be auto-calculated for optimal placement
                </p>
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