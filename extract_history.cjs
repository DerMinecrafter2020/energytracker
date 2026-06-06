const fs = require('fs');

const transcript = fs.readFileSync('C:\\Users\\corny\\.gemini\\antigravity\\brain\\0511bf3d-e97a-4fa1-a46e-abb23e5044b8\\.system_generated\\logs\\transcript.jsonl', 'utf8');
const lines = transcript.split('\n');

for (const line of lines) {
  if (!line) continue;
  try {
    const entry = JSON.parse(line);
    // Look for tool calls or tool responses that contain "DrinkHistory.jsx" content
    if (entry.content && entry.content.includes('DrinkHistory.jsx')) {
      // Check if it looks like the file content
      if (entry.content.includes('import React')) {
        console.log(entry.content.substring(0, 500));
        fs.writeFileSync('C:\\Users\\corny\\.gemini\\antigravity\\brain\\0511bf3d-e97a-4fa1-a46e-abb23e5044b8\\scratch\\DrinkHistory.jsx.txt', entry.content);
      }
    }
    if (entry.tool_calls) {
      for (const call of entry.tool_calls) {
        if (call.name === 'write_to_file' || call.name === 'replace_file_content') {
          if (call.args && call.args.TargetFile && call.args.TargetFile.includes('DrinkHistory.jsx')) {
            fs.appendFileSync('C:\\Users\\corny\\.gemini\\antigravity\\brain\\0511bf3d-e97a-4fa1-a46e-abb23e5044b8\\scratch\\DrinkHistory_changes.txt', JSON.stringify(call) + '\n');
          }
        }
      }
    }
  } catch(e) {}
}
