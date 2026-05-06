
import React, { useState } from 'react';
import { 
  ShieldAlert, UserX, UserCheck, Search, Filter, 
  ExternalLink, Ban, Trash2, Eye, EyeOff, UserPlus,
  Clock, MessageSquareOff
} from 'lucide-react';
import { GlobalBan, MultiChatUser, WhitelistEntry, LatestMember, Chat, ChatBan } from '../types';
import { formatDate, formatDateTime } from '../src/utils/dateUtils';

interface AntiScamProps {
  bans: GlobalBan[];
  chatBans: ChatBan[];
  onBan: (userId: string, reason: string) => void;
  onUnban: (userId: string) => void;
  onUnbanChat: (id: string) => void;
  multiChatUsers: MultiChatUser[];
  latestMembers: LatestMember[];
  whitelist: WhitelistEntry[];
  onWhitelist: (userId: string) => void;
  onRemoveFromWhitelist: (userId: string) => void;
  chats: Chat[];
}

export const AntiScam: React.FC<AntiScamProps> = ({ 
  bans, chatBans, onBan, onUnban, onUnbanChat, multiChatUsers, latestMembers, whitelist, onWhitelist, onRemoveFromWhitelist, chats
}) => {
  const [banInput, setBanInput] = useState('');
  const [banReason, setBanReason] = useState('Подозрение в мошенничестве');
  const [searchQuery, setSearchQuery] = useState('');
  const [minChats, setMinChats] = useState(2);
  const [showWhitelisted, setShowWhitelisted] = useState(false);
  const [hideBanned, setHideBanned] = useState(true);

  // Per-chat ban state
  const [chatBanInput, setChatBanInput] = useState('');
  const [chatBanReason, setChatBanReason] = useState('Нарушение правил чата');
  const [chatBanDuration, setChatBanDuration] = useState(1);
  const [chatBanUnit, setChatBanUnit] = useState<'days' | 'hours' | 'minutes'>('days');
  const [chatBanType, setChatBanType] = useState<'BAN' | 'MUTE'>('BAN');
  const [selectedChatId, setSelectedChatId] = useState('');

  const [loadingBans, setLoadingBans] = useState(false);

  const handleManualBan = () => {
    if (!banInput.trim()) return;
    onBan(banInput.trim(), banReason);
    setBanInput('');
  };

  const handleChatBan = async () => {
    if (!chatBanInput.trim() || !selectedChatId) return;
    try {
      const res = await fetch('/api/bans/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: chatBanInput.trim(),
          chatId: selectedChatId,
          reason: chatBanReason,
          duration: chatBanDuration,
          unit: chatBanUnit,
          type: chatBanType
        })
      });
      if (res.ok) {
        setChatBanInput('');
        setChatBanReason('Нарушение правил чата');
      } else {
        const err = await res.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
        console.error(`Error: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMultiUsers = multiChatUsers.filter(user => {
    const matchesSearch = 
      user.userId.includes(searchQuery) || 
      (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesMinChats = (user.chats?.length || 0) >= minChats;
    const matchesWhitelist = showWhitelisted || !user.isWhitelisted;
    const matchesBanned = !hideBanned || !user.isBanned;

    return matchesSearch && matchesMinChats && matchesWhitelist && matchesBanned;
  });

  const activeChatBans = chatBans.filter(b => b && new Date(b.untilDate) > new Date());

  return (
    <div className="space-y-8">
      {/* Per-Chat Ban Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Ban className="w-5 h-5 text-orange-500" />
          </div>
          <h3 className="text-lg font-bold text-white">Мут и бан</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Действие</label>
              <select 
                value={chatBanType}
                onChange={(e) => setChatBanType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              >
                <option value="BAN">Бан</option>
                <option value="MUTE">Мут</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ID или @username</label>
              <input 
                type="text" 
                value={chatBanInput}
                onChange={(e) => setChatBanInput(e.target.value)}
                placeholder="123456789 или @username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Причина</label>
              <input 
                type="text" 
                value={chatBanReason}
                onChange={(e) => setChatBanReason(e.target.value)}
                placeholder="Причина бана"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Время</label>
                <input 
                  type="number" 
                  value={chatBanDuration}
                  onChange={(e) => setChatBanDuration(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">&nbsp;</label>
                <select 
                  value={chatBanUnit}
                  onChange={(e) => setChatBanUnit(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-xs"
                >
                  <option value="days">Дни</option>
                  <option value="hours">Часы</option>
                  <option value="minutes">Мин</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Чат</label>
              <select 
                value={selectedChatId}
                onChange={(e) => setSelectedChatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              >
                <option value="">Выберите чат...</option>
                {chats.filter(c => c && c.active).map(chat => (
                  <option key={chat.id} value={chat.id}>{chat.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              onClick={handleChatBan}
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-orange-900/20 flex items-center gap-2"
            >
              <Ban className="w-5 h-5" /> Выполнить
            </button>
          </div>
        </div>

        {/* Active Bans/Mutes List */}
        <div className="p-6 border-t border-slate-800">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Список активных ограничений</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Пользователь</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Чат</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Тип</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Причина</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">До</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Действие</th>
                </tr>
              </thead>
              <tbody>
                {loadingBans ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">Загрузка...</td>
                  </tr>
                ) : activeChatBans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">Нет активных ограничений</td>
                  </tr>
                ) : (
                  activeChatBans.map(ban => (
                    <tr key={ban.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-300 font-mono">{ban.userId}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{ban.chatTitle}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          ban.type === 'BAN' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {ban.type === 'BAN' ? 'Бан' : 'Мут'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-400">{ban.reason}</td>
                      <td className="py-3 px-4 text-sm text-slate-400">
                        {formatDateTime(ban.untilDate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button 
                          onClick={() => onUnbanChat(ban.id)}
                          className="p-2 text-slate-500 hover:text-white transition-colors"
                          title="Снять ограничение"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Ban Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 rounded-lg">
            <UserX className="w-5 h-5 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-white">Глобальный бан-лист</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ID или @username</label>
              <input 
                type="text" 
                value={banInput}
                onChange={(e) => setBanInput(e.target.value)}
                placeholder="123456789 или @username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Причина</label>
              <input 
                type="text" 
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Причина бана"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleManualBan}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2"
              >
                <Ban className="w-5 h-5" /> Забанить глобально
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Список заблокированных ({bans.length})
            </h4>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {bans.length === 0 ? (
                <div className="text-center py-8 text-slate-600 italic bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                  Список пуст
                </div>
              ) : (
                bans.filter(b => b).map(ban => (
                  <div key={ban.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-800">
                        {ban.userId.startsWith('@') ? '@' : 'ID'}
                      </div>
                      <div>
                        <p className="font-mono text-blue-400 font-bold">{ban.userId}</p>
                        <p className="text-xs text-slate-500">{ban.reason} • {formatDate(ban.date)}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onUnban(ban.userId)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                      title="Разбанить"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Chat Users Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Пользователи в нескольких чатах</h3>
              <p className="text-xs text-slate-500">Анализ активности подозрительных аккаунтов</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-400">Мин. чатов:</span>
              <input 
                type="number"
                min="2"
                value={minChats}
                onChange={(e) => setMinChats(parseInt(e.target.value) || 2)}
                className="w-12 bg-transparent border-none text-xs text-blue-400 font-bold focus:outline-none"
              />
            </div>

            <button 
              onClick={() => setShowWhitelisted(!showWhitelisted)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                showWhitelisted 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' 
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {showWhitelisted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showWhitelisted ? 'Показывать белые списки' : 'Скрывать белые списки'}
            </button>

            <button 
              onClick={() => setHideBanned(!hideBanned)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                hideBanned 
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-600/30' 
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {hideBanned ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {hideBanned ? 'Скрывать забаненых' : 'Показывать забаненых'}
            </button>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-4">Пользователь</th>
                <th className="px-6 py-4">Чаты</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredMultiUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic">
                    Пользователей не найдено
                  </td>
                </tr>
              ) : (
                filteredMultiUsers.filter(u => u).map(user => (
                  <tr key={user.userId} className={`hover:bg-slate-800/30 transition-colors ${user.isWhitelisted ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                          {user.firstName ? user.firstName[0] : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{user.firstName || 'Unknown'}</p>
                          <p className="text-xs font-mono text-blue-400">{user.username || user.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {user.chats.filter((c: any) => c).map((chat: any) => (
                          <span key={chat.id} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                            {chat.title}
                          </span>
                        ))}
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600/20 text-[10px] text-blue-400 border border-blue-600/30 font-bold">
                          Всего: {user.chats.length}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {user.isBanned && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                            <Ban className="w-3 h-3" /> ЗАБАНЕН
                          </span>
                        )}
                        {user.isWhitelisted && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                            <UserCheck className="w-3 h-3" /> В БЕЛОМ СПИСКЕ
                          </span>
                        )}
                        {!user.isBanned && !user.isWhitelisted && (
                          <span className="text-[10px] text-slate-500 font-medium italic">Чист</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.isBanned && (
                          <button 
                            onClick={() => onBan(user.userId, 'Обнаружен в нескольких чатах')}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                            title="Забанить глобально"
                          >
                            <Ban className="w-5 h-5" />
                          </button>
                        )}
                        
                        {user.isWhitelisted ? (
                          <button 
                            onClick={() => onRemoveFromWhitelist(user.userId)}
                            className="p-2 text-emerald-400 bg-emerald-400/10 rounded-lg transition-all"
                            title="Убрать из белого списка"
                          >
                            <UserCheck className="w-5 h-5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => onWhitelist(user.userId)}
                            className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                            title="Добавить в белый список"
                          >
                            <UserPlus className="w-5 h-5" />
                          </button>
                        )}
                        
                        <a 
                          href={`tg://user?id=${user.userId}`}
                          className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          title="Открыть в Telegram"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latest Joined Members Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-8">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <UserPlus className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Последние присоединившиеся</h3>
            <p className="text-xs text-slate-500">Список недавно вступивших участников во все чаты</p>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-4">Пользователь</th>
                <th className="px-6 py-4">Чат</th>
                <th className="px-6 py-4">Дата вступления</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {latestMembers && latestMembers.length > 0 ? (
                latestMembers.filter(m => m).map(member => (
                  <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 font-bold border border-slate-700 text-xs">
                          {member.firstName ? member.firstName[0] : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{member.firstName || 'Unknown'}</p>
                          <p className="text-[10px] font-mono text-blue-400">{member.username || member.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                        {member.chatTitle}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatDateTime(member.joinedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => onBan(member.userId, 'Подозрительная активность при вступлении')}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                          title="Забанить глобально"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <a 
                          href={`tg://user?id=${member.userId}`}
                          className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          title="Открыть в Telegram"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic">
                    Нет данных о новых участниках
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
