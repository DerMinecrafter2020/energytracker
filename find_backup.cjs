const fs = require('fs');
const path = 'C:/Users/corny/.gemini/antigravity/brain/0511bf3d-e97a-4fa1-a46e-abb23e5044b8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');
for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.tool_calls) {
      for (const tc of step.tool_calls) {
        if (tc.function.name === 'write_to_file' && tc.function.arguments) {
          const args = JSON.parse(tc.function.arguments);
          if (args.TargetFile && args.TargetFile.includes('AdminPanel.jsx')) {
            console.log('Found write_to_file at step index', step.step_index);
            fs.writeFileSync('AdminPanel_backup.jsx', args.CodeContent);
            process.exit(0);
          }
        }
      }
    }
  } catch (e) {}
}
console.log('Not found');
