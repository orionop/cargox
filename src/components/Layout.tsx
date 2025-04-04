import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Boxes, Upload, Search, Home, Activity, BarChart3 } from 'lucide-react';

const Layout = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <div className="flex min-h-screen bg-black text-green-400">
      {/* Top header bar */}
      <div className="fixed top-0 left-0 w-full h-12 bg-black border-b border-green-600/30 flex items-center justify-between px-4 z-20">
        <div className="flex items-center">
          <span className="font-bold text-green-500 mr-2">MISSION_CONTROL:</span>
          <span className="text-gray-400">$</span>
          <span className="text-white ml-2">cargo_stowage_v1.3.7</span>
          <span className="ml-2 text-green-500 animate-pulse">▍</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="text-xs text-gray-500 mr-1">SYS:</span>
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-center">
            <span className="text-xs text-gray-500 mr-1">NET:</span>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-xs text-gray-400">
            T+{Math.floor(Date.now() / 1000)}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-16 md:w-64 bg-gray-950 border-r border-green-600/30 flex flex-col fixed top-12 bottom-0 left-0 z-10">
        {/* Top Logo */}
        <Link to="/" className="flex items-center justify-center md:justify-start px-4 py-6 border-b border-green-600/30">
          <Boxes className="h-8 w-8 text-green-500" />
          <span className="hidden md:block font-bold text-xl ml-3 text-green-500 tracking-widest">CARGO-X</span>
        </Link>
        
        {/* Nav Links */}
        <nav className="flex flex-col mt-6 space-y-2 px-3">
          <Link
            to="/"
            className={`flex items-center py-3 px-3 rounded-md ${
              isActive('/') 
                ? 'bg-green-900/30 text-green-400 border-l-2 border-green-500' 
                : 'text-gray-400 hover:text-green-400 hover:bg-green-900/10'
            }`}
          >
            <Home className="h-5 w-5 md:mr-3" />
            <span className="hidden md:block text-sm">_HOME</span>
          </Link>
          
          <Link
            to="/upload"
            className={`flex items-center py-3 px-3 rounded-md ${
              isActive('/upload') 
                ? 'bg-green-900/30 text-green-400 border-l-2 border-green-500' 
                : 'text-gray-400 hover:text-green-400 hover:bg-green-900/10'
            }`}
          >
            <Upload className="h-5 w-5 md:mr-3" />
            <span className="hidden md:block text-sm">_UPLOAD_CARGO</span>
          </Link>
          
          <Link
            to="/containers"
            className={`flex items-center py-3 px-3 rounded-md ${
              isActive('/containers') 
                ? 'bg-green-900/30 text-green-400 border-l-2 border-green-500' 
                : 'text-gray-400 hover:text-green-400 hover:bg-green-900/10'
            }`}
          >
            <Boxes className="h-5 w-5 md:mr-3" />
            <span className="hidden md:block text-sm">_CONTAINERS</span>
          </Link>
          
          <Link
            to="/retrieve"
            className={`flex items-center py-3 px-3 rounded-md ${
              isActive('/retrieve') 
                ? 'bg-green-900/30 text-green-400 border-l-2 border-green-500' 
                : 'text-gray-400 hover:text-green-400 hover:bg-green-900/10'
            }`}
          >
            <Search className="h-5 w-5 md:mr-3" />
            <span className="hidden md:block text-sm">_RETRIEVE</span>
          </Link>
        </nav>
        
        <div className="mt-auto p-4 text-xs text-gray-500 border-t border-green-600/30 hidden md:block">
          <div className="mb-1">BUILD: CARGO-X-1337</div>
          <div>STATUS: OPERATIONAL</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-16 md:ml-64 mt-12">
        <main className="p-6 grid-bg min-h-[calc(100vh-3rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;