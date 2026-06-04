import React from 'react';
import { Home, Search, BarChart2, Settings } from 'lucide-react';

const BottomNavigation = ({ currentTab, onChangeTab }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Entdecken' },
    { id: 'history', icon: BarChart2, label: 'Verlauf' },
    { id: 'settings', icon: Settings, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 sm:pb-6 pt-2 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="glass-card rounded-[2rem] p-2 flex items-center justify-between shadow-glass backdrop-blur-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-blue-500/10 rounded-2xl shadow-inner animate-fade-in"></div>
                )}
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'animate-glow-pulse drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;
