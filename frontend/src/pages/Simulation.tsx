import { useState } from 'react';
import { simulateDay } from '../frontend-api';

interface UsageItem {
  id: string;
  name: string;
  old_count: number;
  new_count: number;
  limit: number;
}

interface ExpiredItem {
  id: string;
  name: string;
  expiry_date: string;
}

interface SimulationResult {
  success: boolean;
  message: string;
  simulated_date: string;
  used_items: UsageItem[];
  expired_items: ExpiredItem[];
}

const Simulation = () => {
  const [usagePlan, setUsagePlan] = useState<Record<string, number>>({});
  const [itemId, setItemId] = useState<string>('');
  const [usageCount, setUsageCount] = useState<number>(1);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const addToUsagePlan = () => {
    if (!itemId.trim()) {
      setError('Please enter an item ID');
      return;
    }
    
    setUsagePlan(prev => ({
      ...prev,
      [itemId]: usageCount
    }));
    
    // Reset inputs
    setItemId('');
    setUsageCount(1);
  };

  const removeFromUsagePlan = (id: string) => {
    setUsagePlan(prev => {
      const newPlan = { ...prev };
      delete newPlan[id];
      return newPlan;
    });
  };

  const clearUsagePlan = () => {
    setUsagePlan({});
  };

  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await simulateDay(usagePlan) as SimulationResult;
      setSimulationResult(result);
    } catch (err) {
      setError('Failed to simulate day');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 border-b border-green-500/20 pb-2">
        <h1 className="text-2xl font-mono font-bold text-green-500">TIME_SIMULATION</h1>
        <p className="text-gray-500 text-xs">Simulate a day to test item usage and expiry</p>
      </div>
      
      <div className="bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 bg-green-500 mr-2"></div>
          <h2 className="text-lg font-mono font-semibold text-green-400">USAGE_PLAN</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">ITEM_ID:</label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="Enter item ID"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">USAGE_COUNT:</label>
            <input
              type="number"
              value={usageCount}
              onChange={(e) => setUsageCount(parseInt(e.target.value) || 1)}
              min="1"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={addToUsagePlan}
              className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
            >
              ADD_TO_PLAN
            </button>
          </div>
        </div>
        
        {Object.keys(usagePlan).length > 0 ? (
          <div className="mt-4">
            <h3 className="font-mono text-green-400 mb-2 text-xs">PLANNED_USAGE:</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-black/25 border border-green-500/10">
                <thead>
                  <tr className="bg-green-900/10">
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM_ID</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">USAGE_COUNT</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usagePlan).map(([id, count]) => (
                    <tr key={id} className="border-b border-green-500/10 hover:bg-green-900/5">
                      <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{id}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{count}</td>
                      <td className="border border-green-500/10 px-4 py-2">
                        <button
                          onClick={() => removeFromUsagePlan(id)}
                          className="text-red-400 hover:text-red-300 font-mono text-xs"
                        >
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button
                onClick={clearUsagePlan}
                className="bg-black/40 hover:bg-black/60 border border-green-500/20 text-gray-400 px-4 py-2 rounded-md transition duration-200 ease-in-out font-mono text-sm"
              >
                CLEAR_PLAN
              </button>
              
              <button
                onClick={runSimulation}
                className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
                disabled={isLoading}
              >
                {isLoading ? 'SIMULATING...' : 'RUN_SIMULATION'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center mt-4">
            <p className="text-gray-500 font-mono text-xs">NO_ITEMS_IN_PLAN</p>
            
            <button
              onClick={runSimulation}
              className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
              disabled={isLoading}
            >
              {isLoading ? 'SIMULATING...' : 'SIMULATE_EMPTY_PLAN'}
            </button>
          </div>
        )}
      </div>
      
      {simulationResult && (
        <div className="bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg">
          <div className="flex items-center mb-4">
            <div className="w-2 h-2 bg-green-500 mr-2"></div>
            <h2 className="text-lg font-mono font-semibold text-green-400">SIMULATION_RESULTS</h2>
          </div>
          
          <div className="mb-4 bg-black/40 p-4 rounded border border-green-500/10">
            <p className="text-green-400 font-mono text-xs">{simulationResult.message}</p>
            <p className="text-gray-400 mt-1 text-xs"><span className="text-green-400 font-mono">SIMULATED_DATE:</span> {simulationResult.simulated_date}</p>
          </div>
          
          <div className="mb-6">
            <h3 className="font-mono text-green-400 mb-2 text-xs">USED_ITEMS:</h3>
            {simulationResult.used_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-black/25 border border-green-500/10">
                  <thead>
                    <tr className="bg-green-900/10">
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM_ID</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">NAME</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">PREV_COUNT</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">NEW_COUNT</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">LIMIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.used_items.map((item) => (
                      <tr key={item.id} className="border-b border-green-500/10 hover:bg-green-900/5">
                        <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{item.id}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{item.name}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{item.old_count}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-cyan-400 text-xs">{item.new_count}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-500 text-xs">{item.limit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 font-mono text-xs">NO_ITEMS_USED</p>
            )}
          </div>
          
          <div>
            <h3 className="font-mono text-green-400 mb-2 text-xs">EXPIRED_ITEMS:</h3>
            {simulationResult.expired_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-black/25 border border-green-500/10">
                  <thead>
                    <tr className="bg-green-900/10">
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM_ID</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">NAME</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">EXPIRY_DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.expired_items.map((item) => (
                      <tr key={item.id} className="border-b border-green-500/10 hover:bg-green-900/5">
                        <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{item.id}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{item.name}</td>
                        <td className="border border-green-500/10 px-4 py-2 text-red-400 text-xs">{item.expiry_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 font-mono text-xs">NO_ITEMS_EXPIRED</p>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/10 text-red-400 rounded border border-red-500/20 font-mono text-xs">
          ERROR: {error}
        </div>
      )}
    </div>
  );
};

export default Simulation; 