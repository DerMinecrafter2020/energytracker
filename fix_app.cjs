const fs = require('fs');
let s = fs.readFileSync('src/App.jsx', 'utf8');
s = s.replace(  // Apply theme
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.className = settings.theme === 'system' ? '' : \	heme-\\;
    }
  }, [settings?.theme]);,   // Apply theme and language
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.className = settings.theme === 'system' ? '' : \	heme-\\;
    }
    if (settings?.language && typeof setLanguage === 'function') {
      setLanguage(settings.language);
    }
  }, [settings?.theme, settings?.language, setLanguage]););
fs.writeFileSync('src/App.jsx', s, 'utf8');
