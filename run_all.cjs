const { execSync } = require('child_process');
try {
  console.log(execSync('git restore server.js', { encoding: 'utf8' }));
  console.log(execSync('node remove_lang.cjs', { encoding: 'utf8' }));
  console.log(execSync('node add_routes.cjs', { encoding: 'utf8' }));
  console.log(execSync('node update_prompt.cjs', { encoding: 'utf8' }));
  console.log(execSync('node -c server.js', { encoding: 'utf8' }));
  console.log("All done.");
} catch (e) {
  console.error(e.message);
}
