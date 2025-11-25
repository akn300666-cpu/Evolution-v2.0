import React, { useState, useEffect } from 'react';
import { ModelTier } from '../types';

interface LoginScreenProps {
  onLogin: (username: string, tier: ModelTier) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isEntering, setIsEntering] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ModelTier>('free');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsEntering(true);
      // Slight delay for effect
      setTimeout(() => {
        onLogin(username.trim(), selectedTier);
      }, 800);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0510] text-slate-200 p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      </div>

      <div className={`z-10 w-full max-w-md transition-all duration-700 ${isEntering ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-2">
            EVE <span className="text-fuchsia-500 text-lg align-top">v2.0</span>
          </h1>
          <p className="text-slate-500 text-sm tracking-widest uppercase">Evolutionary Virtual Entity</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-8 rounded-2xl shadow-2xl relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 rounded-2xl opacity-50 blur group-hover:opacity-75 transition duration-500"></div>
          
          <div className="relative flex flex-col gap-6">
            
            {/* Tier Selector */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setSelectedTier('free')}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold rounded-md transition-all ${
                  selectedTier === 'free' 
                    ? 'bg-slate-800 text-emerald-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Core (Flash)
              </button>
              <button
                onClick={() => setSelectedTier('pro')}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold rounded-md transition-all ${
                  selectedTier === 'pro' 
                    ? 'bg-slate-800 text-fuchsia-500 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Pro (Exp)
              </button>
            </div>

            <div className="text-center h-8">
               {selectedTier === 'free' ? (
                 <p className="text-[10px] text-slate-500 animate-fade-in">
                   Uses <span className="text-emerald-500">Gemini 2.5 Flash</span>. Fast, efficient, and reliable.
                 </p>
               ) : (
                 <p className="text-[10px] text-slate-500 animate-fade-in">
                   Uses <span className="text-fuchsia-500">Gemini 3 Pro</span>. Max intelligence. Rate limits may apply.
                 </p>
               )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-fade-in">
              <div className="space-y-2">
                <label htmlFor="codename" className="text-xs uppercase font-bold text-slate-500 tracking-widest">
                  Identify Yourself
                </label>
                <input
                  id="codename"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Codename"
                  autoComplete="off"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-4 py-3 text-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-all font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!username.trim()}
                className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest text-sm transition-all duration-300
                  ${username.trim() 
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white hover:from-fuchsia-500 hover:to-purple-500 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 transform hover:-translate-y-0.5' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
                `}
              >
                Initialize Link
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-600 font-mono">
            SECURE CONNECTION // NO FILTERS ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;