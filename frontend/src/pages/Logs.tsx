import { useState, useEffect, ChangeEvent } from 'react';
import { getLogs } from '../frontend-api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: string;
  action: string;
  item_id: string | null;
  container_id: string | null;
  user: string;
  details: string | null;
}

interface LogsResponse {
  success: boolean;
  count: number;
  logs: LogEntry[];
}

const Logs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    item_id: '',
    container_id: '',
    user: '',
    from_date: '',
    to_date: '',
    limit: 100
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(15);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Remove empty filters
      const nonEmptyFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const response = await getLogs(nonEmptyFilters) as LogsResponse;
      setLogs(response.logs || []);
    } catch (err) {
      setError('Failed to fetch logs');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      item_id: '',
      container_id: '',
      user: '',
      from_date: '',
      to_date: '',
      limit: 100
    });
    setCurrentPage(1); // Reset page when filters are cleared
  };

  // Calculate paginated logs
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 border-b border-green-500/20 pb-2">
        <h1 className="text-2xl font-mono font-bold text-green-500">SYSTEM_LOGS</h1>
        <p className="text-gray-500 text-xs">View and filter system action logs</p>
      </div>
      
      <div className="bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg mb-8">
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 bg-green-500 mr-2"></div>
          <h2 className="text-lg font-mono font-semibold text-green-400">FILTER_OPTIONS</h2>
        </div>
        
        <form onSubmit={applyFilters} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">ACTION:</label>
            <input
              type="text"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              placeholder="e.g. retrieval, placement"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">ITEM_ID:</label>
            <input
              type="text"
              name="item_id"
              value={filters.item_id}
              onChange={handleFilterChange}
              placeholder="Item ID"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">CONTAINER_ID:</label>
            <input
              type="text"
              name="container_id"
              value={filters.container_id}
              onChange={handleFilterChange}
              placeholder="Container ID"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">USER:</label>
            <input
              type="text"
              name="user"
              value={filters.user}
              onChange={handleFilterChange}
              placeholder="Username"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">FROM_DATE:</label>
            <input
              type="date"
              name="from_date"
              value={filters.from_date}
              onChange={handleFilterChange}
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">TO_DATE:</label>
            <input
              type="date"
              name="to_date"
              value={filters.to_date}
              onChange={handleFilterChange}
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div>
            <label className="block text-green-400 font-mono mb-2 text-xs">LIMIT:</label>
            <input
              type="number"
              name="limit"
              value={filters.limit}
              onChange={handleFilterChange}
              min="1"
              max="1000"
              className="bg-black/40 border border-green-500/30 text-green-300 px-3 py-2 rounded-md w-full font-mono text-xs focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
            />
          </div>
          
          <div className="md:col-span-3 mt-4 flex gap-2">
            <button
              type="submit"
              className="bg-black/40 hover:bg-black/60 border border-green-500/30 text-green-400 px-4 py-2 rounded-md transition duration-200 ease-in-out transform hover:scale-105 font-mono text-sm"
              disabled={isLoading}
            >
              {isLoading ? 'PROCESSING...' : 'APPLY_FILTERS'}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="bg-black/40 hover:bg-black/60 border border-green-500/20 text-gray-400 px-4 py-2 rounded-md transition duration-200 ease-in-out font-mono text-sm"
            >
              CLEAR
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-gray-900/40 border border-green-500/20 p-6 rounded-lg shadow-lg">
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 bg-green-500 mr-2"></div>
          <h2 className="text-lg font-mono font-semibold text-green-400">LOG_ENTRIES <span className="text-xs text-gray-500">[{logs.length}]</span></h2>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500/70"></div>
            <p className="ml-3 text-green-400 font-mono text-xs">RETRIEVING_DATA...</p>
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-black/25 border border-green-500/10">
                <thead>
                  <tr className="bg-green-900/10">
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ID</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">TIMESTAMP</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ACTION</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">ITEM</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">CONTAINER</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">USER</th>
                    <th className="border border-green-500/10 px-4 py-2 text-left text-green-400 font-mono text-xs">DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-green-500/10 hover:bg-green-900/5">
                      <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{log.id}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{log.timestamp}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-cyan-400 font-mono uppercase text-xs">{log.action}</td>
                      <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{log.item_id || '-'}</td>
                      <td className="border border-green-500/10 px-4 py-2 font-mono text-green-300 text-xs">{log.container_id || '-'}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{log.user}</td>
                      <td className="border border-green-500/10 px-4 py-2 text-gray-400 text-xs">{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded text-xs bg-gray-800/50 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800/70 flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </button>
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded text-xs bg-gray-800/50 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800/70 flex items-center"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 font-mono text-xs">NO_LOGS_FOUND</p>
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

export default Logs; 