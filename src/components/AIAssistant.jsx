import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, MessageSquare, GripHorizontal } from 'lucide-react';
import { sendAiChat } from '../services/aiApi';

const DAILY_LIMIT = 400;

// Hilfsfunktion: Markdown ** zu HTML <strong> konvertieren
const parseMarkdown = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
};

const AIAssistant = ({ totalCaffeineToday = 0, logs = [], onAddDrink }) => {
  const [open, setOpen]       = useState(false);
  const [minimized, setMin]   = useState(false);
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
      { role: 'assistant', content: 'Hallo! Ich bin dein Koffein-Assistent. Stell mir Fragen zu Koffein, Schlaf oder Energie – oder frag mich, wie viel du heute noch trinken kannst.' },
    ];
  });
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [width, setWidth]     = useState(384); // w-96 = 384px
  const [height, setHeight]   = useState(480);
  const bottomRef             = useRef(null);
  const containerRef          = useRef(null);

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  // Persist messages to localStorage
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
      // Only send user/assistant messages (not system) to API
      const history = [...messages.slice(1), userMsg].map(({ role, content }) => ({ role, content }));
      let reply = await sendAiChat({
        messages: history,
        totalCaffeineToday,
        logs,
        dailyLimit: DAILY_LIMIT,
      });

      let drinkToAdd = null;
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.action === 'ADD_DRINK') {
            drinkToAdd = parsed;
          }
        } catch (e) {
          console.error('Fehler beim Parsen der AI JSON-Antwort', e);
        }
        // Remove the JSON block from the displayed reply
        reply = reply.replace(/```json\s*([\s\S]*?)\s*```/, '').trim();
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);

      if (drinkToAdd && onAddDrink) {
        // Automatically add the drink
        await onAddDrink({
          name: drinkToAdd.name || 'AI Drink',
          size: Number(drinkToAdd.size) || 0,
          caffeine: Number(drinkToAdd.caffeine) || 0,
          icon: '🤖'
        });
      }
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        title="AI-Assistent öffnen"
      >
        <Bot className="w-7 h-7 text-white" />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 cursor-auto 
        top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        max-md:!w-[90vw] max-md:!max-w-[400px] ${minimized ? 'max-md:!h-[56px]' : 'max-md:!h-[60vh]'}`}
      style={{
        width: minimized ? 288 : `${width}px`,
        height: minimized ? 56 : `${height}px`,
        background: 'linear-gradient(160deg, rgba(30,22,50,0.98), rgba(15,10,30,0.98))',
        border: '1px solid rgba(139,92,246,0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-700/80 to-purple-700/60 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-200" />
          <span className="text-sm font-semibold text-white">Koffein-Assistent</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMin((v) => !v)} className="p-1 rounded hover:bg-white/10 text-violet-300">
            {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10 text-violet-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-white/8 text-slate-200 rounded-bl-sm border border-white/10'}`}
                >
                  {msg.role === 'assistant' ? (
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 border border-white/10 px-4 py-2 rounded-2xl rounded-bl-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-400 text-center px-2">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Frage stellen... (Enter zum Senden)"
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-violet-500/50 transition-colors"
                style={{ maxHeight: '80px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
