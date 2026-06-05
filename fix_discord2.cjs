const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// The exact string in server.js has an emoji, maybe my search/replace won't match. Let's use regex.
const targetRegex = /const sendDiscordReminder = async \(\{ webhookUrl, email, customMessage \}\) => \{[\s\S]*?throw new Error\(`Discord Webhook Fehler \(\$\{response\.status\}\)`\);\s*\}\s*\};/;

const newFunc = `const sendDiscordReminder = async ({ webhookUrl, email, title, message }) => {
  const randomColor = Math.floor(Math.random() * 16777215);
  const embedTitle = title || '⏰ Erinnerung';
  const embedDesc = message || \`Hallo **\${email}**!\\nBitte denke daran, deinen heutigen Koffein-Bedarf im Tracker einzutragen.\`;
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: embedTitle,
        description: embedDesc,
        color: randomColor,
        timestamp: new Date().toISOString(),
        footer: { text: 'Koffein-Tracker' }
      }]
    }),
  });
  if (!response.ok) {
    throw new Error(\`Discord Webhook Fehler (\${response.status})\`);
  }
};`;

s = s.replace(targetRegex, newFunc);

// Now update tryNotify calls
// Find: customMessage: `**${title}**: ${message}`
s = s.replace(/customMessage:\s*`\*\*\$\{title\}\*\*:\s*\$\{message\}`/g, 'title, message');

fs.writeFileSync('server.js', s, 'utf8');
