
import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, User, Trash2, Key, Mail, CheckCircle2, XCircle, AlertCircle, Loader2, Search, Filter, Plus, X, Edit2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { User as UserType, UserRole, Chat } from '../types';
import { formatDate } from '../src/utils/dateUtils';

interface UserManagementProps {
  chats: Chat[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ chats }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: UserRole.ADVERTISER,
    assignedChatIds: [] as string[],
    maxMessages: 100,
    accessPeriodDays: 30,
    canPin: false
  });

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Не удалось загрузить список пользователей');
      }
    } catch (err) {
      setError('Ошибка при подключении к API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user: UserType | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Don't show password
        role: user.role,
        assignedChatIds: user.assignedChatIds || [],
        maxMessages: user.maxMessages || 100,
        accessPeriodDays: user.accessPeriodDays || 30,
        canPin: user.canPin || false
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: UserRole.ADVERTISER,
        assignedChatIds: [],
        maxMessages: 100,
        accessPeriodDays: 30,
        canPin: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await response.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
        setError(data.error || 'Ошибка при сохранении пользователя');
      }
    } catch (err) {
      setError('Ошибка при подключении к API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchUsers();
      } else {
        setError('Не удалось удалить пользователя');
      }
    } catch (err) {
      setError('Ошибка при подключении к API');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Управление пользователями</h2>
          <p className="text-slate-400 text-sm">Создание и настройка прав доступа администраторов и рекламодателей</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" /> Добавить пользователя
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Поиск по логину или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          >
            <option value="ALL">Все роли</option>
            <option value={UserRole.SUPER_ADMIN}>Главный админ</option>
            <option value={UserRole.ADMIN}>Администратор</option>
            <option value={UserRole.ADVERTISER}>Рекламодатель</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/50 p-4 rounded-xl flex items-center justify-between text-rose-200 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Пользователь</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Роль</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Доступ к чатам</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Лимиты</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Создан</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-slate-500 text-sm">Загрузка пользователей...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-blue-400 font-bold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{user.username}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === UserRole.SUPER_ADMIN ? 'bg-amber-500/10 text-amber-500' :
                        user.role === UserRole.ADMIN ? 'bg-blue-500/10 text-blue-500' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {user.role === UserRole.SUPER_ADMIN && <ShieldCheck className="w-3 h-3" />}
                        {user.role === UserRole.ADMIN && <Shield className="w-3 h-3" />}
                        {user.role === UserRole.ADVERTISER && <User className="w-3 h-3" />}
                        {user.role === UserRole.SUPER_ADMIN ? 'Главный' : 
                         user.role === UserRole.ADMIN ? 'Админ' : 'Рекламодатель'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-300">
                        {user.role === UserRole.SUPER_ADMIN ? 'Все чаты' : 
                         `${user.assignedChatIds?.length || 0} чатов`}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === UserRole.ADVERTISER ? (
                        <div className="text-xs space-y-1">
                          <p className="text-slate-300">Лимит: {user.messagesSent || 0}/{user.maxMessages || 0}</p>
                          <p className="text-slate-500">Пин: {user.canPin ? 'Да' : 'Нет'}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500">{formatDate(user.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <h3 className="text-xl font-bold text-white">
                {editingUser ? 'Редактировать пользователя' : 'Добавить нового пользователя'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Логин</label>
                  <input 
                    type="text" 
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Пароль {editingUser && '(оставьте пустым, чтобы не менять)'}</label>
                  <input 
                    type="password" 
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Роль</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  >
                    <option value={UserRole.ADVERTISER}>Рекламодатель</option>
                    <option value={UserRole.ADMIN}>Администратор</option>
                    <option value={UserRole.SUPER_ADMIN}>Главный админ</option>
                  </select>
                </div>
              </div>

              {formData.role !== UserRole.SUPER_ADMIN && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">Назначенные чаты</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-950 rounded-xl border border-slate-800">
                    {chats.map(chat => (
                      <label key={chat.id} className="flex items-center gap-3 p-2 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.assignedChatIds.includes(chat.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked 
                              ? [...formData.assignedChatIds, chat.id]
                              : formData.assignedChatIds.filter(id => id !== chat.id);
                            setFormData({...formData, assignedChatIds: newIds});
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                        />
                        <span className="text-sm text-slate-300 truncate">{chat.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.role === UserRole.ADVERTISER && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-400 uppercase">Лимит сообщений</label>
                    <input 
                      type="number" 
                      value={formData.maxMessages}
                      onChange={(e) => setFormData({...formData, maxMessages: parseInt(e.target.value)})}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-400 uppercase">Период доступа (дней)</label>
                    <input 
                      type="number" 
                      value={formData.accessPeriodDays}
                      onChange={(e) => setFormData({...formData, accessPeriodDays: parseInt(e.target.value)})}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input 
                      type="checkbox"
                      id="canPin"
                      checked={formData.canPin}
                      onChange={(e) => setFormData({...formData, canPin: e.target.checked})}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                    />
                    <label htmlFor="canPin" className="text-sm font-medium text-slate-300 cursor-pointer">Разрешить закреп</label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingUser ? 'Сохранить изменения' : 'Создать пользователя'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
