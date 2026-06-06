const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

if (!app.includes('const handleUpdateLog =')) {
  const updateLogFn = `
  const handleUpdateLog = async (logId, data) => {
    try {
      const updated = await api.updateLog(logId, data);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, ...updated } : l));
      const total = await api.getDailyTotal();
      setTotalCaffeineToday(total.totalCaffeine);
    } catch (err) {
      setError(err.message);
    }
  };
  `;
  app = app.replace('const handleDeleteLog =', updateLogFn + '\n  const handleDeleteLog =');
}

app = app.replace(
  '<AIAssistant totalCaffeineToday={totalCaffeineToday} logs={logs} onAddDrink={handleAddDrink} />',
  '<AIAssistant totalCaffeineToday={totalCaffeineToday} logs={logs} onAddDrink={handleAddDrink} onDeleteDrink={handleDeleteLog} onUpdateDrink={handleUpdateLog} />'
);

// If it was already replaced or had slightly different props:
if (!app.includes('onDeleteDrink={handleDeleteLog}')) {
  app = app.replace(
    '<AIAssistant',
    '<AIAssistant onDeleteDrink={handleDeleteLog} onUpdateDrink={handleUpdateLog}'
  );
}

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx updated with updateLog for AI');
