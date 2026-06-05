import React from 'react';
import { Home, Search, BarChart2 } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

const BottomNavigation = ({ currentTab, onChangeTab }) => {
  const { t } = useTranslation();
  const tabs = [
    { id: 'home', icon: Home, label: t('home') },
    { id: 'search', icon: Search, label: t('discover') },
    { id: 'history', icon: BarChart2, label: t('history') },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <div className="bg-[#1a1c22] border-t border-[#252830] pb-[env(safe-area-inset-bottom)] rounded-t-2xl sm:rounded-none">
          <div className="flex items-center justify-around h-20 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChangeTab(tab.id)}
                  className={`flex flex-col items-center justify-center h-full min-w-[80px] transition-all duration-300 ${
                    isActive ? 'text-[#a8c7fa]' : 'text-[#c4c6d0] hover:text-[#e2e2e5]'
                  }`}
                >
                  <div className={`flex items-center justify-center w-16 h-8 rounded-full mb-1 transition-all duration-300 ${isActive ? 'bg-[#0842a0]' : 'bg-transparent'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#d3e3fd]' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="text-[11px] font-medium tracking-wide">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;



