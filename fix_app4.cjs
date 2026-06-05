const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const target = 'useEffect(() => {\n    if (settings?.theme) {';
const replacement = `useEffect(() => {
    if (settings?.language && typeof setLanguage === 'function') {
      setLanguage(settings.language);
    }
  }, [settings?.language, setLanguage]);

  useEffect(() => {
    if (settings?.theme) {`;
content = content.replace(target, replacement);

fs.writeFileSync('src/App.jsx', content, 'utf8');
