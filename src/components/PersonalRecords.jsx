import React from 'react';
import { Award, CalendarDays, Coffee, Flame } from 'lucide-react';

const formatMg = (value) => `${Math.round(Number(value) || 0).toLocaleString('de-DE')} mg`;

const RecordTile = ({ icon: Icon, label, value, detail, color = 'blue' }) => {
  const colorClass = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
  }[color] || 'bg-blue-500/10 border-blue-500/20 text-blue-300';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 min-w-0">
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-2 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg font-bold text-white truncate">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {detail && <p className="text-[11px] text-slate-600 mt-1 truncate">{detail}</p>}
    </div>
  );
};

const PersonalRecords = ({ records }) => {
  if (!records) return null;
  const favorite = records.favoriteDrink;
  const maxDay = records.maxCaffeineDay;
  const maxLogged = records.maxLoggedDay;

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
          <Award className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Persoenliche Rekorde</h2>
          <p className="text-xs text-slate-500">Letzte 90 Tage</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <RecordTile
          icon={Flame}
          label="Streak unter Limit"
          value={`${records.currentUnderLimitStreak || 0} Tage`}
          detail={`Bestwert ${records.longestUnderLimitStreak || 0} Tage`}
          color="emerald"
        />
        <RecordTile
          icon={Coffee}
          label="Top-Getraenk"
          value={favorite?.name || 'Noch offen'}
          detail={favorite ? `${favorite.count}x, ${formatMg(favorite.totalCaffeine)}` : 'Mehr tracken fuer Muster'}
          color="amber"
        />
        <RecordTile
          icon={CalendarDays}
          label="Staerkster Tag"
          value={maxDay ? formatMg(maxDay.totalCaffeine) : '0 mg'}
          detail={maxDay?.date || 'Noch keine Daten'}
          color="violet"
        />
        <RecordTile
          icon={Award}
          label="Meiste Eintraege"
          value={`${maxLogged?.count || 0}`}
          detail={maxLogged?.date || 'Noch keine Daten'}
          color="blue"
        />
      </div>
    </div>
  );
};

export default PersonalRecords;
