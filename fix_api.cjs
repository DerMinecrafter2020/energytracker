const fs = require('fs');
let content = fs.readFileSync('src/services/api.js', 'utf8');

content = content.replace('fetch(/api/translations)', 'fetch(${API_BASE}/api/translations)');
content = content.replace('Authorization = Bearer ;', 'Authorization = Bearer ;');
content = content.replace('fetch(/api/admin/translations', 'fetch(${API_BASE}/api/admin/translations');

fs.writeFileSync('src/services/api.js', content, 'utf8');
