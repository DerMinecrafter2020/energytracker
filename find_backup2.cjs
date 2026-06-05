const fs = require('fs');
const path = 'C:/Users/corny/.gemini/antigravity/brain/0511bf3d-e97a-4fa1-a46e-abb23e5044b8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let bestContent = '';
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.type === 'ACTION_RESPONSE' || step.type === 'PLANNER_RESPONSE') {
       const str = JSON.stringify(step);
       if (str.includes('const AdminPanel = ({ session, onLogout, onShowUserPanel')) {
          // Extract it!
          // It might be in the output of a command or view_file
          // Let's just find the longest string containing this
          if (str.length > bestContent.length) {
             bestContent = str;
          }
       }
    }
  } catch (e) {}
}
fs.writeFileSync('best_match.txt', bestContent);
console.log('Done, length:', bestContent.length);
