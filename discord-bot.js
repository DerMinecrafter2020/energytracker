import { Client, GatewayIntentBits, Partials } from 'discord.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
  dotenv.config({ path: path.join(__dirname, '.env') });
} else {
  dotenv.config();
}

const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL, {
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => console.error('[Bot Redis] Fehler:', err.message));
redis.on('connect', () => console.log('[Bot Redis] ✓ Verbunden'));

const AI_CONFIG_KEY = 'koffein:ai_config';

let discordBotClient = null;
let currentConfig = {
  apiKey: '',
  model: 'deepseek/deepseek-v3',
  discordBotToken: '',
  discordBotEnabled: false,
  discordBotStatus: 'online'
};

const safeParse = (s, fallback) => {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

const callOpenRouter = async (messages) => {
  const key = currentConfig.apiKey;
  const mdl = currentConfig.model || 'deepseek/deepseek-v3';

  if (!key) throw new Error('Kein OpenRouter API-Key konfiguriert.');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/DerMinecrafter2020/energytracker',
      'X-Title': 'Koffein-Tracker Bot',
    },
    body: JSON.stringify({
      model: mdl,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API Fehler: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  throw new Error('Unerwartete Antwort von OpenRouter.');
};

const updateDiscordBotLifecycle = async (enabled, token, status = 'online') => {
  try {
    if (!enabled || !token) {
      if (discordBotClient) {
        discordBotClient.destroy();
        discordBotClient = null;
        console.log('[Discord Bot] Gestoppt, da deaktiviert oder kein Token vorhanden.');
      }
      return;
    }

    // Wenn Token geändert wurde oder der Bot noch nicht existiert, starte ihn neu
    if (!discordBotClient || discordBotClient.token !== token) {
      if (discordBotClient) {
        discordBotClient.destroy();
      }

      discordBotClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel, Partials.Message],
        presence: { status }
      });

      discordBotClient.on('ready', () => {
        console.log(`[Discord Bot] Eingeloggt als ${discordBotClient.user.tag} mit Status ${status}`);
        discordBotClient.user.setStatus(status);
      });

      discordBotClient.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isMentioned = message.mentions.has(discordBotClient.user.id);
        const isDM = message.channel.isDMBased ? message.channel.isDMBased() : (message.channel.type === 1 || message.channel.type === 'DM');

        if (isMentioned || isDM) {
          try {
            message.channel.sendTyping();
            
            const content = message.content.replace(`<@${discordBotClient.user.id}>`, '').replace(`<@!${discordBotClient.user.id}>`, '').trim();

            if (content.toLowerCase().startsWith('!status ')) {
              let newStatus = content.toLowerCase().replace('!status ', '').trim();
              if (newStatus === 'do not disturb') newStatus = 'dnd';
              
              const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
              
              if (validStatuses.includes(newStatus)) {
                discordBotClient.user.setStatus(newStatus);
                currentConfig.discordBotStatus = newStatus;
                
                // Save new status back to Redis
                await redis.set(AI_CONFIG_KEY, JSON.stringify(currentConfig));
                
                await message.reply(`Status erfolgreich auf **${newStatus}** gesetzt.`);
                return;
              } else {
                await message.reply(`Ungültiger Status. Erlaubt sind: online, idle, dnd, invisible`);
                return;
              }
            }

            const systemPrompt = `Du bist ein hilfreicher Assistent für den Koffein-Tracker, der jetzt auch auf Discord agiert. Du beantwortest Fragen zu Koffein, Schlaf, Energie und Getränken auf Deutsch. Sei präzise, freundlich und praxisnah. Aktuell bist du im experimentellen Modus und hast keinen Zugriff auf die individuellen Tracker-Daten der Discord-User.`;

            const fullMessages = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content }
            ];

            const reply = await callOpenRouter(fullMessages);
            await message.reply(reply);
          } catch (err) {
            console.error('[Discord Bot] Fehler beim Verarbeiten:', err);
            await message.reply('Es gab einen Fehler bei der Kommunikation mit der KI.');
          }
        }
      });

      await discordBotClient.login(token);
    } else {
      // Nur Status aktualisieren falls der Bot schon läuft
      if (discordBotClient.user && discordBotClient.user.presence.status !== status) {
        discordBotClient.user.setStatus(status);
      }
    }
  } catch (err) {
    console.error('[Discord Bot] Lifecycle Error:', err);
  }
};

const pollConfig = async () => {
  try {
    const raw = await redis.get(AI_CONFIG_KEY);
    const parsed = safeParse(raw, null);
    
    if (parsed) {
      const tokenChanged = currentConfig.discordBotToken !== parsed.discordBotToken;
      const statusChanged = currentConfig.discordBotStatus !== parsed.discordBotStatus;
      const enabledChanged = currentConfig.discordBotEnabled !== parsed.discordBotEnabled;
      
      currentConfig = { ...currentConfig, ...parsed };
      
      if (tokenChanged || enabledChanged || statusChanged) {
        updateDiscordBotLifecycle(currentConfig.discordBotEnabled, currentConfig.discordBotToken, currentConfig.discordBotStatus);
      }
    }
  } catch (err) {
    console.error('[Bot Redis] Fehler beim Polling:', err.message);
  }
};

// Start Polling Loop
console.log('Starte Discord Bot Service...');
pollConfig(); // Initial fetch
setInterval(pollConfig, 10 * 1000); // Check every 10 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  if (discordBotClient) discordBotClient.destroy();
  redis.quit();
  process.exit(0);
});
process.on('SIGTERM', () => {
  if (discordBotClient) discordBotClient.destroy();
  redis.quit();
  process.exit(0);
});
