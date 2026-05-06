import express from 'express';
console.log('--- SERVER STARTING UP ---');
import path from 'path';
import { Telegraf } from 'telegraf';
import { Agent } from 'https';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './database.ts';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'teleguard-secret-key-2026';

app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'null') return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', botActive: !!bot });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userSnap = await db.collection('users').where('username', '==', username).get();
    if (userSnap.empty) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const user = userSnap.docs[0].data();
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Don't send password back
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const usersList = snapshot.docs.map(doc => {
      const { password, ...u } = doc.data();
      return u;
    });
    res.json(usersList);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  if ((req as any).user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const userData = req.body;
  try {
    const id = Math.random().toString(36).substr(2, 9);
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = {
      ...userData,
      id,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      messagesSent: 0
    };
    await db.collection('users').doc(id).set(newUser);
    const { password, ...u } = newUser;
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if ((req as any).user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const updateData = req.body;
  try {
    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Пользователь не найден' });

    const currentData = userDoc.data();
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const updatedUser = { ...currentData, ...updateData };
    await db.collection('users').doc(id).set(updatedUser);
    const { password, ...u } = updatedUser;
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  if ((req as any).user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    await db.collection('users').doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/chats', authenticateToken, (req, res) => res.json(chats));
app.get('/api/bans', authenticateToken, (req, res) => res.json(bans));
app.get('/api/filters', authenticateToken, (req, res) => res.json(filters));
app.get('/api/logs', authenticateToken, (req, res) => res.json(logs));
app.get('/api/settings', authenticateToken, (req, res) => res.json(settings));
app.get('/api/tasks', authenticateToken, (req, res) => res.json(tasks));
app.get('/api/whitelist', authenticateToken, (req, res) => res.json(whitelist));

app.post('/api/bans/chat', async (req, res) => {
  const { userId, chatId, reason, duration, unit, type } = req.body;
  try {
    if (!bot) return res.status(500).json({ error: 'Бот не инициализирован' });

    let targetId = userId;
    if (userId.startsWith('@')) {
      const m = memberships.find(m => m.username?.toLowerCase() === userId.toLowerCase());
      if (m) targetId = m.userId;
      else return res.status(404).json({ error: 'Пользователь не найден в базе данных' });
    }

    const untilDate = Math.floor(Date.now() / 1000) + (
      unit === 'days' ? duration * 24 * 60 * 60 :
      unit === 'hours' ? duration * 60 * 60 :
      duration * 60
    );

    if (type === 'MUTE') {
      await bot.telegram.restrictChatMember(chatId, targetId, {
        permissions: { can_send_messages: false },
        until_date: untilDate
      });
    } else {
      await bot.telegram.banChatMember(chatId, targetId, untilDate);
    }
    
    const chat = chats.find(c => String(c.id) === String(chatId));
    const member = memberships.find(m => String(m.userId) === String(targetId) && String(m.chatId) === String(chatId));
    const name = member ? (member.firstName || member.username || targetId) : targetId;

    const actionText = type === 'MUTE' ? 'Замучен' : 'Забанен';
    const emoji = type === 'MUTE' ? '🔇' : '🚫';
    await bot.telegram.sendMessage(chatId, `${emoji} Пользователь: ${name}\n📝 Причина: ${reason}\n⏳ Время: ${duration} ${unit}\n⚡️ Действие: ${actionText}`);

    const chatBan = {
      id: Math.random().toString(36).substr(2, 9),
      userId: targetId,
      chatId,
      chatTitle: chat?.title || chatId,
      reason,
      type: type || 'BAN',
      untilDate: new Date(untilDate * 1000).toISOString(),
      addedAt: new Date().toISOString()
    };

    await db.collection('chat_bans').doc(chatBan.id).set(cleanData(chatBan));
    chatBans.push(chatBan);

    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: type === 'MUTE' ? 'MUTE' : 'BAN',
      user: name,
      chat: chat?.title || chatId,
      details: `${actionText} в чате: ${reason} (${duration} ${unit})`
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('Chat ban/mute failed:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bans/chat', (req, res) => {
  res.json(chatBans);
});

app.delete('/api/bans/chat/:id', async (req, res) => {
  try {
    console.log(`DELETE /api/bans/chat/${req.params.id} called`);
    const ban = chatBans.find(b => b.id === req.params.id);
    if (ban) {
      if (bot) {
        try {
          console.log(`Attempting to unban/unmute user ${ban.userId} in chat ${ban.chatId} (Type: ${ban.type})`);
          if (ban.type === 'MUTE') {
            await bot.telegram.restrictChatMember(ban.chatId, Number(ban.userId), {
              permissions: {
                can_send_messages: true,
                can_send_audios: true,
                can_send_documents: true,
                can_send_photos: true,
                can_send_videos: true,
                can_send_video_notes: true,
                can_send_voice_notes: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
                can_change_info: true,
                can_invite_users: true,
                can_pin_messages: true
              }
            });
          } else {
            await bot.telegram.unbanChatMember(ban.chatId, Number(ban.userId));
          }
          console.log(`Successfully unbanned/unmuted user ${ban.userId} via bot`);
        } catch (e) {
          console.error('Failed to unban/unmute via bot:', e);
        }
      }
      await db.collection('chat_bans').doc(req.params.id).delete();
      const oldLength = chatBans.length;
      chatBans = chatBans.filter(b => b.id !== req.params.id);
      console.log(`Deleted chat ban record ${req.params.id} from Firestore and local state. Old length: ${oldLength}, New length: ${chatBans.length}`);
    } else {
      console.warn(`Chat ban record ${req.params.id} not found in local state`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete chat ban ${req.params.id}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});
app.get('/api/memberships/multi-chat', (req, res) => {
  const userMap = new Map<string, any>();
  
  console.log(`Calculating multi-chat users. Memberships: ${memberships.length}, Chats: ${chats.length}`);
  
  // Sort memberships by lastSeen or joinedAt to get the freshest info first
  const sortedMemberships = [...memberships].sort((a, b) => {
    const timeA = new Date(a.lastSeen || a.joinedAt || 0).getTime();
    const timeB = new Date(b.lastSeen || b.joinedAt || 0).getTime();
    return timeB - timeA;
  });

  sortedMemberships.forEach(m => {
    const userId = String(m.userId);
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId: userId,
        username: m.username,
        firstName: m.firstName,
        lastName: m.lastName,
        chats: []
      });
    }
    const user = userMap.get(userId);
    const chat = chats.find(c => String(c.id) === String(m.chatId));
    if (chat) {
      // Avoid duplicate chats for the same user
      if (!user.chats.some((c: any) => String(c.id) === String(chat.id))) {
        user.chats.push({ id: chat.id, title: chat.title });
      }
    }
  });

  const multiChatUsersResult = Array.from(userMap.values())
    .filter(u => u.chats.length > 1)
    .map(u => ({
      ...u,
      isWhitelisted: whitelist.some(w => String(w.userId) === String(u.userId) || String(w.id) === String(u.userId)),
      isBanned: bans.some(b => String(b.userId) === String(u.userId) || String(b.id) === String(u.userId))
    }));

  console.log(`Found ${multiChatUsersResult.length} users in multiple chats`);
  res.json(multiChatUsersResult);
});

app.get('/api/stats', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const queryChatIds = req.query.chatIds ? (req.query.chatIds as string).split(',') : null;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  
  // If not super admin, restrict to assigned chats
  let allowedChatIds = queryChatIds;
  if (user.role !== 'SUPER_ADMIN') {
    const assigned = user.assignedChatIds || [];
    if (queryChatIds) {
      allowedChatIds = queryChatIds.filter(id => assigned.includes(id));
    } else {
      allowedChatIds = assigned;
    }
    
    if (allowedChatIds.length === 0 && assigned.length > 0) {
      return res.json({
        totalMembers: 0,
        totalMessages24h: 0,
        modActions: 0,
        activeChats: 0,
        chartData: [],
        topActiveMembers: [],
        topActiveAdmins: [],
        topChatsByMembers: [],
        topChatsByMessages24h: [],
        topChatsByTotalMessages: [],
        topChatsByActiveUsers: [],
        topChatsByOnlineUsers: []
      });
    }
  }

  const filteredChats = allowedChatIds 
    ? chats.filter(c => allowedChatIds.includes(String(c.id)))
    : chats.filter(c => c.active);

  const totalMembers = filteredChats.reduce((acc, chat) => acc + (chat.members || 0), 0);
  const activeChatsCount = filteredChats.length;
  
  const todayDate = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const today = statsHistory.find(s => s.date === todayDate) || { msgs: 0, chatStats: {}, joins: 0, leaves: 0, totalMembers: totalMembers };
  const yesterday = statsHistory.find(s => s.date === yesterdayDate);
  
  let totalMessages24h = 0;
  let prevMessages24h = 0;
  
  if (allowedChatIds) {
    totalMessages24h = allowedChatIds.reduce((acc, id) => {
      const chatStat = today.chatStats?.[id];
      return acc + (chatStat?.msgs || 0);
    }, 0);
    
    if (yesterday) {
      prevMessages24h = allowedChatIds.reduce((acc, id) => {
        const chatStat = yesterday.chatStats?.[id];
        return acc + (chatStat?.msgs || 0);
      }, 0);
    }
  } else {
    totalMessages24h = today.msgs || 0;
    prevMessages24h = yesterday?.msgs || 0;
  }

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return current > 0 ? "+100%" : "+0.0%";
    const diff = ((current - previous) / previous) * 100;
    return (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
  };

  const totalMembersTrend = yesterday ? calculateTrend(totalMembers, yesterday.totalMembers || totalMembers) : "+0.0%";
  const messagesTrend = calculateTrend(totalMessages24h, prevMessages24h);
  
  const modActions = logs.filter(l => {
    const isModAction = ['BAN', 'KICK', 'WARN', 'MUTE'].includes(l.type);
    if (!isModAction) return false;
    
    if (startDate && l.timestamp.split('T')[0] < startDate) return false;
    if (endDate && l.timestamp.split('T')[0] > endDate) return false;

    if (allowedChatIds) {
      const chat = chats.find(c => c.title === l.chat);
      return chat && allowedChatIds.includes(String(chat.id));
    }
    return true;
  }).length;

  // For mod actions trend, we compare current period with previous period of same length
  let modActionsTrend = "+0.0%";
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const prevStart = new Date(start.getTime() - diffTime - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const prevEnd = new Date(start.getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const prevModActions = logs.filter(l => {
      const isModAction = ['BAN', 'KICK', 'WARN', 'MUTE'].includes(l.type);
      if (!isModAction) return false;
      if (l.timestamp.split('T')[0] < prevStart || l.timestamp.split('T')[0] > prevEnd) return false;
      if (allowedChatIds) {
        const chat = chats.find(c => c.title === l.chat);
        return chat && allowedChatIds.includes(String(chat.id));
      }
      return true;
    }).length;
    modActionsTrend = calculateTrend(modActions, prevModActions);
  } else {
    // Default: compare last 24h with previous 24h
    const prev24hStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const prev24hEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const prevModActions = logs.filter(l => {
      const isModAction = ['BAN', 'KICK', 'WARN', 'MUTE'].includes(l.type);
      if (!isModAction) return false;
      if (l.timestamp < prev24hStart || l.timestamp > prev24hEnd) return false;
      if (allowedChatIds) {
        const chat = chats.find(c => c.title === l.chat);
        return chat && allowedChatIds.includes(String(chat.id));
      }
      return true;
    }).length;
    const current24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const currentModActions = logs.filter(l => {
      const isModAction = ['BAN', 'KICK', 'WARN', 'MUTE'].includes(l.type);
      if (!isModAction) return false;
      if (l.timestamp < current24hStart) return false;
      if (allowedChatIds) {
        const chat = chats.find(c => c.title === l.chat);
        return chat && allowedChatIds.includes(String(chat.id));
      }
      return true;
    }).length;
    modActionsTrend = calculateTrend(currentModActions, prevModActions);
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const onlineMembers = memberships.filter(m => {
    if (allowedChatIds && !allowedChatIds.includes(String(m.chatId))) return false;
    const chat = chats.find(c => c.id === m.chatId);
    if (!chat || !chat.active) return false;
    return m.lastSeen && m.lastSeen > twentyFourHoursAgo;
  }).length;

  let filteredStatsHistory = [...statsHistory];
  if (startDate) {
    filteredStatsHistory = filteredStatsHistory.filter(s => s.date >= startDate);
  }
  if (endDate) {
    filteredStatsHistory = filteredStatsHistory.filter(s => s.date <= endDate);
  }

  // If no date range provided, default to last 7 days for the chart
  if (!startDate && !endDate) {
    filteredStatsHistory = filteredStatsHistory.slice(-7);
  }

  const chartData = filteredStatsHistory.map(point => {
    let filteredJoins = 0;
    let filteredLeaves = 0;
    let filteredMsgs = 0;
    let filteredActiveMembers = 0;
    let filteredOnlineMembers = 0;
    let filteredTotalMembers = 0;
    
    // If we have chat-specific stats, use them. Otherwise fallback to global stats.
    if (allowedChatIds && point.chatStats) {
      const activeUsersSet = new Set<string>();
      const onlineUsersSet = new Set<string>();
      allowedChatIds.forEach(id => {
        const chatStat = point.chatStats?.[id];
        if (chatStat) {
          filteredJoins += (chatStat.joins || 0);
          filteredLeaves += (chatStat.leaves || 0);
          filteredMsgs += (chatStat.msgs || 0);
          if (chatStat.activeUsers) {
            chatStat.activeUsers.forEach((uid: string) => activeUsersSet.add(uid));
          }
          if (chatStat.onlineUsers) {
            chatStat.onlineUsers.forEach((uid: string) => onlineUsersSet.add(uid));
          }
          filteredTotalMembers += (chatStat.totalMembers || 0);
        }
      });
      filteredActiveMembers = activeUsersSet.size;
      filteredOnlineMembers = onlineUsersSet.size;
    } else {
      // Fallback: if no chatStats or no allowedChatIds, use global point stats
      filteredJoins = point.joins || 0;
      filteredLeaves = point.leaves || 0;
      filteredMsgs = point.msgs || 0;
      filteredActiveMembers = point.activeUsers?.length || 0;
      filteredOnlineMembers = point.onlineUsers?.length || 0;
      filteredTotalMembers = point.totalMembers || 0;
    }
    
    return {
      name: point.name,
      joins: filteredJoins,
      leaves: filteredLeaves,
      msgs: filteredMsgs,
      activeMembers: filteredActiveMembers,
      onlineMembers: filteredOnlineMembers,
      totalMembers: filteredTotalMembers
    };
  });

  const topActiveMembersMap = new Map<string, any>();
  memberships.forEach(m => {
    if (allowedChatIds && !allowedChatIds.includes(String(m.chatId))) return;
    const chat = chats.find(c => c.id === m.chatId);
    if (!chat || !chat.active) return;
    
    if (!topActiveMembersMap.has(m.userId)) {
      topActiveMembersMap.set(m.userId, {
        userId: m.userId,
        username: m.username,
        firstName: m.firstName,
        msgCount: 0,
        chats: []
      });
    }
    const user = topActiveMembersMap.get(m.userId);
    user.msgCount += (m.msgCount || 0);
    user.chats.push({ id: chat.id, title: chat.title });
  });

  const topActiveMembers = Array.from(topActiveMembersMap.values())
    .sort((a, b) => b.msgCount - a.msgCount)
    .slice(0, 10);

  const topActiveAdminsMap = new Map<string, any>();
  memberships.forEach(m => {
    if (!m.isAdmin) return;
    if (allowedChatIds && !allowedChatIds.includes(String(m.chatId))) return;
    const chat = chats.find(c => c.id === m.chatId);
    if (!chat || !chat.active) return;
    
    if (!topActiveAdminsMap.has(m.userId)) {
      topActiveAdminsMap.set(m.userId, {
        userId: m.userId,
        username: m.username,
        firstName: m.firstName,
        msgCount: 0,
        chats: []
      });
    }
    const admin = topActiveAdminsMap.get(m.userId);
    admin.msgCount += (m.msgCount || 0);
    admin.chats.push({ id: chat.id, title: chat.title });
  });

  const topActiveAdmins = Array.from(topActiveAdminsMap.values())
    .sort((a, b) => b.msgCount - a.msgCount)
    .slice(0, 10);

  // Top 10 Chats by Members
  const topChatsByMembers = [...filteredChats]
    .sort((a, b) => (b.members || 0) - (a.members || 0))
    .slice(0, 10)
    .map(c => ({ id: c.id, title: c.title, count: c.members || 0 }));

  // Top 10 Chats by Messages 24h
  const topChatsByMessages24h = [...filteredChats]
    .map(c => ({
      id: c.id,
      title: c.title,
      count: today.chatStats?.[c.id]?.msgs || 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Chats by Total Messages
  const topChatsByTotalMessages = [...filteredChats]
    .sort((a, b) => (b.msgCount || 0) - (a.msgCount || 0))
    .slice(0, 10)
    .map(c => ({ id: c.id, title: c.title, count: c.msgCount || 0 }));

  // Top 10 Chats by Active Users (today)
  const topChatsByActiveUsers = [...filteredChats]
    .map(c => ({
      id: c.id,
      title: c.title,
      count: today.chatStats?.[c.id]?.activeUsers?.length || 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 10 Chats by Online Users (today)
  const topChatsByOnlineUsers = [...filteredChats]
    .map(c => {
      // For "Online", we use the same 24h window as the main stat for consistency
      const chatOnlineCount = memberships.filter(m => 
        String(m.chatId) === String(c.id) && 
        m.lastSeen && m.lastSeen > twentyFourHoursAgo
      ).length;
      
      return {
        id: c.id,
        title: c.title,
        count: chatOnlineCount
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    totalMembers,
    totalMembersTrend,
    totalMessages24h,
    messagesTrend,
    modActions,
    modActionsTrend,
    activeChats: activeChatsCount,
    chartData,
    topActiveMembers,
    topActiveAdmins,
    topChatsByMembers,
    topChatsByMessages24h,
    topChatsByTotalMessages,
    topChatsByActiveUsers,
    topChatsByOnlineUsers
  });
});

app.get('/api/memberships/latest', (req, res) => {
  const latestMembers = [...memberships]
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
    .slice(0, 20)
    .map(m => {
      const chat = chats.find(c => c.id === m.chatId);
      return {
        ...m,
        chatTitle: chat ? chat.title : 'Unknown'
      };
    });
  res.json(latestMembers);
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Access denied' });
    
    const newSettings = req.body;
    console.log('Updating settings:', newSettings);
    await db.collection('config').doc('settings').set(cleanData(newSettings));
    settings = { ...settings, ...newSettings };
    
    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'SETTINGS',
      user: user.username,
      chat: 'System',
      details: `Обновлены настройки системы.`
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/filters', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') return res.status(403).json({ error: 'Access denied' });
    
    const newFilters = req.body;
    console.log('Updating filters:', newFilters);
    await db.collection('config').doc('moderation').set(cleanData(newFilters));
    filters = { ...filters, ...newFilters };
    
    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'SETTINGS',
      user: user.username,
      chat: 'System',
      details: `Обновлены глобальные правила модерации.`
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update filters:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const update = req.body;
    console.log(`Updating task ${req.params.id}:`, update);
    const taskIndex = tasks.findIndex(t => t.id === req.params.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...update };
      await db.collection('tasks').doc(req.params.id).set(cleanData(tasks[taskIndex]));
    }
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to update task ${req.params.id}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = req.body;
    console.log('Creating task:', task);
    await db.collection('tasks').doc(task.id).set(cleanData(task));
    tasks.push(task);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to create task:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await db.collection('tasks').doc(req.params.id).delete();
    tasks = tasks.filter(t => t.id !== req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/broadcast/delete-last', async (req, res) => {
  try {
    if (!bot) throw new Error('Bot not initialized');
    
    const results = [];
    for (const msg of lastBroadcastMessages) {
      try {
        await bot.telegram.deleteMessage(msg.chatId, msg.messageId);
        results.push({ ...msg, success: true });
      } catch (e) {
        results.push({ ...msg, success: false, error: (e as Error).message });
      }
    }
    
    lastBroadcastMessages = [];
    await db.collection('config').doc('broadcast').set({ messages: [] });
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/bans', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const ban = req.body;
    if (!ban.id) ban.id = Math.random().toString(36).substr(2, 9);
    if (!ban.date) ban.date = new Date().toISOString();
    
    await db.collection('bans').doc(ban.userId.toString()).set(cleanData(ban));
    
    // Update local state
    const index = bans.findIndex(b => String(b.userId) === String(ban.userId));
    if (index !== -1) {
      bans[index] = ban;
    } else {
      bans.push(ban);
    }
    
    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'BAN',
      user: user.username,
      chat: 'Global',
      details: `Глобальный бан пользователя ${ban.userId}. Причина: ${ban.reason}`
    });

    // Apply ban in all managed chats
    if (bot) {
      for (const chat of chats.filter(c => c.active)) {
        try {
          // Telegram API expects a number for userId
          await bot.telegram.banChatMember(chat.id, Number(ban.userId));
          console.log(`Global ban applied for ${ban.userId} in chat ${chat.id} (${chat.title})`);
        } catch (e) {
          const errorMessage = (e as Error).message;
          
          // If chat is not found, deactivate it
          if (errorMessage.includes('chat not found')) {
            console.log(`Deactivating chat ${chat.id} because it was not found.`);
            chat.active = false;
            await updateChat(chat, true);
          } else {
            console.error(`Failed to apply global ban for ${ban.userId} in chat ${chat.id}:`, errorMessage);
          }
        }
      }
    }
    
    res.json(ban);
  } catch (err) {
    console.error('Failed to create global ban:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/bans/:userId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    await db.collection('bans').doc(req.params.userId).delete();
    // Update local state
    bans = bans.filter(b => String(b.userId) !== String(req.params.userId));
    
    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'BAN',
      user: user.username,
      chat: 'Global',
      details: `Снят глобальный бан с пользователя ${req.params.userId}`
    });

    // Unban in all managed chats
    if (bot) {
      for (const chat of chats.filter(c => c.active)) {
        try {
          // Telegram API expects a number for userId
          await bot.telegram.unbanChatMember(chat.id, Number(req.params.userId));
          console.log(`Global unban applied for ${req.params.userId} in chat ${chat.id} (${chat.title})`);
        } catch (e) {
          const errorMessage = (e as Error).message;
          
          // If chat is not found, deactivate it
          if (errorMessage.includes('chat not found')) {
            console.log(`Deactivating chat ${chat.id} because it was not found.`);
            chat.active = false;
            await updateChat(chat, true);
          } else {
            console.error(`Failed to apply global unban for ${req.params.userId} in chat ${chat.id}:`, errorMessage);
          }
        }
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete global ban for ${req.params.userId}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/whitelist', async (req, res) => {
  try {
    const entry = req.body;
    console.log('Adding to whitelist:', entry);
    if (!entry.id) entry.id = Math.random().toString(36).substr(2, 9);
    if (!entry.addedAt) entry.addedAt = new Date().toISOString();
    
    await db.collection('whitelist').doc(entry.userId.toString()).set(cleanData(entry));
    
    // Update local state
    const index = whitelist.findIndex(w => String(w.userId) === String(entry.userId) || String(w.id) === String(entry.userId));
    if (index !== -1) {
      whitelist[index] = entry;
    } else {
      whitelist.push(entry);
    }
    
    console.log(`Whitelist updated. Total entries: ${whitelist.length}`);
    res.json(entry);
  } catch (err) {
    console.error('Failed to add to whitelist:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/whitelist/:userId', async (req, res) => {
  try {
    console.log(`Removing from whitelist: ${req.params.userId}`);
    await db.collection('whitelist').doc(req.params.userId).delete();
    // Update local state
    whitelist = whitelist.filter(w => String(w.userId) !== String(req.params.userId) && String(w.id) !== String(req.params.userId));
    console.log(`Whitelist updated after removal. Total entries: ${whitelist.length}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove from whitelist:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const chat = req.body;
    console.log('Adding chat:', chat);
    await updateChat(chat);
    res.json(chat);
  } catch (err) {
    console.error('Failed to add chat:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/chats/:id', async (req, res) => {
  try {
    const chatId = req.params.id;
    console.log('Removing chat:', chatId);
    await db.collection('chats').doc(chatId).delete();
    chats = chats.filter(c => c.id !== chatId);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to remove chat ${req.params.id}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/chats/:id', async (req, res) => {
  try {
    const updatedChat = req.body;
    console.log(`Updating chat ${req.params.id}:`, updatedChat);
    await updateChat(updatedChat);
    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to update chat ${req.params.id}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/chats/:id/settings', async (req, res) => {
  try {
    const chatSettings = req.body;
    await db.collection('chats').doc(req.params.id).update({ settings: cleanData(chatSettings) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Firestore Error Handler
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the bot, but we log it
}

// Helper to remove undefined values for Firestore
function cleanData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data === undefined ? null : data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanData(item));
  }

  const cleaned: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== undefined) {
        cleaned[key] = cleanData(value);
      } else {
        cleaned[key] = null;
      }
    }
  }
  return cleaned;
}

// Throttled Write Queue
const pendingWrites = new Map<string, { collection: string, docId: string, data: any, type: 'set' | 'delete' }>();
const membershipLastWrite = new Map<string, number>();
const chatLastWrite = new Map<string, number>();
let isFlushing = false;

function queueWrite(collection: string, docId: string, data: any) {
  const key = `${collection}/${docId}`;
  pendingWrites.set(key, { collection, docId, data, type: 'set' });
}

function queueDelete(collection: string, docId: string) {
  const key = `${collection}/${docId}`;
  pendingWrites.set(key, { collection, docId, data: null, type: 'delete' });
  if (collection === 'memberships') membershipLastWrite.delete(docId);
  if (collection === 'chats') chatLastWrite.delete(docId);
}

async function flushWrites() {
  if (isFlushing || pendingWrites.size === 0) return;
  isFlushing = true;
  
  const updates = Array.from(pendingWrites.values());
  pendingWrites.clear();
  
  console.log(`[Firestore] Flushing ${updates.length} queued updates...`);
  
  // Process in small chunks to avoid RESOURCE_EXHAUSTED
  const chunkSize = 20;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (update) => {
      try {
        if (update.type === 'delete') {
          await db.collection(update.collection).doc(update.docId).delete();
        } else {
          await db.collection(update.collection).doc(update.docId).set(update.data);
        }
      } catch (err) {
        console.error(`[Firestore] Flush failed for ${update.collection}/${update.docId}:`, err);
      }
    }));
  }
  
  isFlushing = false;
}

setInterval(flushWrites, 30000); // Flush every 30 seconds to reduce write frequency

let lastBroadcastMessages: { chatId: string, messageId: number }[] = [];
let scheduledDeletions: { chatId: string, messageId: number, deleteAt: string }[] = [];
let captchaSessions = new Map<string, { chatId: string, answer: string, timestamp: number }>();
let broadcastSessions = new Map<string, { 
  message: any, 
  options: { pin: boolean, delay: number, silent: boolean, selectedChats: string[] } 
}>();
let activeVotes = new Map<string, {
  targetUserId: number,
  targetName: string,
  chatId: number,
  type: 'BAN' | 'MUTE',
  votes: Set<number>,
  requiredVotes: number,
  messageId: number,
  expiresAt: number
}>();

// Data state (synced with Firestore)
let broadcastHistory: any[] = [];
let chats: any[] = [];
let logs: any[] = [];
let statsHistory: any[] = [];
let bans: any[] = [];
let tasks: any[] = [];
let memberships: any[] = [];
let whitelist: any[] = [];
let chatBans: any[] = [];
let filters = {
  blockLinks: true,
  blockTelegramLinks: false,
  blockMedia: false,
  blockForwards: true,
  forbiddenWords: ['scam', 'crypto', 'free money'],
  autoApprove: true,
  captchaEnabled: false,
  captchaQuestion: 'Сколько будет 2 + 2?',
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
  multiChatThreshold: 5
};
let settings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '7523471690:AAGSfN9svITRIFGVxmfI1726SKMoOOPiT1Y',
  adminPassword: '',
  dbHost: 'localhost',
  dbUser: 'root',
  dbPass: '',
  dbName: 'teleguard',
  maintenanceMode: false
};

// Sync functions
async function syncData() {
  try {
    console.log(`Starting data sync...`);
    // Initial load
    const chatsSnap = await db.collection('chats').get();
    chats = chatsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${chats.length} chats`);

    const tasksSnap = await db.collection('tasks').get();
    tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${tasks.length} tasks`);

    const bansSnap = await db.collection('bans').get();
    bans = bansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${bans.length} bans`);

    const membershipsSnap = await db.collection('memberships').get();
    memberships = membershipsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${memberships.length} memberships`);

    const whitelistSnap = await db.collection('whitelist').get();
    whitelist = whitelistSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${whitelist.length} whitelisted users`);

    const chatBansSnap = await db.collection('chat_bans').get();
    chatBans = chatBansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${chatBans.length} chat-specific bans`);

    const logsSnap = await db.collection('logs').orderBy('timestamp', 'desc').limit(100).get();
    logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${logs.length} logs`);

    const statsSnap = await db.collection('stats').orderBy('date', 'asc').get();
    statsHistory = statsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${statsHistory.length} stats history entries`);

    const filtersDoc = await db.collection('config').doc('moderation').get();
    if (filtersDoc.exists) {
      filters = { ...filters, ...filtersDoc.data() as any };
      console.log('Loaded moderation filters');
    }

    const settingsDoc = await db.collection('config').doc('settings').get();
    if (settingsDoc.exists) {
      settings = { ...settings, ...settingsDoc.data() as any };
      console.log('Loaded settings');
    }

    const broadcastDoc = await db.collection('config').doc('broadcast').get();
    if (broadcastDoc.exists) {
      lastBroadcastMessages = (broadcastDoc.data() as any).messages || [];
    }

    const broadcastHistorySnap = await db.collection('broadcast_history').orderBy('timestamp', 'desc').limit(100).get();
    broadcastHistory = broadcastHistorySnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    console.log(`Loaded ${broadcastHistory.length} broadcast history entries`);

    const deletionsDoc = await db.collection('config').doc('deletions').get();
    if (deletionsDoc.exists) {
      scheduledDeletions = (deletionsDoc.data() as any).items || [];
    }

    // Create default super admin if no users exist
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
      console.log('No users found. Creating default super admin...');
      const adminId = 'admin';
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const defaultAdmin = {
        id: adminId,
        username: 'admin',
        email: 'admin@teleguard.local',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        assignedChatIds: [],
        createdAt: new Date().toISOString()
      };
      await db.collection('users').doc(adminId).set(defaultAdmin);
      console.log('Default super admin created: admin / admin123');
    }

    // Periodically refresh chat info if bot is ready
    setInterval(async () => {
      if (!bot) return;
      console.log('Refreshing chat info...');
      for (const chat of chats) {
        try {
          const chatFull = await bot.telegram.getChat(chat.id);
          const memberCount = await bot.telegram.getChatMembersCount(chat.id);
          let avatarUrl = chat.avatarUrl;
          
          if (chatFull.photo) {
            const fileId = chatFull.photo.small_file_id;
            const fileLink = await bot.telegram.getFileLink(fileId);
            avatarUrl = fileLink.toString();
          }

          const updatedChat = {
            ...chat,
            title: 'title' in chatFull ? chatFull.title : chat.title,
            members: memberCount,
            avatarUrl
          };
          
          if (JSON.stringify(updatedChat) !== JSON.stringify(chat)) {
            await updateChat(updatedChat);
          }
        } catch (e) {
          console.error(`Failed to refresh chat info for ${chat.id}:`, e);
        }
      }
    }, 1000 * 60 * 60); // Every hour

    // Set up real-time listeners for config
    db.collection('config').doc('moderation').onSnapshot((doc) => {
      if (doc.exists) {
        filters = { ...filters, ...doc.data() as any };
        console.log('Moderation filters updated from Firestore');
      }
    }, (err: any) => {
      // Suppress idle stream timeout noise as it's benign and handled by SDK reconnection
      if (err.message && (err.message.includes('idle stream') || err.message.includes('CANCELLED'))) {
        return;
      }
      console.error('Firestore moderation stream error:', err);
    });

    db.collection('config').doc('settings').onSnapshot((doc) => {
      if (doc.exists) {
        const newSettings = doc.data() as any;
        const tokenChanged = newSettings.botToken !== settings.botToken;
        settings = { ...settings, ...newSettings };
        if (tokenChanged) {
          console.log('Bot token updated from Firestore, restarting...');
          initBot(settings.botToken);
        }
      }
    }, (err: any) => {
      // Suppress idle stream timeout noise as it's benign and handled by SDK reconnection
      if (err.message && (err.message.includes('idle stream') || err.message.includes('CANCELLED'))) {
        return;
      }
      console.error('Firestore settings stream error:', err);
    });

    console.log('Data synced successfully');
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'initial_sync');
  }
}

// Helper to update Firestore and local state
async function updateChat(chat: any, immediate = false) {
  try {
    if (!chat.id) throw new Error('Chat ID is required for update');
    const cleaned = cleanData(chat);
    
    const idx = chats.findIndex(c => c.id === chat.id.toString());
    if (idx !== -1) chats[idx] = chat;
    else chats.push(chat);

    if (immediate) {
      console.log(`Saving chat ${chat.id} to Firestore (immediate):`, cleaned);
      await db.collection('chats').doc(chat.id.toString()).set(cleaned);
      chatLastWrite.set(chat.id.toString(), Date.now());
    } else {
      // Only queue write if last write was > 5 minutes ago or it's a new chat
      const lastWrite = chatLastWrite.get(chat.id.toString()) || 0;
      if (Date.now() - lastWrite > 5 * 60 * 1000) {
        queueWrite('chats', chat.id.toString(), cleaned);
        chatLastWrite.set(chat.id.toString(), Date.now());
      }
    }
  } catch (err) {
    console.error(`Failed to update chat ${chat.id}:`, err);
    handleFirestoreError(err, OperationType.WRITE, `chats/${chat.id}`);
    if (immediate) throw err;
  }
}

async function addLog(log: any) {
  try {
    const cleaned = cleanData(log);
    queueWrite('logs', log.id, cleaned);
    logs.unshift(log);
    if (logs.length > 100) logs.pop();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `logs/${log.id}`);
  }
}

async function updateStats(point: any) {
  try {
    const cleaned = cleanData(point);
    queueWrite('stats', point.date, cleaned);
    const idx = statsHistory.findIndex(s => s.date === point.date);
    if (idx !== -1) statsHistory[idx] = point;
    else {
      statsHistory.push(point);
      statsHistory.sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `stats/${point.date}`);
  }
}

async function incrementDailyStats(chatId: string, type: 'joins' | 'leaves' | 'msgs', amount: number = 1, userId?: string) {
  const todayDate = new Date().toISOString().split('T')[0];
  let today = statsHistory.find(s => s.date === todayDate);
  if (!today) {
    const [y, m, d] = todayDate.split('-');
    today = { 
      date: todayDate, 
      name: `${d}.${m}.${y}`, 
      joins: 0, 
      leaves: 0, 
      msgs: 0, 
      chatStats: {},
      activeUsers: [],
      onlineUsers: []
    };
  }

  if (type === 'joins') today.joins = (today.joins || 0) + amount;
  if (type === 'leaves') today.leaves = (today.leaves || 0) + amount;
  if (type === 'msgs') today.msgs = (today.msgs || 0) + amount;

  if (!today.chatStats) today.chatStats = {};
  if (!today.chatStats[chatId]) {
    today.chatStats[chatId] = { joins: 0, leaves: 0, msgs: 0, activeUsers: [], onlineUsers: [] };
  }
  
  if (type === 'joins') today.chatStats[chatId].joins += amount;
  if (type === 'leaves') today.chatStats[chatId].leaves += amount;
  if (type === 'msgs') today.chatStats[chatId].msgs += amount;

  if (userId) {
    if (type === 'msgs' || type === 'joins') {
      if (!today.activeUsers) today.activeUsers = [];
      if (!today.activeUsers.includes(userId)) today.activeUsers.push(userId);
      
      if (!today.chatStats[chatId].activeUsers) today.chatStats[chatId].activeUsers = [];
      if (!today.chatStats[chatId].activeUsers.includes(userId)) today.chatStats[chatId].activeUsers.push(userId);
    }
    
    if (!today.onlineUsers) today.onlineUsers = [];
    if (!today.onlineUsers.includes(userId)) today.onlineUsers.push(userId);
    
    if (!today.chatStats[chatId].onlineUsers) today.chatStats[chatId].onlineUsers = [];
    if (!today.chatStats[chatId].onlineUsers.includes(userId)) today.chatStats[chatId].onlineUsers.push(userId);
  }

  // Update total members snapshot
  today.totalMembers = chats.filter(c => c.active).reduce((acc, c) => acc + (c.members || 0), 0);
  const chat = chats.find(c => c.id === chatId);
  if (chat) {
    today.chatStats[chatId].totalMembers = chat.members;
  }

  await updateStats(today);
}

async function trackMembership(chatId: string, user: { id: number, username?: string, first_name?: string, last_name?: string }, isMessage = false) {
  const userId = user.id.toString();
  const membershipId = `${chatId}_${userId}`;
  
  // Heuristic for admin status: if they are in the bot's admin list or we check them
  // For simplicity, we'll check if they are an admin if we don't know yet
  let isAdmin = false;
  const existingMembership = memberships.find(m => m.id === membershipId);
  if (existingMembership && existingMembership.isAdmin !== undefined) {
    isAdmin = existingMembership.isAdmin;
  } else if (bot && isMessage) {
    // Check admin status occasionally (e.g. 1% of messages or if new)
    if (!existingMembership || Math.random() < 0.01) {
      try {
        const member = await bot.telegram.getChatMember(chatId, user.id);
        isAdmin = ['administrator', 'creator'].includes(member.status);
      } catch (e) {}
    }
  }

  const membershipData = {
    id: membershipId,
    chatId,
    userId,
    username: user.username ? `@${user.username}` : null,
    firstName: user.first_name || null,
    lastName: user.last_name || null,
    lastSeen: new Date().toISOString(),
    isAdmin
  };
  
  try {
    const existingIdx = memberships.findIndex(m => m.id === membershipId);
    if (existingIdx === -1) {
      const membership = { ...membershipData, joinedAt: new Date().toISOString(), msgCount: isMessage ? 1 : 0 };
      queueWrite('memberships', membershipId, cleanData(membership));
      membershipLastWrite.set(membershipId, Date.now());
      memberships.push(membership);
      console.log(`New membership tracked for user ${userId} in chat ${chatId}`);

      // Count as join
      await incrementDailyStats(chatId, 'joins', 1, userId);

      // Check for multi-chat join notification
      const userMemberships = memberships.filter(m => m.userId === userId);
      if (filters.notifyMultiChat && userMemberships.length >= filters.multiChatThreshold) {
        const bookrayChatId = process.env.BOOKRAY_CHAT_ID;
        if (bookrayChatId && bot) {
          const chatTitles = userMemberships.map(m => {
            const c = chats.find(ch => ch.id === m.chatId);
            return c ? c.title : m.chatId;
          }).join(', ');
          
          const alertMsg = `⚠️ *Внимание!* Пользователь [${user.first_name || userId}](tg://user?id=${userId}) вступил в ${userMemberships.length} чатов.\n\n*Чаты:* ${chatTitles}`;
          bot.telegram.sendMessage(bookrayChatId, alertMsg, { parse_mode: 'Markdown' }).catch(e => console.error('Failed to send multi-chat alert:', e));
        }
      }
    } else {
      const currentMembership = memberships[existingIdx];
      const updated = { 
        ...currentMembership, 
        ...membershipData,
        msgCount: (currentMembership.msgCount || 0) + (isMessage ? 1 : 0)
      };
      
      memberships[existingIdx] = updated;

      // Update last seen in DB occasionally to avoid too many writes
      const lastWrite = membershipLastWrite.get(membershipId) || 0;
      if (Date.now() - lastWrite > 15 * 60 * 1000) {
        queueWrite('memberships', membershipId, cleanData(updated));
        membershipLastWrite.set(membershipId, Date.now());
      }

      // Count message or just update online status
      if (isMessage) {
        await incrementDailyStats(chatId, 'msgs', 1, userId);
      } else {
        // Just update online status without incrementing msg count
        await incrementDailyStats(chatId, 'msgs', 0, userId); 
      }
    }
  } catch (e) {
    console.error('Failed to save membership:', e);
  }
}

// Initialize Telegram Bot
let bot: Telegraf | null = null;

async function initBot(token: string, retryCount = 3) {
  if (!token) {
    console.warn('Bot token is empty. Bot functionality is disabled.');
    return null;
  }

  try {
    if (bot) {
      console.log('Stopping existing bot instance...');
      try {
        await bot.stop();
      } catch (stopErr) {
        console.warn('Error while stopping bot:', stopErr);
      }
    }

    bot = new Telegraf(token, {
      handlerTimeout: 60000,
      telegram: {
        apiRoot: 'https://api.telegram.org',
        agent: new Agent({ keepAlive: true, timeout: 30000 }),
      }
    });

    bot.catch((err, ctx) => {
      console.error(`Unhandled error while processing ${ctx.updateType}:`, err);
    });
    
    // Add simple ping to check connectivity before launch
    try {
      console.log('Testing connection to Telegram API...');
      const response = await fetch('https://api.telegram.org', { timeout: 10000 }).catch(e => { throw new Error(`DNS/Connection error: ${e.message}`); });
      if (!response.ok) console.warn(`Telegram API test status: ${response.status}`);
      else console.log('Telegram API is reachable');
    } catch (e: any) {
      console.error('Network connectivity check failed:', e.message);
      // We still try to launch, maybe it's just the test that failed
    }

    bot.start((ctx) => {
      console.log('Start command received');
      ctx.reply('TeleGuard Admin Bot is active!');
    });
    
    bot.help((ctx) => ctx.reply('Send me a message to see how I can help you manage your chats.'));
    
    bot.on('message', async (ctx) => {
      if (settings.maintenanceMode) return;

      const chatId = ctx.chat.id.toString();
      const chatType = ctx.chat.type;
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;

      // Check for global bans
      const isGloballyBanned = bans.find(b => String(b.userId) === String(userId));
      const isWhitelisted = whitelist.some(w => String(w.userId) === String(userId) || (username && w.username && w.username.toLowerCase() === `@${username.toLowerCase()}`));

      if (isGloballyBanned && !isWhitelisted && chatType !== 'private') {
        try {
          await ctx.telegram.banChatMember(chatId, Number(userId));
          await ctx.deleteMessage();
          console.log(`Auto-banned globally banned user ${userId} in chat ${chatId} after message`);
          return;
        } catch (e) {
          console.error(`Failed to auto-ban globally banned user ${userId} in chat ${chatId}:`, (e as Error).message);
        }
      }

      // Store bookray's chatId for reports
      if (username === 'bookray' && chatType === 'private') {
        process.env.BOOKRAY_CHAT_ID = chatId;
      }

      // Restrict bot communication to @bookray
      // If it's a private chat and not @bookray, ignore or notify
      if (chatType === 'private' && username !== 'bookray') {
        // If they are in a captcha session, we must allow it
        const session = captchaSessions.get(userId);
        if (!session) {
          console.log(`Unauthorized private interaction from @${username} (${userId})`);
          return; 
        }
      }

      // Handle Broadcast from Admin
      if (chatType === 'private' && username === 'bookray') {
        // If it's a command, handle it normally. 
        if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/')) {
           // allow commands to pass through
        } else if (ctx.message) {
          // Treat any other message/forward as a broadcast source
          broadcastSessions.set(userId, { 
            message: ctx.message, 
            options: { 
              pin: false, 
              delay: 10, 
              silent: false, 
              selectedChats: chats.filter(c => c.active).map(c => String(c.id))
            } 
          });
          
          return ctx.reply('📢 Вы прислали сообщение для рассылки. Выберите действие:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 Начать рассылку', callback_data: 'bc_start' }],
                [{ text: '👥 Выбор чатов', callback_data: 'bc_select_chats' }],
                [{ text: '⚙️ Настройки', callback_data: 'bc_options' }],
                [{ text: '❌ Отмена', callback_data: 'bc_cancel' }]
              ]
            }
          });
        }
      }

      // Handle Captcha in Private Messages
      if (chatType === 'private') {
        const session = captchaSessions.get(userId);
        if (session && 'text' in ctx.message) {
          const expectedAnswer = String(session.answer).trim().toLowerCase();
          const userAnswer = ctx.message.text.trim().toLowerCase();
          
          console.log(`User ${userId} provided captcha answer: "${userAnswer}". Expected: "${expectedAnswer}"`);
          
          if (userAnswer === expectedAnswer) {
            try {
              await ctx.telegram.approveChatJoinRequest(session.chatId, ctx.from.id);
              
              // Track membership on captcha success
              await trackMembership(session.chatId, {
                id: ctx.from.id,
                username: ctx.from.username,
                first_name: ctx.from.first_name,
                last_name: ctx.from.last_name
              });

              captchaSessions.delete(userId);
              ctx.reply('✅ Правильно! Ваша заявка одобрена.');
              
              await addLog({
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'SYSTEM',
                user: ctx.from.first_name,
                chat: 'Private',
                details: `Пользователь прошел каптчу и был одобрен в чат.`
              });
            } catch (e) {
              console.error('Failed to approve after captcha:', e);
              ctx.reply('❌ Ошибка при одобрении заявки. Возможно, срок действия заявки истек.');
            }
          } else {
            ctx.reply('❌ Неверный ответ. Попробуйте еще раз.');
          }
        }
        return;
      }
      
      // Update message count for existing chats
      let chat = chats.find(c => c.id === chatId);
      
      // Automatically add chat if it's a group/supergroup and not in the list
      if (!chat && (chatType === 'group' || chatType === 'supergroup')) {
        // Double check to prevent race condition duplicates
        if (!chats.some(c => c.id === chatId)) {
          console.log(`New chat detected via message: ${chatId}`);
          let memberCount = 0;
          try {
            memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
          } catch (e) {
            console.error('Failed to get member count on message:', e);
          }

          chat = {
            id: chatId,
            title: 'title' in ctx.chat ? ctx.chat.title : 'Group',
            members: memberCount,
            muteNewcomers: false,
            muteDurationMinutes: 30,
            autoApprove: true,
            msgCount: 0,
            avatarUrl: `https://picsum.photos/seed/${chatId}/200`,
            active: false // New chats are deactivated by default
          };
          await updateChat(chat, true);
          
          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: 'Bot',
            chat: chat.title,
            details: 'Чат автоматически добавлен после получения сообщения (деактивирован).'
          });
        }
      }

      if (chat) {
        chat.msgCount = (chat.msgCount || 0) + 1;
        await updateChat(chat);
        
        // Track membership on message
        await trackMembership(chatId, {
          id: Number(userId),
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name
        }, true);
        
        // Moderation Logic
        if (chat.active) {
          // Check Global Ban List (ID or Username)
          const isBanned = bans.some(b => {
            if (b.userId.startsWith('@')) {
              return ctx.from.username && `@${ctx.from.username.toLowerCase()}` === b.userId.toLowerCase();
            }
            return b.userId === userId;
          });

          if (isBanned) {
            try {
              await ctx.deleteMessage();
              await ctx.banChatMember(ctx.from.id);
              await addLog({
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'BAN',
                user: ctx.from.first_name,
                chat: chat.title,
                details: 'Пользователь удален (глобальный бан-лист).'
              });
              return;
            } catch (e) {
              console.error('Moderation failed (ban):', e);
            }
          }

          // Handle /userban and /usermute
          if (ctx.message && 'text' in ctx.message && (ctx.message.text.startsWith('/userban') || ctx.message.text.startsWith('/usermute'))) {
            if (filters.userVoteEnabled) {
              const isBan = ctx.message.text.startsWith('/userban');
              const type = isBan ? 'BAN' : 'MUTE';
              let targetUser: { id: number, name: string } | null = null;

              if (ctx.message.reply_to_message) {
                targetUser = {
                  id: ctx.message.reply_to_message.from!.id,
                  name: ctx.message.reply_to_message.from!.first_name || ctx.message.reply_to_message.from!.username || 'User'
                };
              } else {
                const parts = ctx.message.text.split(' ');
                if (parts.length > 1) {
                  const query = parts.slice(1).join(' ').replace('@', '').toLowerCase();
                  const found = memberships.find(m => 
                    m.chatId === chatId && 
                    (m.username?.replace('@', '').toLowerCase() === query || 
                     m.firstName?.toLowerCase() === query ||
                     m.userId === query)
                  );
                  if (found) {
                    targetUser = {
                      id: Number(found.userId),
                      name: found.firstName || found.username || 'User'
                    };
                  }
                }
              }

              if (targetUser) {
                if (targetUser.id === ctx.from.id) {
                  await ctx.reply('🤔 Вы не можете начать голосование против самого себя.');
                } else {
                  // Calculate required votes
                  const chatMembers = chat ? chat.members : 0;
                  let requiredVotes = Math.ceil((chatMembers * filters.userVotePercentage) / 100);
                  if (requiredVotes < filters.userVoteMin) requiredVotes = filters.userVoteMin;
                  if (requiredVotes > filters.userVoteMax) requiredVotes = filters.userVoteMax;

                  const voteId = `${chatId}_${targetUser.id}_${Date.now()}`;
                  const keyboard = {
                    inline_keyboard: [[
                      { text: `🗳 Проголосовать (0/${requiredVotes})`, callback_data: `vote_${voteId}` }
                    ]]
                  };

                  const voteMsg = await ctx.reply(
                    `🗳 **Голосование за ${isBan ? 'БАН' : 'МУТ'}**\n\n` +
                    `Пользователь: ${targetUser.name}\n` +
                    `Инициатор: ${ctx.from.first_name}\n` +
                    `Необходимо голосов: ${requiredVotes}\n\n` +
                    `Нажмите кнопку ниже, чтобы проголосовать.`,
                    { parse_mode: 'Markdown', reply_markup: keyboard }
                  );

                  activeVotes.set(voteId, {
                    targetUserId: targetUser.id,
                    targetName: targetUser.name,
                    chatId: Number(chatId),
                    type,
                    votes: new Set(),
                    requiredVotes,
                    messageId: voteMsg.message_id,
                    expiresAt: Date.now() + (filters.userVoteDuration || 1440) * 60 * 1000
                  });
                }
                return;
              } else {
                await ctx.reply('❌ Пользователь не найден. Ответьте на сообщение пользователя или укажите его имя/username.');
                return;
              }
            }
          }

          // Filters
          let violation = null;
          const text = 'text' in ctx.message ? ctx.message.text : ('caption' in ctx.message ? ctx.message.caption : '');
          
          const effectiveFilters = {
            blockLinks: (chat.blockLinks !== undefined && chat.blockLinks !== null) ? chat.blockLinks : filters.blockLinks,
            blockTelegramLinks: (chat.blockTelegramLinks !== undefined && chat.blockTelegramLinks !== null) ? chat.blockTelegramLinks : filters.blockTelegramLinks,
            blockMedia: (chat.blockMedia !== undefined && chat.blockMedia !== null) ? chat.blockMedia : filters.blockMedia,
            blockForwards: (chat.blockForwards !== undefined && chat.blockForwards !== null) ? chat.blockForwards : filters.blockForwards,
            forbiddenWords: (chat.forbiddenWords && chat.forbiddenWords.length > 0) ? chat.forbiddenWords : (filters.forbiddenWords || []),
            deleteCommands: (chat.deleteCommands !== undefined && chat.deleteCommands !== null) ? chat.deleteCommands : filters.deleteCommands,
            muteNewcomers: (chat.muteNewcomers !== undefined && chat.muteNewcomers !== null) ? chat.muteNewcomers : filters.muteNewcomers,
            muteDurationHours: (chat.muteDurationHours !== undefined && chat.muteDurationHours !== null) ? chat.muteDurationHours : filters.muteDurationHours,
          };

          console.log(`Checking moderation for message in ${chatId}. Filters:`, effectiveFilters);

          // Check Mute Newcomers
          if (effectiveFilters.muteNewcomers) {
            const membership = memberships.find(m => String(m.userId) === String(userId) && String(m.chatId) === String(chatId));
            if (membership) {
              const joinedAt = new Date(membership.joinedAt).getTime();
              const now = Date.now();
              const muteDurationMs = (effectiveFilters.muteDurationHours || 0) * 3600 * 1000;
              if (now - joinedAt < muteDurationMs) {
                violation = `Новичкам нельзя писать первые ${effectiveFilters.muteDurationHours}ч.`;
              }
            }
          }

          if (!violation && effectiveFilters.blockLinks && (ctx.message as any).entities?.some((e: any) => e.type === 'url' || e.type === 'text_link')) {
            violation = 'Ссылки запрещены';
          } else if (!violation && effectiveFilters.blockTelegramLinks) {
            const hasTelegramLink = (ctx.message as any).entities?.some((e: any) => {
              if (e.type === 'mention') return true;
              if (e.type === 'url' || e.type === 'text_link') {
                const url = e.type === 'url' ? text.substring(e.offset, e.offset + e.length) : e.url;
                return url?.includes('t.me') || url?.includes('telegram.me');
              }
              return false;
            });
            if (hasTelegramLink) violation = 'Telegram-ссылки запрещены';
          } else if (!violation && effectiveFilters.blockForwards && ((ctx.message as any).forward_from || (ctx.message as any).forward_from_chat || (ctx.message as any).forward_date)) {
            violation = 'Пересылки запрещены';
          } else if (!violation && effectiveFilters.blockMedia && (
            (ctx.message as any).photo || 
            (ctx.message as any).video || 
            (ctx.message as any).document || 
            (ctx.message as any).voice || 
            (ctx.message as any).audio || 
            (ctx.message as any).video_note || 
            (ctx.message as any).animation || 
            (ctx.message as any).sticker
          )) {
            violation = 'Медиа запрещено';
          } else if (!violation && text && effectiveFilters.forbiddenWords && effectiveFilters.forbiddenWords.length > 0) {
            for (const word of effectiveFilters.forbiddenWords) {
              if (!word) continue;
              try {
                // Try as regex first
                const regex = new RegExp(word, 'i');
                if (regex.test(text)) {
                  violation = `Запрещенное слово (regex): ${word}`;
                  break;
                }
              } catch (e) {
                // Fallback to simple include if regex is invalid
                if (text.toLowerCase().includes(word.toLowerCase())) {
                  violation = `Запрещенное слово: ${word}`;
                  break;
                }
              }
            }
          } else if (!violation && text && effectiveFilters.deleteCommands && (text.startsWith('/') || text.startsWith('!'))) {
            violation = 'Команды запрещены';
          }

          if (violation) {
            console.log(`Violation found: ${violation}. Deleting message...`);
            try {
              await ctx.deleteMessage();
              
              if (violation.includes('Новичкам нельзя писать')) {
                const mention = `[${ctx.from.first_name}](tg://user?id=${ctx.from.id})`;
                const warningMsg = await ctx.reply(`${mention}, ${violation}`, { parse_mode: 'Markdown' });
                
                // Delete warning after 1 minute
                setTimeout(async () => {
                  try {
                    await ctx.telegram.deleteMessage(chatId, warningMsg.message_id);
                  } catch (e) {}
                }, 60000);
              }

              await addLog({
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'WARN',
                user: ctx.from.first_name,
                chat: chat.title,
                details: `Сообщение удалено: ${violation}`
              });
            } catch (e) {
              console.error('Moderation failed (delete):', e);
            }
          }
        }
      }

      console.log(`Message from ${ctx.from.first_name} in ${chatType} ${chatId}: ${'text' in ctx.message ? ctx.message.text : 'non-text'}`);
    });

    // Handle Left Members
    bot.on('left_chat_member', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;

      console.log(`Left chat member detected in ${chatId}`);

      const shouldDelete = chat.deleteSystemMessages !== undefined ? chat.deleteSystemMessages : filters.deleteSystemMessages;
      if (shouldDelete) {
        try { await ctx.deleteMessage(); } catch (e) {}
      }

      const member = ctx.message.left_chat_member;
      if (member.is_bot) return;

      // Update member count
      try {
        const memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
        chat.members = memberCount;
        await updateChat(chat);
      } catch (e) {
        console.error('Failed to update member count on leave:', e);
      }

      // Track membership removal
      const membershipId = `${chatId}_${member.id}`;
      try {
        queueDelete('memberships', membershipId);
        memberships = memberships.filter(m => m.id !== membershipId);
        console.log(`Membership removed for user ${member.id} in chat ${chatId}`);
      } catch (e) {
        console.error('Failed to remove membership:', e);
      }

      // Update stats
      await incrementDailyStats(chatId, 'leaves', 1, member.id.toString());
    });

    // Handle Join Requests
    bot.on('chat_join_request', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const userId = ctx.from.id.toString();
      const chat = chats.find(c => c.id === chatId);

      if (!chat || !chat.active) return;

      const effectiveAutoApprove = chat.autoApprove !== undefined ? chat.autoApprove : filters.autoApprove;
      const effectiveCaptchaEnabled = chat.captchaEnabled !== undefined ? chat.captchaEnabled : filters.captchaEnabled;
      const effectiveCaptchaQuestion = chat.captchaQuestion !== undefined ? chat.captchaQuestion : filters.captchaQuestion;

      if (!effectiveAutoApprove) return;

      if (effectiveCaptchaEnabled) {
        try {
          const effectiveCaptchaAnswer = chat.captchaAnswer !== undefined ? chat.captchaAnswer : filters.captchaAnswer;
          
          // Send captcha DM
          await ctx.telegram.sendMessage(ctx.from.id, `Привет! Вы подали заявку на вступление в чат "${chat.title}".\n\nДля подтверждения ответьте на вопрос:\n${effectiveCaptchaQuestion}`);
          captchaSessions.set(userId, { 
            chatId, 
            answer: effectiveCaptchaAnswer, 
            timestamp: Date.now() 
          });
          
          console.log(`Captcha sent to user ${userId} for chat ${chatId}. Expected answer: ${effectiveCaptchaAnswer}`);
          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: ctx.from.first_name,
            chat: chat.title,
            details: `Отправлена каптча новому участнику: ${effectiveCaptchaQuestion}`
          });
        } catch (e) {
          console.error('Failed to send captcha DM:', e);
          // If DM fails, we might want to approve anyway or notify the admins
          // For now, let's try to approve if DM fails to avoid blocking users
          try {
            await ctx.telegram.approveChatJoinRequest(chatId, Number(userId));
            console.log(`Auto-approved user ${userId} for chat ${chatId} because DM failed`);
            
            // Track membership on auto-approval
            await trackMembership(chatId, {
              id: ctx.from.id,
              username: ctx.from.username,
              first_name: ctx.from.first_name,
              last_name: ctx.from.last_name
            });
          } catch (approveErr) {
            console.error('Failed to approve after DM fail:', approveErr);
          }
        }
      } else {
        try {
          await ctx.telegram.approveChatJoinRequest(chatId, Number(userId));
          console.log(`Auto-approved user ${userId} for chat ${chatId}`);
          
          // Track membership on auto-approval
          await trackMembership(chatId, {
            id: ctx.from.id,
            username: ctx.from.username,
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name
          });

          const todayDate = new Date().toISOString().split('T')[0];
          let today = statsHistory.find(s => s.date === todayDate);
          if (!today) {
            const [y, m, d] = todayDate.split('-');
            today = { 
              date: todayDate, 
              name: `${d}.${m}.${y}`, 
              joins: 0, 
              leaves: 0, 
              msgs: 0, 
              chatStats: {},
              activeUsers: [],
              onlineUsers: []
            };
          }
          today.joins = (today.joins || 0) + 1;
          if (!today.chatStats) today.chatStats = {};
          if (!today.chatStats[chatId]) today.chatStats[chatId] = { joins: 0, leaves: 0, msgs: 0, activeUsers: [], onlineUsers: [] };
          today.chatStats[chatId].joins++;
          
          // Update total members for today
          today.totalMembers = chats.filter(c => c.active).reduce((acc, c) => acc + (c.members || 0), 0);
          today.chatStats[chatId].totalMembers = chat.members;
          
          await updateStats(today);

          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: ctx.from.first_name,
            chat: chat.title,
            details: 'Автоматическое одобрение участника.'
          });
        } catch (e) {
          console.error('Failed to auto-approve:', e);
        }
      }
    });

    // Handle New Members (Mute & Membership Tracking)
    bot.on('new_chat_members', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;

      const shouldDelete = chat.deleteSystemMessages !== undefined ? chat.deleteSystemMessages : filters.deleteSystemMessages;
      if (shouldDelete) {
        try { await ctx.deleteMessage(); } catch (e) {}
      }

      // Update member count
      try {
        const memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
        chat.members = memberCount;
        await updateChat(chat);
      } catch (e) {
        console.error('Failed to update member count on join:', e);
      }

      // Track membership
      const newMembers = (ctx.message as any).new_chat_members.filter((m: any) => !m.is_bot);
      for (const member of newMembers) {
        // Check for global bans
        const isGloballyBanned = bans.find(b => String(b.userId) === String(member.id));
        const isWhitelisted = whitelist.some(w => String(w.userId) === String(member.id) || (member.username && w.username && w.username.toLowerCase() === `@${member.username.toLowerCase()}`));
        
        if (isGloballyBanned && !isWhitelisted) {
          try {
            await ctx.telegram.banChatMember(chatId, member.id);
            console.log(`Auto-banned globally banned user ${member.id} in chat ${chatId} on join`);
            continue; // Skip tracking for banned user
          } catch (e) {
            console.error(`Failed to auto-ban globally banned user ${member.id} in chat ${chatId}:`, (e as Error).message);
          }
        }

        // Track membership on join
        await trackMembership(chatId, member);
      }

      if (!chat.active) return;

      const effectiveMuteNewcomers = chat.muteNewcomers !== undefined ? chat.muteNewcomers : filters.muteNewcomers;
      const effectiveMuteDurationHours = chat.muteDurationHours !== undefined ? chat.muteDurationHours : filters.muteDurationHours;
      const effectiveMuteMessage = chat.muteMessage !== undefined ? chat.muteMessage : filters.muteMessage;

      if (effectiveMuteNewcomers) {
        for (const member of (ctx.message as any).new_chat_members) {
          if (member.is_bot) continue;
          try {
            console.log(`Muting newcomer ${member.id} in chat ${chatId} for ${effectiveMuteDurationHours}h`);
            const untilDate = Math.floor(Date.now() / 1000) + (effectiveMuteDurationHours * 3600);
            
            await ctx.telegram.restrictChatMember(chatId, member.id, {
              until_date: untilDate,
              permissions: {
                can_send_messages: false,
                can_send_audios: false,
                can_send_documents: false,
                can_send_photos: false,
                can_send_videos: false,
                can_send_video_notes: false,
                can_send_voice_notes: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false
              }
            });

            const welcomeMsg = effectiveMuteMessage.replace('{hours}', effectiveMuteDurationHours.toString());
            const mention = `[${member.first_name}](tg://user?id=${member.id})`;
            const sentMsg = await ctx.reply(`${mention}, ${welcomeMsg}`, { parse_mode: 'Markdown' });

            // Delete welcome message after 1 minute if it's a mute notification
            setTimeout(async () => {
              try {
                await ctx.telegram.deleteMessage(chatId, sentMsg.message_id);
              } catch (e) {}
            }, 60000);

            await addLog({
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toISOString(),
              type: 'MUTE_INFO',
              user: member.first_name,
              chat: chat.title,
              details: `Новый участник замучен на ${effectiveMuteDurationHours}ч.`
            });
          } catch (e) {
            console.error('Failed to mute newcomer:', e);
          }
        }
      }
    });


    // Automatically manage chats based on bot membership
    bot.on('my_chat_member', async (ctx) => {
      const { new_chat_member, chat } = ctx.myChatMember;
      const chatId = chat.id.toString();

      if (new_chat_member.status === 'administrator') {
        const chatExists = chats.find(c => c.id === chatId);
        if (!chatExists) {
          let memberCount = 0;
          let avatarUrl = `https://picsum.photos/seed/${chatId}/200`;
          
          try {
            memberCount = await ctx.telegram.getChatMembersCount(chat.id);
            const chatFull = await ctx.telegram.getChat(chat.id);
            if (chatFull.photo) {
              const fileId = chatFull.photo.small_file_id;
              const fileLink = await ctx.telegram.getFileLink(fileId);
              avatarUrl = fileLink.toString();
            }
          } catch (e) {
            console.error('Failed to get chat info:', e);
          }

          const newChat = {
            id: chatId,
            title: 'title' in chat ? chat.title : 'Private Chat',
            members: memberCount,
            muteNewcomers: false,
            muteDurationMinutes: 30,
            autoApprove: true,
            msgCount: 0,
            avatarUrl,
            active: false // New chats are deactivated by default
          };
          await updateChat(newChat, true);
          
          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: 'Bot',
            chat: 'title' in chat ? chat.title : chatId,
            details: 'Бот добавлен в чат как администратор. Чат добавлен в управление (деактивирован).'
          });
          
          console.log(`Added new managed chat: ${'title' in chat ? chat.title : chatId}`);
        }
      } else if (['left', 'kicked', 'member'].includes(new_chat_member.status)) {
        // If bot is no longer admin or left, remove from managed chats
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
          const removedChat = chats[chatIndex];
          await db.collection('chats').doc(chatId).delete();
          chats.splice(chatIndex, 1);
          
          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: 'Bot',
            chat: removedChat.title,
            details: 'Бот лишен прав администратора или удален из чата. Чат удален из управления.'
          });
          
          console.log(`Removed managed chat: ${removedChat.title}`);
        }
      }
    });

    bot.on('callback_query', async (ctx) => {
      const userId = ctx.from.id.toString();
      const username = ctx.from.username;
      const data = (ctx.callbackQuery as any).data;

      if (data.startsWith('vote_')) {
        const voteId = data.replace('vote_', '');
        const vote = activeVotes.get(voteId);

        if (!vote) {
          return ctx.answerCbQuery('❌ Голосование не найдено или завершено.');
        }

        if (Date.now() > vote.expiresAt) {
          activeVotes.delete(voteId);
          return ctx.answerCbQuery('❌ Срок голосования истек.');
        }

        if (vote.votes.has(ctx.from.id)) {
          return ctx.answerCbQuery('⚠️ Вы уже проголосовали.');
        }

        vote.votes.add(ctx.from.id);
        const currentVotes = vote.votes.size;

        if (currentVotes >= vote.requiredVotes) {
          activeVotes.delete(voteId);
          try {
            if (vote.type === 'BAN') {
              await ctx.telegram.banChatMember(vote.chatId, vote.targetUserId);
              await ctx.editMessageText(`✅ Пользователь ${vote.targetName} был забанен по результатам голосования!`);
            } else {
              const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
              await ctx.telegram.restrictChatMember(vote.chatId, vote.targetUserId, {
                permissions: { can_send_messages: false },
                until_date: until
              });
              await ctx.editMessageText(`✅ Пользователь ${vote.targetName} был замучен на 24 часа по результатам голосования!`);
            }
            
            await addLog({
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toISOString(),
              type: vote.type === 'BAN' ? 'BAN' : 'MUTE',
              user: vote.targetName,
              chat: 'Voting',
              details: `Пользователь ${vote.type === 'BAN' ? 'забанен' : 'замучен'} по результатам голосования.`
            });
          } catch (e) {
            console.error('Voting action failed:', e);
            await ctx.editMessageText(`❌ Не удалось выполнить ${vote.type === 'BAN' ? 'бан' : 'мут'} пользователя ${vote.targetName}.`);
          }
        } else {
          const keyboard = {
            inline_keyboard: [[
              { text: `🗳 Проголосовать (${currentVotes}/${vote.requiredVotes})`, callback_data: `vote_${voteId}` }
            ]]
          };
          try {
            await ctx.editMessageReplyMarkup(keyboard);
          } catch (e) {}
          await ctx.answerCbQuery('✅ Ваш голос учтен!');
        }
        return;
      }

      if (username !== 'bookray') return ctx.answerCbQuery('У вас нет прав.');

      const session = broadcastSessions.get(userId);
      if (!session && data.startsWith('bc_')) {
        return ctx.answerCbQuery('Сессия рассылки не найдена.');
      }

      if (data === 'bc_cancel') {
        broadcastSessions.delete(userId);
        await ctx.editMessageText('❌ Рассылка отменена.');
        return ctx.answerCbQuery();
      }

      if (data === 'bc_options') {
        const { pin, delay, silent } = session!.options;
        return ctx.editMessageText(`⚙️ Настройки рассылки:\n\nЗакреп: ${pin ? '✅' : '❌'}\nЗадержка: ${delay} сек.\nБез звука: ${silent ? '✅' : '❌'}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `Закреп: ${pin ? 'Выкл' : 'Вкл'}`, callback_data: 'bc_opt_pin' }],
              [{ text: `Без звука: ${silent ? 'Выкл' : 'Вкл'}`, callback_data: 'bc_opt_silent' }],
              [{ text: `Задержка: ${delay} сек.`, callback_data: 'bc_opt_delay' }],
              [{ text: '⬅️ Назад', callback_data: 'bc_back' }]
            ]
          }
        });
      }

      if (data === 'bc_select_chats') {
        const activeChats = chats.filter(c => c.active);
        const selected = session!.options.selectedChats;
        
        const keyboard = activeChats.map(chat => {
          const isSelected = selected.includes(String(chat.id));
          return [{ 
            text: `${isSelected ? '✅' : '❌'} ${chat.title}`, 
            callback_data: `bc_toggle_${chat.id}` 
          }];
        });

        keyboard.push([
          { text: '✅ Все', callback_data: 'bc_sel_all' },
          { text: '❌ Ни одного', callback_data: 'bc_sel_none' }
        ]);
        keyboard.push([{ text: '⬅️ Назад', callback_data: 'bc_back' }]);

        return ctx.editMessageText(`👥 Выберите чаты для рассылки (${selected.length}/${activeChats.length}):`, {
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      if (data === 'bc_sel_all') {
        session!.options.selectedChats = chats.filter(c => c.active).map(c => String(c.id));
        broadcastSessions.set(userId, session!);
        return ctx.editMessageReplyMarkup({
          inline_keyboard: [
            ...chats.filter(c => c.active).map(chat => [{ 
              text: `✅ ${chat.title}`, 
              callback_data: `bc_toggle_${chat.id}` 
            }]),
            [{ text: '✅ Все', callback_data: 'bc_sel_all' }, { text: '❌ Ни одного', callback_data: 'bc_sel_none' }],
            [{ text: '⬅️ Назад', callback_data: 'bc_back' }]
          ]
        });
      }

      if (data === 'bc_sel_none') {
        session!.options.selectedChats = [];
        broadcastSessions.set(userId, session!);
        return ctx.editMessageReplyMarkup({
          inline_keyboard: [
            ...chats.filter(c => c.active).map(chat => [{ 
              text: `❌ ${chat.title}`, 
              callback_data: `bc_toggle_${chat.id}` 
            }]),
            [{ text: '✅ Все', callback_data: 'bc_sel_all' }, { text: '❌ Ни одного', callback_data: 'bc_sel_none' }],
            [{ text: '⬅️ Назад', callback_data: 'bc_back' }]
          ]
        });
      }

      if (data.startsWith('bc_toggle_')) {
        const chatId = data.replace('bc_toggle_', '');
        const selected = session!.options.selectedChats;
        if (selected.includes(chatId)) {
          session!.options.selectedChats = selected.filter(id => id !== chatId);
        } else {
          session!.options.selectedChats.push(chatId);
        }
        broadcastSessions.set(userId, session!);
        
        const activeChats = chats.filter(c => c.active);
        const keyboard = activeChats.map(chat => {
          const isSelected = session!.options.selectedChats.includes(String(chat.id));
          return [{ 
            text: `${isSelected ? '✅' : '❌'} ${chat.title}`, 
            callback_data: `bc_toggle_${chat.id}` 
          }];
        });
        keyboard.push([
          { text: '✅ Все', callback_data: 'bc_sel_all' },
          { text: '❌ Ни одного', callback_data: 'bc_sel_none' }
        ]);
        keyboard.push([{ text: '⬅️ Назад', callback_data: 'bc_back' }]);

        return ctx.editMessageText(`👥 Выберите чаты для рассылки (${session!.options.selectedChats.length}/${activeChats.length}):`, {
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      if (data === 'bc_back') {
        return ctx.editMessageText('📢 Вы прислали сообщение для рассылки. Выберите действие:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Начать рассылку', callback_data: 'bc_start' }],
              [{ text: '👥 Выбор чатов', callback_data: 'bc_select_chats' }],
              [{ text: '⚙️ Настройки', callback_data: 'bc_options' }],
              [{ text: '❌ Отмена', callback_data: 'bc_cancel' }]
            ]
          }
        });
      }

      if (data.startsWith('bc_opt_')) {
        if (data === 'bc_opt_pin') session!.options.pin = !session!.options.pin;
        if (data === 'bc_opt_silent') session!.options.silent = !session!.options.silent;
        if (data === 'bc_opt_delay') {
          const delays = [10, 60, 120, 300];
          const currentIndex = delays.indexOf(session!.options.delay);
          session!.options.delay = delays[(currentIndex + 1) % delays.length];
        }
        broadcastSessions.set(userId, session!);
        return ctx.editMessageText(`⚙️ Настройки рассылки:\n\nЗакреп: ${session!.options.pin ? '✅' : '❌'}\nЗадержка: ${session!.options.delay} сек.\nБез звука: ${session!.options.silent ? '✅' : '❌'}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `Закреп: ${session!.options.pin ? 'Выкл' : 'Вкл'}`, callback_data: 'bc_opt_pin' }],
              [{ text: `Без звука: ${session!.options.silent ? 'Выкл' : 'Вкл'}`, callback_data: 'bc_opt_silent' }],
              [{ text: `Задержка: ${session!.options.delay} сек.`, callback_data: 'bc_opt_delay' }],
              [{ text: '⬅️ Назад', callback_data: 'bc_back' }]
            ]
          }
        });
      }

      if (data === 'bc_start') {
        const targetChatIds = session!.options.selectedChats;
        const targetChats = chats.filter(c => targetChatIds.includes(String(c.id)));
        
        if (targetChats.length === 0) {
          return ctx.answerCbQuery('Не выбрано ни одного чата для рассылки.');
        }

        await ctx.editMessageText(`🚀 Начинаю рассылку в ${targetChats.length} чатов...`);
        
        const { pin, delay, silent } = session!.options;
        const message = session!.message;
        
        broadcastSessions.delete(userId);

        // Run broadcast in background
        (async () => {
          let success = 0;
          let failed = 0;
          const currentBroadcastMessages: { chatId: string, messageId: number }[] = [];
          const reportLinks: string[] = [];
          const messageIds: { chatId: string, messageId: number }[] = [];

          for (const chat of targetChats) {
            try {
              // copyMessage sends a copy without "Forwarded from"
              const sentMsg = await ctx.telegram.copyMessage(chat.id, ctx.chat!.id, message.message_id, {
                disable_notification: silent
              });
              
              currentBroadcastMessages.push({ chatId: chat.id, messageId: sentMsg.message_id });
              messageIds.push({ chatId: String(chat.id), messageId: sentMsg.message_id });
              
              // Generate link
              let link = '';
              if (chat.id.toString().startsWith('-100')) {
                const cleanId = chat.id.toString().replace('-100', '');
                link = `https://t.me/c/${cleanId}/${sentMsg.message_id}`;
              } else {
                // Try to get chat username if available
                try {
                  const chatInfo = await ctx.telegram.getChat(chat.id);
                  if ('username' in chatInfo && chatInfo.username) {
                    link = `https://t.me/${chatInfo.username}/${sentMsg.message_id}`;
                  }
                } catch (e) {}
              }
              
              if (link) {
                reportLinks.push(`${chat.title}: ${link}`);
              } else {
                reportLinks.push(`${chat.title}: (ссылка недоступна)`);
              }

              if (pin) {
                try {
                  await ctx.telegram.pinChatMessage(chat.id, sentMsg.message_id, { disable_notification: true });
                } catch (e) {
                  console.error(`Failed to pin in ${chat.id}:`, e);
                }
              }
              
              success++;
              if (delay > 0 && success < targetChats.length) await new Promise(r => setTimeout(r, delay * 1000));
            } catch (e) {
              console.error(`Failed to send broadcast to ${chat.id}:`, e);
              failed++;
            }
          }

          // Save to history
          const historyEntry = {
            id: Math.random().toString(36).substr(2, 9),
            userId: userId,
            username: username || userId,
            text: ('text' in message ? message.text : ('caption' in message ? message.caption : 'Media message')) || 'Media message',
            timestamp: new Date().toISOString(),
            chatIds: targetChats.map(c => String(c.id)),
            messageIds: messageIds,
            pin: pin,
            source: 'BOT'
          };
          broadcastHistory.unshift(historyEntry);
          if (broadcastHistory.length > 100) broadcastHistory.pop();
          await db.collection('broadcast_history').doc(historyEntry.id).set(cleanData(historyEntry));

          // Update lastBroadcastMessages for deletion feature
          lastBroadcastMessages = currentBroadcastMessages;

          const reportText = `✅ Рассылка завершена!\n\nУспешно: ${success}\nОшибок: ${failed}\n\n🔗 Ссылки:\n${reportLinks.join('\n')}`;
          
          // If report is too long, split it
          if (reportText.length > 4000) {
             await ctx.telegram.sendMessage(ctx.chat!.id, `✅ Рассылка завершена!\n\nУспешно: ${success}\nОшибок: ${failed}`);
             // Send links in chunks
             for (let i = 0; i < reportLinks.length; i += 20) {
               await ctx.telegram.sendMessage(ctx.chat!.id, reportLinks.slice(i, i + 20).join('\n'));
             }
          } else {
             await ctx.telegram.sendMessage(ctx.chat!.id, reportText, { link_preview_options: { is_disabled: true } });
          }
          
          await addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: 'SYSTEM',
            user: 'Bot (Admin)',
            chat: 'Broadcast',
            details: `Рассылка завершена. Успешно: ${success}, Ошибок: ${failed}`
          });
        })();
        
        return ctx.answerCbQuery();
      }
    });

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL;
    const useWebhooks = false; // Force polling for stability in preview environment
    
    if (useWebhooks && appUrl && appUrl.startsWith('https') && !appUrl.includes('aistudio.google.com')) {
      const secretPath = `/telegraf-webhook/${token.split(':')[1]}`;
      console.log(`Setting up webhook at ${appUrl}${secretPath}`);
      app.use(bot.webhookCallback(secretPath));
      try {
        await bot.telegram.setWebhook(`${appUrl}${secretPath}`);
        console.log(`Telegram bot initialized with webhooks`);
      } catch (webhookErr) {
        console.error('Webhook setup failed, falling back to polling:', webhookErr);
        await bot.telegram.deleteWebhook().catch(() => {});
        await bot.launch();
        console.log('Telegram bot launched successfully using polling (webhook fallback)');
      }
    } else {
      let currentAttempt = 0;
      const maxAttempts = retryCount;
      
      while (currentAttempt < maxAttempts) {
        try {
          currentAttempt++;
          console.log(`Attempting to launch bot using polling (Attempt ${currentAttempt}/${maxAttempts})...`);
          
          // Clear any stuck webhooks
          await bot.telegram.deleteWebhook().catch(() => {});
          
          // Small verification call
          const botInfo = await bot.telegram.getMe();
          console.log(`Telegram API connection verified: @${botInfo.username}`);
          
          await bot.launch();
          console.log('Telegram bot launched successfully using polling');
          return bot;
        } catch (err: any) {
          console.error(`Bot launch attempt ${currentAttempt} failed:`, err.message || err);
          
          if (err.response && err.response.error_code === 409) {
            console.warn('Telegram bot conflict detected (409). Polling instance might be already active elsewhere.');
            return bot; // Already running somewhere?
          }
          
          if (currentAttempt < maxAttempts) {
            const delay = 5000 * currentAttempt;
            console.log(`Retrying bot launch in ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            throw err;
          }
        }
      }
    }
    return bot;
  } catch (err) {
    console.error('Failed to initialize Telegram bot after all attempts:', err);
    bot = null;
    return null;
  }
}

// Initial bot launch
syncData()
  .catch(err => {
    console.error('Initial data sync failed (proceeding anyway):', err);
  })
  .finally(() => {
    if (settings.botToken) {
      console.log('Starting bot initialization...');
      initBot(settings.botToken);
    } else {
      console.warn('Bot token missing, bot will not start automatically.');
    }
  });

// Helper to fix invalid URLs for Telegram (e.g. localhost)
function fixUrl(url: string): string {
  if (!url) return '';
  // Telegram doesn't allow localhost URLs
  if (url.includes('localhost')) {
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || '';
    if (appUrl) {
      return url.replace(/https?:\/\/localhost(:\d+)?/, appUrl);
    }
  }
  // Ensure it starts with http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

app.post('/api/bot/restart', authenticateToken, async (req, res) => {
  try {
    if (settings.botToken) {
      const result = await initBot(settings.botToken);
      if (result) {
        res.json({ success: true, message: 'Бот успешно перезапущен' });
      } else {
        res.status(500).json({ error: 'Не удалось инициализировать бота' });
      }
    } else {
      res.status(400).json({ error: 'Токен бота не настроен' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка при перезапуске бота' });
  }
});

app.post('/api/settings/db-setup', authenticateToken, async (req, res) => {
  try {
    // This is a placeholder for DB setup logic if needed
    // For now we just return success as Firebase is automatic
    res.json({ success: true, message: 'База данных настроена' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка при настройке БД' });
  }
});

app.post('/api/broadcast', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { text: bodyText, message: bodyMessage, chatIds, pin, silent, pinTime, imageUrl, buttons, delay: broadcastDelay } = req.body;
    const text = bodyText || bodyMessage || '';
    const delay = broadcastDelay || 10;

    if (!Array.isArray(chatIds)) {
      return res.status(400).json({ error: 'chatIds должен быть массивом' });
    }

    // Check advertiser limits
    if (user.role === 'ADVERTISER') {
      const userDoc = await db.collection('users').doc(user.id).get();
      const userData = userDoc.data();
      if (userData) {
        const max = userData.maxMessages || 0;
        const sent = userData.messagesSent || 0;
        if (max > 0 && sent >= max) {
          return res.status(403).json({ error: 'Лимит сообщений исчерпан' });
        }
        
        // Check if trying to send to unassigned chats
        const assigned = userData.assignedChatIds || [];
        const unauthorized = chatIds.filter((id: string) => !assigned.includes(id));
        if (unauthorized.length > 0) {
          return res.status(403).json({ error: 'У вас нет доступа к некоторым выбранным чатам' });
        }

        // Update sent count
        await db.collection('users').doc(user.id).update({
          messagesSent: sent + 1
        });
      }
    }
    
    console.log('Broadcast request:', { text, chatIds, pin, silent, pinTime, imageUrl, buttons, delay });

    if (!bot) {
      return res.status(500).json({ error: 'Бот не инициализирован' });
    }

    const results: any[] = [];
    const newBroadcastMessages: any[] = [];
    const reportLinks: string[] = [];

    // Send immediate response
    res.json({ success: true, message: `Начинаю рассылку в ${chatIds.length} чатов с задержкой ${delay}с.` });

    // Process in background
    (async () => {
      const messageIds: { chatId: string, messageId: number }[] = [];
      for (let i = 0; i < chatIds.length; i++) {
        const chatId = chatIds[i];
        try {
          const extra: any = {
            disable_notification: silent
          };

          if (buttons && buttons.length > 0) {
            extra.reply_markup = {
              inline_keyboard: [buttons.map((b: any) => ({ text: b.text, url: fixUrl(b.url) }))]
            };
          }

          let sentMsg;
          if (imageUrl) {
            sentMsg = await bot.telegram.sendPhoto(chatId, imageUrl, { 
              caption: text, 
              parse_mode: 'HTML',
              ...extra 
            });
          } else {
            sentMsg = await bot.telegram.sendMessage(chatId, text, {
              parse_mode: 'HTML',
              ...extra
            });
          }
          
          // Generate link (for supergroups/channels it's t.me/c/ID/MSG_ID)
          const cleanChatId = String(chatId).replace('-100', '');
          const msgLink = `https://t.me/c/${cleanChatId}/${sentMsg.message_id}`;
          reportLinks.push(msgLink);

          if (pin) {
            try {
              await bot.telegram.pinChatMessage(chatId, sentMsg.message_id);
              
              // Delayed unpin if pinTime > 0 (hours)
              if (pinTime > 0) {
                const timeoutMs = pinTime * 60 * 60 * 1000;
                setTimeout(async () => {
                  try {
                    if (bot) await bot.telegram.unpinChatMessage(chatId, sentMsg.message_id);
                    console.log(`Auto-unpinned message ${sentMsg.message_id} in ${chatId}`);
                  } catch (e) {
                    console.error(`Failed to auto-unpin message ${sentMsg.message_id} in ${chatId}:`, e);
                  }
                }, timeoutMs);
              }
            } catch (pinError) {
              console.error(`Failed to pin message in ${chatId}:`, pinError);
            }
          }
          
          results.push({ chatId, success: true, messageId: sentMsg.message_id });
          newBroadcastMessages.push({ chatId, messageId: sentMsg.message_id });
          messageIds.push({ chatId: String(chatId), messageId: sentMsg.message_id });
        } catch (e) {
          const errorMessage = (e as Error).message || String(e);
          console.error(`Failed to send broadcast to ${chatId}:`, errorMessage);
          results.push({ chatId, success: false, error: errorMessage });
          
          // If chat is not found, deactivate it
          if (errorMessage.includes('chat not found')) {
            const chat = chats.find(c => String(c.id) === String(chatId));
            if (chat) {
              console.log(`Deactivating chat ${chatId} because it was not found during broadcast.`);
              chat.active = false;
              await updateChat(chat, true);
            }
          }
        }

        // Wait before next message
        if (i < chatIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }

      // Save to history
      const historyEntry = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        text: text,
        timestamp: new Date().toISOString(),
        chatIds: chatIds,
        messageIds: messageIds,
        pin: pin,
        pinTime: pinTime,
        imageUrl: imageUrl,
        buttons: buttons,
        source: 'ADMIN'
      };
      broadcastHistory.unshift(historyEntry);
      if (broadcastHistory.length > 100) broadcastHistory.pop();
      await db.collection('broadcast_history').doc(historyEntry.id).set(cleanData(historyEntry));

      // Replace lastBroadcastMessages with the new batch
      lastBroadcastMessages = newBroadcastMessages;
    await db.collection('config').doc('broadcast').set({ messages: lastBroadcastMessages });
    
    await addLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'BROADCAST',
      user: 'Admin',
      chat: `${chatIds.length} чатов`,
      details: `Рассылка завершена в ${chatIds.length} чатов.`
    });

    // Send report to @bookray
    const bookrayChatId = process.env.BOOKRAY_CHAT_ID;
    if (bookrayChatId && bot) {
      const reportText = `📢 *Отчет о рассылке*\n\nОтправлено в ${reportLinks.length} чатов.\n\n${reportLinks.join('\n')}`;
      try {
        await bot.telegram.sendMessage(bookrayChatId, reportText, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Failed to send report to @bookray:', e);
      }
    }
  })();
  } catch (err) {
    console.error('Broadcast API error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка сервера при инициализации рассылки' });
    }
  }
});

