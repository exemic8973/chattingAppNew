import { lazy } from 'react';

// Lazy load heavy components for code splitting
export const LazyVideoCall = lazy(() => import('../components/VideoCall'));
export const LazyThreadView = lazy(() => import('../components/ThreadView'));
export const LazyNotificationSettings = lazy(() => import('../components/NotificationSettings'));
export const LazyProfileModal = lazy(() => import('../components/ProfileModal'));
export const LazySearchModal = lazy(() => import('../components/SearchModal'));
export const LazyChannelMembers = lazy(() => import('../components/ChannelMembers'));
export const LazyInviteUserModal = lazy(() => import('../components/InviteUserModal'));
export const LazyIncomingCallModal = lazy(() => import('../components/IncomingCallModal'));
export const LazyVoiceChannel = lazy(() => import('../components/VoiceChannel'));

// Preload critical components
export const preloadComponent = (componentImport) => {
  const componentLoader = componentImport();
  componentLoader.catch(() => {});
  return componentLoader;
};

// Preload video call component when user might need it
export const preloadVideoCall = () => {
  preloadComponent(() => import('../components/VideoCall'));
};

// Preload thread view when user might need it
export const preloadThreadView = () => {
  preloadComponent(() => import('../components/ThreadView'));
};