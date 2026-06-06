const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// remove language from getUserSettings
s = s.replace(/theme: 'system',\s*language: 'de',/, "theme: 'system',");
// remove from updateUserSettings parameters
s = s.replace(/theme,\s*language\s*}\)/g, "theme })");
// remove assignment
s = s.replace(/\s*if \(language !== undefined\) settings\.language = language;/g, "");
// remove from POST /api/settings/me body destruct
s = s.replace(/theme,\s*language\s*} = req.body/g, "theme } = req.body");

fs.writeFileSync('server.js', s);
console.log('Language removed successfully');
