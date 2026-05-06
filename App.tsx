
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, MessageSquareText, Shield, 
  Calendar, Radio, ScrollText, Menu, X, LogOut, Database, Settings as SettingsIcon,
  Bot, UserPlus
} from 'lucide-react';

import { Chat, ScheduledMessage, LogEntry, GlobalBan, FilterSettings, Tab, BotSettings, Stats, WhitelistEntry, MultiChatUser, LatestMember, ChatBan, User, UserRole, DatabaseType } from './types';
import { Dashboard } from './components/Dashboard';
import { ChatList } from './components/ChatList';
import { Scheduler } from './components/Scheduler';
import { Logs } from './components/Logs';
import { Moderation } from './components/Moderation';
import { AntiScam } from './components/AntiScam';
import { Broadcast } from './components/Broadcast';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';

// Если мы на одном сервере, используем относительный путь /api
const API_BASE_URL = '/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<Tab>(Tab.STATISTICS);

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline'>('offline');
  const [botStatus, setBotStatus] = useState<'online' | 'offline'>('offline');
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [tasks, setTasks] = useState<ScheduledMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bans, setBans] = useState<GlobalBan[]>([]);
  const [filters, setFilters] = useState<FilterSettings>({
    blockLinks: false,
    blockTelegramLinks: false,
    blockMedia: false,
    blockForwards: false,
    forbiddenWords: [],
    autoApprove: false,
    captchaEnabled: false,
    captchaQuestion: 'Сколько будет 2+2?',
    captchaAnswer: '4',
    muteNewcomers: false,
    muteDurationHours: 24,
    muteMessage: 'Добро пожаловать! Вы временно в муте на {hours}ч. Пожалуйста, ознакомьтесь с правилами.',
    deleteSystemMessages: false,
    deleteCommands: false,
    userVoteEnabled: false,
    userVotePercentage: 10,
    userVoteMin: 5,
    userVoteMax: 50,
    userVoteDuration: 1440,
    notifyMultiChat: false,
    multiChatThreshold: 5,
  });
  const [settings, setSettings] = useState<BotSettings>({
    botToken: '7523471690:AAGSfN9svITRIFGVxmfI1726SKMoOOPiT1Y',
    dbHost: 'localhost',
    dbUser: 'root',
    dbPass: '',
    dbName: 'teleguard',
    maintenanceMode: false
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [multiChatUsers, setMultiChatUsers] = useState<MultiChatUser[]>([]);
  const [latestMembers, setLatestMembers] = useState<LatestMember[]>([]);
  const [chatBans, setChatBans] = useState<ChatBan[]>([]);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  useEffect(() => {
    const initApp = async () => {
      try {
        setIsLoading(true);
        const healthCheck = await authenticatedFetch(`${API_BASE_URL}/health`).catch(() => null);
        
        if (healthCheck?.ok) {
          const healthData = await healthCheck.json();
          setDbStatus('online');
          setBotStatus(healthData.botActive ? 'online' : 'offline');
          const [chatsRes, bansRes, filtersRes, logsRes, settingsRes, tasksRes, whitelistRes, multiChatRes, latestMembersRes] = await Promise.all([
            authenticatedFetch(`${API_BASE_URL}/chats`),
            authenticatedFetch(`${API_BASE_URL}/bans`),
            authenticatedFetch(`${API_BASE_URL}/filters`),
            authenticatedFetch(`${API_BASE_URL}/logs`),
            authenticatedFetch(`${API_BASE_URL}/settings`),
            authenticatedFetch(`${API_BASE_URL}/tasks`),
            authenticatedFetch(`${API_BASE_URL}/whitelist`),
            authenticatedFetch(`${API_BASE_URL}/memberships/multi-chat`),
            authenticatedFetch(`${API_BASE_URL}/memberships/latest`)
          ]);

          if (chatsRes.ok) setChats(await chatsRes.json());
          if (bansRes.ok) setBans(await bansRes.json());
          if (filtersRes.ok) setFilters(await filtersRes.json());
          if (logsRes.ok) setLogs(await logsRes.json());
          if (settingsRes.ok) setSettings(await settingsRes.json());
          if (tasksRes.ok) setTasks(await tasksRes.json());
          if (whitelistRes.ok) setWhitelist(await whitelistRes.json());
          if (multiChatRes.ok) setMultiChatUsers(await multiChatRes.json());
          if (latestMembersRes.ok) setLatestMembers(await latestMembersRes.json());
        } else {
          setDbStatus('offline');
        }
      } catch (error) {
        console.error("Backend unreachable:", error);
        setDbStatus('offline');
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // Health check to recover from offline status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE_URL}/health`);
        if (res.ok) {
          const healthData = await res.json();
          setBotStatus(healthData.botActive ? 'online' : 'offline');
          setDbStatus('online');
          setPollingError(null);
        } else {
          setDbStatus('offline');
        }
      } catch (e: any) {
        setDbStatus('offline');
        setPollingError(`Backend connection failed: ${e.message}`);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  // Polling for real-time updates (chats and logs)
  useEffect(() => {
    if (!token || !currentUser) return;
    
    let isMounted = true;
    let controller = new AbortController();

    const pollData = async (isInitial = false) => {
      try {
        if (dbStatus === 'offline' && !isInitial) return;
        
        // Reset controller for new request
        controller.abort();
        controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        const fetchOptions = { signal: controller.signal };

        const statsQuery = new URLSearchParams({
          ...(selectedChatIds.length > 0 ? { chatIds: selectedChatIds.join(',') } : {}),
          ...(dateRange.start ? { startDate: dateRange.start } : {}),
          ...(dateRange.end ? { endDate: dateRange.end } : {})
        }).toString();

        const [chatsRes, bansRes, whitelistRes, logsRes, statsRes, multiChatRes, latestMembersRes] = await Promise.all([
          authenticatedFetch(`${API_BASE_URL}/chats`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/bans/chat`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/whitelist`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/logs`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/stats?${statsQuery}`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/memberships/multi-chat`, fetchOptions),
          authenticatedFetch(`${API_BASE_URL}/memberships/latest`, fetchOptions)
        ]);

        clearTimeout(timeoutId);

        if (!isMounted) return;

        if (chatsRes.ok) setChats(await chatsRes.json());
        if (bansRes.ok) setChatBans(await bansRes.json());
        if (whitelistRes.ok) setWhitelist(await whitelistRes.json());
        if (logsRes.ok) setLogs(await logsRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (multiChatRes.ok) setMultiChatUsers(await multiChatRes.json());
        if (latestMembersRes.ok) setLatestMembers(await latestMembersRes.json());

        setPollingError(null);
        setDbStatus('online');
      } catch (e: any) {
        if (!isMounted) return;
        
        if (e.name === 'AbortError') {
          console.log('Poll aborted or timed out');
        } else {
          console.error('Polling error:', e);
          setPollingError(`Ошибка сети: ${e.message}. Проверьте соединение с сервером.`);
        }
      }
    };

    pollData(true);
    const interval = setInterval(() => pollData(), 10000);
    
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [token, currentUser, selectedChatIds, dateRange]);

  const handleUpdateChat = async (updatedChat: Chat) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/chats/${updatedChat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedChat)
      });
      if (res.ok) setChats(chats.map(c => c && c.id === updatedChat.id ? updatedChat : c));
    } catch (e) { console.error(e); }
  };

  const handleRemoveChat = async (id: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/chats/${id}`, { method: 'DELETE' });
      if (res.ok) setChats(chats.filter(c => c && c.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleAddChat = async (id: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: 'Ожидает одобрения', members: 0 })
      });
      if (res.ok) {
        const newChat = await res.json();
        setChats([...chats, newChat]);
      }
    } catch (e) { console.error(e); }
  };

  const handleBan = async (userId: string, reason: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason })
      });
      if (res.ok) setBans([...bans, await res.json()]);
    } catch (e) { console.error(e); }
  };

  const handleUnban = async (userId: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/bans/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setBans(bans.filter(b => b && b.userId !== userId));
        // Refresh multi-chat users
        const multiChatRes = await authenticatedFetch(`${API_BASE_URL}/memberships/multi-chat`);
        if (multiChatRes.ok) setMultiChatUsers(await multiChatRes.json());
      }
    } catch (e) { console.error(e); }
  };

  const handleWhitelist = async (userId: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, addedAt: new Date().toISOString() })
      });
      if (res.ok) {
        const entry = await res.json();
        setWhitelist([...whitelist, entry]);
        // Refresh multi-chat users
        const multiChatRes = await authenticatedFetch(`${API_BASE_URL}/memberships/multi-chat`);
        if (multiChatRes.ok) setMultiChatUsers(await multiChatRes.json());
      }
    } catch (e) { console.error(e); }
  };

  const handleRemoveFromWhitelist = async (userId: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/whitelist/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setWhitelist(whitelist.filter(w => w.userId !== userId));
        // Refresh multi-chat users
        const multiChatRes = await authenticatedFetch(`${API_BASE_URL}/memberships/multi-chat`);
        if (multiChatRes.ok) setMultiChatUsers(await multiChatRes.json());
      }
    } catch (e) { console.error(e); }
  };

  const handleUnbanChat = async (id: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/bans/chat/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChatBans(chatBans.filter(b => b && b.id !== id));
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateSettings = async (newSettings: BotSettings) => {
    try {
      console.log('Sending settings update:', newSettings);
      const res = await authenticatedFetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        console.log('Settings updated successfully');
        setSettings(newSettings);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to update settings:', errorData);
        throw new Error(errorData.error || 'Failed to update settings');
      }
    } catch (e) { 
      console.error('Update settings error:', e);
      throw e;
    }
  };

  const handleUpdateFilters = async (newFilters: FilterSettings) => {
    try {
      console.log('Sending filters update:', newFilters);
      const res = await authenticatedFetch(`${API_BASE_URL}/filters`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFilters)
      });
      if (res.ok) {
        console.log('Filters updated successfully');
        setFilters(newFilters);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to update filters:', errorData);
      }
    } catch (e) { console.error('Update filters error:', e); }
  };

  const handleAddTask = async (task: ScheduledMessage) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks([...tasks, newTask]);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) setTasks(tasks.filter(t => t && t.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t && t.id === id);
    if (!task) return;
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !task.active })
      });
      if (res.ok) setTasks(tasks.map(t => t && t.id === id ? { ...t, active: !task.active } : t));
    } catch (e) { console.error(e); }
  };

  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
        activeTab === tab 
          ? 'bg-blue-600/10 text-blue-400 font-medium' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon className={`w-5 h-5 ${activeTab === tab ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
      <span>{label}</span>
      {activeTab === tab && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>}
    </button>
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setCurrentUser(null);
  };

  if (!token || !currentUser) {
    return <Login onLogin={(t, u) => { setToken(t); setCurrentUser(u); }} />;
  }

  // Filter data based on assigned chats
  const filteredChats = (currentUser.role === UserRole.SUPER_ADMIN)
    ? chats 
    : chats.filter(c => c && currentUser.assignedChatIds?.includes(c.id));

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200 font-sans">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed md:sticky top-0 h-screen w-72 bg-slate-900 border-r border-slate-800 z-30 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Мотобат</h1>
              <p className="text-xs text-slate-500 font-medium">Админ-панель</p>
            </div>
          </div>
        </div>

        <nav className="px-4 space-y-2 mt-4 flex-1">
          <NavItem tab={Tab.STATISTICS} icon={LayoutDashboard} label="Статистика" />
          {currentUser.role !== UserRole.ADVERTISER && (
            <>
              <NavItem tab={Tab.CHATS} icon={MessageSquareText} label="Управление чатами" />
              <NavItem tab={Tab.MODERATION} icon={Shield} label="Глобальные правила" />
              <NavItem tab={Tab.ANTI_SCAM} icon={Shield} label="Анти мошенники" />
              <NavItem tab={Tab.SCHEDULER} icon={Calendar} label="Планировщик" />
            </>
          )}
          <NavItem tab={Tab.BROADCAST} icon={Radio} label="Рассылка" />
          {currentUser.role !== UserRole.ADVERTISER && (
            <NavItem tab={Tab.LOGS} icon={ScrollText} label="Логи событий" />
          )}
          {currentUser.role === UserRole.SUPER_ADMIN && (
            <>
              <NavItem tab={Tab.USERS} icon={UserPlus} label="Пользователи" />
              <NavItem tab={Tab.SETTINGS} icon={SettingsIcon} label="Настройки" />
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-400"><Menu className="w-6 h-6" /></button>
            <h2 className="text-xl font-semibold text-white">
              {activeTab.replace('_', ' ')}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            {isLoading && <div className="text-xs text-blue-400 animate-pulse hidden sm:block">Подключение...</div>}
            
            {currentUser.role !== UserRole.ADVERTISER && (
              <div className="hidden lg:flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
                  <Database className={`w-3.5 h-3.5 ${dbStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <span className="text-[10px] font-mono text-slate-400">{settings.dbType === DatabaseType.FIREBASE ? 'Firebase' : 'MySQL'}</span>
                  <div className={`h-1.5 w-1.5 rounded-full ${dbStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 animate-pulse'}`}></div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-lg border border-slate-800">
                  <Bot className={`w-3.5 h-3.5 ${botStatus === 'online' ? 'text-blue-500' : 'text-rose-500'}`} />
                  <span className="text-[10px] font-mono text-slate-400">Bot API</span>
                  <div className={`h-1.5 w-1.5 rounded-full ${botStatus === 'online' ? 'bg-blue-500 shadow-[0_0_6px_#3b82f6]' : 'bg-rose-500 animate-pulse'}`}></div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 border-l border-slate-800 pl-6">
              <button 
                onClick={handleLogout}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-800 transition-all"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {!isLoading && dbStatus === 'offline' && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/50 p-4 rounded-xl flex items-center gap-4 text-rose-200">
              <div className="p-2 bg-rose-500/20 rounded-lg"><X className="w-5 h-5" /></div>
              <div>
                <p className="font-bold">Бэкенд недоступен</p>
                <p className="text-xs opacity-70">{pollingError || `Убедитесь, что сервер запущен. Текущий адрес: ${API_BASE_URL}`}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
               <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-slate-400 animate-pulse">Синхронизация с базой данных...</p>
            </div>
          ) : (
            <>
              {activeTab === Tab.STATISTICS && (
          <Dashboard 
            stats={stats} 
            chats={filteredChats} 
            selectedChatIds={selectedChatIds}
            onToggleChatFilter={(id) => {
              setSelectedChatIds(prev => 
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
              );
            }}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        )}
              {activeTab === Tab.CHATS && (
                <ChatList 
                  chats={filteredChats} 
                  onUpdateChat={handleUpdateChat}
                  onRemoveChat={handleRemoveChat}
                  onAddChat={handleAddChat}
                />
              )}
              {activeTab === Tab.MODERATION && (
                <Moderation 
                  filters={filters}
                  onUpdateFilters={handleUpdateFilters}
                />
              )}
              {activeTab === Tab.ANTI_SCAM && (
                <AntiScam 
                  bans={bans}
                  chatBans={chatBans}
                  onBan={handleBan}
                  onUnban={handleUnban}
                  onUnbanChat={handleUnbanChat}
                  multiChatUsers={multiChatUsers}
                  latestMembers={latestMembers}
                  whitelist={whitelist}
                  onWhitelist={handleWhitelist}
                  onRemoveFromWhitelist={handleRemoveFromWhitelist}
                  chats={filteredChats}
                />
              )}
              {activeTab === Tab.SCHEDULER && (
                <Scheduler 
                  tasks={tasks}
                  chats={filteredChats}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onToggleTask={handleToggleTask}
                />
              )}
              {activeTab === Tab.BROADCAST && <Broadcast chats={filteredChats} currentUser={currentUser} />}
              {activeTab === Tab.LOGS && <Logs logs={logs} />}
              {activeTab === Tab.USERS && <UserManagement chats={chats} />}
              {activeTab === Tab.SETTINGS && (
                <Settings 
                  settings={settings} 
                  onUpdateSettings={handleUpdateSettings} 
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
