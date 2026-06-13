import React from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';

const FavoriteQuickActions = ({ favorites = [], onAddFavorite, onRemoveFavorite, isLoading = false }) => {
  if (!Array.isArray(favorites) || favorites.length === 0) return null;

  return (
    <div className="glass-card rounded-[2rem] p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-amber-300" />
        <h2 className="text-base font-bold text-white">Schnellwahl</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {favorites.slice(0, 8).map((drink) => (
          <div key={drink.id} className="flex items-center gap-2 rounded-2xl bg-[#252830] border border-white/5 p-2.5">
            <button
              type="button"
              onClick={() => onAddFavorite(drink)}
              disabled={isLoading}
              className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:opacity-50"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shrink-0">
                {drink.icon || '🥤'}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white truncate">{drink.name}</span>
                <span className="block text-xs text-slate-500">{drink.size} ml · {drink.caffeine} mg</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onAddFavorite(drink)}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-300 flex items-center justify-center disabled:opacity-50"
              aria-label={`${drink.name} hinzufügen`}
              title="Hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onRemoveFavorite(drink.id)}
              disabled={isLoading}
              className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center justify-center disabled:opacity-50"
              aria-label={`${drink.name} aus Favoriten entfernen`}
              title="Favorit entfernen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoriteQuickActions;
