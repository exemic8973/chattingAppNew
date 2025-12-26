// User and Authentication Types
export interface User {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
}

export interface AuthUser {
  id: number;
  username: string;
  password: string;
  avatar_url?: string;
}

// Channel and Message Types
export interface Channel {
  id: string;
  name: string;
  hasPasscode: boolean;
  host: string;
}

export interface Message {
  id: number;
  channel_id: string;
  sender: string;
  text: string;
  time: string;
  timestamp: number;
  isOwn?: boolean;
  isSystem?: boolean;
  reactions?: Reaction[];
  reply_to?: number;
  thread_id?: number;
  replies?: Message[];
  replyCount?: number;
}

export interface Reaction {
  emoji: string;
  username: string;
}

// Team Structure
export interface Team {
  id: number;
  name: string;
  channels: Channel[];
}

// Channel Management Types
export interface ChannelMember {
  username: string;
  avatar?: string;
  isTyping: boolean;
  isHost: boolean;
  isHostAssist: boolean;
}

export interface ChannelInvite {
  channel_id: string;
  username: string;
  invited_by: string;
  timestamp: number;
  role: 'member' | 'host_assist';
  status: 'invited' | 'accepted' | 'banned';
}

// Socket Event Types
export interface SocketEvents {
  // Client to Server
  signup: (data: { username: string; password: string }) => void;
  login: (data: { username: string; password: string }) => void;
  join_channel: (data: { username: string; channelId: string }) => void;
  join_channel_request: (data: { channelId: string; passcode: string | null; username: string }) => void;
  send_message: (data: { channelId: string; message: Message }) => void;
  reply_to_message: (data: { channelId: string; message: Message; replyToId: number }) => void;
  create_thread: (data: { channelId: string; message: Message; threadId: number }) => void;
  get_thread_messages: (data: { channelId: string; threadId: number }) => void;
  typing: (data: { channelId: string; username: string }) => void;
  stop_typing: (data: { channelId: string; username: string }) => void;
  delete_message: (data: { messageId: number; channelId: string; username: string }) => void;
  edit_message: (data: { messageId: number; channelId: string; username: string; newText: string }) => void;
  add_reaction: (data: { messageId: number; channelId: string; emoji: string; username: string }) => void;
  remove_reaction: (data: { messageId: number; channelId: string; emoji: string; username: string }) => void;
  create_channel: (data: { name: string; passcode: string | null; host: string }) => void;
  invite_user: (data: { channelId: string; channelName: string; targetUsername: string; fromUsername: string }) => void;
  kick_user: (data: { channelId: string; targetUsername: string; hostUsername: string }) => void;
  make_host: (data: { channelId: string; targetUsername: string; currentHost: string }) => void;
  invite_host_assist: (data: { channelId: string; channelName: string; targetUsername: string; fromUsername: string }) => void;
  respond_host_assist: (data: { channelId: string; username: string; accepted: boolean }) => void;
  delete_channel: (data: { channelId: string; username: string }) => void;
  leave_channel: (data: { channelId: string; username: string }) => void;
  load_more_messages: (data: { channelId: string; beforeTimestamp: number }) => void;
  get_channels: () => void;
  initiate_call: (data: { to: string | null; channelId: string; from: string; isVideo: boolean }) => void;
  accept_call: (data: { from: string; channelId: string }) => void;
  decline_call: (data: { from: string; channelId: string }) => void;

  // Server to Client
  signup_success: (message: string) => void;
  signup_error: (error: string) => void;
  login_success: (username: string) => void;
  login_error: (error: string) => void;
  receive_message: (message: Message) => void;
  receive_history: (history: Message[]) => void;
  thread_messages: (data: { threadId: number; messages: Message[] }) => void;
  message_replied: (data: { originalMessageId: number; reply: Message }) => void;
  update_user_list: (users: User[]) => void;
  update_channel_list: (channels: Channel[]) => void;
  channel_members_update: (data: { channelId: string; members: ChannelMember[] }) => void;
  user_typing: (data: { username: string }) => void;
  user_stopped_typing: (data: { username: string }) => void;
  reaction_updated: (data: { messageId: number; reactions: Reaction[] }) => void;
  message_deleted: (data: { messageId: number }) => void;
  message_edited: (data: { messageId: number; newText: string }) => void;
  join_channel_success: (channelId: string) => void;
  join_channel_error: (error: string | { msg: string; channelId: string; needsPasscode: boolean }) => void;
  invitation_received: (data: { from: string; channelName: string; channelId: string }) => void;
  host_assist_invitation_received: (data: { from: string; channelName: string; channelId: string }) => void;
  kicked_from_channel: (data: { channelId: string; by: string; redirectTo: string }) => void;
  channel_deleted: (data: { channelId: string; deletedBy: string }) => void;
  more_messages_loaded: (olderMessages: Message[]) => void;
  incoming_call: (data: { from: string; isVideo: boolean; channelId: string }) => void;
  call_cancelled: () => void;
  call_accepted: (data: { channelId: string; isVideo: boolean }) => void;
  call_declined: (data: { by: string }) => void;
  call_failed: (data: { reason: string }) => void;
  connection_error: (data: { error: string; retryAfter: string }) => void;
  message_error: (data: { error: string; retryAfter?: string }) => void;
}

// UI Component Props Types
export interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  typingUsers: string[];
  onTyping: () => void;
  onStopTyping: () => void;
  onLoadMore: () => void;
  onAddReaction: (messageId: number, emoji: string) => void;
  onRemoveReaction: (messageId: number, emoji: string) => void;
  onDelete: (messageId: number) => void;
  onEdit: (messageId: number, newText: string) => void;
  currentUser: string;
}

export interface SidebarProps {
  teams: Team[];
  selectedTeamId: number;
  selectedChannelId: string | null;
  selectedUserId: string | null;
  onSelectChannel: (teamId: number, channelId: string) => void;
  onCreateChannel: (teamId: number, channelName: string, passcode: string | null) => void;
  onSelectUser: (userId: string) => void;
  users: User[];
  currentUsername: string;
}

export interface HeaderProps {
  channelName: string;
  onVideoCall: () => void;
  onVoiceCall: () => void;
  onJoinVoice: () => void;
  showVoiceChannel: boolean;
  onInviteUser: () => void;
  onLeaveChannel: () => void;
  onKickUser: () => void;
  onDeleteChannel: () => void;
  onSearch: () => void;
  onProfile: () => void;
  onLogout: () => void;
  userAvatar: string | null;
  username: string;
  isChannel: boolean;
  isHost: boolean;
}

// Context Types
export interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export interface I18nContextType {
  locale: string;
  t: (key: string, params?: Record<string, string>) => string;
  changeLanguage: (locale: string) => void;
  availableLanguages: Array<{ code: string; name: string }>;
}

// Error Types
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface ErrorReport {
  message: string;
  stack: string;
  componentStack: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

// Voice/Video Call Types
export interface VoiceSession {
  channel_id: string;
  username: string;
  is_muted: boolean;
  can_unmute: boolean;
  joined_at: number;
}

export interface IncomingCall {
  from: string;
  isVideo: boolean;
  channelId: string;
}

// Database Types
export interface DatabaseSchema {
  users: AuthUser;
  channels: Channel;
  messages: Message;
  channel_invites: ChannelInvite;
  reactions: Reaction;
  voice_sessions: VoiceSession;
}