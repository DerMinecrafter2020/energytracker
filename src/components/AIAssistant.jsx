import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Trash2, Brain, RefreshCw, Zap, Activity, Clock, Sparkles } from 'lucide-react';
import { sendAiChat, fetchDailySummary, scheduleDiscordMessage, fetchAiChatHistory, saveAiChatHistory } from '../services/aiApi';

const DAILY_LIMIT = 400;
const CHAT_SYNC_INTERVAL_MS = 5000;
const DEFAULT_MESSAGES = [
  { role: 'assistant', type: 'text', content: 'Hallo! Ich bin dein Koffein-Assistent. Wie kann ich dir heute helfen?' },
];
const legacyStorageKey = 'ai_chat_messages';

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const parseMarkdown = (text) => {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
};

const getStorageKey = (session) => `ai_chat_messages:${String(session?.email || 'anonymous').toLowerCase().trim()}`;
const getLocalDateKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const isDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};
const formatDateLabel = (date) => {
  if (!isDateKey(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('de-DE');
};
const formatLogIds = (logs, selectedDate) => {
  const dateLabel = formatDateLabel(selectedDate) || selectedDate || 'diesem Tag';
  if (!Array.isArray(logs) || logs.length === 0) {
    return `Für ${dateLabel} sind keine Einträge vorhanden, daher gibt es aktuell keine IDs zum Löschen.`;
  }

  return `Hier sind deine Einträge für ${dateLabel} mit IDs:\n${logs.map((log) =>
    `ID ${log.id}: ${log.name} (${log.size} ml, ${log.caffeine} mg Koffein)`
  ).join('\n')}`;
};
const isTodayLogIdsRequest = (text) => {
  const value = String(text || '').toLowerCase();
  const asksForIds = /\bids?\b/.test(value) || value.includes('identifikationsnummer');
  const asksToShow = /(zeig|zeige|anzeigen|liste|auflisten|welche|nenn|gib mir|was sind)/.test(value);
  const mentionsLogs = /(einträg|eintrag|logs?|getränk|getraenk|drinks?|heutig|heute)/.test(value);
  const mentionsAccount = /(user|benutzer|konto|account|profil)/.test(value);
  return asksForIds && asksToShow && (mentionsLogs || !mentionsAccount);
};
const parseToolArguments = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  return JSON.parse(String(value));
};
const toDrinkItems = (toolName, args) => {
  if (toolName === 'add_drinks') {
    const items = Array.isArray(args.drinks) ? args.drinks : (Array.isArray(args.items) ? args.items : []);
    return items.map((item) => ({ ...item, date: item.date || args.date }));
  }
  if (Array.isArray(args.drinks)) return args.drinks.map((item) => ({ ...item, date: item.date || args.date }));
  if (Array.isArray(args.items)) return args.items.map((item) => ({ ...item, date: item.date || args.date }));
  return [args];
};

const DRINK_PATTERNS = [
  { pattern: /\b(monster|monster energy)\b/i, name: 'Monster Energy', size: 500, caffeine: 160, icon: '⚡' },
  { pattern: /\b(red\s*bull|redbull)\b/i, name: 'Red Bull', size: 250, caffeine: 80, icon: '🐂' },
  { pattern: /\b(energy|energydrink|energy-drink)\b/i, name: 'Energy Drink', size: 500, caffeine: 160, icon: '⚡' },
  { pattern: /\b(espresso)\b/i, name: 'Espresso', size: 40, caffeine: 65, icon: '☕' },
  { pattern: /\b(kaffee|cafe|coffee)\b/i, name: 'Kaffee', size: 250, caffeine: 100, icon: '☕' },
  { pattern: /\b(cola|coke|coca cola|coca-cola)\b/i, name: 'Cola', size: 330, caffeine: 32, icon: '🥤' },
  { pattern: /\b(tee|schwarztee|grüner tee|gruener tee)\b/i, name: 'Tee', size: 250, caffeine: 45, icon: '🍵' },
];

const NUMBER_WORDS = {
  ein: 1,
  eine: 1,
  einen: 1,
  einer: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

const addDaysToDateKey = (dateKey, offset) => {
  const [year, month, day] = String(dateKey || getLocalDateKey()).split('-').map(Number);
  const date = new Date(year, month - 1, day || 1);
  date.setDate(date.getDate() + offset);
  return getLocalDateKeyFromDate(date);
};

const getLocalDateKeyFromDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const hasKnownDrink = (text) => DRINK_PATTERNS.some((drink) => drink.pattern.test(text));

const isAddDrinkIntent = (text) => {
  const value = String(text || '').toLowerCase();
  if (value.includes('?') && !/(füge|fuege|hinzu|trag|trage|eintragen|logge|speicher|speichere)/i.test(value)) return false;
  return /(füge|fuege|hinzu|trag|trage|eintragen|logge|speicher|speichere|hatte|habe|hab|trank|getrunken)/i.test(value)
    && /(getränk|getraenk|drink|kaffee|cafe|coffee|monster|red\s*bull|redbull|energy|espresso|cola|tee|mg|ml|koffein|das|es)/i.test(value);
};

const quantityBefore = (segment, index) => {
  const before = segment.slice(Math.max(0, index - 28), index).toLowerCase();
  const numeric = before.match(/(\d+)\s*$/);
  if (numeric) return Math.max(1, Math.min(10, Number(numeric[1]) || 1));
  const word = before.match(/\b(ein|eine|einen|einer|eins|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn)\s*$/);
  return word ? NUMBER_WORDS[word[1]] || 1 : 1;
};

const dateFromSegment = (segment, selectedDate) => {
  const value = String(segment || '').toLowerCase();
  const explicit = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit && isDateKey(explicit[1])) return explicit[1];
  if (/\bvorgestern\b/.test(value)) return addDaysToDateKey(getLocalDateKey(), -2);
  if (/\bgestern\b/.test(value)) return addDaysToDateKey(getLocalDateKey(), -1);
  if (/\bheute\b/.test(value)) return getLocalDateKey();
  if (/\bmorgen\b/.test(value)) return null;
  return isDateKey(selectedDate) ? selectedDate : getLocalDateKey();
};

const splitByDateMarkers = (text, selectedDate) => {
  const source = String(text || '');
  const marker = /\b(heute|gestern|vorgestern|morgen|\d{4}-\d{2}-\d{2})\b/gi;
  const matches = [...source.matchAll(marker)];
  if (matches.length === 0) return [{ text: source, date: isDateKey(selectedDate) ? selectedDate : getLocalDateKey() }];

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end = matches[index + 1]?.index ?? source.length;
    const segment = source.slice(start, end);
    return { text: segment, date: dateFromSegment(segment, selectedDate) };
  });
};

