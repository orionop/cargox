import React, { useState } from 'react';
import RetrievalAnimation from '../components/RetrievalAnimation';

const TestAnimation: React.FC = () => {
  const [startAnimation, setStartAnimation] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasDisturbedItems, setHasDisturbedItems] = useState(false);

  const handleStartAnimation = () => {
    setStartAnimation(true);
    setCompleted(false);
  };

  const handleAnimationComplete = () => {
    setCompleted(true);
    setTimeout(() => {
      setStartAnimation(false);
    }, 100);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Retrieval Animation Test</h1>
      
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleStartAnimation}
            disabled={startAnimation}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {startAnimation ? 'Animation in progress...' : 'Start Animation'}
          </button>
          
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDisturbedItems}
              onChange={() => setHasDisturbedItems(!hasDisturbedItems)}
              className="form-checkbox h-4 w-4 text-blue-600"
              disabled={startAnimation}
            />
            <span>Include disturbed items</span>
          </label>
        </div>
        
        {completed && (
          <div className="p-2 bg-green-100 text-green-800 rounded">
            Animation completed successfully!
          </div>
        )}
      </div>
      
      <div className="border border-gray-300 rounded-lg w-full h-[500px] overflow-hidden">
        <RetrievalAnimation 
          startAnimation={startAnimation} 
          onAnimationComplete={handleAnimationComplete}
          disturbed_items={hasDisturbedItems ? ['item1', 'item2', 'item3'] : []}
          steps={hasDisturbedItems ? 3 : 0}
        />
      </div>
    </div>
  );
};

export default TestAnimation; 