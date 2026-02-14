import React, { useState, useEffect } from 'react';

export const SystemClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="font-mono text-xs text-verum-green border border-verum-green/30 rounded px-3 py-1 bg-verum-dark/50 flex items-center gap-2 shadow-[0_0_10px_rgba(39,174,96,0.1)]">
      <span className="material-icons text-[10px] animate-pulse">access_time</span>
      <span>{time.toISOString().replace('T', ' ').split('.')[0]} UTC</span>
    </div>
  );
};