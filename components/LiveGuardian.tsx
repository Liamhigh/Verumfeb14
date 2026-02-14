import React from 'react';

export const LiveGuardian: React.FC = () => {
  return (
    <div className="bg-verum-black border border-verum-red/50 p-4 rounded-lg mt-6 opacity-50 cursor-not-allowed">
        <h3 className="text-gray-500 font-mono font-bold mb-4 flex items-center gap-2">
            <span className="material-icons">cloud_off</span> GUARDIAN UPLINK
        </h3>
        <p className="font-mono text-xs text-verum-red">
            OFFLINE MODE ENFORCED. LIVE STREAMING DISABLED BY CONSTITUTION V5.2.7.
        </p>
    </div>
  );
};