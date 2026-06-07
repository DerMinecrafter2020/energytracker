import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Bot } from 'lucide-react';
import { sendAiChat } from '../services/aiApi';

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
      { role: 'assistant', content: 'SYSTEM INITIALIZED.\nKoffein-Assistent online. Warte auf Eingabe...' },
    ];
  });
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const scrollContainerRef    = useRef(null);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages.filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages.slice(1), userMsg].map(({ role, content }) => ({ role, content }));
      let { content: reply, tool_calls } = await sendAiChat({
        messages: history,
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
                await onAddDrink({
                  name: args.name || 'AI Drink',
                  size: Number(args.size) || 0,
                  caffeine: Number(args.caffeine) || 0,
                  icon: args.icon || '🤖'
                });
              }
              actionsPerformed.push('Getränk hinzugefügt.');
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
                  actionsPerformed.push('Getränk gelöscht.');
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
                  actionsPerformed.push('Getränk aktualisiert.');
                } else {
                  setError('Zu aktualisierendes Getränk (ID) nicht gefunden.');
                }
              }
            } catch (e) {
              console.error('Fehler beim Ausführen von update_drink', e);
            }
          }
        }
      }

      if (!reply && actionsPerformed.length > 0) {
        reply = actionsPerformed.join(' ');
      }
      
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
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

  return (
    <div className="glass-card rounded-3xl overflow-hidden animate-fade-in flex flex-col mb-6 h-[600px] border border-white/5 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600/20 to-purple-600/10 border-b border-white/10 shrink-0">
        <Bot className="w-5 h-5 text-violet-400" />
        <span className="text-sm font-bold text-white tracking-wide">KI Konsole</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm custom-scrollbar" ref={scrollContainerRef}>
        {messages.map((msg, i) => (
          <div key={i} className="flex flex-col">
            {msg.role === 'user' ? (
              <div className="text-slate-200">
                <span className="text-violet-400 font-bold opacity-80 mr-2">&gt; USER:</span> 
                {msg.content}
              </div>
            ) : (
              <div className="text-slate-300">
                <span className="text-purple-400 font-bold opacity-80">&gt; ASSISTANT:</span>
                <div className="mt-1 pl-4 whitespace-pre-wrap leading-relaxed border-l-2 border-purple-500/30" dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-violet-400 font-bold flex items-center gap-1">
            <span>&gt;</span>
            <div className="flex gap-1 ml-1">
              <span className="w-2 h-4 bg-violet-400 animate-pulse"></span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-400 font-bold">
            &gt; FEHLER: {error}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 bg-white/5 shrink-0 flex items-center gap-2">
        <span className="text-violet-400 font-bold opacity-80 shrink-0 text-lg leading-none">&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Kommando eingeben..."
          className="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:outline-none focus:ring-0 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="text-violet-400 hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;
