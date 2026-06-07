import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Trash2, Brain, RefreshCw, Zap, Activity, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { sendAiChat, fetchDailySummary, scheduleDiscordMessage } from '../services/aiApi';

const DAILY_LIMIT = 400;

const parseMarkdown = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
};

const AIAssistant = ({ totalCaffeineToday = 0, logs = [], onAddDrink, onDeleteDrink, onUpdateDrink }) => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading chat messages:', e);
    }
    return [
      { role: 'assistant', type: 'text', content: 'Hallo! Ich bin dein Koffein-Assistent. Wie kann ich dir heute helfen?' },
    ];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollContainerRef = useRef(null);

  // Daily Summary State
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('ai_chat_messages', JSON.stringify(messages));
    } catch (e) {
      console.error('Error saving chat messages:', e);
    }
  }, [messages]);

  const handleFetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError('');
    setShowSummary(true);
    try {
      const data = await fetchDailySummary({ logs, totalCaffeine: totalCaffeineToday, dailyLimit: DAILY_LIMIT });
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', type: 'text', content: text };
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
        dailyLimit: DAILY_LIMIT,
      });

      let actionsPerformed = [];

      if (tool_calls && tool_calls.length > 0) {
        for (const call of tool_calls) {
          if (call.function.name === 'add_drink') {
            try {
              const args = JSON.parse(call.function.arguments);
              if (onAddDrink) {
                const addedDrink = await onAddDrink({
                  name: args.name || 'AI Drink',
                  size: Number(args.size) || 0,
                  caffeine: Number(args.caffeine) || 0,
                  icon: args.icon || '🤖'
                });
                
                if (addedDrink) {
                  actionsPerformed.push({ type: 'drink_added', drink: addedDrink });
                } else {
                  actionsPerformed.push({ type: 'text', content: 'Getränk hinzugefügt.' });
                }
              }
            } catch (e) {
              console.error('Fehler beim Ausführen von add_drink', e);
            }
          } else if (call.function.name === 'delete_drink') {
            try {
              const args = JSON.parse(call.function.arguments);
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
          } else if (call.function.name === 'update_drink') {
            try {
              const args = JSON.parse(call.function.arguments);
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
          } else if (call.function.name === 'schedule_discord_message') {
            try {
              const args = JSON.parse(call.function.arguments);
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
    <div className="glass-card rounded-[2rem] overflow-hidden animate-fade-in flex flex-col mb-6 h-[650px] shadow-glass flex-shrink-0">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600/30 to-purple-600/20 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shadow-inner">
            <Bot className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">KI-Assistent</h2>
            <p className="text-xs text-violet-300/70">Powered by AI</p>
          </div>
        </div>
        
        <button 
          onClick={handleFetchSummary}
          disabled={summaryLoading}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-violet-300 text-sm font-medium transition-all shadow-sm border border-white/5"
        >
          {summaryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          <span className="hidden sm:inline">Tagesanalyse</span>
        </button>
      </div>

      {/* Daily Summary Panel */}
      {showSummary && (
        <div className="bg-violet-900/20 border-b border-white/5 p-4 shrink-0 animate-fade-in relative">
          <button onClick={() => setShowSummary(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <ChevronUp className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Aktuelle Auswertung</h3>
          </div>
          
          {summaryError && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-xl p-3 flex justify-between items-center">
              <span>{summaryError}</span>
              <button onClick={handleFetchSummary} className="underline font-medium">Erneut</button>
            </div>
          )}
          
          {summary && !summaryError && (
            <div className="space-y-3">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {summary.summary.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}
              </p>
              <div className="flex justify-end">
                <button onClick={handleFetchSummary} className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Aktualisieren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm custom-scrollbar bg-black/10" ref={scrollContainerRef}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          
          if (msg.type === 'drink_added' && msg.drink) {
            return (
              <div key={i} className="flex justify-start w-full animate-fade-in">
                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 max-w-[85%] sm:max-w-[75%] shadow-sm">
                  <div className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> KI hat ein Getränk hinzugefügt
                  </div>
                  <div className="flex items-center justify-between gap-4 bg-black/20 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{msg.drink.icon}</div>
                      <div>
                        <div className="font-bold text-white text-base">{msg.drink.name}</div>
                        <div className="text-xs text-slate-400">{msg.drink.size} ml • {msg.drink.caffeine} mg Koffein</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAddedDrink(msg.drink.id, i)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eintrag löschen"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === 'discord_scheduled' && msg.time && msg.message) {
            return (
              <div key={i} className="flex justify-start w-full animate-fade-in">
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-2xl p-4 max-w-[85%] sm:max-w-[75%] shadow-sm">
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
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm
                ${isUser 
                  ? 'bg-violet-600 text-white rounded-br-sm' 
                  : 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm'}`}
              >
                <div 
                  className="whitespace-pre-wrap leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: isUser ? msg.content : parseMarkdown(msg.content || '') }} 
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
      <div className="p-4 bg-white/5 border-t border-white/10 shrink-0">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Kommando oder Frage eingeben..."
            className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none custom-scrollbar"
            rows="1"
            style={{ minHeight: '56px', maxHeight: '120px' }}
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
