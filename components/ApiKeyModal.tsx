import React, { useState } from 'react';
import { Key, ShieldCheck, Lock } from 'lucide-react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave }) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!inputKey.trim()) {
      setError('Neural Link ID required.');
      return;
    }
    // Basic validation for Google API keys
    if (!inputKey.startsWith('AIza')) {
      setError('Invalid signature detected. (Must start with AIza)');
      return;
    }
    onSave(inputKey);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-black border border-cyan-500/30 p-8 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-cyan-950/30 flex items-center justify-center border border-cyan-500/50">
            <Key className="w-8 h-8 text-cyan-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black orbitron text-white tracking-wider">SECURE UPLINK REQUIRED</h2>
            <p className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest">Enter Gemini API Key to establish connection</p>
          </div>

          <div className="w-full space-y-4">
            <div className="relative group">
              <input
                type="password"
                value={inputKey}
                onChange={(e) => { setInputKey(e.target.value); setError(''); }}
                placeholder="AIzaSy..."
                className="w-full bg-cyan-950/10 border border-cyan-800 text-center text-cyan-400 font-mono text-sm py-4 px-4 rounded-lg focus:outline-none focus:border-cyan-400 transition-all placeholder:text-cyan-900/50"
              />
              <div className="absolute inset-0 rounded-lg pointer-events-none border border-cyan-500/0 group-focus-within:border-cyan-500/20 group-focus-within:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"></div>
            </div>

            {error && <p className="text-[10px] text-red-500 font-mono uppercase tracking-widest animate-pulse">{error}</p>}

            <button
              onClick={handleSave}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase tracking-[0.2em] text-sm transition-all rounded-lg flex items-center justify-center gap-2 group"
            >
              <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Authenticate
            </button>
          </div>

          <div className="text-[10px] text-white/20 font-mono leading-relaxed max-w-xs">
            <p className="flex items-center justify-center gap-2"><Lock className="w-3 h-3" /> E2E ENCRYPTED STORAGE</p>
            The key is stored locally in your browser's neural buffer (localStorage). It is never transmitted to our servers.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
