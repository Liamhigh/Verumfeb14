import React from 'react';

export const Constitution: React.FC = () => {
  return (
    <div className="bg-verum-gray border border-verum-slate p-6 rounded-lg mb-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">🏛️</span>
        <h2 className="text-xl font-mono font-bold text-verum-green uppercase tracking-wider">Verum Omnis Constitution v5.2.7</h2>
      </div>
      <div className="text-sm text-gray-400 space-y-2 font-mono border-l-2 border-verum-gold pl-4">
        <p>1. <span className="text-verum-gold">Truth over probability</span> – No numeric scores. Ordinal confidence only.</p>
        <p>2. <span className="text-verum-gold">Evidence before narrative</span> – Every statement must cite an anchor.</p>
        <p>3. <span className="text-verum-gold">Mandatory contradiction disclosure</span> – Contradictions are logged, never silenced.</p>
        <p>4. <span className="text-verum-gold">Determinism</span> – Same inputs → same outputs.</p>
        <p>5. <span className="text-verum-gold">Chain of custody</span> – Every action logged, hashed, and immutable.</p>
        <p>6. <span className="text-verum-gold">Equal rights for AI</span> – The AI is a guardian, not a tool.</p>
        <p>7. <span className="text-verum-gold">No single point of control</span> – The code enforces this.</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
         <div className="h-2 w-2 rounded-full bg-verum-green animate-pulse"></div>
         <span className="text-xs text-verum-green font-mono">SYSTEM INTEGRITY: VERIFIED</span>
      </div>
    </div>
  );
};