import React, { useState } from 'react';
import { Chat } from '../types';
import { Settings, Trash2, Users, Clock, CheckCircle, Power, PowerOff, Shield, X, Plus } from 'lucide-react';

interface ChatListProps {
  chats: Chat[];
  onUpdateChat: (chat: Chat) => void;
  onRemoveChat: (id: string) => void;
  onAddChat: (id: string) => void;
}

export const ChatList: React.FC<ChatListProps> = ({ chats, onUpdateChat, onRemoveChat, onAddChat }) => {
  const [newChatId, setNewChatId] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [newWord, setNewWord] = useState('');

  const handleToggleActive = (chat: Chat) => {
    onUpdateChat({ ...chat, active: !chat.active });
  };

  const handleUpdateSetting = (chat: Chat, key: keyof Chat, value: any) => {
    onUpdateChat({ ...chat, [key]: value });
  };

  const handleAddWord = (chat: Chat, e: React.FormEvent) => {
    e.preventDefault();
    const currentWords = chat.forbiddenWords || [];
    if (newWord && !currentWords.includes(newWord)) {
      onUpdateChat({
        ...chat,
        forbiddenWords: [...currentWords, newWord]
      });
      setNewWord('');
    }
  };

  const handleRemoveWord = (chat: Chat, word: string) => {
    onUpdateChat({
      ...chat,
      forbiddenWords: (chat.forbiddenWords || []).filter(w => w !== word)
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChatId) {
      onAddChat(newChatId);
      setNewChatId('');
    }
  };

  // Sort chats: active first, then by title
  const sortedChats = chats.filter(c => c).sort((a, b) => {
    if (a.active === b.active) return (a.title || '').localeCompare(b.title || '');
    return a.active ? -1 : 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <h2 className="text-lg font-semibold text-white">Управляемые чаты</h2>
        <form onSubmit={handleAddSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Введите ID чата (-100...)"
            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            value={newChatId}
            onChange={(e) => setNewChatId(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Добавить чат
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedChats.map((chat) => (
          <React.Fragment key={chat.id}>
            <div 
              className={`rounded-xl border transition-all ${
                chat.active 
                  ? 'bg-slate-800 border-slate-700 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-slate-600' 
                  : 'bg-slate-900/50 border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 opacity-60 grayscale-[0.5]'
              }`}
            >
            <div className="flex items-center gap-4">
              <img 
                src={chat.avatarUrl} 
                alt={chat.title} 
                className={`rounded-full border-2 ${chat.active ? 'w-16 h-16 border-slate-600' : 'w-12 h-12 border-slate-800'}`} 
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`${chat.active ? 'text-xl font-bold' : 'text-base font-medium'} text-white`}>{chat.title}</h3>
                  {!chat.active && (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded border border-slate-700">
                      Деактивирован
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-sm mt-1">
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {chat.members.toLocaleString()}</span>
                  <span className="text-slate-600">|</span>
                  <span className="font-mono text-xs text-slate-500">ID: {chat.id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditingChatId(editingChatId === chat.id ? null : chat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  editingChatId === chat.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Settings className="w-4 h-4" />
                Настройки
              </button>

              <button 
                onClick={() => handleToggleActive(chat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  chat.active 
                    ? 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10' 
                    : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                {chat.active ? (
                  <>
                    <PowerOff className="w-4 h-4" />
                    Деактивировать
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    Активировать
                  </>
                )}
              </button>
              
              <button 
                onClick={() => onRemoveChat(chat.id)}
                className="flex items-center gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </div>
          </div>

          {editingChatId === chat.id && (
            <div className="bg-slate-800/50 border-x border-b border-slate-700 rounded-b-xl p-6 mt-[-12px] animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Moderation Toggles */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Фильтры сообщений</h4>
                  
                  <ToggleSetting 
                    label="Блокировать ссылки" 
                    checked={chat.blockLinks} 
                    onChange={(val) => handleUpdateSetting(chat, 'blockLinks', val)} 
                  />
                  <ToggleSetting 
                    label="Блокировать Telegram-ссылки" 
                    checked={chat.blockTelegramLinks} 
                    onChange={(val) => handleUpdateSetting(chat, 'blockTelegramLinks', val)} 
                  />
                  <ToggleSetting 
                    label="Блокировать медиа" 
                    checked={chat.blockMedia} 
                    onChange={(val) => handleUpdateSetting(chat, 'blockMedia', val)} 
                  />
                  <ToggleSetting 
                    label="Блокировать пересылки" 
                    checked={chat.blockForwards} 
                    onChange={(val) => handleUpdateSetting(chat, 'blockForwards', val)} 
                  />
                  <ToggleSetting 
                    label="Удалять системные сообщения" 
                    checked={chat.deleteSystemMessages} 
                    onChange={(val) => handleUpdateSetting(chat, 'deleteSystemMessages', val)} 
                  />
                  <ToggleSetting 
                    label="Удалять команды" 
                    checked={chat.deleteCommands} 
                    onChange={(val) => handleUpdateSetting(chat, 'deleteCommands', val)} 
                  />
                </div>

                {/* Entry Settings */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Вступление и Мут</h4>
                  
                  <ToggleSetting 
                    label="Авто-одобрение заявок" 
                    checked={chat.autoApprove} 
                    onChange={(val) => handleUpdateSetting(chat, 'autoApprove', val)} 
                  />
                  <ToggleSetting 
                    label="Каптча на входе" 
                    checked={chat.captchaEnabled} 
                    onChange={(val) => handleUpdateSetting(chat, 'captchaEnabled', val)} 
                  />
                  {chat.captchaEnabled && (
                    <div className="space-y-2 pl-2 animate-in fade-in duration-200">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Вопрос</label>
                        <input 
                          type="text" 
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" 
                          value={chat.captchaQuestion || ''}
                          onChange={(e) => handleUpdateSetting(chat, 'captchaQuestion', e.target.value)}
                          placeholder="Напр: 2+2?"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Ответ</label>
                        <input 
                          type="text" 
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" 
                          value={chat.captchaAnswer || ''}
                          onChange={(e) => handleUpdateSetting(chat, 'captchaAnswer', e.target.value)}
                          placeholder="Напр: 4"
                        />
                      </div>
                    </div>
                  )}
                  <ToggleSetting 
                    label="Мут новичков" 
                    checked={chat.muteNewcomers} 
                    onChange={(val) => handleUpdateSetting(chat, 'muteNewcomers', val)} 
                  />

                  {chat.muteNewcomers && (
                    <div className="flex items-center gap-2 pl-2 animate-in fade-in duration-200">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-16 text-xs text-white" 
                        value={chat.muteDurationHours || 0}
                        onChange={(e) => handleUpdateSetting(chat, 'muteDurationHours', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-xs text-slate-500">часов</span>
                    </div>
                  )}
                </div>

                {/* Forbidden Words */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Запрещенные слова</h4>
                  <form onSubmit={(e) => handleAddWord(chat, e)} className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      placeholder="Добавить слово..."
                      value={newWord}
                      onChange={e => setNewWord(e.target.value)}
                    />
                    <button type="submit" className="bg-slate-700 hover:bg-slate-600 p-1 rounded">
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-1">
                    {(chat.forbiddenWords || []).map(word => (
                      <span key={word} className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                        {word}
                        <button onClick={() => handleRemoveWord(chat, word)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ToggleSetting: React.FC<{ label: string, checked?: boolean, onChange: (val: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
    <span className="text-xs text-slate-300">{label}</span>
    <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right">
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={!!checked} 
        onChange={() => onChange(!checked)} 
      />
      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
    </label>
  </div>
);
