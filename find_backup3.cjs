const fs = require('fs');
const path = 'C:/Users/corny/.gemini/antigravity/brain/0511bf3d-e97a-4fa1-a46e-abb23e5044b8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let matches = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    const str = JSON.stringify(step);
    if (str.includes('const AdminPanel =')) {
        matches.push({ index: i, len: str.length });
    }
  } catch (e) {}
}
console.log(matches);
