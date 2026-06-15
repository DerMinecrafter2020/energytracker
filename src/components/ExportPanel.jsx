import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { fetchExportLogs } from '../services/api';

const dateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return dateKey(d);
};

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildCsv = (items) => {
  const header = ['ID', 'Name', 'Koffein (mg)', 'Groesse (ml)', 'Datum', 'Erstellt'];
  const rows = items.map((item) => [item.id, item.name, item.caffeine, item.size, item.date, item.createdAt].map(csvValue).join(','));
  return [header.map(csvValue).join(','), ...rows].join('\n');
};

const htmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const renderPrintableHtml = ({ items, summary }) => `
  <!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>Koffein Export</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
        h1 { margin: 0 0 8px; }
        .meta { color: #4b5563; margin-bottom: 24px; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
        .value { font-size: 22px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px; }
        th { background: #f9fafb; }
      </style>
    </head>
    <body>
      <h1>Koffein Export</h1>
      <div class="meta">${htmlEscape(summary.start)} bis ${htmlEscape(summary.end)}</div>
      <div class="cards">
        <div class="card"><div class="value">${summary.logCount}</div><div>Einträge</div></div>
        <div class="card"><div class="value">${summary.totalCaffeine} mg</div><div>Koffein</div></div>
        <div class="card"><div class="value">${summary.totalSize} ml</div><div>Getränke</div></div>
      </div>
      <table>
        <thead>
          <tr><th>Datum</th><th>Name</th><th>Groesse</th><th>Koffein</th></tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${htmlEscape(item.date)}</td>
              <td>${htmlEscape(item.name)}</td>
              <td>${htmlEscape(item.size)} ml</td>
              <td>${htmlEscape(item.caffeine)} mg</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
  </html>
`;

const ExportPanel = ({ userIdentity }) => {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const disabled = !userIdentity?.email || loading;

  const filenameRange = useMemo(() => `${start}-bis-${end}`, [start, end]);

  const loadExport = async () => {
    const data = await fetchExportLogs({ ...userIdentity, start, end });
    return {
      items: Array.isArray(data.items) ? data.items : [],
      summary: data.summary || { start, end, logCount: 0, totalCaffeine: 0, totalSize: 0 },
    };
  };

  const handleCsv = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await loadExport();
      downloadFile(buildCsv(data.items), `koffein-export-${filenameRange}.csv`, 'text/csv;charset=utf-8;');
      setMessage(`${data.summary.logCount} Einträge exportiert.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      setMessage('Popup blockiert. Bitte Popups für diese Seite erlauben.');
      return;
    }

    setLoading(true);
    setMessage('');
    printWindow.document.write('<p style="font-family:Arial;padding:24px">Export wird vorbereitet...</p>');
    try {
      const data = await loadExport();
      printWindow.document.open();
      printWindow.document.write(renderPrintableHtml(data));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      setMessage(`${data.summary.logCount} Einträge für PDF vorbereitet.`);
    } catch (err) {
      printWindow.close();
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-5 sm:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-500/15 border border-slate-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-slate-300" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Export</h2>
          <p className="text-xs text-slate-500">Zeitraum als CSV oder PDF sichern</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-xs text-slate-400">
          Von
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input-dark mt-1 text-sm" />
        </label>
        <label className="text-xs text-slate-400">
          Bis
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input-dark mt-1 text-sm" />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCsv}
          disabled={disabled}
          className="flex-1 rounded-2xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={handlePdf}
          disabled={disabled}
          className="flex-1 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          PDF
        </button>
      </div>

      {message && <p className="text-xs text-slate-500 mt-3">{message}</p>}
    </div>
  );
};

export default ExportPanel;
