# CJ Chat - Real-time Chat Application

A modern, real-time chat application built with Node.js, Socket.io, and Supabase. Features include anonymous chat rooms, persistent message storage, and admin panel for room management.

## Features

- 🚀 **Real-time messaging** with Socket.io
- 🔐 **Anonymous chat rooms** with unique 6-character codes
- 💾 **Persistent storage** using Supabase PostgreSQL
- 👥 **Active user tracking** and typing indicators
- 🛡️ **Rate limiting** to prevent spam
- 🔧 **Admin panel** for room management
- 📱 **Responsive design** for all devices
- 🧹 **Automatic cleanup** of inactive rooms

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project

## Setup Instructions

### 1. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to your Supabase project dashboard
3. Navigate to the SQL Editor
4. Copy and paste the contents of `supabase_setup.sql` into the editor
5. Run the script to create the required tables and policies

### 2. Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ADMIN_SECRET=your_admin_secret_key
PORT=3000
ROOM_EXPIRY_HOURS=2
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

**To find your Supabase credentials:**
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "Project URL" and "anon public" key

### 3. Install Dependencies

```bash
# Install client dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 4. Start the Application

Open two terminal windows:

**Terminal 1 - Start the server:**
```bash
npm run start-server
```

**Terminal 2 - Start the client:**
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## How to Use

### Creating a Room

1. Click the "Create New Room" button
2. The system will generate a unique 6-character room code (e.g., ABC123)
3. You'll automatically join the room and see the chat interface
4. Share the room code with others to let them join

### Joining a Room

1. Enter a 6-character room code in the input field
2. Click "Join Room"
3. You'll be assigned a random anonymous username
4. Start chatting!

### Admin Panel

1. Click "Admin Panel" on the main screen
2. Enter the admin secret (set in your environment variables)
3. View all active rooms and their user counts
4. Delete rooms if needed
5. Monitor room creation and deletion in real-time

## Project Structure

```
├── client/                 # Frontend application
│   ├── index.html         # Main HTML file
│   ├── main.js           # Client-side JavaScript
│   └── style.css         # Styles
├── server/                # Backend server
│   ├── server.js         # Socket.io server
│   └── package.json      # Server dependencies
├── supabase_setup.sql    # Database setup script
├── package.json          # Client dependencies
└── README.md            # This file
```

## Technical Details

### Server Features

- **Room Management**: Creates unique room codes and manages active sessions
- **Message Persistence**: Stores all messages in Supabase PostgreSQL
- **Rate Limiting**: Prevents spam with configurable limits
- **Automatic Cleanup**: Removes inactive rooms after configurable time
- **Admin Authentication**: Secure admin panel with secret key
- **Real-time Notifications**: Live updates for room events

### Client Features

- **Responsive UI**: Works on desktop and mobile devices
- **Real-time Updates**: Live message updates and user status
- **Typing Indicators**: Shows when users are typing
- **Anonymous Usernames**: Random guest usernames for privacy
- **Error Handling**: User-friendly error messages
- **Admin Interface**: Full admin panel integration

### Database Schema

**Rooms Table:**
- `id` (VARCHAR): Unique 6-character room code
- `created_at` (TIMESTAMP): Room creation time
- `last_activity` (TIMESTAMP): Last activity in the room

**Messages Table:**
- `id` (BIGSERIAL): Auto-incrementing message ID
- `room_id` (VARCHAR): Foreign key to rooms table
- `username` (VARCHAR): Anonymous username
- `content` (TEXT): Message content
- `timestamp` (TIMESTAMP): Message timestamp

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Required |
| `ADMIN_SECRET` | Secret key for admin access | `BOLT_ADMIN_SECRET` |
| `PORT` | Server port | `3000` |
| `ROOM_EXPIRY_HOURS` | Hours before room cleanup | `2` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` |
| `RATE_LIMIT_MAX` | Max messages per window | `10` |

## Troubleshooting

### Common Issues

1. **"Supabase URL or Anon Key is not set"**
   - Check your `.env` file and ensure credentials are correct
   - Verify your Supabase project is active

2. **"Room not found"**
   - Ensure the database tables were created correctly
   - Check Supabase connection

3. **"Admin login failed"**
   - Verify the `ADMIN_SECRET` environment variable is set
   - Check that you're using the correct secret

4. **Messages not persisting**
   - Check Supabase RLS policies
   - Verify database permissions

### Development

For development, you can run both client and server in watch mode:

```bash
# Terminal 1
npm run start-server

# Terminal 2  
npm run dev
```

## Security Considerations

- The application uses anonymous chat - no user authentication required
- Admin panel is protected by a secret key
- Rate limiting prevents spam
- Row Level Security (RLS) is enabled in Supabase
- All database operations are validated

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE). 