const parseLocalAddDrinks = (text, selectedDate, previousMessages = []) => {
  if (!isAddDrinkIntent(text)) return [];

  let source = text;
  if (/\b(das|es)\b/i.test(text) && !hasKnownDrink(text)) {
    const recentContext = previousMessages
      .slice(-4)
      .map((message) => message.content || message.summary || '')
      .join('\n');
    source = `${recentContext}\n${text}`;
  }

  const items = [];
  for (const segment of splitByDateMarkers(source, selectedDate)) {
    if (!segment.date) continue;
    for (const drink of DRINK_PATTERNS) {
      const match = segment.text.match(drink.pattern);
      if (!match) continue;
      const sizeMatch = segment.text.match(/(\d{2,4})\s*ml/i);
      const caffeineMatch = segment.text.match(/(\d{1,4})\s*mg/i);
      const quantity = quantityBefore(segment.text, match.index || 0);
      for (let i = 0; i < quantity; i += 1) {
        items.push({
          name: drink.name,
          size: sizeMatch ? Number(sizeMatch[1]) : drink.size,
          caffeine: caffeineMatch ? Number(caffeineMatch[1]) : drink.caffeine,
          icon: drink.icon,
          date: segment.date,
        });
      }
    }
  }

  if (items.length === 0 && hasKnownDrink(source)) {
    const fallbackDate = dateFromSegment(source, selectedDate);
    if (fallbackDate) {
      for (const drink of DRINK_PATTERNS) {
        const match = source.match(drink.pattern);
        if (!match) continue;
        const sizeMatch = source.match(/(\d{2,4})\s*ml/i);
        const caffeineMatch = source.match(/(\d{1,4})\s*mg/i);
        const quantity = quantityBefore(source, match.index || 0);
        for (let i = 0; i < quantity; i += 1) {
          items.push({
            name: drink.name,
            size: sizeMatch ? Number(sizeMatch[1]) : drink.size,
            caffeine: caffeineMatch ? Number(caffeineMatch[1]) : drink.caffeine,
            icon: drink.icon,
            date: fallbackDate,
          });
        }
      }
    }
  }

  return items.slice(0, 20);
};

