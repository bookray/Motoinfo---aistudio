import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Terminal, Clock, Filter } from 'lucide-react';
import { formatDateTime } from '../src/utils/dateUtils';

interface LogsProps {
  logs: LogEntry[];
}

export const Logs: React.FC<LogsProps> = ({ logs }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'BAN': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'KICK': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'WARN': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'JOIN': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'LEAVE': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'SYSTEM': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'BROADCAST': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'SETTINGS': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'AUTH': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      default: return 'text-slate-400';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!log) return false;
    const matchesFilter = filter === 'ALL' || log.type === filter;
    const matchesSearch = !search || 
      log.user.toLowerCase().includes(search.toLowerCase()) || 
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.chat.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const logTypes = ['ALL', 'JOIN', 'LEAVE', 'BAN', 'KICK', 'WARN', 'MUTE', 'SYSTEM', 'BROADCAST', 'SETTINGS', 'AUTH', 'CHAT_UPDATE', 'TASK'];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5" /> События в реальном времени
            </h2>
            
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
                    >
                        {logTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                
                <input 
                    type="text"
                    placeholder="Поиск по логам..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 font-mono text-sm p-4 space-y-2 shadow-inner custom-scrollbar">
            {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                    <Clock className="w-8 h-8 mb-2 opacity-50" />
                    <p>{logs.length === 0 ? 'Логов пока нет...' : 'Ничего не найдено по фильтрам'}</p>
                </div>
            ) : (
                filteredLogs.map((log) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 hover:bg-slate-900 rounded border-b border-slate-900 last:border-0 transition-colors group">
                        <span className="text-slate-500 whitespace-nowrap text-[10px] w-32">{formatDateTime(log.timestamp)}</span>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] border uppercase font-bold tracking-wider w-24 text-center ${getBadgeColor(log.type)}`}>
                            {log.type}
                        </span>
                        <div className="flex-1 flex gap-2 overflow-hidden">
                            <span className="text-blue-400 font-medium shrink-0">@{log.user}</span>
                            <span className="text-slate-400 truncate group-hover:whitespace-normal group-hover:overflow-visible">{log.details}</span>
                        </div>
                        <span className="text-slate-600 text-[10px] shrink-0">ID: {log.chat}</span>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};
