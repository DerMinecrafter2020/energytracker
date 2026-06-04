import React from 'react';
import { Heart, HeartOff, Plus } from 'lucide-react';

const PresetDrinks = ({ favorites, onAddDrink, onRemoveFavorite, isLoading }) => {
  const handleAddFavorite = (drink) => {
    onAddDrink({
      name: drink.name,
      size: drink.size,
      caffeine: drink.caffeine,
      caffeinePerMl: drink.caffeinePerMl,
      icon: drink.icon,
      isPreset: false,
    });
  };

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-pink-400" />
        Favoriten
      </h3>

      {Array.isArray(favorites) && favorites.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {favorites.map((drink) => (
            <div
              key={drink.id}
              className="glass-card glass-card-hover rounded-3xl p-4 flex flex-col
                transition-all duration-300 group cursor-pointer overflow-hidden relative"
              onClick={() => !isLoading && handleAddFavorite(drink)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start w-full relative z-10 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                  {drink.icon || '🥤'}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if(onRemoveFavorite) onRemoveFavorite(drink.id);
                  }}
                  disabled={isLoading}
                  className="p-1.5 rounded-xl text-pink-400 hover:text-white hover:bg-pink-500/40 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                  title="Aus Favoriten entfernen"
                >
                  <HeartOff className="w-4 h-4" />
                </button>
              </div>

              <div className="relative z-10 text-left mt-1">
                <span className="font-bold text-sm block truncate text-slate-100">{drink.name}</span>
                <span className="text-xs text-blue-300 font-medium mt-0.5 block">{drink.size} ml • <span className="text-amber-400">{drink.caffeine} mg</span></span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
          Noch keine Favoriten gespeichert. Markiere ein Getränk im Verlauf mit dem Herz-Symbol, um es hier schnell wiederzuverwenden.
        </div>
      )}

      <p className="text-xs text-slate-600 mt-3 flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Klick auf einen Favoriten fügt ihn direkt erneut hinzu.
      </p>
    </div>
  );
};

export default PresetDrinks;
