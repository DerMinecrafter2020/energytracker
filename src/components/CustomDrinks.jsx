import React, { useState, useEffect } from 'react';
import { fetchCustomDrinks, addCustomDrink, removeCustomDrink } from '../services/api';

export default function CustomDrinks({ session, isLoading }) {
  const [customDrinks, setCustomDrinks] = useState([]);
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [caffeine, setCaffeine] = useState('');
  const [icon, setIcon] = useState('🥤');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [loadingDrinks, setLoadingDrinks] = useState(false);

  // Load custom drinks
  useEffect(() => {
    if (!session?.email) return;

    const load = async () => {
      setLoadingDrinks(true);
      try {
        const drinks = await fetchCustomDrinks({
          userId: session.userId || null,
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
      setMessage('❌ Bitte alle Felder ausfüllen');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const newDrink = await addCustomDrink({
        userId: session.userId || null,
        email: session.email,
        name: name.trim(),
        size: Number(size),
        caffeine: Number(caffeine),
        icon: icon || '🥤',
      });

      setCustomDrinks([...customDrinks, newDrink]);
      setName('');
      setSize('');
      setCaffeine('');
      setIcon('🥤');
      setMessage('✅ Getränk hinzugefügt!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDrink = async (drinkId) => {
    try {
      await removeCustomDrink({
        userId: session.userId || null,
        email: session.email,
        drinkId,
      });
      setCustomDrinks(customDrinks.filter((d) => d.id !== drinkId));
      setMessage('✅ Getränk gelöscht!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('❌ ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">🍷 Eigene Getränke</h2>

      {/* Add Drink Form */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-medium text-gray-700 mb-3">Neues Getränk</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            placeholder="Name (z.B. Espresso)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Größe (ml)"
            min="10"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Koffein (mg)"
            min="0"
            value={caffeine}
            onChange={(e) => setCaffeine(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Icon (Emoji)"
            maxLength="2"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleAddDrink}
          disabled={adding || isLoading}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition"
        >
          {adding ? '➕ Wird hinzugefügt...' : '➕ Hinzufügen'}
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {/* Custom Drinks List */}
      {loadingDrinks ? (
        <p className="text-gray-500">Lädt...</p>
      ) : customDrinks.length === 0 ? (
        <p className="text-gray-500 text-sm">Noch keine eigenen Getränke. Füge dein erstes Getränk hinzu!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {customDrinks.map((drink) => (
            <div key={drink.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-800">
                  {drink.icon} {drink.name}
                </p>
                <p className="text-xs text-gray-600">
                  {drink.size}ml • {drink.caffeine}mg
                </p>
              </div>
              <button
                onClick={() => handleRemoveDrink(drink.id)}
                className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
