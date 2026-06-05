const fs = require('fs');
let s = fs.readFileSync('src/App.jsx', 'utf8');

const target = `  // Apply theme
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.className = settings.theme === 'system' ? '' : \`theme-\${settings.theme}\`;
    }
  }, [settings?.theme]);`;

const replacement = `  // Apply theme and language
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.className = settings.theme === 'system' ? '' : \`theme-\${settings.theme}\`;
    }
    if (settings?.language && typeof setLanguage === 'function') {
      setLanguage(settings.language);
    }
  }, [settings?.theme, settings?.language, setLanguage]);`;

s = s.replace(target, replacement);
fs.writeFileSync('src/App.jsx', s, 'utf8');
