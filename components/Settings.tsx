import React, { useState } from 'react';
import { BotSettings, DatabaseType } from '../types';
import { Save, Key, Bot, Database, ShieldCheck, AlertTriangle, Mail, RefreshCw } from 'lucide-react';

interface SettingsProps {
  settings: BotSettings;
  onUpdateSettings: (settings: BotSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  const [localSettings, setLocalSettings] = useState<BotSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Sync local state if props change (e.g. after successful save or remote update)
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings(localSettings);
      setStatusMessage({ text: 'Настройки сохранены', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      setStatusMessage({ text: e.message || 'Ошибка при сохранении', type: 'error' });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestartBot = async () => {
    setIsRestarting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/bot/restart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
      if (res.ok) {
        setStatusMessage({ text: 'Бот успешно перезапущен', type: 'success' });
      } else {
        setStatusMessage({ text: data.error || 'Ошибка при перезапуске бота', type: 'error' });
      }
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (e: any) {
      setStatusMessage({ text: `Ошибка сети: ${e.message || 'неизвестно'}`, type: 'error' });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDbSetup = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/settings/db-setup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({ error: 'Некорректный ответ сервера' }));
      if (res.ok) {
        setStatusMessage({ text: 'База данных успешно настроена', type: 'success' });
      } else {
        setStatusMessage({ text: data.error || 'Ошибка настройки БД', type: 'error' });
      }
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      setStatusMessage({ text: 'Ошибка сети при настройке БД', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {statusMessage && (
        <div className={`fixed top-20 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-right-4 ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/50 text-rose-400'
        }`}>
          {statusMessage.text}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Настройки системы</h2>
          <p className="text-slate-400 text-sm">Управление токенами, паролями и подключением к БД</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Сохранить изменения
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telegram Bot Settings */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Telegram Бот</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Токен бота (Bot Token)
              </label>
              <input
                type="text"
                value={localSettings.botToken}
                onChange={(e) => setLocalSettings({ ...localSettings, botToken: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
              />
              <p className="mt-2 text-[10px] text-slate-500 italic">
                * Изменение токена потребует перезапуска бота
              </p>
            </div>
          </div>
        </div>

        {/* Panel Security */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Безопасность панели</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Пароль администратора
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={localSettings.adminPassword || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, adminPassword: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  placeholder="Оставьте пустым, чтобы не менять"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                Email для восстановления
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={localSettings.recoveryEmail || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, recoveryEmail: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-200">Режим обслуживания</p>
                <p className="text-xs text-slate-500">Бот будет игнорировать команды</p>
              </div>
              <button
                onClick={() => setLocalSettings({ ...localSettings, maintenanceMode: !localSettings.maintenanceMode })}
                className={`w-12 h-6 rounded-full transition-colors relative ${localSettings.maintenanceMode ? 'bg-amber-500' : 'bg-slate-800'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.maintenanceMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Database Connection */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">База данных</h3>
            </div>
            
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setLocalSettings({ ...localSettings, dbType: DatabaseType.FIREBASE })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  localSettings.dbType === DatabaseType.FIREBASE ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Firebase
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, dbType: DatabaseType.MYSQL })}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  localSettings.dbType === DatabaseType.MYSQL ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                MySQL
              </button>
            </div>
          </div>
          
          {localSettings.dbType === DatabaseType.MYSQL ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    Хост (Host)
                  </label>
                  <input
                    type="text"
                    value={localSettings.dbHost}
                    onChange={(e) => setLocalSettings({ ...localSettings, dbHost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    Порт (Port)
                  </label>
                  <input
                    type="number"
                    value={localSettings.dbPort}
                    onChange={(e) => setLocalSettings({ ...localSettings, dbPort: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    Имя базы (Database Name)
                  </label>
                  <input
                    type="text"
                    value={localSettings.dbName}
                    onChange={(e) => setLocalSettings({ ...localSettings, dbName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    Пользователь (User)
                  </label>
                  <input
                    type="text"
                    value={localSettings.dbUser}
                    onChange={(e) => setLocalSettings({ ...localSettings, dbUser: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                    Пароль (Password)
                  </label>
                  <input
                    type="password"
                    value={localSettings.dbPass}
                    onChange={(e) => setLocalSettings({ ...localSettings, dbPass: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={handleDbSetup}
                  className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-xl font-bold transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Первичная настройка MySQL
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 mb-4">
                <Database size={32} />
              </div>
              <h4 className="text-white font-bold mb-2">Используется Firebase</h4>
              <p className="text-slate-500 text-sm max-w-md">
                Все данные синхронизируются с облачной базой данных Firebase Firestore. 
                Настройки подключения не требуются.
              </p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-bold text-rose-500">Опасная зона</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">Действия ниже могут привести к потере данных или остановке сервиса.</p>
          
          <div className="flex flex-wrap gap-4">
            <button className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-bold transition-all border border-rose-500/30">
              Сброс всех логов
            </button>
            <button 
              onClick={handleRestartBot}
              disabled={isRestarting}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-bold transition-all border border-rose-500/30 disabled:opacity-50"
            >
              {isRestarting ? 'Перезапуск...' : 'Перезагрузить бота'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
