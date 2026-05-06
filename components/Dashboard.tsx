import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { Users, MessageSquare, ShieldAlert, Activity, Filter, Check, Calendar } from 'lucide-react';

import { Stats, Chat } from '../types';
import { formatDate } from '../src/utils/dateUtils';

interface DashboardProps {
  stats: Stats | null;
  chats: Chat[];
  selectedChatIds: string[];
  onToggleChatFilter: (id: string) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
  <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex items-start justify-between hover:border-slate-700 transition-all">
    <div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
      <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      <p className={`text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full inline-block ${sub.includes('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
        {sub} <span className="opacity-60 font-medium lowercase">vs prev period</span>
      </p>
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-20 shadow-lg`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ 
  stats, 
  chats, 
  selectedChatIds, 
  onToggleChatFilter,
  dateRange,
  onDateRangeChange
}) => {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Загрузка статистики...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Filter className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Фильтр по чатам</h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Выберите чаты для анализа</p>
              </div>
            </div>
            {selectedChatIds.length > 0 && (
              <button 
                onClick={() => chats.forEach(c => c && selectedChatIds.includes(c.id) && onToggleChatFilter(c.id))}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
              >
                Сбросить фильтр
              </button>
            )}
          </div>
          
          <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {chats.filter(c => c && c.active).map(chat => (
                <button
                  key={chat.id}
                  onClick={() => onToggleChatFilter(chat.id)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    selectedChatIds.includes(chat.id)
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-900/10'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate flex-1 text-left">{chat.title}</span>
                  {selectedChatIds.includes(chat.id) ? (
                    <div className="bg-blue-500 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Период</h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Выберите диапазон дат</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5 block">От</label>
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5 block">До</label>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {(dateRange.start || dateRange.end) && (
              <button 
                onClick={() => onDateRangeChange({ start: '', end: '' })}
                className="w-full py-2 text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all"
              >
                Сбросить даты
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Всего участников" 
          value={stats.totalMembers.toLocaleString()} 
          sub={stats.totalMembersTrend} 
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Сообщений (24ч)" 
          value={stats.totalMessages24h.toLocaleString()} 
          sub={stats.messagesTrend} 
          icon={MessageSquare} 
          color="bg-purple-500" 
        />
        <StatCard 
          title="Действия модерации" 
          value={stats.modActions.toLocaleString()} 
          sub={stats.modActionsTrend} 
          icon={ShieldAlert} 
          color="bg-rose-500" 
        />
        <StatCard 
          title="Активные чаты" 
          value={stats.activeChats.toString()} 
          sub="+0" 
          icon={Activity} 
          color="bg-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Присоединившиеся и вышедшие {dateRange.start && dateRange.end ? `(${formatDate(dateRange.start)} - ${formatDate(dateRange.end)})` : (dateRange.start || dateRange.end ? '' : '(за 7 дней)')}
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatDate(val)} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  labelFormatter={(val) => formatDate(val)}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="joins" fill="#10b981" radius={[4, 4, 0, 0]} name="Присоединились" />
                <Bar dataKey="leaves" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Вышли" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Участники онлайн {dateRange.start && dateRange.end ? `(${formatDate(dateRange.start)} - ${formatDate(dateRange.end)})` : (dateRange.start || dateRange.end ? '' : '(за сутки)')}
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatDate(val)} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  labelFormatter={(val) => formatDate(val)}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="onlineMembers" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 8 }} name="Онлайн" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Всего участников {dateRange.start && dateRange.end ? `(${formatDate(dateRange.start)} - ${formatDate(dateRange.end)})` : (dateRange.start || dateRange.end ? '' : '(по дням)')}
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatDate(val)} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 100', 'auto']} />
                <Tooltip 
                  labelFormatter={(val) => formatDate(val)}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="totalMembers" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 8 }} name="Участники" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            Объем сообщений {dateRange.start && dateRange.end ? `(${formatDate(dateRange.start)} - ${formatDate(dateRange.end)})` : (dateRange.start || dateRange.end ? '' : '(за 7 дней)')}
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatDate(val)} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  labelFormatter={(val) => formatDate(val)}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="msgs" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 8 }} name="Сообщения" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Active Members & Admins Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Топ активных участников
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Пользователь</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Чаты</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Сообщений</th>
                </tr>
              </thead>
              <tbody>
                {stats.topActiveMembers && stats.topActiveMembers.length > 0 ? (
                  stats.topActiveMembers.filter(u => u).map((user, idx) => (
                    <tr key={user.userId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{user.firstName || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-500">{user.username || 'No username'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.chats.filter((c: any) => c).map(chat => (
                            <span key={chat.id} className="px-1.5 py-0.5 bg-slate-800 text-[9px] text-slate-400 border border-slate-700 rounded uppercase font-bold">
                              {chat.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold">
                          {user.msgCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-600 italic text-sm">
                      Нет данных об активности участников
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Топ активных администраторов
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Администратор</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Чаты</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Сообщений</th>
                </tr>
              </thead>
              <tbody>
                {stats.topActiveAdmins && stats.topActiveAdmins.length > 0 ? (
                  stats.topActiveAdmins.filter(u => u).map((user, idx) => (
                    <tr key={user.userId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{user.firstName || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-500">{user.username || 'No username'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {user.chats.filter((c: any) => c).map(chat => (
                            <span key={chat.id} className="px-1.5 py-0.5 bg-slate-800 text-[9px] text-slate-400 border border-slate-700 rounded uppercase font-bold">
                              {chat.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-xs font-bold">
                          {user.msgCount.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-600 italic text-sm">
                      Нет данных об активности администраторов
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top 10 Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Top10Table 
          title="Топ 10 по участникам" 
          data={stats.topChatsByMembers} 
          icon={Users} 
          color="text-blue-500" 
          label="Участников" 
        />
        <Top10Table 
          title="Топ 10 по сообщениям (24ч)" 
          data={stats.topChatsByMessages24h} 
          icon={MessageSquare} 
          color="text-purple-500" 
          label="Сообщений" 
        />
        <Top10Table 
          title="Топ 10 по сообщениям (всего)" 
          data={stats.topChatsByTotalMessages} 
          icon={MessageSquare} 
          color="text-indigo-500" 
          label="Всего" 
        />
        <Top10Table 
          title="Топ 10 по активным (сегодня)" 
          data={stats.topChatsByActiveUsers} 
          icon={Activity} 
          color="text-emerald-500" 
          label="Активных" 
        />
        <Top10Table 
          title="Топ 10 по онлайн (сегодня)" 
          data={stats.topChatsByOnlineUsers} 
          icon={Activity} 
          color="text-blue-400" 
          label="Онлайн" 
        />
      </div>
    </div>
  );
};

interface Top10TableProps {
  title: string;
  data: { id: string; title: string; count: number }[];
  icon: React.ElementType;
  color: string;
  label: string;
}

const Top10Table: React.FC<Top10TableProps> = ({ title, data, icon: Icon, color, label }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full hover:border-slate-700 transition-all">
    <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-950/50 text-slate-500 text-[9px] font-bold uppercase tracking-widest border-b border-slate-800">
            <th className="px-4 py-2 font-bold">Чат</th>
            <th className="px-4 py-2 text-right font-bold">{label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {data && data.length > 0 ? (
            data.filter(item => item).map((item, idx) => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-600 w-5">{idx + 1}.</span>
                    <span className="text-xs font-medium text-slate-300 truncate max-w-[140px] group-hover:text-white transition-colors">
                      {item.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-bold font-mono ${color}`}>
                    {item.count.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-12 text-center text-slate-600 italic text-[10px]">
                Нет данных для отображения
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
