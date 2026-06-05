const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace('const { t } = useTranslation();', 'const { t, language, setLanguage } = useTranslation();');

const target = 'if (userSettings) setSettings(userSettings);';
const replacement = `if (userSettings) {
        setSettings(userSettings);
        if (userSettings.language && typeof setLanguage === 'function') {
          setLanguage(userSettings.language);
        }
      }`;
content = content.replace(target, replacement);

fs.writeFileSync('src/App.jsx', content, 'utf8');
