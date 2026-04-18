import React, { useState, useEffect } from 'react';
import { Heart, HeartOff, Plus, Trash2, Wine } from 'lucide-react';
import { fetchCustomDrinks, addCustomDrink, removeCustomDrink } from '../services/api';

export default function CustomDrinks({
  session,
  isLoading,
  onAddDrink,
  onToggleFavorite,
  isFavoriteDrink,
}) {
  const [customDrinks, setCustomDrinks] = useState([]);
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [caffeine, setCaffeine] = useState('');
  const [icon, setIcon] = useState('🍷');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingDrinks, setLoadingDrinks] = useState(false);

  useEffect(() => {
    if (!session?.email) return;

    const load = async () => {
      setLoadingDrinks(true);
      try {
        const drinks = await fetchCustomDrinks({
          userId: session.id || session.userId || null,
          email: session.email,
        });
        setCustomDrinks(drinks);
      } catch (err) {
        console.error('Fehler beim Laden der Getränke:', err);
      } finally {
        setLoadingDrinks(false);
      }
    };

    load();
  }, [session]);

  const handleAddDrink = async () => {
    if (!name.trim() || !size || !caffeine) {
      setMessage('error');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const newDrink = await addCustomDrink({
        userId: session.id || session.userId || null,
        email: session.email,
        name: name.trim(),
        size: Number(size),
        caffeine: Number(caffeine),
        icon: icon || '🍷',
      });

      setCustomDrinks([...customDrinks, newDrink]);
      setName('');
      setSize('');
      setCaffeine('');
      setIcon('🍷');
      setMessage('saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('error');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDrink = async (drinkId) => {
    try {
      await removeCustomDrink({
        userId: session.id || session.userId || null,
        email: session.email,
        drinkId,
      });
      setCustomDrinks(customDrinks.filter((d) => d.id !== drinkId));
      setMessage('deleted');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('error');
      console.error(err);
    }
  };

  const handleQuickAddDrink = (drink) => {
    if (!onAddDrink) return;
    onAddDrink({
      name: drink.name,
      size: Number(drink.size),
      caffeine: Number(drink.caffeine),
      caffeinePerMl: drink.size ? Number(drink.caffeine) / Number(drink.size) : null,
      icon: drink.icon || '🥤',
      isPreset: false,
    });
  };

  const handleToggleFavoriteDrink = (drink) => {
    if (!onToggleFavorite) return;
    const favorite = !!isFavoriteDrink?.(drink);
    onToggleFavorite({
      name: drink.name,
      size: Number(drink.size),
      caffeine: Number(drink.caffeine),
      caffeinePerMl: drink.size ? Number(drink.caffeine) / Number(drink.size) : null,
      icon: drink.icon || '🥤',
    }, favorite);
  };

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 animate-fade-in">
      <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <Wine className="w-5 h-5 text-pink-400" />
        Eigene Getränke
      </h3>

      {/* Add Form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Neues Getränk
        </p>

        <div className="space-y-3 mb-3">
          <input
            type="text"
            placeholder="Name (z.B. Espresso)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-dark"
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <input
                type="number"
                placeholder="Größe"
                min="10"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="input-dark"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">
                ml
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                placeholder="Koffein"
                min="0"
                value={caffeine}
                onChange={(e) => setCaffeine(e.target.value)}
                className="input-dark"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">
                mg
              </span>
            </div>

            <input
              type="text"
              placeholder="Icon"
              maxLength="2"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="input-dark text-center"
            />
          </div>
        </div>

        <button
          onClick={handleAddDrink}
          disabled={adding || isLoading}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500
            text-white font-semibold rounded-xl
            hover:from-pink-500 hover:to-pink-400 disabled:opacity-50
            transition-all duration-200 flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          {adding ? 'Wird hinzugefügt...' : 'Hinzufügen'}
        </button>
      </div>

      {/* Messages */}
      {message === 'saved' && (
        <div className="px-4 py-2.5 rounded-2xl bg-green-500/10 border border-green-500/30
          text-green-300 text-sm font-medium text-center mb-4 animate-fade-in">
          ✓ Getränk hinzugefügt
        </div>
      )}
      {message === 'deleted' && (
        <div className="px-4 py-2.5 rounded-2xl bg-green-500/10 border border-green-500/30
          text-green-300 text-sm font-medium text-center mb-4 animate-fade-in">
          ✓ Getränk gelöscht
        </div>
      )}
      {message === 'error' && (
        <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30
          text-red-300 text-sm font-medium text-center mb-4 animate-fade-in">
          × Fehler
        </div>
      )}

      {/* Drinks List */}
      {loadingDrinks ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-slate-400 text-sm">Lädt...</p>
        </div>
      ) : customDrinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
          <Wine className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm text-center">Noch keine eigenen Getränke.</p>
          <p className="text-xs text-slate-500 mt-1">Füge dein erstes Getränk hinzu!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {customDrinks.map((drink) => (
            <div
              key={drink.id}
              className="flex items-center gap-3 p-3.5 rounded-2xl
                bg-white/5 border border-white/8
                hover:bg-white/10 hover:border-white/15
                transition-all duration-200 group"
            >
              <button
                type="button"
                onClick={() => handleQuickAddDrink(drink)}
                disabled={isLoading}
                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-60 cursor-pointer"
                title="Zum heutigen Konsum hinzufügen"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center
                  bg-gradient-to-br from-pink-600/30 to-pink-400/10 border border-pink-500/20 shrink-0 text-lg">
                  {drink.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm">{drink.name}</h4>
                  <p className="text-xs text-slate-500">
                    {drink.size}ml • {drink.caffeine}mg
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1
                  bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Hinzufügen</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleFavoriteDrink(drink)}
                className="p-1.5 text-slate-400 hover:text-pink-300 hover:bg-pink-500/10
                  rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                aria-label="Favorit umschalten"
                title="Als Favorit speichern"
              >
                {isFavoriteDrink?.(drink) ? <HeartOff className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              </button>

              <button
                onClick={() => handleRemoveDrink(drink.id)}
                className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10
                  rounded-xl transition-all duration-200
                  opacity-0 group-hover:opacity-100"
                aria-label="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