const loadLocalMessages = (storageKey) => {
  try {
    for (const key of [storageKey, legacyStorageKey]) {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading chat messages:', e);
  }
  return DEFAULT_MESSAGES;
};

const sameMessages = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

const AIAssistant = ({
  session,
  selectedDate,
  totalCaffeineToday = 0,
  logs = [],
  onAddDrink,
  onDeleteDrink,
  onUpdateDrink,
  primary = false,
  contextSummary,
}) => {
  const storageKey = getStorageKey(session);
  const userIdentity = { userId: session?.id || null, email: session?.email || null };
  const [messages, setMessages] = useState(() => loadLocalMessages(storageKey));
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(messages);
  const loadingRef = useRef(false);
  const remoteLoadedRef = useRef(false);
  const skipNextRemoteSaveRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef(null);

  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      localStorage.removeItem(legacyStorageKey);
    } catch (e) {
      console.error('Error saving chat messages:', e);
    }

    if (!userIdentity.email || !remoteLoadedRef.current) return undefined;
    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const data = await saveAiChatHistory({ ...userIdentity, messages });
        if (data?.updatedAt) lastRemoteUpdatedAtRef.current = data.updatedAt;
      } catch (e) {
        console.error('Error syncing chat messages:', e);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [messages, storageKey, userIdentity.userId, userIdentity.email]);

  useEffect(() => {
    if (!userIdentity.email) return undefined;
    let cancelled = false;

    const syncFromServer = async ({ initial = false } = {}) => {
      if (!initial && loadingRef.current) return;
      try {
        const data = await fetchAiChatHistory(userIdentity);
        if (cancelled) return;

        if (data?.updatedAt && data.updatedAt !== lastRemoteUpdatedAtRef.current) {
          const remoteMessages = Array.isArray(data.messages) && data.messages.length > 0 ? data.messages : DEFAULT_MESSAGES;
          lastRemoteUpdatedAtRef.current = data.updatedAt;
          if (!sameMessages(remoteMessages, messagesRef.current)) {
            skipNextRemoteSaveRef.current = true;
            setMessages(remoteMessages);
          }
        } else if (initial && !data?.updatedAt) {
          const saved = await saveAiChatHistory({ ...userIdentity, messages: messagesRef.current });
          if (saved?.updatedAt) lastRemoteUpdatedAtRef.current = saved.updatedAt;
        }
      } catch (e) {
        console.error('Error loading synced chat messages:', e);
      } finally {
        if (!cancelled) remoteLoadedRef.current = true;
      }
    };

    syncFromServer({ initial: true });
    const interval = window.setInterval(() => syncFromServer(), CHAT_SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userIdentity.userId, userIdentity.email]);

  const handleFetchSummary = async () => {
    setSummaryLoading(true);
    setLoading(true);
    
    const userMsg = { role: 'user', type: 'text', content: 'Erstelle eine KI-Tagesauswertung meines Koffeinkonsums.' };
    setMessages(prev => [...prev, userMsg]);

    try {
      const data = await fetchDailySummary({ logs, totalCaffeine: totalCaffeineToday, dailyLimit: DAILY_LIMIT, selectedDate });
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        type: 'daily_summary', 
        summary: data.summary 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        type: 'text', 
        content: `Fehler bei der Auswertung: ${err.message}` 
      }]);
    } finally {
      setSummaryLoading(false);
      setLoading(false);
    }
  };

  const executeAddDrinkItems = async (drinkItems) => {
    const actions = [];
    if (!onAddDrink || !Array.isArray(drinkItems) || drinkItems.length === 0) return actions;

    for (const item of drinkItems) {
      const targetDate = isDateKey(item.date) ? item.date : (isDateKey(selectedDate) ? selectedDate : getLocalDateKey());
      const addedDrink = await onAddDrink({
        name: item.name || 'Getränk',
        size: Number(item.size) || 0,
        caffeine: Number(item.caffeine) || 0,
        icon: item.icon || '🤖',
        date: targetDate,
      });

      if (addedDrink) {
        actions.push({ type: 'drink_added', drink: addedDrink, date: addedDrink.date || targetDate });
      } else {
        actions.push({ type: 'text', content: `Getränk für ${formatDateLabel(targetDate) || targetDate} hinzugefügt.` });
      }
    }

    return actions;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', type: 'text', content: text };
    if (isTodayLogIdsRequest(text)) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: 'assistant', type: 'text', content: formatLogIds(logs, selectedDate) },
      ]);
      return;
    }

    const localDrinkItems = parseLocalAddDrinks(text, selectedDate, messages);
    if (localDrinkItems.length > 0) {
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const actionsPerformed = await executeAddDrinkItems(localDrinkItems);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', type: 'text', content: `${actionsPerformed.length} Eintrag${actionsPerformed.length === 1 ? '' : 'e'} hinzugefügt.` },
          ...actionsPerformed.map((action) => ({ role: 'assistant', ...action })),
        ]);
      } catch (err) {
        setError(err.message || 'Fehler beim Hinzufügen.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const historyForApi = [...messages.filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0), userMsg]
      .filter(m => m.type !== 'drink_added') // AI expects text history
      .map(({ role, content }) => ({ role, content: content || '' }));
      
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      let { content: reply, tool_calls } = await sendAiChat({
        messages: historyForApi,
        totalCaffeineToday,
        logs,
        selectedDate,
        dailyLimit: DAILY_LIMIT,
      });

      let actionsPerformed = [];

      if (tool_calls && tool_calls.length > 0) {
        for (const call of tool_calls) {
          const toolName = call.function?.name || call.name;
          const toolArguments = call.function?.arguments || call.arguments;
          if (toolName === 'add_drink' || toolName === 'add_drinks') {
            try {
              const args = parseToolArguments(toolArguments);
              const drinkItems = toDrinkItems(toolName, args);
              if (onAddDrink && drinkItems.length > 0) {
                actionsPerformed.push(...await executeAddDrinkItems(drinkItems));
              }
            } catch (e) {
              console.error('Fehler beim Ausführen von add_drink/add_drinks', e);
            }
          } else if (toolName === 'delete_drink') {
            try {
              const args = parseToolArguments(toolArguments);
              if (onDeleteDrink) {
                const match = logs.find(l => String(l.id) === String(args.id));
                if (match) {
                  await onDeleteDrink(match.id);
                  actionsPerformed.push({ type: 'text', content: `Getränk "${match.name}" gelöscht.` });
                } else {
                  setError('Zu löschendes Getränk (ID) nicht gefunden.');
                }
              }
            } catch (e) {
              console.error('Fehler beim Ausführen von delete_drink', e);
            }
          } else if (toolName === 'update_drink') {
            try {
              const args = parseToolArguments(toolArguments);
              if (onUpdateDrink) {
                const match = logs.find(l => String(l.id) === String(args.id));
                if (match) {
                  await onUpdateDrink(match.id, {
                    name: args.name || match.name,
                    size: args.size ? Number(args.size) : match.size,
                    caffeine: args.caffeine ? Number(args.caffeine) : match.caffeine,
                    icon: args.icon || match.icon
                  });
                  actionsPerformed.push({ type: 'text', content: `Getränk "${match.name}" aktualisiert.` });
                } else {
                  setError('Zu aktualisierendes Getränk (ID) nicht gefunden.');
                }
              }
            } catch (e) {
              console.error('Fehler beim Ausführen von update_drink', e);
            }
          } else if (toolName === 'schedule_discord_message') {
            try {
              const args = parseToolArguments(toolArguments);
              const data = await scheduleDiscordMessage(args.time, args.message);
              if (data && data.success) {
                actionsPerformed.push({ type: 'discord_scheduled', time: args.time, message: args.message });
              }
            } catch (e) {
              console.error('Fehler beim Einplanen der Discord-Nachricht', e);
              setError('Fehler beim Einplanen der Discord-Nachricht: ' + e.message);
            }
          }
        }
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        if (reply) {
          newMsgs.push({ role: 'assistant', type: 'text', content: reply });
        }
        actionsPerformed.forEach(action => {
          newMsgs.push({ role: 'assistant', ...action });
        });
        // Fallback if AI did something but returned no message
        if (!reply && actionsPerformed.length === 0) {
          newMsgs.push({ role: 'assistant', type: 'text', content: 'Aktion ausgeführt.' });
        }
        return newMsgs;
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedDateLabel = formatDateLabel(selectedDate) || selectedDate || 'dem gewaehlten Tag';
  const quickPrompts = [
    `Analysiere ${selectedDateLabel} und sag mir, was ich verbessern kann.`,
    `Zeig mir die IDs der Eintraege fuer ${selectedDateLabel}.`,
    `Fuege fuer ${selectedDateLabel} einen Kaffee mit 250 ml und 100 mg Koffein hinzu.`,
  ];

  const usePrompt = (prompt) => {
    setInput(prompt);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleDeleteAddedDrink = async (drinkId, index) => {
    if (onDeleteDrink) {
      await onDeleteDrink(drinkId);
      setMessages(prev => prev.map((msg, i) => 
        i === index 
          ? { role: 'assistant', type: 'text', content: `Getränk "${msg.drink?.name || ''}" wurde entfernt.` } 
          : msg
      ));
    }
  };

  return (
    <div className={`glass-card overflow-hidden animate-fade-in flex flex-col shadow-glass flex-shrink-0 ${
      primary
        ? 'rounded-[1.25rem] sm:rounded-[1.5rem] min-h-[460px] h-[72svh] sm:min-h-[620px] sm:h-[calc(100vh-10.5rem)] max-h-[860px]'
        : 'rounded-[1.5rem] sm:rounded-[2rem] mb-6 h-[560px] sm:h-[650px]'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-violet-600/30 to-purple-600/20 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shadow-inner shrink-0">
            <Bot className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-violet-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {primary ? 'AI Chat' : 'KI-Assistent'}
            </h2>
            <p className="text-xs text-violet-300/80 truncate max-w-[52vw] sm:max-w-none">
              {contextSummary || 'Synchronisiert und aktionsfaehig'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleFetchSummary}
          disabled={summaryLoading}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-violet-300 text-sm font-medium transition-all shadow-sm border border-white/5 shrink-0"
          aria-label="Tagesanalyse erstellen"
        >
          {summaryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          <span className="hidden sm:inline">Tagesanalyse</span>
        </button>
      </div>



      {/* Chat Messages */}
      <div className={`${primary ? 'p-3 sm:p-6' : 'p-4 sm:p-6'} flex-1 overflow-y-auto space-y-4 sm:space-y-6 text-sm custom-scrollbar bg-black/10`} ref={scrollContainerRef}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          
          if (msg.type === 'drink_added' && msg.drink) {
            return (
              <div key={i} className="flex justify-start w-full animate-fade-in">
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-3 sm:p-4 max-w-[94%] sm:max-w-[75%] shadow-sm">
                  <div className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> KI hat ein Getränk hinzugefügt
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-black/20 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl shrink-0">{msg.drink.icon}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-base">{msg.drink.name}</div>
                        <div className="text-xs text-slate-400">{msg.drink.size} ml • {msg.drink.caffeine} mg Koffein</div>
                        {msg.date && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{formatDateLabel(msg.date) || msg.date}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAddedDrink(msg.drink.id, i)}
                      className="self-end sm:self-auto p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eintrag löschen"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === 'daily_summary' && msg.summary) {
            return (
              <div key={i} className="flex justify-start w-full animate-fade-in">
                <div className="bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-4 sm:p-5 max-w-[94%] sm:max-w-[85%] shadow-sm">
                  <div className="text-sm font-bold text-violet-300 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Deine KI-Tagesauswertung
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {typeof msg.summary === 'string' ? msg.summary.replace(/^#+\s*/gm, '').replace(/\*\*/g, '') : (msg.summary?.content || JSON.stringify(msg.summary)).replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === 'discord_scheduled' && msg.time && msg.message) {
            return (
              <div key={i} className="flex justify-start w-full animate-fade-in">
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-2xl p-3 sm:p-4 max-w-[94%] sm:max-w-[75%] shadow-sm">
                  <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Discord-Nachricht geplant für {msg.time} Uhr
                  </div>
                  <div className="bg-black/20 rounded-xl p-3">
                    <div className="text-sm text-slate-200 italic">
                      "{msg.message}"
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`max-w-[92%] sm:max-w-[75%] rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm
                ${isUser 
                  ? 'bg-violet-600 text-white rounded-br-sm' 
                  : 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm'}`}
              >
                <div 
                  className="whitespace-pre-wrap leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: isUser ? escapeHtml(msg.content) : parseMarkdown(msg.content || '') }}
                />
              </div>
            </div>
          );
        })}
        
        {loading && (
          <div className="flex justify-start w-full">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex justify-center w-full my-2">
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-xl text-center">
              Fehler: {error}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-white/5 border-t border-white/10 shrink-0">
        {primary && (
          <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => usePrompt(prompt)}
                className="inline-flex items-center gap-1.5 shrink-0 max-w-[78vw] sm:max-w-none rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                <span className="truncate">{prompt}</span>
              </button>
            ))}
          </div>
        )}
        <div className="relative flex items-center">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={primary ? 'Frag die KI oder steuere deine Eintraege...' : 'Kommando oder Frage eingeben...'}
            className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 rounded-2xl pl-4 sm:pl-5 pr-14 py-3.5 sm:py-4 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none custom-scrollbar"
            rows="1"
            style={{ minHeight: '52px', maxHeight: '112px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 p-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 disabled:text-white/30 text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
