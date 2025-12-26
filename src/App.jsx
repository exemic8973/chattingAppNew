import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import io from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import Login from './components/Login';
import notificationService from './services/NotificationService';

// Lazy load modal components and large components
const VideoCall = lazy(() => import('./components/VideoCall'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const SearchModal = lazy(() => import('./components/SearchModal'));
const ChannelMembers = lazy(() => import('./components/ChannelMembers'));
const InviteUserModal = lazy(() => import('./components/InviteUserModal'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const VoiceChannel = lazy(() => import('./components/VoiceChannel'));
const SoulVoiceRoom = lazy(() => import('./components/SoulVoiceRoom'));
const SoulRoomManager = lazy(() => import('./components/SoulRoomManager'));
const SoulRecommendations = lazy(() => import('./components/SoulRecommendations'));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import { initialData, initialUsers } from './data';

// Loading fallback component
const LoadingFallback = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        color: 'var(--text-secondary)'
    }}>
        Loading...
    </div>
);

// Connect to backend
// In development (Zeabur), use same origin. In development, use localhost:3001
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const socketUrl = isDevelopment
  ? `https://${window.location.hostname}:3001`
  : window.location.origin;

const socket = io(socketUrl, {
  secure: true,
  rejectUnauthorized: false
});

function App() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('chatAppUsername');
    const savedAvatar = localStorage.getItem('chatAppAvatar');
    if (savedUsername) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
      if (savedAvatar) {
        setUserAvatar(savedAvatar);
      }
    }

    // Initialize notification service
    notificationService.initialize();
  }, []);

  // Keep teams structure for navigation, but messages will come from socket
  const [teams, setTeams] = useState(initialData.teams);
  const [users, setUsers] = useState(initialUsers);

  const [selectedTeamId, setSelectedTeamId] = useState(initialData.teams[0].id);
  const [selectedChannelId, setSelectedChannelId] = useState(initialData.teams[0].channels[0].id);
  const [selectedUserId, setSelectedUserId] = useState(null); // For DMs

  const [currentMessages, setCurrentMessages] = useState([]);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isVoiceCall, setIsVoiceCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { from, isVideo, channelId }
  const [showVoiceChannel, setShowVoiceChannel] = useState(false); // Toggle voice UI
  const [showSoulVoiceRoom, setShowSoulVoiceRoom] = useState(false);
  const [isSoulRoomActive, setIsSoulRoomActive] = useState(false);
  const [showSoulManager, setShowSoulManager] = useState(false);
  const [showSoulRecommendations, setShowSoulRecommendations] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [channelMembers, setChannelMembers] = useState([]);
  const chatAreaRef = useRef(null);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  // Channel might be null if we are in DM mode
  const selectedChannel = selectedTeam ? selectedTeam.channels.find(c => c.id === selectedChannelId) : null;
  const selectedUser = users.find(u => u.id === selectedUserId);

  // Join channel when selected channel changes or login happens
  useEffect(() => {
    if (isLoggedIn && selectedChannelId) {
      socket.emit("join_channel", { username, channelId: selectedChannelId });
      setCurrentMessages([]);
      setTypingUsers(new Set()); // Reset typing users when changing channel
      setChannelMembers([]); // Reset channel members when changing channel
    }
  }, [selectedChannelId, isLoggedIn, username]);

  // Update typing status in channel members when typingUsers changes
  useEffect(() => {
    setChannelMembers(prev =>
      prev.map(member => ({
        ...member,
        isTyping: typingUsers.has(member.username)
      }))
    );
  }, [typingUsers]);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setCurrentMessages((list) => [...list, data]);
      
      // Show notification if message is not from current user and not in focus
      if (data.sender !== username && document.hidden) {
        const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
        if (notificationSettings.enabled) {
          const isMentioned = data.text.includes(`@${username}`);
          const shouldNotify = isMentioned ? 
            notificationSettings.mentionNotifications : 
            notificationSettings.messageNotifications;

          if (shouldNotify) {
            notificationService.showMessageNotification(data.sender, data, data.channel_id, isMentioned);
          }
        }
      }
    });

    socket.on("receive_history", (history) => {
      setCurrentMessages(history);
    });

    socket.on("update_user_list", (userList) => {
      setUsers(userList);
    });

    socket.on("user_typing", ({ username: typer }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.add(typer);
        return newSet;
      });
    });

    socket.on("user_stopped_typing", ({ username: typer }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(typer);
        return newSet;
      });
    });

    socket.on("channel_members_update", ({ channelId, members }) => {
      // Only update if this is for the current channel
      if (channelId === selectedChannelId) {
        // Merge typing status from typingUsers into members
        const membersWithTyping = members.map(member => ({
          ...member,
          isTyping: typingUsers.has(member.username)
        }));
        setChannelMembers(membersWithTyping);
      }
    });

    socket.on("update_channel_list", (serverChannels) => {
      // Update the channels of the first team (or all teams if we had mapping)
      // For simplicity, we assume all these dynamic channels belong to the first team
      setTeams(prevTeams => {
        const newTeams = [...prevTeams];
        if (newTeams[0]) {
          newTeams[0] = {
            ...newTeams[0],
            channels: serverChannels
          };
        }
        return newTeams;
      });
    });

    socket.on("more_messages_loaded", (olderMessages) => {
      setCurrentMessages((current) => [...olderMessages, ...current]);
    });

    socket.on("reaction_updated", ({ messageId, reactions }) => {
      setCurrentMessages((msgs) =>
        msgs.map((msg) =>
          msg.id === messageId ? { ...msg, reactions } : msg
        )
      );
    });

    socket.on("message_deleted", ({ messageId }) => {
      setCurrentMessages((msgs) => msgs.filter((msg) => msg.id !== messageId));
    });

    socket.on("message_edited", ({ messageId, newText }) => {
      setCurrentMessages((msgs) =>
        msgs.map((msg) =>
          msg.id === messageId ? { ...msg, text: newText } : msg
        )
      );
    });

    socket.on("kicked_from_channel", ({ redirectTo }) => {
      // Auto-move to the redirect channel (no confirmation needed)
      const targetChannelId = redirectTo || 'c1';
      setSelectedChannelId(targetChannelId);
      socket.emit("join_channel", { username, channelId: targetChannelId });
    });

    socket.on("join_channel_success", (channelId) => {
      setSelectedTeamId(1); // Assume team 1
      setSelectedChannelId(channelId);
      setSelectedUserId(null);
    });

    socket.on("join_channel_error", (data) => {
      // data can be string or object { msg, channelId, needsPasscode }
      if (typeof data === 'object' && data.needsPasscode) {
        const passcode = prompt(`Enter passcode for channel:`);
        if (passcode !== null) {
          socket.emit("join_channel_request", { channelId: data.channelId, passcode: passcode.trim(), username });
        }
      } else {
        alert(typeof data === 'string' ? data : data.msg);
      }
    });

    // Incoming call notification system
    socket.on("incoming_call", ({ from, isVideo, channelId }) => {
      setIncomingCall({ from, isVideo, channelId });
      
      // Show call notification
      const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
      if (notificationSettings.enabled && notificationSettings.callNotifications && document.hidden) {
        notificationService.showCallNotification(from, isVideo);
      }
    });

    socket.on("call_cancelled", () => {
      setIncomingCall(null);
    });

    socket.on("call_accepted", ({ channelId, isVideo }) => {
      setIsVoiceCall(!isVideo);
      setIsVideoCallActive(true);
      setIncomingCall(null);
    });

    socket.on("call_declined", ({ by }) => {
      alert(`Call was declined by ${by}`);
    });

    socket.on("call_failed", ({ reason }) => {
      alert(`Call failed: ${reason}`);
    });

    socket.on("invitation_received", (data) => {
      const { channelId } = data;
      // Auto-join without confirmation (as per requirements)
      socket.emit("join_channel_request", { channelId, passcode: null, username });
    });

    socket.on("host_assist_invitation_received", (data) => {
      const { from, channelName, channelId } = data;
      const accept = confirm(`${from} invited you to be a host-assist in #${channelName}. Accept?`);
      socket.emit("respond_host_assist", { channelId, username, accepted: accept });
    });

    socket.on("channel_deleted", ({ channelId }) => {
      // Channel was deleted, move to default channel
      const defaultChannelId = 'c1';
      if (selectedChannelId === channelId) {
        setSelectedChannelId(defaultChannelId);
        socket.emit("join_channel", { username, channelId: defaultChannelId });
      }
    });

    // Request initial channels
    socket.emit("get_channels");

    // Handle Reconnection
    const handleReconnect = () => {
      console.log("Connected/Reconnected");
      // Re-fetch channels
      socket.emit("get_channels");
      // Re-join current channel if logged in
      if (username && selectedChannelId) {
        socket.emit("join_channel", { username, channelId: selectedChannelId });
      }
    };

    socket.on("connect", handleReconnect);

    // Handle connection errors
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      // You could show a user-friendly error message here
      // For example: setConnectionError(error.message);
    });

    // Handle socket errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      // Show error to user
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      // If the server initiated the disconnect, we should try to reconnect
      if (reason === "io server disconnect") {
        // Server disconnected us, reconnect manually
        socket.connect();
      }
      // Otherwise, socket will try to reconnect automatically
    });

    // Handle reconnection attempts
    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("Attempting to reconnect, attempt:", attemptNumber);
    });

    // Handle successful reconnection
    socket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected successfully after", attemptNumber, "attempts");
    });

    // Handle reconnection failure
    socket.on("reconnect_failed", () => {
      console.error("Failed to reconnect to server");
      // Show error to user that reconnection failed
    });

    // Handle user role check response
    socket.on("user_role", (data) => {
      if (data.username === username) {
        setIsAdmin(data.role === 'admin' || data.role === 'system');
      }
    });

    return () => {
      socket.off("receive_message");
      socket.off("receive_history");
      socket.off("update_user_list");
      socket.off("update_channel_list");
      socket.off("join_channel_success");
      socket.off("join_channel_error");
      socket.off("incoming_call");
      socket.off("call_cancelled");
      socket.off("call_accepted");
      socket.off("call_declined");
      socket.off("call_failed");
      socket.off("invitation_received");
      socket.off("host_assist_invitation_received");
      socket.off("channel_deleted");
      socket.off("connect", handleReconnect);
      socket.off("connect_error");
      socket.off("error");
      socket.off("disconnect");
      socket.off("reconnect_attempt");
      socket.off("reconnect");
      socket.off("reconnect_failed");
      socket.off("user_role");
    };
  }, [username, selectedChannelId]); // Add dependencies to ensure we have latest state on connect

  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    // Save session to localStorage
    localStorage.setItem('chatAppUsername', user);

    // Check if user is admin
    socket.emit('check_user_role', { username: user });
  };

  const handleLogout = () => {
    setUsername("");
    setIsLoggedIn(false);
    setUserAvatar(null);
    // Clear session from localStorage
    localStorage.removeItem('chatAppUsername');
    localStorage.removeItem('chatAppAvatar');
    // Disconnect socket
    socket.disconnect();
    // Reconnect for next login
    socket.connect();
  };

  const handleChannelSelect = (teamId, channelId) => {
    console.log("Selecting Channel Request:", teamId, channelId);

    // Exit soul room mode when selecting a channel
    setIsSoulRoomActive(false);

    // Validate inputs
    if (!teamId || !channelId) {
      console.error("Invalid teamId or channelId");
      return;
    }

    const team = teams.find(t => t.id === teamId || t.id == teamId); // Loose comparison for safety
    if (!team) {
      console.error("Team not found:", teamId);
      return;
    }

    const channel = team.channels.find(c => c.id === channelId);
    if (!channel) {
      console.error("Channel not found in team:", channelId);
      return;
    }

    console.log("Channel Found:", channel);

    // Always try joining first - server will check if user is invited or host
    // If it fails with "Invalid passcode", we'll prompt then
    if (channel.hasPasscode && channel.host !== username) {
      // Try joining without passcode first (in case user is invited)
      socket.emit("join_channel_request", { channelId, passcode: null, username, needsPasscodePrompt: true });
    } else {
      socket.emit("join_channel_request", { channelId, passcode: null, username });
    }
  };

  const handleCreateChannel = (teamId, channelName, passcode) => {
    socket.emit("create_channel", { name: channelName, passcode: passcode ? passcode.trim() : null, host: username });
  };

  const handleInviteUser = () => {
    if (!selectedChannelId || selectedChannelId.includes('_')) {
      alert("You can only invite users to channels.");
      return;
    }
    setShowInviteModal(true);
  };

  const handleSoulRoomClick = () => {
    setIsSoulRoomActive(true);
    setShowSoulVoiceRoom(true);
  };

  const handleInviteUserConfirm = (targetUser) => {
    if (targetUser) {
      socket.emit("invite_user", {
        targetUsername: targetUser.trim(),
        channelId: selectedChannelId,
        channelName: selectedChannel?.name,
        fromUsername: username
      });
      alert(`Invitation sent to ${targetUser}`);
    }
  };

  const handleKickUser = () => {
    if (!selectedChannelId) return;
    const targetUser = prompt("Enter username to kick:");
    if (targetUser) {
      socket.emit("kick_user", {
        channelId: selectedChannelId,
        targetUsername: targetUser.trim(),
        hostUsername: username
      });
    }
  };

  const handleKickUserFromMembers = (targetUsername) => {
    if (!selectedChannelId) return;
    if (confirm(`Are you sure you want to kick ${targetUsername}?`)) {
      socket.emit("kick_user", {
        channelId: selectedChannelId,
        targetUsername: targetUsername,
        hostUsername: username
      });
    }
  };

  const handleMakeHost = (targetUsername) => {
    if (!selectedChannelId) return;
    if (confirm(`Make ${targetUsername} the host of this channel?`)) {
      socket.emit("make_host", {
        channelId: selectedChannelId,
        targetUsername: targetUsername,
        currentHost: username
      });
    }
  };

  const handleMakeHostAssist = (targetUsername) => {
    if (!selectedChannelId) return;
    if (confirm(`Invite ${targetUsername} to be a host-assist?`)) {
      socket.emit("invite_host_assist", {
        channelId: selectedChannelId,
        channelName: selectedChannel?.name || 'channel',
        targetUsername: targetUsername,
        fromUsername: username
      });
    }
  };

  const handleDeleteChannel = () => {
    if (!selectedChannelId) return;
    if (confirm(`Are you sure you want to delete #${selectedChannel?.name}? This action cannot be undone.`)) {
      socket.emit("delete_channel", {
        channelId: selectedChannelId,
        username: username
      });
    }
  };

  const handleUserSelect = (userId) => {
    // Exit soul room mode when selecting a user
    setIsSoulRoomActive(false);

    setSelectedUserId(userId);
    setSelectedChannelId(null); // Deselect channel

    const otherUser = users.find(u => u.id === userId);
    const dmRoomId = [username, otherUser.name].sort().join("_");

    socket.emit("join_channel", { username, channelId: dmRoomId });
    setCurrentMessages([]);
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    const messageData = {
      id: Date.now(),
      text,
      sender: username,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: false
    };

    // Determine target: channel or DM room
    let targetId = selectedChannelId;
    if (selectedUserId) {
      const otherUser = users.find(u => u.id === selectedUserId);
      if (!otherUser) {
        console.error('User not found:', selectedUserId);
        return;
      }
      targetId = [username, otherUser.name].sort().join("_");
    }

    socket.emit("send_message", { channelId: targetId, message: messageData });
  };

  const startVideoCall = () => {
    const targetId = selectedUserId
      ? [username, selectedUser?.name].sort().join("_")
      : selectedChannelId;

    socket.emit("initiate_call", {
      to: selectedUserId ? selectedUser?.name : null,
      channelId: targetId,
      from: username,
      isVideo: true
    });
  };

  const startVoiceCall = () => {
    const targetId = selectedUserId
      ? [username, selectedUser?.name].sort().join("_")
      : selectedChannelId;

    socket.emit("initiate_call", {
      to: selectedUserId ? selectedUser?.name : null,
      channelId: targetId,
      from: username,
      isVideo: false
    });
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;

    socket.emit("accept_call", {
      from: incomingCall.from,
      channelId: incomingCall.channelId
    });

    setIsVoiceCall(!incomingCall.isVideo);
    setIsVideoCallActive(true);
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    if (!incomingCall) return;

    socket.emit("decline_call", {
      from: incomingCall.from,
      channelId: incomingCall.channelId
    });

    setIncomingCall(null);
  };

  if (!isLoggedIn) {
    return <Login socket={socket} onJoin={handleLogin} />;
  }

  // Map messages to include isOwn property
  const displayMessages = currentMessages.map(msg => ({
    ...msg,
    isOwn: msg.sender === username
  }));

  // Determine header title
  const headerTitle = selectedUserId ? `@ ${selectedUser?.name}` : `# ${selectedChannel?.name}`;

  return (
    <div className="app-container">
      <Sidebar
        teams={teams}
        selectedTeamId={selectedTeamId}
        selectedChannelId={selectedChannelId}
        onSelectChannel={handleChannelSelect}
        onCreateChannel={handleCreateChannel}
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={handleUserSelect}
        currentUsername={username}
        onSoulRoomClick={handleSoulRoomClick}
        isSoulRoomActive={isSoulRoomActive}
      />
      <div className="main-content">
        <Header
          channelName={isSoulRoomActive ? 'Soul Voice Room' : (selectedUserId ? selectedUser?.name : selectedChannel?.name)}
          onVideoCall={startVideoCall}
          onVoiceCall={startVoiceCall}
          onJoinVoice={() => setShowVoiceChannel(!showVoiceChannel)}
          showVoiceChannel={showVoiceChannel}
          onInviteUser={handleInviteUser}
          onLeaveChannel={() => {
            if (selectedChannelId && confirm('Are you sure you want to leave this channel?')) {
              socket.emit('leave_channel', { channelId: selectedChannelId, username });
              const defaultChannelId = teams[0]?.channels[0]?.id || 'c1';
              setSelectedChannelId(defaultChannelId);
              socket.emit('join_channel', { username, channelId: defaultChannelId });
            }
          }}
          onKickUser={handleKickUser}
          onDeleteChannel={handleDeleteChannel}
          onSearch={() => setShowSearchModal(true)}
          onProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
          onNotificationSettings={() => setShowNotificationSettings(true)}
          onAdmin={() => setShowAdminPanel(true)}
          isAdmin={isAdmin}
          userAvatar={userAvatar}
          username={username}
          isChannel={!selectedUserId}
          isHost={selectedChannel?.host === username}
          onSoulVoiceRoom={() => setShowSoulVoiceRoom(true)}
          onSoulManager={() => setShowSoulManager(true)}
          onSoulRecommendations={() => setShowSoulRecommendations(true)}
        />
        {!isSoulRoomActive && (
          <ChatArea
            ref={chatAreaRef}
            messages={displayMessages}
            onSendMessage={handleSendMessage}
            typingUsers={Array.from(typingUsers)}
            onTyping={() => socket.emit("typing", { channelId: selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null), username })}
            onStopTyping={() => socket.emit("stop_typing", { channelId: selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null), username })}
            onLoadMore={() => {
              if (displayMessages.length > 0) {
                const oldestMessage = displayMessages[0];
                if (oldestMessage.timestamp) {
                  socket.emit("load_more_messages", {
                    channelId: selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null),
                    beforeTimestamp: oldestMessage.timestamp
                  });
                }
              }
            }}
            onAddReaction={(messageId, emoji) => {
              const channelId = selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null);
              socket.emit("add_reaction", { messageId, channelId, emoji, username });
            }}
            onRemoveReaction={(messageId, emoji) => {
              const channelId = selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null);
              socket.emit("remove_reaction", { messageId, channelId, emoji, username });
            }}
            onDelete={(messageId) => {
              const channelId = selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null);
              socket.emit("delete_message", { messageId, channelId, username });
            }}
            onEdit={(messageId, newText) => {
              const channelId = selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null);
              socket.emit("edit_message", { messageId, channelId, username, newText });
            }}
            currentUser={username}
          />
        )}
        {isVideoCallActive && (
          <Suspense fallback={<LoadingFallback />}>
            <VideoCall
              socket={socket}
              channelId={selectedUserId ? [username, selectedUser?.name].sort().join("_") : selectedChannelId}
              username={username}
              onClose={() => setIsVideoCallActive(false)}
              isVoiceOnly={isVoiceCall}
            />
          </Suspense>
        )}

        {incomingCall && (
          <Suspense fallback={<LoadingFallback />}>
            <IncomingCallModal
              callerName={incomingCall.from}
              isVideoCall={incomingCall.isVideo}
              onAccept={handleAcceptCall}
              onDecline={handleDeclineCall}
            />
          </Suspense>
        )}

        {showVoiceChannel && !selectedUserId && selectedChannelId && (
          <Suspense fallback={<LoadingFallback />}>
            <VoiceChannel
              socket={socket}
              channelId={selectedChannelId}
              username={username}
              isHost={selectedChannel?.host === username}
              isHostAssist={channelMembers.find(m => m.username === username)?.isHostAssist || false}
            />
          </Suspense>
        )}
        
        {isSoulRoomActive && (
          <Suspense fallback={<LoadingFallback />}>
            <SoulVoiceRoom
              socket={socket}
              username={username}
              onLeave={() => {
                setShowSoulVoiceRoom(false);
                setIsSoulRoomActive(false);
              }}
            />
          </Suspense>
        )}
        
        {showSoulManager && (
          <div className="modal-overlay">
            <div className="modal-content">
              <Suspense fallback={<LoadingFallback />}>
                <SoulRoomManager
                  socket={socket}
                  username={username}
                />
              </Suspense>
              <button 
                onClick={() => setShowSoulManager(false)}
                className="close-modal-btn"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {showSoulRecommendations && (
          <div className="modal-overlay">
            <div className="modal-content">
              <Suspense fallback={<LoadingFallback />}>
                <SoulRecommendations
                  socket={socket}
                  username={username}
                  onJoinRoom={(room) => {
                    setShowSoulRecommendations(false);
                    setShowSoulVoiceRoom(true);
                  }}
                />
              </Suspense>
              <button 
                onClick={() => setShowSoulRecommendations(false)}
                className="close-modal-btn"
              >
                ✕
              </button>
            </div>
          </div>
        )}      </div>

      {!selectedUserId && selectedChannelId && (
        <Suspense fallback={<LoadingFallback />}>
          <ChannelMembers
            members={channelMembers}
            currentUser={username}
            isHost={selectedChannel?.host === username}
            isHostAssist={channelMembers.find(m => m.username === username)?.isHostAssist || false}
            onKickUser={handleKickUserFromMembers}
            onMakeHost={handleMakeHost}
            onMakeHostAssist={handleMakeHostAssist}
          />
        </Suspense>
      )}

      {showProfileModal && (
        <Suspense fallback={<LoadingFallback />}>
          <ProfileModal
            username={username}
            currentAvatar={userAvatar}
            onClose={() => setShowProfileModal(false)}
            onAvatarUpdate={(url) => {
              setUserAvatar(url);
              // Save avatar to localStorage
              localStorage.setItem('chatAppAvatar', url);
              setShowProfileModal(false);
            }}
          />
        </Suspense>
      )}

      {showSearchModal && (
        <Suspense fallback={<LoadingFallback />}>
          <SearchModal
            channelId={selectedChannelId || (selectedUserId ? [username, selectedUser?.name].sort().join("_") : null)}
            onClose={() => setShowSearchModal(false)}
            onSelectMessage={(msg) => {
              setShowSearchModal(false);
              // Scroll to the selected message
              if (chatAreaRef.current) {
                chatAreaRef.current.scrollToMessage(msg.id);
              }
            }}
          />
        </Suspense>
      )}

      {showInviteModal && (
        <Suspense fallback={<LoadingFallback />}>
          <InviteUserModal
            users={users}
            onClose={() => setShowInviteModal(false)}
            onInvite={handleInviteUserConfirm}
          />
        </Suspense>
      )}

      {showNotificationSettings && (
        <Suspense fallback={<LoadingFallback />}>
          <NotificationSettings
            onClose={() => setShowNotificationSettings(false)}
            onSave={(settings) => {
              console.log('Notification settings saved:', settings);
            }}
          />
        </Suspense>
      )}

      {showAdminPanel && (
        <Suspense fallback={<LoadingFallback />}>
          <AdminPanel
            onClose={() => setShowAdminPanel(false)}
            socket={socket}
            currentUser={username}
          />
        </Suspense>
      )}
      </div>
  );
}

export default App;
