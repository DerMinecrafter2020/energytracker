const fs = require('fs');
const path = 'C:/Users/corny/.gemini/antigravity/brain/0511bf3d-e97a-4fa1-a46e-abb23e5044b8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let bestContent = '';
for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.tool_calls) {
        for (const tc of step.tool_calls) {
            if (tc.function.name === 'view_file' && tc.function.arguments.includes('AdminPanel.jsx')) {
                console.log('view_file at step', i);
            }
        }
    }
    if (step.type === 'ACTION_RESPONSE' && JSON.stringify(step).includes('const AdminPanel =')) {
        // console.log('ACTION_RESPONSE at step', i, 'length', JSON.stringify(step).length);
    }
  } catch (e) {}
}
