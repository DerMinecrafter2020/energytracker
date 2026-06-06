const fs = require('fs');

const code = fs.readFileSync('src/components/AdminPanel.jsx', 'utf8');
const lines = code.split('\n');

let capturingLogs = false;
let outputLogs = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('activeTab === \'logs\' && (')) {
    capturingLogs = true;
  }
  if (capturingLogs) {
    outputLogs.push(lines[i]);
    if (lines[i].includes('activeTab === \'users\' && (')) {
      break;
    }
  }
}

fs.writeFileSync('admin_logs.txt', outputLogs.join('\n'));
