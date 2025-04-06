import { useState, useEffect } from 'react';
import { 
  identifyWaste, 
  generateWasteReturnPlan, 
  executeWastePlacementPlan,
  getContainers, 
  WasteItem, 
  WasteReturnPlan,
  WastePlacementExecutionResult
} from '../frontend-api';

const Waste = () => {
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [returnPlan, setReturnPlan] = useState<WasteReturnPlan | null>(null);
  const [executionResult, setExecutionResult] = useState<WastePlacementExecutionResult | null>(null);
  const [targetZone, setTargetZone] = useState<string>('Storage_Bay');
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Identify waste items and fetch zones when component mounts
  useEffect(() => {
    console.log("Waste component mounted, fetching data...");
    fetchWasteItems();
    fetchAvailableZones();
  }, []);

  const fetchWasteItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await identifyWaste();
      console.log("Waste items response:", response);
      setWasteItems(response.waste_items || []);
    } catch (err) {
      setError('Failed to identify waste items');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableZones = async () => {
    console.log("Fetching available zones...");
    try {
      const response = await getContainers();
      console.log("Raw containers response:", response);
      
      // Handle different response formats (might be array or {containers: []})
      let containersArray: any[] = [];
      if (Array.isArray(response)) {
        console.log("Response is an array");
        containersArray = response;
      } else if (response && typeof response === 'object') {
        console.log("Response is an object");
        // Safely access potential containers property using type assertion
        const responseObj = response as Record<string, any>;
        if (Array.isArray(responseObj.containers)) {
          console.log("Response has containers array property");
          containersArray = responseObj.containers;
        } else {
          console.log("Response does not have containers array property:", responseObj);
        }
      } else {
        console.log("Response is neither array nor object:", typeof response);
      }
      
      if (!Array.isArray(containersArray) || containersArray.length === 0) {
        console.error("No containers found in response");
        
        // Set default zones as fallback
        const defaultZones = [
          'Storage_Bay', 
          'Command_Center', 
          'Engineering_Bay', 
          'Crew_Quarters',
          'Medical_Bay',
          'Lab'
        ];
        console.log("Setting default zones:", defaultZones);
        setAvailableZones(defaultZones);
        return;
      }
      
      // Extract and filter unique zones
      const zones = containersArray
        .map((container: any) => container.zone)
        .filter((zone: string | null) => zone !== null && zone !== undefined)
        // Filter unique values
        .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
        .sort();
      
      console.log("Extracted zones:", zones);
      
      if (zones.length > 0) {
        console.log("Setting available zones:", zones);
        setAvailableZones(zones);
        
        // Set default zone if we have zones and current targetZone isn't in the list
        if (!zones.includes(targetZone)) {
          console.log(`Current target zone ${targetZone} not in zones list, setting to ${zones[0]}`);
          setTargetZone(zones[0]);
        }
      } else {
        // Set default zones as fallback if no zones found
        const defaultZones = [
          'Storage_Bay', 
          'Command_Center', 
          'Engineering_Bay', 
          'Crew_Quarters',
          'Medical_Bay',
          'Lab'
        ];
        console.log("No zones found in containers, setting default zones:", defaultZones);
        setAvailableZones(defaultZones);
      }
    } catch (err) {
      console.error('Failed to fetch container zones:', err);
      // Don't show error to user as this is just for the dropdown
      
      // Set default zones as fallback
      const defaultZones = [
        'Storage_Bay', 
        'Command_Center', 
        'Engineering_Bay', 
        'Crew_Quarters',
        'Medical_Bay',
        'Lab'
      ];
      console.log("Error fetching zones, setting default zones:", defaultZones);
      setAvailableZones(defaultZones);
    }
  };

  const generatePlan = async () => {
    setIsLoading(true);
    setError(null);
    setExecutionResult(null);
    try {
      const plan = await generateWasteReturnPlan(targetZone);
      setReturnPlan(plan);
    } catch (err) {
      setError('Failed to generate waste return plan');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const executePlan = async () => {
    if (!returnPlan) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await executeWastePlacementPlan(returnPlan);
      setExecutionResult(result);
      
      // If the execution was successful, refresh the waste items list
      if (result.success) {
        await fetchWasteItems();
      }
    } catch (err) {
      setError('Failed to execute waste placement plan');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Log current state before render
  console.log("Rendering Waste component with availableZones:", availableZones);
  console.log(`Will render ${availableZones.length > 0 ? 'dropdown selector' : 'text input'} for zones`);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 border-b border-green-500/20 pb-2">
        <h1 className="text-2xl font-mono font-bold text-green-500">WASTE_MANAGEMENT</h1>
        <p className="text-gray-500 text-xs">Identify and dispose of expired items</p>
      </div>
      
      <div className="mb-8 bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 bg-green-500 mr-2"></div>
          <h2 className="text-lg font-mono font-semibold text-green-400">IDENTIFY_WASTE</h2>
        </div>
        
        <button 
          onClick={fetchWasteItems}
          className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 mr-2 font-mono text-sm"
          disabled={isLoading}
        >
          {isLoading ? 'SCANNING...' : 'SCAN FOR WASTE'}
        </button>
        
        {wasteItems.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-mono font-medium mb-2 text-green-300">FOUND {wasteItems.length} WASTE ITEMS:</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-black/25 border border-green-500/10">
                <thead>
                  <tr className="bg-green-900/10">
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM_ID</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">NAME</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteItems.map((item, index) => (
                    <tr key={index} className="border-b border-green-500/10 hover:bg-green-900/5">
                      <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{item.id}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{item.name}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-red-400 text-xs">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : !isLoading && (
          <p className="mt-4 text-gray-500 font-mono text-xs">NO_WASTE_DETECTED</p>
        )}
      </div>
      
      <div className="bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 bg-green-500 mr-2"></div>
          <h2 className="text-lg font-mono font-semibold text-green-400">WASTE_RETURN_PLAN</h2>
        </div>
        
        <div className="mb-4">
          <label className="block text-green-400 font-mono mb-2 text-xs">TARGET_ZONE:</label>
          {availableZones.length > 0 ? (
            <select
              value={targetZone}
              onChange={(e) => setTargetZone(e.target.value)}
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full max-w-md font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50 appearance-none cursor-pointer hover:bg-black/60 focus:bg-black/60 transition-colors duration-200"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2322c55e\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', 
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              {availableZones.map((zone) => (
                <option key={zone} value={zone} className="bg-gray-900 text-green-300">
                  {zone}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={targetZone}
              onChange={(e) => setTargetZone(e.target.value)}
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full max-w-md font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50 hover:bg-black/60 focus:bg-black/60 transition-colors duration-200"
              placeholder="Enter zone (e.g. Storage_Bay, W)"
            />
          )}
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={generatePlan}
            className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
            disabled={isLoading}
          >
            {isLoading ? 'GENERATING...' : 'GENERATE_RETURN_PLAN'}
          </button>
          
          {returnPlan && !executionResult && (
            <button 
              onClick={executePlan}
              className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
              disabled={isLoading}
            >
              {isLoading ? 'EXECUTING...' : 'EXECUTE_PLAN'}
            </button>
          )}
        </div>
        
        {returnPlan && (
          <div className="mt-6 bg-black/40 p-4 rounded border border-green-500/10">
            <h3 className="text-sm font-mono font-medium mb-2 text-green-400">{returnPlan.message}</h3>
            
            {executionResult && (
              <div className={`p-3 mb-4 rounded border ${executionResult.success ? 'bg-green-900/10 border-green-500/20 text-green-400' : 'bg-red-900/10 border-red-500/20 text-red-400'} font-mono text-xs`}>
                <div className="flex items-center">
                  <div className={`w-2 h-2 ${executionResult.success ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
                  <span className="font-bold">EXECUTION_STATUS:</span>
                </div>
                <p className="mt-1">{executionResult.message}</p>
                {executionResult.success && (
                  <p className="mt-1">Successfully placed {executionResult.items_placed} items</p>
                )}
              </div>
            )}
            
            <p className="text-gray-400 mb-1 text-xs">
              <span className="text-green-400 font-mono">PLACED:</span> {returnPlan.placed_count}
              <span className="mx-2">|</span>
              <span className="text-green-400 font-mono">UNPLACED:</span> {returnPlan.unplaced_count}
            </p>
            
            <h4 className="font-mono text-green-400 mt-4 mb-2 text-xs">WASTE_CONTAINERS:</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {returnPlan.waste_containers.map((container, index) => (
                <span key={index} className="bg-green-900/10 text-green-300 px-3 py-1 rounded-md border border-green-500/20 font-mono text-xs">
                  {container}
                </span>
              ))}
            </div>
            
            <h4 className="font-mono text-green-400 mt-4 mb-2 text-xs">PLACEMENT_PLAN:</h4>
            {returnPlan.placement_plan.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-black/25 border border-green-500/10">
                  <thead>
                    <tr className="bg-green-900/10">
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">CONTAINER</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">POSITION</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnPlan.placement_plan.map((item, index) => (
                      <tr key={index} className="border-b border-green-500/10 hover:bg-green-900/5">
                        <td className="border border-green-500/10 px-4 py-2 text-green-300 font-mono text-xs">
                          {item.item_id} - <span className="text-gray-400">{item.item_name}</span>
                        </td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 font-mono text-xs">
                          {item.container_id || 'No container'}
                        </td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 font-mono text-xs">
                          {item.position ? (
                            `(${item.position.x.toFixed(2)}, ${item.position.y.toFixed(2)}, ${item.position.z.toFixed(2)})`
                          ) : (
                            'No position'
                          )}
                        </td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 font-mono text-xs">
                          {item.error ? (
                            <span className="text-red-400">{item.error}</span>
                          ) : (
                            <span className="text-green-400">Ready to place</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 font-mono text-xs">NO_ITEMS_IN_PLAN</p>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/10 text-red-400 rounded border border-red-500/20 font-mono text-xs">
          ERROR: {error}
        </div>
      )}
    </div>
  );
};

export default Waste; 