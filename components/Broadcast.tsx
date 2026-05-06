import React, { useState, useEffect, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Chat, User, UserRole, BroadcastHistory } from '../types';
import { Send, Pin, Clock, Trash2, AlertTriangle, MessageSquare, History, User as UserIcon, ExternalLink, PinOff } from 'lucide-react';
import { formatDateTime } from '../src/utils/dateUtils';

interface BroadcastProps {
  chats: Chat[];
  currentUser: User;
}

export const Broadcast: React.FC<BroadcastProps> = ({ chats, currentUser }) => {
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<{ text: string; url: string }[]>([]);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [options, setOptions] = useState({
    pin: false,
    pinTime: 0, // 0 = forever
    silent: false,
    delay: 10, // Default 10 seconds
  });
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [confirmingUnpin, setConfirmingUnpin] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/broadcasts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleChat = (id: string) => {
    const activeChats = chats.filter(c => c && c.active);
    if (id === 'ALL') {
      if (selectedChats.length === activeChats.length) setSelectedChats([]);
      else setSelectedChats(activeChats.map(c => c.id));
      return;
    }
    if (selectedChats.includes(id)) {
      setSelectedChats(selectedChats.filter(c => c !== id));
    } else {
      setSelectedChats([...selectedChats, id]);
    }
  };

  const isMessageEmpty = !message || message.replace(/<(.|\n)*?>/g, '').trim().length === 0;

  const handleSend = async () => {
    console.log('Sending broadcast...', { message, selectedChats, limitReached, isMessageEmpty });
    if (isMessageEmpty || selectedChats.length === 0) {
      console.warn('Cannot send: message or selectedChats is empty');
      return;
    }

    // Basic HTML cleaning for Telegram (Telegram supports <b>, <i>, <a>, <code>, <pre>)
    let formattedMessage = message
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '<b>$1</b>')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '<i>$1</i>')
      .replace(/<p><br><\/p>/g, '\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n')
      .replace(/<br>/g, '\n')
      .replace(/<li>(.*?)<\/li>/g, '• $1\n')
      .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/g, '');

    // Strip all tags except allowed ones for Telegram
    formattedMessage = formattedMessage.replace(/<(?!\/?(b|i|a|code|pre|u|s)\b)[^>]+>/g, '');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chatIds: selectedChats,
          text: formattedMessage,
          pin: options.pin,
          silent: options.silent,
          pinTime: options.pinTime,
          delay: options.delay,
          imageUrl: imageUrl || undefined,
          buttons: buttons.length > 0 ? buttons : undefined
        })
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage('');
        setImageUrl('');
        setButtons([]);
        setSelectedChats([]);
        alert(data.message || 'Рассылка успешно запущена!');
        fetchHistory();
      } else {
        const error = await response.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
        alert(`Ошибка при отправке: ${error.error}`);
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('Произошла ошибка при отправке рассылки');
    }
  };

  const handleDeleteLast = async () => {
    if (window.confirm("Вы уверены, что хотите удалить последнее сообщение рассылки из всех выбранных чатов?")) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/broadcast/delete', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          alert("Последняя рассылка удалена.");
        } else {
          const error = await response.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
          alert(`Ошибка при удалении: ${error.error}`);
        }
      } catch (err) {
        console.error('Delete broadcast error:', err);
        alert('Произошла ошибка при удалении рассылки');
      }
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/broadcasts/${id}/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchHistory();
      } else {
        const error = await response.json();
        console.error(`Ошибка: ${error.error}`);
      }
    } catch (err) {
      console.error('Ошибка при удалении', err);
    } finally {
      setActionLoading(null);
      setConfirmingDelete(null);
    }
  };

  const handleUnpinBroadcast = async (id: string) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/broadcasts/${id}/unpin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchHistory();
      } else {
        const error = await response.json();
        console.error(`Ошибка: ${error.error}`);
      }
    } catch (err) {
      console.error('Ошибка при откреплении', err);
    } finally {
      setActionLoading(null);
      setConfirmingUnpin(null);
    }
  };

  const isAdvertiser = currentUser.role === UserRole.ADVERTISER;
  const remainingMessages = isAdvertiser ? (currentUser.maxMessages || 0) - (currentUser.messagesSent || 0) : Infinity;
  const limitReached = isAdvertiser && remainingMessages <= 0;

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean'],
    ],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {isAdvertiser && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${limitReached ? 'bg-rose-500/10 border-rose-500/50 text-rose-200' : 'bg-blue-500/10 border-blue-500/50 text-blue-200'}`}>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5" />
            <div>
              <p className="font-bold text-sm">Лимит сообщений</p>
              <p className="text-xs opacity-70">
                {limitReached 
                  ? 'Вы исчерпали выделенный лимит сообщений. Обратитесь к администратору.' 
                  : `У вас осталось ${remainingMessages} сообщений из ${currentUser.maxMessages}.`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold">{remainingMessages < 0 ? 0 : remainingMessages}</span>
          </div>
        </div>
      )}

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-400" /> Новая рассылка
        </h3>

        <div className="space-y-4">
          <div className="quill-dark-theme">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Текст сообщения</label>
            <ReactQuill
              theme="snow"
              value={message}
              onChange={setMessage}
              modules={quillModules}
              placeholder="Введите текст объявления здесь..."
              className="bg-slate-900 text-white rounded-lg overflow-hidden border border-slate-600"
            />
            <style>{`
              .quill-dark-theme .ql-toolbar { background: #1e293b; border-color: #475569 !important; border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; }
              .quill-dark-theme .ql-container { background: #0f172a; border-color: #475569 !important; border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; min-height: 150px; color: white; font-size: 14px; }
              .quill-dark-theme .ql-stroke { stroke: #94a3b8 !important; }
              .quill-dark-theme .ql-fill { fill: #94a3b8 !important; }
              .quill-dark-theme .ql-picker { color: #94a3b8 !important; }
              .quill-dark-theme .ql-editor.ql-blank::before { color: #475569 !important; font-style: normal; }
              .quill-dark-theme .ql-editor { min-height: 150px; }
            `}</style>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Ссылка на изображение (URL)</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Кнопки (Текст | URL)</label>
              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].text = e.target.value;
                        setButtons(newBtns);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                      placeholder="Текст"
                    />
                    <input
                      type="text"
                      value={btn.url}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].url = e.target.value;
                        setButtons(newBtns);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                      placeholder="URL"
                    />
                    <button 
                      onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setButtons([...buttons, { text: '', url: '' }])}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  + Добавить кнопку
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Целевые чаты</label>
                <button 
                  onClick={() => toggleChat('ALL')} 
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  {selectedChats.length === chats.filter(c => c && c.active).length ? 'Снять всё' : 'Выбрать всё'}
                </button>
              </div>
              <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                {chats.filter(chat => chat && chat.active).map(chat => (
                  <label 
                    key={chat.id} 
                    className="flex items-center gap-3 p-2 rounded cursor-pointer group hover:bg-slate-800"
                  >
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                      checked={selectedChats.includes(chat.id)}
                      onChange={() => toggleChat(chat.id)}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-slate-300 group-hover:text-white truncate">{chat.title}</span>
                    </div>
                  </label>
                ))}
                {chats.filter(chat => chat && chat.active).length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Нет активных чатов для рассылки</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Параметры отправки</label>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={options.pin}
                    onChange={() => setOptions({...options, pin: !options.pin})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                  />
                  <Pin className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">Закрепить сообщение</span>
                </label>

                {options.pin && (
                   <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                     <Clock className="w-4 h-4 text-slate-400" />
                     <span className="text-sm text-slate-300 whitespace-nowrap">Открепить через:</span>
                     <select 
                       className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                       value={options.pinTime}
                       onChange={(e) => setOptions({...options, pinTime: parseInt(e.target.value)})}
                     >
                       <option value={0}>Никогда</option>
                       <option value={24}>24 часа</option>
                       <option value={48}>2 дня</option>
                       <option value={168}>7 дней</option>
                     </select>
                   </div>
                )}
                
                <div className="pt-4 border-t border-slate-700 space-y-3">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Задержка (сек)</label>
                     <input 
                       type="number" 
                       min={0}
                       max={3600}
                       value={options.delay}
                       onChange={(e) => setOptions({...options, delay: parseInt(e.target.value) || 0})}
                       className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white text-right"
                     />
                   </div>
                   
                   <button 
                     disabled={isMessageEmpty || selectedChats.length === 0 || limitReached}
                     onClick={handleSend}
                     className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all flex justify-center items-center gap-2"
                   >
                     <Send className="w-4 h-4" />
                     {limitReached ? 'Лимит исчерпан' : `Отправить в ${selectedChats.length} чатов`}
                   </button>
                   {(isMessageEmpty || selectedChats.length === 0) && !limitReached && (
                     <p className="text-[10px] text-slate-500 mt-2 text-center animate-pulse">
                       {isMessageEmpty ? 'Введите текст сообщения' : 'Выберите чаты для рассылки'}
                     </p>
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-rose-900/10 p-6 rounded-xl border border-rose-900/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500/20 rounded-full">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <div>
             <h4 className="text-white font-medium">Экстренное управление</h4>
             <p className="text-sm text-rose-300/70">Действия здесь влияют на ранее отправленные рассылки.</p>
          </div>
        </div>
        <button 
          onClick={handleDeleteLast}
          className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Удалить последнюю рассылку
        </button>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-400" /> Прошедшие рассылки
        </h3>

        {loadingHistory ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>История рассылок пуста</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.source === 'ADMIN' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                      {item.source === 'ADMIN' ? <Send className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {formatDateTime(item.timestamp)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.source === 'ADMIN' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {item.source === 'ADMIN' ? 'Админка' : 'Бот'}
                        </span>
                      </div>
                      {currentUser.role === UserRole.SUPER_ADMIN && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <UserIcon className="w-3 h-3" />
                          <span>{item.username}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.pin && (
                      <div className="flex items-center gap-1">
                        {confirmingUnpin === item.id ? (
                          <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                            <button 
                              onClick={() => handleUnpinBroadcast(item.id)}
                              disabled={actionLoading === item.id}
                              className="px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded hover:bg-amber-600 transition-colors"
                            >
                              {actionLoading === item.id ? '...' : 'Да'}
                            </button>
                            <button 
                              onClick={() => setConfirmingUnpin(null)}
                              className="px-2 py-1 bg-slate-700 text-white text-[10px] font-bold rounded hover:bg-slate-600 transition-colors"
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmingUnpin(item.id)}
                            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                            title="Открепить везде"
                          >
                            <PinOff className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1">
                      {confirmingDelete === item.id ? (
                        <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                          <button 
                            onClick={() => handleDeleteBroadcast(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition-colors"
                          >
                            {actionLoading === item.id ? '...' : 'Да'}
                          </button>
                          <button 
                            onClick={() => setConfirmingDelete(null)}
                            className="px-2 py-1 bg-slate-700 text-white text-[10px] font-bold rounded hover:bg-slate-600 transition-colors"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmingDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                          title="Удалить везде"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/50 rounded-lg p-3 mb-3 border border-slate-800">
                  <p className="text-sm text-slate-300 line-clamp-3 whitespace-pre-wrap">
                    {item.text.replace(/<[^>]*>/g, '')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.messageIds.map((msg, idx) => {
                    const chat = chats.find(c => String(c.id) === String(msg.chatId));
                    const cleanId = String(msg.chatId).replace('-100', '');
                    const link = `https://t.me/c/${cleanId}/${msg.messageId}`;
                    
                    return (
                      <a 
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-[10px] transition-colors border border-slate-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {chat?.title || msg.chatId}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};