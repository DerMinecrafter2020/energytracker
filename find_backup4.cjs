const fs = require('fs');
const path = 'C:/Users/corny/.gemini/antigravity/brain/0511bf3d-e97a-4fa1-a46e-abb23e5044b8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const step = JSON.parse(lines[635]);
fs.writeFileSync('step635.json', JSON.stringify(step, null, 2));
console.log('Saved step635.json');
