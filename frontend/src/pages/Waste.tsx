import { useState, useEffect } from 'react';
import { identifyWaste, generateWasteReturnPlan, WasteItem, WasteReturnPlan } from '../frontend-api';

const Waste = () => {
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([]);
  const [returnPlan, setReturnPlan] = useState<WasteReturnPlan | null>(null);
  const [targetZone, setTargetZone] = useState<string>('Storage_Bay');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Identify waste items when component mounts
  useEffect(() => {
    fetchWasteItems();
  }, []);

  const fetchWasteItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await identifyWaste();
      setWasteItems(response.waste_items || []);
    } catch (err) {
      setError('Failed to identify waste items');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePlan = async () => {
    setIsLoading(true);
    setError(null);
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
          <input
            type="text"
            value={targetZone}
            onChange={(e) => setTargetZone(e.target.value)}
            className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full max-w-md font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
          />
        </div>
        
        <button 
          onClick={generatePlan}
          className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
          disabled={isLoading}
        >
          {isLoading ? 'GENERATING...' : 'GENERATE_RETURN_PLAN'}
        </button>
        
        {returnPlan && (
          <div className="mt-6 bg-black/40 p-4 rounded border border-green-500/10">
            <h3 className="text-sm font-mono font-medium mb-2 text-green-400">{returnPlan.message}</h3>
            <p className="text-gray-400 mb-1 text-xs"><span className="text-green-400 font-mono">TOTAL_MASS:</span> {returnPlan.total_waste_mass} kg</p>
            <p className="text-gray-400 mb-3 text-xs"><span className="text-green-400 font-mono">TARGET_ZONE:</span> {returnPlan.target_zone}</p>
            
            <h4 className="font-mono text-green-400 mt-4 mb-2 text-xs">WASTE_CONTAINERS:</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {returnPlan.waste_containers.map((container, index) => (
                <span key={index} className="bg-green-900/10 text-green-300 px-3 py-1 rounded-md border border-green-500/20 font-mono text-xs">{container}</span>
              ))}
            </div>
            
            <h4 className="font-mono text-green-400 mt-4 mb-2 text-xs">RETURN_PLAN:</h4>
            {returnPlan.return_plan.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-black/25 border border-green-500/10">
                  <thead>
                    <tr className="bg-green-900/10">
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">WEIGHT</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">SOURCE</th>
                      <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">TARGET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnPlan.return_plan.map((item, index) => (
                      <tr key={index} className="border-b border-green-500/10 hover:bg-green-900/5">
                        <td className="border border-green-500/10 px-4 py-2 text-green-300 font-mono text-xs">
                          {item.item_id} - <span className="text-gray-400">{item.item_name}</span>
                        </td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{item.weight} kg</td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 font-mono text-xs">
                          {item.source_container.id} <span className="text-gray-500">(Zone {item.source_container.zone})</span>
                        </td>
                        <td className="border border-green-500/10 px-4 py-2 text-gray-400 font-mono text-xs">
                          {item.target_container.id} <span className="text-gray-500">(Zone {item.target_container.zone})</span>
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