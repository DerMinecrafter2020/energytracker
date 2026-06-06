const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Imports
if (app.includes('DrinkHistoryChart')) {
  app = app.replace('import DrinkHistoryChart from \'./components/DrinkHistoryChart\';', 'import DrinkHistory from \'./components/DrinkHistory\';');
}

// 2. Add handleDeleteLog and handleToggleFavorite if they are missing
if (!app.includes('const handleDeleteLog =')) {
  const handlers = `
  const handleDeleteLog = async (logId) => {
    try {
      await api.deleteLog(logId);
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleFavorite = async (log, isFavorite) => {
    try {
      if (isFavorite) {
        // Find favorite ID by log match (pseudo logic, adjust based on actual api)
        // If we don't have full favorites logic here, we just ignore or implement basic
      }
    } catch (err) {
      setError(err.message);
    }
  };
  `;
  app = app.replace('const handleAddDrink =', handlers + '\n  const handleAddDrink =');
}

// 3. Replace the component call
app = app.replace(
  '<DrinkHistoryChart logs={logs} />',
  '<DrinkHistory logs={logs} onDeleteLog={handleDeleteLog} onToggleFavorite={handleToggleFavorite} isFavoriteLog={() => false} />'
);

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx updated with DrinkHistory');
