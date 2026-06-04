import React from 'react';
import { Zap, Loader2, LogOut, User, ShieldCheck, Settings } from 'lucide-react';

const Header = ({ isAuthenticated, isLoading, session, onLogout, onShowAdminPanel }) => {
  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="glass-card rounded-b-[2rem] sm:rounded-b-[2.5rem] border-x-0 border-t-0 border-white/5 px-4 py-4 sm:py-5 mb-8 sticky top-0 z-30 shadow-glass">
      <div className="max-w-lg mx-auto flex items-center gap-4">
        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
          bg-gradient-to-br from-blue-500 via-blue-400 to-amber-400 shadow-glow-blue animate-glow-pulse">
          <Zap className="w-6 h-6 text-white" fill="currentColor" />
        </div>

        {/* Title + date */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gradient leading-tight tracking-tight">Koffein-Tracker</h1>
          <p className="text-xs sm:text-sm text-slate-400 truncate">{today}</p>
        </div>

        {/* Spinner */}
        {isLoading && (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
        )}

        {/* User badge + logout */}
        {session && (
          <div className="flex items-center gap-2">
            {session.role === 'admin' && onShowAdminPanel && (
              <button
                onClick={onShowAdminPanel}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
                  bg-amber-500/10 border border-amber-500/30 text-amber-300
                  hover:bg-amber-500/20 transition-all"
                aria-label="Zum Admin-Panel wechseln"
                title="Zum Admin-Panel"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">Admin</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
              bg-white/5 border border-white/10">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400 hidden sm:inline">{session.name}</span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-xl text-slate-500 hover:text-red-400
                  hover:bg-red-500/10 transition-all"
                aria-label="Abmelden"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {!isAuthenticated && (
          <p className="text-xs text-slate-600">Verbinde…</p>
        )}
      </div>
    </header>
  );
};

export default Header;
