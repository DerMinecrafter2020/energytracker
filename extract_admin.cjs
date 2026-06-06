const fs = require('fs');

const code = fs.readFileSync('src/components/AdminPanel.jsx', 'utf8');
const lines = code.split('\n');

let capturing = false;
let output = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('activeTab === \'users\' && (')) {
    capturing = true;
  }
  if (capturing) {
    output.push(lines[i]);
    if (lines[i].includes('export default')) {
      break;
    }
    if (output.length > 100) {
      break;
    }
  }
}

fs.writeFileSync('scratch/admin_users.txt', output.join('\n'));
console.log('Extracted');
