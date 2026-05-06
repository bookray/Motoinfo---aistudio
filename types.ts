export interface Chat {
  id: string;
  title: string;
  members: number;
  muteNewcomers?: boolean;
  muteDurationHours?: number;
  muteMessage?: string;
  autoApprove?: boolean;
  captchaEnabled?: boolean;
  captchaQuestion?: string;
  captchaAnswer?: string;
  blockLinks?: boolean;
  blockTelegramLinks?: boolean;
  blockMedia?: boolean;
  blockForwards?: boolean;
  forbiddenWords?: string[];
  msgCount: number;
  avatarUrl: string;
  active: boolean;
  deleteSystemMessages?: boolean;
  deleteCommands?: boolean;
}

export interface ScheduledMessage {
  id: string;
  text: string;
  chatIds: string[];
  intervalDays: number;
  time: string;
  active: boolean;
  lastRun?: string;
  imageUrl?: string;
  buttons?: { text: string; url: string }[];
  pin?: boolean;
  deleteAfterDays?: number;
  deleteAfterHours?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'JOIN' | 'LEAVE' | 'BAN' | 'KICK' | 'WARN' | 'MUTE' | 'SYSTEM' | 'BROADCAST' | 'SETTINGS' | 'AUTH' | 'CHAT_UPDATE' | 'TASK';
  user: string;
  chat: string;
  details: string;
}

export interface GlobalBan {
  id: string;
  userId: string; // Can be ID or @username
  reason: string;
  date: string;
}

export interface WhitelistEntry {
  id: string;
  userId: string; // Can be ID or @username
  addedAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatId: string;
  joinedAt: string;
  lastSeen?: string;
  msgCount?: number;
  isAdmin?: boolean;
}

export interface MultiChatUser {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatIds: string[];
  chatCount: number;
}

export interface FilterSettings {
  blockLinks: boolean;
  blockTelegramLinks: boolean;
  blockMedia: boolean;
  blockForwards: boolean;
  forbiddenWords: string[];
  autoApprove: boolean;
  captchaEnabled: boolean;
  captchaQuestion: string;
  captchaAnswer: string;
  muteNewcomers: boolean;
  muteDurationHours: number;
  muteMessage: string;
  deleteSystemMessages: boolean;
  deleteCommands: boolean;
  userVoteEnabled: boolean;
  userVotePercentage: number;
  userVoteMin: number;
  userVoteMax: number;
  userVoteDuration: number;
  notifyMultiChat: boolean;
  multiChatThreshold: number;
}

export const DatabaseType = {
  FIREBASE: 'FIREBASE',
  MYSQL: 'MYSQL'
} as const;
export type DatabaseType = 'FIREBASE' | 'MYSQL';

export const UserRole = {
  ADMIN: 'ADMIN',
  ADVERTISER: 'ADVERTISER',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;
export type UserRole = 'ADMIN' | 'ADVERTISER' | 'SUPER_ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  assignedChatIds: string[];
  // Advertiser specific
  maxMessages?: number;
  messagesSent?: number;
  accessPeriodDays?: number;
  canPin?: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface BotSettings {
  botToken: string;
  adminPassword?: string;
  recoveryEmail?: string;
  dbType: DatabaseType;
  dbHost: string;
  dbUser: string;
  dbPass: string;
  dbName: string;
  dbPort: number;
  maintenanceMode: boolean;
}

export interface ChatBan {
  id: string;
  userId: string;
  chatId: string;
  chatTitle: string;
  reason: string;
  type: 'BAN' | 'MUTE';
  untilDate: string;
  addedAt: string;
}

export interface LatestMember extends Membership {
  chatTitle: string;
}

export interface Stats {
  totalMembers: number;
  totalMembersTrend: string;
  totalMessages24h: number;
  messagesTrend: string;
  modActions: number;
  modActionsTrend: string;
  activeChats: number;
  chartData: { 
    name: string; 
    joins: number; 
    leaves: number; 
    msgs: number;
    activeMembers: number;
    onlineMembers: number;
    totalMembers: number;
  }[];
  topActiveMembers: {
    userId: string;
    username?: string;
    firstName?: string;
    msgCount: number;
    chats: { id: string; title: string }[];
  }[];
  topActiveAdmins: {
    userId: string;
    username?: string;
    firstName?: string;
    msgCount: number;
    chats: { id: string; title: string }[];
  }[];
  topChatsByMembers: { id: string; title: string; count: number }[];
  topChatsByMessages24h: { id: string; title: string; count: number }[];
  topChatsByTotalMessages: { id: string; title: string; count: number }[];
  topChatsByActiveUsers: { id: string; title: string; count: number }[];
  topChatsByOnlineUsers: { id: string; title: string; count: number }[];
}

export interface BroadcastHistory {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  chatIds: string[];
  messageIds: { chatId: string; messageId: number }[];
  pin: boolean;
  pinTime?: number;
  imageUrl?: string;
  buttons?: { text: string; url: string }[];
  source: 'ADMIN' | 'BOT';
}

export const Tab = {
  STATISTICS: 'STATISTICS',
  CHATS: 'CHATS',
  MODERATION: 'MODERATION',
  ANTI_SCAM: 'ANTI_SCAM',
  SCHEDULER: 'SCHEDULER',
  BROADCAST: 'BROADCAST',
  LOGS: 'LOGS',
  USERS: 'USERS',
  SETTINGS: 'SETTINGS',
} as const;
export type Tab = 'STATISTICS' | 'CHATS' | 'MODERATION' | 'ANTI_SCAM' | 'SCHEDULER' | 'BROADCAST' | 'LOGS' | 'USERS' | 'SETTINGS';