app.get('/api/broadcasts', authenticateToken, (req, res) => {
  const user = (req as any).user;
  if (user.role === 'SUPER_ADMIN') {
    res.json(broadcastHistory);
  } else {
    res.json(broadcastHistory.filter(b => b.userId === user.id));
  }
});

app.post('/api/broadcasts/:id/delete', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const entry = broadcastHistory.find(b => b.id === id);
  
  if (!entry) return res.status(404).json({ error: 'Рассылка не найдена' });
  if (user.role !== 'SUPER_ADMIN' && entry.userId !== user.id) {
    return res.status(403).json({ error: 'У вас нет прав для удаления этой рассылки' });
  }

  if (!bot) return res.status(500).json({ error: 'Бот не инициализирован' });

  const results = [];
  const messageIds = entry.messageIds || [];
  
  for (const msg of messageIds) {
    try {
      await bot.telegram.deleteMessage(msg.chatId, msg.messageId);
      results.push({ ...msg, success: true });
    } catch (e) {
      results.push({ ...msg, success: false, error: (e as Error).message });
    }
  }

  broadcastHistory = broadcastHistory.filter(b => b.id !== id);
  await db.collection('broadcast_history').doc(id).delete();
  
  await addLog({
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    type: 'BROADCAST',
    user: user.username,
    chat: 'Global',
    details: `Удалена прошедшая рассылка из всех чатов (ID: ${id}).`
  });
  
  res.json({ success: true, results });
});

