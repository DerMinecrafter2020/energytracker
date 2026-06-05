const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');
content = content.replace(/\\$\{API_BASE\}\/api\/translations\/g, '\${API_BASE_URL}/api/translations\');
content = content.replace(/\\$\{API_BASE\}\/api\/admin\/translations\/g, '\${API_BASE_URL}/api/admin/translations\');
fs.writeFileSync('src/services/api.js', content, 'utf8');
