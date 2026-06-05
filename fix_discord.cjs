const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const targetFunc = const sendDiscordReminder = async ({ webhookUrl, email, customMessage }) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: customMessage || \⏰ Erinnerung für \: Bitte heute deinen Energy-/Koffein-Bedarf im Tracker eintragen.\,
    }),
  });
  if (!response.ok) {
    throw new Error(\Discord Webhook Fehler (\)\);
  }
};;

const newFunc = const sendDiscordReminder = async ({ webhookUrl, email, title, message }) => {
  const randomColor = Math.floor(Math.random() * 16777215);
  const embedTitle = title || '⏰ Erinnerung';
  const embedDesc = message || \Hallo **\**!\\nBitte denke daran, deinen heutigen Koffein-Bedarf im Tracker einzutragen.\;
  
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
    throw new Error(\Discord Webhook Fehler (\)\);
  }
};;

s = s.replace(targetFunc, newFunc);

// Now update tryNotify calls
s = s.replace(/customMessage: \\*\*\$\{title\}\*\*: \$\{message\}\/g, 'title, message');

fs.writeFileSync('server.js', s, 'utf8');
