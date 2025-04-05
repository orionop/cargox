import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Upload, Search, ArrowRight, Play, Database, ArrowRightCircle, Trash, RefreshCw } from 'lucide-react';
import { runPlacementAlgorithm } from '../api';
import toast from 'react-hot-toast';

const TypingAnimation = ({ text, delay = 50 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <span>
      {displayText}
      {currentIndex < text.length && <span className="text-green-500 animate-pulse">▍</span>}
    </span>
  );
};

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [truncateLoading, setTruncateLoading] = useState(false);
  
  const handleRunAlgorithm = async () => {
    setLoading(true);
    toast.loading('Running placement algorithm...', { id: 'placement' });
    
    try {
      const response = await runPlacementAlgorithm();
      console.log('Algorithm response:', response.data);
      
      if (response.data?.success) {
        const placedCount = response.data.containers?.reduce((count, container) => 
          count + (container.items?.length || 0), 0) || 0;
        const unplacedCount = response.data.unplaced_items?.length || 0;
        
        toast.success(`Placement algorithm completed successfully! ${placedCount} items placed, ${unplacedCount} items unplaced.`, { id: 'placement' });
      } else if (Array.isArray(response.data)) {
        toast.success(`Placement algorithm completed successfully! ${response.data.length} items processed.`, { id: 'placement' });
      } else {
        toast.error(`Algorithm returned unexpected data format: ${JSON.stringify(response.data).substring(0, 100)}...`, { id: 'placement' });
      }
    } catch (error) {
      console.error('Error running algorithm:', error);
      toast.error('Failed to run placement algorithm', { id: 'placement' });
    } finally {
      setLoading(false);
    }
  };

  const handleTruncateDatabase = async () => {
    if (!confirm('Are you sure you want to truncate the entire database? This will delete all containers, items, and logs.')) {
      return;
    }
    
    setTruncateLoading(true);
    toast.loading('Truncating database...', { id: 'truncate' });
    
    try {
      const response = await fetch('http://localhost:8000/api/truncate-database', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Database truncated successfully!', { id: 'truncate' });
      } else {
        toast.error(`Truncation failed: ${result.message || 'Unknown error'}`, { id: 'truncate' });
      }
    } catch (error) {
      console.error('Error truncating database:', error);
      toast.error('Failed to truncate database', { id: 'truncate' });
    } finally {
      setTruncateLoading(false);
    }
  };

  return (
    <div className="px-2 md:px-8">
      {/* Stars background with CSS */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-40 z-0">
        {[...Array(50)].map((_, i) => {
          const size = Math.random() * 2 + 1;
          const top = Math.random() * 100;
          const left = Math.random() * 100;
          const animationDelay = Math.random() * 5;
          return (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top: `${top}%`,
                left: `${left}%`,
                animation: `twinkle 5s infinite ${animationDelay}s`
              }}
            />
          );
        })}
      </div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-green-500 text-xl mb-2 font-bold">
          <TypingAnimation text="# WELCOME TO CARGO-X SYSTEM" delay={40} />
        </div>
        
        <div className="border border-green-500/30 bg-black/80 p-6 rounded-md mb-8">
          <div className="text-green-400 mb-6">
            <div className="mb-2">
              <span className="text-gray-500">{'>'}</span> <TypingAnimation text="cargo_system.initialize()" delay={60} />
            </div>
            <div className="mb-2">
              <span className="text-gray-500">{'>'}</span> LOADING CARGO STOWAGE MANAGEMENT SYSTEM...
            </div>
            <div className="mb-2 text-white">
              <span className="text-gray-500">{'>'}</span> VERSION: 1.3.7
            </div>
            <div className="mb-2 text-yellow-400">
              <span className="text-gray-500">{'>'}</span> STATUS: SYSTEM OPERATIONAL
            </div>
          </div>
          
          <div className="mb-6 border-t border-green-500/20 pt-4">
            <div className="text-xl text-green-400 mb-2">{'// SYSTEM OVERVIEW'}</div>
            <div className="text-gray-300 text-sm mb-4">
              Advanced cargo stowage management and retrieval system providing efficient space allocation, 
              optimized container management, and rapid cargo tracking in aerospace environments.
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={handleRunAlgorithm}
                disabled={loading}
                className={`flex items-center text-sm px-4 py-2 rounded-md ${
                  loading 
                    ? 'bg-gray-800 text-gray-400 cursor-wait' 
                    : 'bg-green-800/50 text-green-400 hover:bg-green-700/50'
                } transition-colors`}
              >
                {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {loading ? 'Running Algorithm...' : 'Run Placement Algorithm'}
              </button>
              
              <button 
                onClick={handleTruncateDatabase}
                disabled={truncateLoading}
                className={`flex items-center text-sm px-4 py-2 rounded-md ${
                  truncateLoading 
                    ? 'bg-gray-800 text-gray-400 cursor-wait' 
                    : 'bg-red-900/50 text-red-400 hover:bg-red-800/50'
                } transition-colors`}
              >
                <Trash className="h-4 w-4 mr-2" />
                {truncateLoading ? 'Truncating...' : 'Reset Database'}
              </button>
            </div>
          </div>
        </div>

        <div className="text-green-500 text-sm mb-4">
          <span className="mr-2">{'>'}</span>
          SELECT MODULE:
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            to="/upload"
            className="bg-gray-950 p-5 rounded-md hover:border-green-500 border border-green-800/30 hover:bg-black transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <Upload className="h-8 w-8 text-green-500" />
              <ArrowRight className="h-4 w-4 text-green-500/60" />
            </div>
            <h2 className="text-lg font-bold mb-2 text-green-400">UPLOAD.CARGO</h2>
            <p className="text-sm text-gray-400">Initialize cargo manifest import sequence for new mission systems</p>
          </Link>

          <Link
            to="/containers"
            className="bg-gray-950 p-5 rounded-md hover:border-green-500 border border-green-800/30 hover:bg-black transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <Boxes className="h-8 w-8 text-green-500" />
              <ArrowRight className="h-4 w-4 text-green-500/60" />
            </div>
            <h2 className="text-lg font-bold mb-2 text-green-400">VIEW.CONTAINERS</h2>
            <p className="text-sm text-gray-400">Access and analyze container specifications and stowage status</p>
          </Link>

          <Link
            to="/retrieve"
            className="bg-gray-950 p-5 rounded-md hover:border-green-500 border border-green-800/30 hover:bg-black transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <Search className="h-8 w-8 text-green-500" />
              <ArrowRight className="h-4 w-4 text-green-500/60" />
            </div>
            <h2 className="text-lg font-bold mb-2 text-green-400">VIEW.RETRIEVE</h2>
            <p className="text-sm text-gray-400">Locate and access specific items for mission critical tasks</p>
          </Link>

          <Link
            to="/rearrange"
            className="bg-gray-950 p-5 rounded-md hover:border-green-500 border border-green-800/30 hover:bg-black transition-all"
          >
            <div className="flex justify-between items-center mb-4">
              <RefreshCw className="h-8 w-8 text-green-500" />
              <ArrowRight className="h-4 w-4 text-green-500/60" />
            </div>
            <h2 className="text-lg font-bold mb-2 text-green-400">OPTIMIZE.CARGO</h2>
            <p className="text-sm text-gray-400">Review and implement intelligent cargo rearrangement suggestions</p>
          </Link>
        </div>
        
        <div className="mt-10 text-xs text-gray-500 border-t border-green-600/30 pt-4">
          <div className="flex justify-between">
            <div>CARGO-X // ISRO ADVANCED STOWAGE SYSTEMS</div>
            <div>CLEARANCE LEVEL: AUTHORIZED PERSONNEL ONLY</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;