app.post('/api/broadcasts/:id/unpin', authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const entry = broadcastHistory.find(b => b.id === id);
  
  if (!entry) return res.status(404).json({ error: 'Рассылка не найдена' });
  if (user.role !== 'SUPER_ADMIN' && entry.userId !== user.id) {
    return res.status(403).json({ error: 'У вас нет прав для изменения этой рассылки' });
  }

  if (!bot) return res.status(500).json({ error: 'Бот не инициализирован' });

  const results = [];
  const messageIds = entry.messageIds || [];

  for (const msg of messageIds) {
    try {
      await bot.telegram.unpinChatMessage(msg.chatId, msg.messageId);
      results.push({ ...msg, success: true });
    } catch (e) {
      results.push({ ...msg, success: false, error: (e as Error).message });
    }
  }

  const idx = broadcastHistory.findIndex(b => b.id === id);
  if (idx !== -1) {
    broadcastHistory[idx].pin = false;
    await db.collection('broadcast_history').doc(id).update({ pin: false });
  }
  
  await addLog({
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    type: 'BROADCAST',
    user: user.username,
    chat: 'Global',
    details: `Откреплена прошедшая рассылка во всех чатах (ID: ${id}).`
  });
  
  res.json({ success: true, results });
});

app.post('/api/broadcast/delete', authenticateToken, async (req, res) => {
  if (!bot) {
    return res.status(500).json({ error: 'Bot not initialized' });
  }

  const results = [];
  for (const item of lastBroadcastMessages) {
    try {
      await bot.telegram.deleteMessage(item.chatId, item.messageId);
      results.push({ chatId: item.chatId, success: true });
    } catch (e) {
      console.error(`Failed to delete broadcast from ${item.chatId}:`, e);
      results.push({ chatId: item.chatId, success: false, error: String(e) });
    }
  }

  lastBroadcastMessages = [];
  await db.collection('config').doc('broadcast').set({ messages: [] });
  
  await addLog({
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    type: 'SYSTEM',
    user: 'Admin',
    chat: 'Global',
    details: 'Последняя рассылка удалена из всех чатов.'
  });

  res.json({ success: true, results });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
  });

  // Scheduler background job
  setInterval(async () => {
    const now = new Date();
    const currentHHmm = now.toISOString().substring(11, 16); // "HH:mm" in UTC

    // Handle expired votes
    for (const [voteId, vote] of activeVotes.entries()) {
      if (Date.now() > vote.expiresAt) {
        activeVotes.delete(voteId);
        try {
          if (bot) await bot.telegram.deleteMessage(vote.chatId, vote.messageId);
          console.log(`Deleted expired vote message ${vote.messageId} in ${vote.chatId}`);
        } catch (e) {
          console.error(`Failed to delete expired vote message ${vote.messageId} in ${vote.chatId}:`, e);
        }
      }
    }

    // Handle scheduled deletions
    const remainingDeletions = [];
    let deletionsChanged = false;
    for (const item of scheduledDeletions) {
      if (new Date(item.deleteAt) <= now) {
        try {
          if (bot) await bot.telegram.deleteMessage(item.chatId, item.messageId);
          console.log(`Deleted scheduled message ${item.messageId} in ${item.chatId}`);
          deletionsChanged = true;
        } catch (e) {
          console.error(`Failed to delete scheduled message ${item.messageId} in ${item.chatId}:`, e);
          // If message is not found or too old, we still remove it from the list
          deletionsChanged = true;
        }
      } else {
        remainingDeletions.push(item);
      }
    }
    if (deletionsChanged) {
      scheduledDeletions = remainingDeletions;
      await db.collection('config').doc('deletions').set({ items: scheduledDeletions });
    }

    for (const task of tasks) {
      if (!task.active) continue;
      if (task.time !== currentHHmm) continue;

      const lastRun = task.lastRun ? new Date(task.lastRun) : null;
      const daysSinceLastRun = lastRun ? Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

      if (daysSinceLastRun >= task.intervalDays) {
        console.log(`Running scheduled task: ${task.id}`);
        for (const chatId of task.chatIds) {
          try {
            if (bot) {
              const extra: any = {};
              if (task.buttons && task.buttons.length > 0) {
                extra.reply_markup = {
                  inline_keyboard: [task.buttons.map((b: any) => ({ text: b.text, url: fixUrl(b.url) }))]
                };
              }

              let sentMsg;
              if (task.imageUrl) {
                sentMsg = await bot.telegram.sendPhoto(chatId, task.imageUrl, { caption: task.text, ...extra });
              } else {
                const messageText = task.text || task.message || '';
              sentMsg = await bot.telegram.sendMessage(chatId, messageText, extra);
              }

              // Handle pin
              if (task.pin) {
                try {
                  await bot.telegram.pinChatMessage(chatId, sentMsg.message_id);
                } catch (pinError) {
                  console.error(`Failed to pin scheduled message in ${chatId}:`, pinError);
                }
              }

              // Handle scheduled deletion
              if (task.deleteAfterDays > 0 || task.deleteAfterHours > 0) {
                const deleteAt = new Date(now.getTime() + (task.deleteAfterDays || 0) * 24 * 60 * 60 * 1000 + (task.deleteAfterHours || 0) * 60 * 60 * 1000);
                scheduledDeletions.push({
                  chatId,
                  messageId: sentMsg.message_id,
                  deleteAt: deleteAt.toISOString()
                });
                await db.collection('config').doc('deletions').set({ items: scheduledDeletions });
              }

              await addLog({
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                type: 'SYSTEM',
                user: 'Bot',
                chat: chats.find(c => c.id === chatId)?.title || chatId,
                details: `Запланированное сообщение отправлено: ${task.text.substring(0, 20)}...`
              });
            }
          } catch (err) {
            console.error(`Failed to send scheduled message to ${chatId}:`, err);
          }
        }
        task.lastRun = now.toISOString();
        await db.collection('tasks').doc(task.id).set(task);
      }
    }
  }, 60000); // Check every minute
}

startServer().catch(err => {
  console.error('CRITICAL: Failed to start server:', err);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', async () => {
  await flushWrites();
  bot?.stop('SIGINT');
});
process.once('SIGTERM', async () => {
  await flushWrites();
  bot?.stop('SIGTERM');
});
