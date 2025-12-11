# Chatting App

A modern, real-time chat application built with React, Socket.IO, and Node.js. Features responsive design, internationalization, and advanced channel management.

## Features

### Core Functionality
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **User Authentication**: Secure signup and login system
- **Channels & Direct Messages**: Create channels with optional passcodes or chat privately
- **Message Reactions**: React to messages with emojis
- **Message Search**: Search through message history with navigation
- **Typing Indicators**: See when others are typing
- **File Sharing**: Upload and share images and files
- **Markdown Support**: Rich text formatting in messages
- **Message History**: Infinite scroll to load older messages

### User Interface
- **Responsive Design**: Mobile-first design with breakpoints for tablet (1024px), mobile (768px), and small mobile (480px)
- **Dark/Light Theme**: Toggle between dark and light modes
- **Internationalization (i18n)**: Multi-language support with English and Chinese (Simplified)
- **User Avatars**: Customizable profile pictures
- **Profile Management**: Update avatar and personal settings

### Channel Management
- **Channel Roles**:
  - **Host**: Full control over the channel
  - **Host-Assist**: Can kick users and manage members
  - **Member**: Regular channel participant
- **Passcode Protection**: Optional passcode for private channels
- **Passcode Persistence**: Enter passcode once per channel (remembered until kicked)
- **Member List**: View all channel members with their roles
- **Invite System**: Invite users to channels
- **Kick/Ban System**: Remove users from channels (auto-redirect to default channel)
- **Channel Deletion**: Hosts can permanently delete channels
- **Transfer Host**: Promote members to host role

### Advanced Features
- **Session Persistence**: Auto-login with localStorage
- **Message Editing**: Edit your own messages
- **Message Deletion**: Delete your own messages
- **Read Receipts**: Track which messages have been read
- **Voice/Video Call UI**: Buttons for initiating calls (UI ready)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/exemic8973/chattingAppNew.git
cd chattingAppNew
```

2. Install dependencies:
```bash
npm install
```

3. Start the development servers:

**Frontend** (Vite dev server):
```bash
npm run dev
```
The frontend will run on `https://localhost:5173`

**Backend** (Node.js server):
```bash
npm run server
```
The backend will run on `http://localhost:3001`

## Usage

### Creating an Account
1. Open the app at `https://localhost:5173`
2. Click "Sign Up"
3. Enter a username and password
4. Click "Sign Up" to create your account

### Joining Channels
1. Select a channel from the sidebar
2. If the channel has a passcode, enter it when prompted
3. Once entered, you won't need the passcode again (unless kicked)

### Creating Channels
1. Click the `+` button next to "CHANNELS" in the sidebar
2. Enter a channel name
3. Optionally set a passcode for privacy
4. Click OK to create

### Managing Channels (Host)
- **Invite User**: Click ➕👤 in the header
- **Kick User**: Click 👢, then select a user from the members panel
- **Make Host-Assist**: Right-click a member → "Make Host-Assist"
- **Transfer Host**: Right-click a member → "Make Host"
- **Delete Channel**: Click 🗑️ (warning: permanent!)

### Changing Language
1. Click the language dropdown in the header
2. Select "English" or "简体中文"
3. All UI text will update immediately

### Switching Themes
- Click the 🌙/☀️ button in the header to toggle dark/light mode

## Project Structure

```
chattingAppNew/
├── server/
│   ├── server.js           # Express & Socket.IO server
│   ├── socket.js           # Socket.IO event handlers
│   ├── db.js              # SQLite database setup & migrations
│   └── uploads/           # File upload storage
├── src/
│   ├── components/
│   │   ├── ChatArea.jsx          # Main chat interface
│   │   ├── Header.jsx            # Top navigation bar
│   │   ├── Sidebar.jsx           # Channels & DMs list
│   │   ├── Login.jsx             # Authentication UI
│   │   ├── Message.jsx           # Individual message component
│   │   ├── ChannelMembers.jsx   # Members panel with roles
│   │   ├── InviteUserModal.jsx  # User invitation dialog
│   │   ├── LanguageSwitcher.jsx # Language selection dropdown
│   │   ├── UserAutocomplete.jsx # Username autocomplete input
│   │   ├── SearchModal.jsx      # Message search dialog
│   │   ├── ProfileModal.jsx     # User profile editor
│   │   └── VideoCall.jsx        # Video call interface
│   ├── context/
│   │   └── ThemeContext.jsx     # Dark/light theme provider
│   ├── i18n/
│   │   ├── I18nContext.jsx      # Internationalization context
│   │   └── locales/
│   │       ├── en.json          # English translations
│   │       └── zh-CN.json       # Chinese translations
│   ├── App.jsx               # Main application component
│   ├── main.jsx             # React entry point
│   └── index.css            # Global styles with responsive design
├── package.json
└── README.md
```

## Technologies Used

### Frontend
- **React 18**: UI framework with hooks
- **Vite**: Fast development server and build tool
- **Socket.IO Client**: Real-time WebSocket communication
- **React Context**: State management (Theme, i18n)
- **Marked.js**: Markdown rendering
- **CSS3**: Custom properties, flexbox, grid, animations

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web server framework
- **Socket.IO**: Real-time bidirectional communication
- **SQLite**: Lightweight SQL database
- **Multer**: File upload handling
- **better-sqlite3**: Synchronous SQLite bindings

## Database Schema

### Tables
- **users**: User accounts (username, password, avatar)
- **messages**: Chat messages with reactions
- **channels**: Channel information (name, host, passcode)
- **channel_invites**: Invitations and member roles (member, host_assist)
  - Status: `invited`, `accepted`, `banned`
- **direct_messages**: Private messages between users
- **reactions**: Message reactions
- **message_reads**: Read receipt tracking

## Deployment

### Production Build

1. Build the frontend:
```bash
npm run build
```

2. The built files will be in the `dist/` directory

3. Deploy to your hosting platform (Vercel, Netlify, Zeabur, etc.)

### Environment Variables
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string (for production)
- `NODE_ENV`: Set to "production" for production builds

## Recent Updates

### Version 2.0.0 (Latest)
- ✨ Added responsive design for mobile and tablet devices
- 🌍 Added internationalization (i18n) with Chinese translation support
- 🔒 Implemented passcode persistence (enter once per channel)
- 🚫 Added ban system for kicked users
- ⭐ Added host-assist role for channel management
- 🗑️ Added channel deletion feature
- 🎨 Enhanced UI with better mobile experience
- 🐛 Fixed database migration issues for existing databases

### Previous Updates
- Added channel members panel with role badges
- Implemented session persistence with localStorage
- Added message search with navigation
- Added markdown support for rich text
- Added file upload and image sharing
- Implemented message reactions
- Added typing indicators
- Added profile management with avatars

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for learning or commercial purposes.

## Support

For issues and questions, please open an issue on GitHub.
