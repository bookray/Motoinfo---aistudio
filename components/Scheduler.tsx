import React, { useState } from 'react';
import { ScheduledMessage, Chat } from '../types';
import { Calendar, Play, Pause, Trash2, Plus, Clock, Pin } from 'lucide-react';

interface SchedulerProps {
  tasks: ScheduledMessage[];
  chats: Chat[];
  onAddTask: (task: ScheduledMessage) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
}

export const Scheduler: React.FC<SchedulerProps> = ({ tasks, chats, onAddTask, onDeleteTask, onToggleTask }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ScheduledMessage>>({
    text: '',
    chatIds: [],
    intervalDays: 1,
    time: '12:00',
    active: true,
    imageUrl: '',
    buttons: [],
    pin: false,
    deleteAfterDays: 0,
    deleteAfterHours: 0
  });

  const handleCreate = () => {
    if (!newTask.text || (newTask.chatIds?.length || 0) === 0) return;
    
    onAddTask({
      id: Date.now().toString(),
      text: newTask.text!,
      chatIds: newTask.chatIds!,
      intervalDays: newTask.intervalDays || 1,
      time: newTask.time || '12:00',
      active: true,
      imageUrl: newTask.imageUrl || undefined,
      buttons: (newTask.buttons?.length || 0) > 0 ? newTask.buttons : undefined,
      pin: newTask.pin,
      deleteAfterDays: newTask.deleteAfterDays,
      deleteAfterHours: newTask.deleteAfterHours
    });
    setIsCreating(false);
    setNewTask({ text: '', chatIds: [], intervalDays: 1, time: '12:00', active: true, imageUrl: '', buttons: [], pin: false, deleteAfterDays: 0, deleteAfterHours: 0 });
  };

  const toggleChatSelection = (chatId: string) => {
    const current = newTask.chatIds || [];
    if (current.includes(chatId)) {
      setNewTask({ ...newTask, chatIds: current.filter(id => id !== chatId) });
    } else {
      setNewTask({ ...newTask, chatIds: [...current, chatId] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-purple-500" /> Запланированные сообщения
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Новое расписание
        </button>
      </div>

      {isCreating && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Текст сообщения</label>
                <textarea 
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 h-32 resize-none"
                  placeholder="Введите текст автоматического сообщения..."
                  value={newTask.text}
                  onChange={e => setNewTask({...newTask, text: e.target.value})}
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Интервал (в днях)</label>
                   <input 
                     type="number" 
                     min="1" 
                     className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white" 
                     value={newTask.intervalDays}
                     onChange={e => setNewTask({...newTask, intervalDays: parseInt(e.target.value)})}
                   />
                </div>
                <div>
                   <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Время (UTC)</label>
                   <input 
                     type="time" 
                     className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white" 
                     value={newTask.time}
                     onChange={e => setNewTask({...newTask, time: e.target.value})}
                   />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Ссылка на изображение (URL)</label>
                  <input
                    type="text"
                    value={newTask.imageUrl}
                    onChange={(e) => setNewTask({...newTask, imageUrl: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Кнопки (Текст | URL)</label>
                  <div className="space-y-2">
                    {(newTask.buttons || []).map((btn, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => {
                            const newBtns = [...(newTask.buttons || [])];
                            newBtns[idx].text = e.target.value;
                            setNewTask({...newTask, buttons: newBtns});
                          }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                          placeholder="Текст"
                        />
                        <input
                          type="text"
                          value={btn.url}
                          onChange={(e) => {
                            const newBtns = [...(newTask.buttons || [])];
                            newBtns[idx].url = e.target.value;
                            setNewTask({...newTask, buttons: newBtns});
                          }}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                          placeholder="URL"
                        />
                        <button 
                          onClick={() => setNewTask({...newTask, buttons: (newTask.buttons || []).filter((_, i) => i !== idx)})}
                          className="text-rose-400 hover:text-rose-300 px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setNewTask({...newTask, buttons: [...(newTask.buttons || []), { text: '', url: '' }]})}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      + Добавить кнопку
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-700 pt-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newTask.pin} 
                      onChange={e => setNewTask({...newTask, pin: e.target.checked})}
                      className="rounded border-slate-600 bg-slate-900 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-xs font-medium text-slate-300">Закрепить</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Удалить через (дней)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={newTask.deleteAfterDays}
                      onChange={e => setNewTask({...newTask, deleteAfterDays: parseInt(e.target.value) || 0})}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">Удалить через (часов)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={newTask.deleteAfterHours}
                      onChange={e => setNewTask({...newTask, deleteAfterHours: parseInt(e.target.value) || 0})}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Целевые чаты</label>
              <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 max-h-52 overflow-y-auto space-y-1">
                {chats.filter(c => c).map(chat => (
                  <div 
                    key={chat.id} 
                    onClick={() => toggleChatSelection(chat.id)}
                    className={`p-2 rounded cursor-pointer flex items-center justify-between text-sm ${newTask.chatIds?.includes(chat.id) ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <span>{chat.title}</span>
                    {newTask.chatIds?.includes(chat.id) && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                 <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2">Отмена</button>
                 <button onClick={handleCreate} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg text-sm font-medium">Сохранить расписание</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.filter(t => t).map(task => (
          <div key={task.id} className={`relative p-6 rounded-xl border transition-all ${task.active ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/50 border-slate-800 opacity-75'}`}>
             <div className="absolute top-4 right-4 flex gap-2">
               <button onClick={() => onToggleTask(task.id)} className={`p-2 rounded-lg transition-colors ${task.active ? 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20' : 'text-slate-400 bg-slate-700 hover:bg-slate-600'}`}>
                 {task.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
               </button>
               <button onClick={() => onDeleteTask(task.id)} className="p-2 rounded-lg text-rose-400 bg-rose-400/10 hover:bg-rose-400/20 transition-colors">
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>

             <div className="mb-4">
               <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                 <Clock className="w-4 h-4" />
                 <span>Every {task.intervalDays} day(s) at {task.time}</span>
               </div>
               <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${task.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                 {task.active ? 'Active' : 'Paused'}
               </span>
               <div className="flex gap-2 mt-2">
                 {task.pin && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1"><Pin className="w-3 h-3" /> Pin</span>}
                 {(task.deleteAfterDays || task.deleteAfterHours) ? (
                   <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                     <Trash2 className="w-3 h-3" /> Del: {task.deleteAfterDays}d {task.deleteAfterHours}h
                   </span>
                 ) : null}
               </div>
             </div>

             <p className="text-white text-sm line-clamp-3 bg-slate-900/50 p-3 rounded-lg mb-4 border border-slate-700/50 font-mono">
               {task.text}
             </p>

             {(task.imageUrl || (task.buttons && task.buttons.length > 0)) && (
               <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                 {task.imageUrl && (
                   <div className="relative group">
                     <img src={task.imageUrl} alt="Preview" className="w-12 h-12 rounded object-cover border border-slate-700" referrerPolicy="no-referrer" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                       <span className="text-[8px] text-white">IMG</span>
                     </div>
                   </div>
                 )}
                 {task.buttons && task.buttons.map((btn, i) => (
                   <div key={i} className="px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-300 whitespace-nowrap border border-slate-600">
                     {btn.text || 'Btn'}
                   </div>
                 ))}
               </div>
             )}

             <div className="text-xs text-slate-500">
               Цели: {task.chatIds.length} чатов
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};