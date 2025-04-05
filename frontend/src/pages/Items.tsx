import React, { useEffect, useState } from 'react';
import { getAllItems } from '../api';
import { Loader, Package, AlertTriangle, Check, X, ArrowUpDown } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  is_placed: boolean;
  container_id: string | null;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  priority: number;
  preferred_zone: string | null;
  is_waste: boolean;
}

const ItemsPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof Item>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [placedFilter, setPlacedFilter] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getAllItems();
        if (response.items) {
          setItems(response.items);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
        setError('Failed to load items');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const sortedItems = () => {
    return [...items]
      .filter(item => placedFilter === null || item.is_placed === placedFilter)
      .sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
        if (bValue == null) return sortOrder === 'asc' ? 1 : -1;
        
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  };

  const toggleSort = (field: keyof Item) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center">
        <div>
          <Loader className="h-8 w-8 animate-spin text-green-500 mx-auto mb-4" />
          <div className="text-green-400 animate-pulse">LOADING ITEM DATA...</div>
          <div className="text-xs text-gray-500 mt-2">PLEASE WAIT</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400 mb-2">{error}</p>
        <p className="text-xs text-gray-500">ERROR CODE: CARGO-FETCH-002</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-green-500 text-xl mb-4 font-bold">
        # CARGO INVENTORY <span className="text-xs text-green-600">[ITEMS: {items.length}]</span>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <button 
          onClick={() => setPlacedFilter(null)} 
          className={`px-3 py-1 rounded text-xs ${placedFilter === null ? 'bg-green-900/50 text-green-400' : 'bg-gray-800/50 text-gray-400'}`}
        >
          All
        </button>
        <button 
          onClick={() => setPlacedFilter(true)} 
          className={`px-3 py-1 rounded text-xs ${placedFilter === true ? 'bg-green-900/50 text-green-400' : 'bg-gray-800/50 text-gray-400'}`}
        >
          Placed
        </button>
        <button 
          onClick={() => setPlacedFilter(false)} 
          className={`px-3 py-1 rounded text-xs ${placedFilter === false ? 'bg-green-900/50 text-green-400' : 'bg-gray-800/50 text-gray-400'}`}
        >
          Unplaced
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border border-yellow-500/30 bg-yellow-900/10 rounded-md p-6 text-center">
          <Package className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-400 mb-2">NO CARGO ITEMS AVAILABLE</p>
          <p className="text-xs text-gray-400">IMPORT ITEMS TO BEGIN</p>
        </div>
      ) : (
        <div className="bg-gray-950 border border-green-800/30 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-green-900/20 text-xs text-green-500">
                <tr>
                  <th className="py-2 px-4 text-left font-medium cursor-pointer" onClick={() => toggleSort('id')}>
                    <div className="flex items-center">
                      ID 
                      {sortBy === 'id' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-left font-medium cursor-pointer" onClick={() => toggleSort('name')}>
                    <div className="flex items-center">
                      NAME
                      {sortBy === 'name' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-left font-medium cursor-pointer" onClick={() => toggleSort('priority')}>
                    <div className="flex items-center">
                      PRIORITY
                      {sortBy === 'priority' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-left font-medium cursor-pointer" onClick={() => toggleSort('preferred_zone')}>
                    <div className="flex items-center">
                      ZONE
                      {sortBy === 'preferred_zone' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-left font-medium cursor-pointer" onClick={() => toggleSort('is_placed')}>
                    <div className="flex items-center">
                      STATUS
                      {sortBy === 'is_placed' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </div>
                  </th>
                  <th className="py-2 px-4 text-left font-medium">
                    CONTAINER
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedItems().map((item) => (
                  <tr key={item.id} className="border-t border-green-900/10 hover:bg-green-900/5">
                    <td className="py-2 px-4 font-mono text-green-400">{item.id}</td>
                    <td className="py-2 px-4 text-gray-300">{item.name}</td>
                    <td className="py-2 px-4">
                      <div className={`px-2 py-0.5 inline-block rounded ${
                        item.priority >= 80 ? 'bg-red-900/20 text-red-400' :
                        item.priority >= 50 ? 'bg-yellow-900/20 text-yellow-400' :
                        'bg-blue-900/20 text-blue-400'
                      }`}>
                        {item.priority}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-gray-400">{item.preferred_zone || 'Any'}</td>
                    <td className="py-2 px-4">
                      {item.is_placed ? (
                        <div className="flex items-center text-green-500">
                          <Check className="h-4 w-4 mr-1" />
                          <span>Placed</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-400">
                          <X className="h-4 w-4 mr-1" />
                          <span>Unplaced</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-gray-400">
                      {item.container_id || 'Not assigned'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="mt-6 text-xs text-gray-500 border-t border-green-600/30 pt-4">
        <div className="flex justify-between">
          <div>LAST SYNC: {new Date().toLocaleTimeString()}</div>
          <div>
            <span className="mr-4">PLACED: {items.filter(i => i.is_placed).length}</span>
            <span>UNPLACED: {items.filter(i => !i.is_placed).length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemsPage; 