import React, { useState } from 'react';
import { Upload, Terminal, AlertTriangle } from 'lucide-react';
import { uploadContainers, uploadItems } from '../api';
import toast from 'react-hot-toast';

const UploadPage = () => {
  const [loading, setLoading] = useState({ containers: false, items: false });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleFileUpload = async (type: 'containers' | 'items', file: File) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    addLog(`INITIATING ${type.toUpperCase()} UPLOAD: ${file.name}`);

    try {
      const upload = type === 'containers' ? uploadContainers : uploadItems;
      await upload(file);
      toast.success(`${type} data uploaded successfully`);
      addLog(`SUCCESS: ${type.toUpperCase()} DATA PROCESSED AND VALIDATED`);
    } catch (error) {
      toast.error(`Failed to upload ${type} data`);
      addLog(`ERROR: ${type.toUpperCase()} UPLOAD FAILED - CHECK LOG FOR DETAILS`);
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="text-green-500 text-xl mb-4 font-bold">
        # CARGO MANIFEST UPLOADER <span className="text-xs text-green-600">[SYSTEM VERSION 1.3.7]</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-950 p-5 rounded-md border border-green-800/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-green-400">CONTAINER.MANIFEST</h2>
            <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
              REQUIRED
            </div>
          </div>
          
          <label className="block">
            <div className="flex justify-center p-6 border-2 border-green-800/30 border-dashed rounded-md hover:border-green-500 transition-colors cursor-pointer bg-black/20">
              <div className="space-y-2 text-center">
                <Upload className="mx-auto h-10 w-10 text-green-500" />
                <div className="text-sm text-green-400">
                  <label className="relative cursor-pointer font-medium hover:text-green-300 focus-within:outline-none">
                    <span>UPLOAD CONTAINERS.CSV</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('containers', file);
                      }}
                      disabled={loading.containers}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">FORMAT: CSV / MAX SIZE: 10MB</p>
              </div>
            </div>
          </label>
          
          {loading.containers && (
            <div className="mt-2 text-sm text-green-500 animate-pulse flex items-center">
              <Terminal className="h-4 w-4 mr-2" />
              PROCESSING CONTAINER MANIFEST...
            </div>
          )}
        </div>

        <div className="bg-gray-950 p-5 rounded-md border border-green-800/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-green-400">CARGO.MANIFEST</h2>
            <div className="px-2 py-1 bg-green-900/20 text-green-500 text-xs rounded border border-green-500/20">
              REQUIRED
            </div>
          </div>
          
          <label className="block">
            <div className="flex justify-center p-6 border-2 border-green-800/30 border-dashed rounded-md hover:border-green-500 transition-colors cursor-pointer bg-black/20">
              <div className="space-y-2 text-center">
                <Upload className="mx-auto h-10 w-10 text-green-500" />
                <div className="text-sm text-green-400">
                  <label className="relative cursor-pointer font-medium hover:text-green-300 focus-within:outline-none">
                    <span>UPLOAD INPUT_ITEMS.CSV</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('items', file);
                      }}
                      disabled={loading.items}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">FORMAT: CSV / MAX SIZE: 10MB</p>
              </div>
            </div>
          </label>
          
          {loading.items && (
            <div className="mt-2 text-sm text-green-500 animate-pulse flex items-center">
              <Terminal className="h-4 w-4 mr-2" />
              PROCESSING CARGO ITEMS...
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-gray-950 p-4 rounded-md border border-green-800/30">
        <div className="flex items-center justify-between mb-2">
          <div className="text-green-400 text-sm font-bold">SYSTEM.LOG</div>
          <button 
            className="text-xs text-gray-500 hover:text-green-400"
            onClick={() => setLogs([])}
          >
            CLEAR LOGS
          </button>
        </div>
        <div className="bg-black/50 p-3 rounded font-mono text-xs h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-600 flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              NO LOGS AVAILABLE - UPLOAD MANIFEST TO BEGIN
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-green-300 mb-1">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;