import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import Login from './components/Login';
import VideoCall from './components/VideoCall';
import ProfileModal from './components/ProfileModal';
import SearchModal from './components/SearchModal';
import ChannelMembers from './components/ChannelMembers';
import InviteUserModal from './components/InviteUserModal';
import IncomingCallModal from './components/IncomingCallModal';
import { initialData, initialUsers } from './data';

// Connect to backend
// In production (Zeabur), use same origin. In development, use localhost:3001
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const socketUrl = isDevelopment
  ? `https://${window.location.hostname}:3001`
  : window.location.origin;

const socket = io(socketUrl, {
  secure: !isDevelopment,
  rejectUnauthorized: false
});

function App() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

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
    };
  }, [username, selectedChannelId]); // Add dependencies to ensure we have latest state on connect

  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    // Save session to localStorage
    localStorage.setItem('chatAppUsername', user);
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
      />
      <div className="main-content">
        <Header
          channelName={selectedUserId ? selectedUser?.name : selectedChannel?.name}
          onVideoCall={startVideoCall}
          onVoiceCall={startVoiceCall}
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
          userAvatar={userAvatar}
          username={username}
          isChannel={!selectedUserId}
          isHost={selectedChannel?.host === username}
        />
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
        {isVideoCallActive && (
          <VideoCall
            socket={socket}
            channelId={selectedUserId ? [username, selectedUser?.name].sort().join("_") : selectedChannelId}
            username={username}
            onClose={() => setIsVideoCallActive(false)}
            isVoiceOnly={isVoiceCall}
          />
        )}

        {incomingCall && (
          <IncomingCallModal
            callerName={incomingCall.from}
            isVideoCall={incomingCall.isVideo}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
          />
        )}
      </div>

      {!selectedUserId && selectedChannelId && (
        <ChannelMembers
          members={channelMembers}
          currentUser={username}
          isHost={selectedChannel?.host === username}
          isHostAssist={channelMembers.find(m => m.username === username)?.isHostAssist || false}
          onKickUser={handleKickUserFromMembers}
          onMakeHost={handleMakeHost}
          onMakeHostAssist={handleMakeHostAssist}
        />
      )}

      {showProfileModal && (
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
      )}

      {showSearchModal && (
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
      )}

      {showInviteModal && (
        <InviteUserModal
          users={users}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUserConfirm}
        />
      )}
    </div>
  );
}

export default App;
