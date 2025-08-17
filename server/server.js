require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js'); // Supabase client

const app = express();
const server = http.createServer(app);

// Allow CORS for development
app.use(cors({
  origin: '*', // Adjust in production to your frontend domain
  methods: ['GET', 'POST']
}));

const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for Socket.io in development
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// --- Supabase Configuration ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL ERROR: Supabase URL or Anon Key is not set.');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  process.exit(1); // Exit if Supabase credentials are not provided
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('Supabase client initialized.');

// In-memory storage for active rooms and users (still needed for real-time session management)
// rooms: Map<roomId, { users: Map<socketId, { username: string, lastActivity: number }>, messages: [] (optional, for quick access), lastActivity: number }>
const rooms = new Map();
const adminSockets = new Set(); // Store socket IDs of authenticated admins

// Configuration
const ROOM_EXPIRY_HOURS = process.env.ROOM_EXPIRY_HOURS ? parseInt(process.env.ROOM_EXPIRY_HOURS) : 2;
const MESSAGE_HISTORY_LIMIT = 50;
const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 10; // 10 messages per minute
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'BOLT_ADMIN_SECRET'; // Simple admin secret for demonstration

// Rate limiting storage: Map<socketId, { count: number, lastReset: number }>
const rateLimits = new Map();

// Helper to generate unique room codes
function generateRoomCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Helper to generate random anonymous usernames
const adjectives = ['Swift', 'Silent', 'Brave', 'Clever', 'Mystic', 'Golden', 'Crimson', 'Azure', 'Emerald', 'Whispering'];
const nouns = ['Wolf', 'Eagle', 'Lion', 'Fox', 'Bear', 'Dragon', 'Phoenix', 'Shadow', 'River', 'Mountain'];
function generateUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `Guest_${adj}_${noun}`;
}

// Room cleanup logic (now interacts with Supabase)
setInterval(async () => {
  const now = Date.now();
  const expiryThreshold = new Date(now - ROOM_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // Find rooms in DB that are inactive
  const { data: inactiveRooms, error: fetchError } = await supabase
    .from('rooms')
    .select('id')
    .lt('last_activity', expiryThreshold);

  if (fetchError) {
    console.error('Supabase error fetching inactive rooms for cleanup:', fetchError);
    return;
  }

  for (const dbRoom of inactiveRooms) {
    const roomId = dbRoom.id;
    // Only clean up if no active users are currently in the in-memory map
    // This prevents deleting rooms that are active but might have a stale last_activity in DB
    if (!rooms.has(roomId) || rooms.get(roomId).users.size === 0) {
      console.log(`Cleaning up inactive room: ${roomId} (DB & In-memory if exists)`);

      // Delete messages first (due to foreign key constraint)
      const { error: deleteMessagesError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId);

      if (deleteMessagesError) {
        console.error(`Supabase error deleting messages for room ${roomId}:`, deleteMessagesError);
        continue; // Skip to next room if message deletion fails
      }

      // Then delete the room
      const { error: deleteRoomError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (deleteRoomError) {
        console.error(`Supabase error deleting room ${roomId}:`, deleteRoomError);
        continue; // Skip to next room if room deletion fails
      }

      // Remove from in-memory if it exists
      if (rooms.has(roomId)) {
        rooms.delete(roomId);
      }

      adminSockets.forEach(adminSocketId => {
        io.to(adminSocketId).emit('room-deleted-admin-notify', { roomId, message: `Room ${roomId} was automatically cleaned up due to inactivity.` });
      });
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Initialize rate limit for new connection
  rateLimits.set(socket.id, { count: 0, lastReset: Date.now() });

  socket.on('create-room', async (callback) => {
    let roomId;
    let roomExistsInDB = true;
    // Generate a unique room code that doesn't exist in DB
    while (roomExistsInDB) {
      roomId = generateRoomCode();
      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .single();
      if (error && error.code === 'PGRST116') { // No rows found
        roomExistsInDB = false;
      } else if (error) {
        console.error('Supabase error checking room existence:', error);
        return callback({ success: false, message: 'Database error during room creation.' });
      }
      // If data is returned, room exists, so loop again
    }

    // Insert new room into Supabase
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ id: roomId }])
      .select(); // Select the inserted row to confirm

    if (error) {
      console.error('Supabase error creating room:', error);
      return callback({ success: false, message: 'Failed to create room in database.' });
    }

    // Add to in-memory map for active session management
    rooms.set(roomId, {
      users: new Map(),
      messages: [], // Messages will be fetched from DB on join
      lastActivity: Date.now() // Still track in-memory for quick cleanup checks
    });
    console.log(`Room created: ${roomId} (DB & In-memory)`);
    callback({ success: true, roomId });

    // Notify admins about new room
    adminSockets.forEach(adminSocketId => {
      io.to(adminSocketId).emit('room-created-admin-notify', { roomId });
    });
  });

  socket.on('join-room', async ({ roomId }, callback) => {
    // Check if room exists in Supabase
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      console.error('Supabase error fetching room:', roomError);
      return callback({ success: false, message: 'Room not found or database error.' });
    }

    // Update last activity in DB for the room
    await supabase
      .from('rooms')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', roomId);

    // Ensure in-memory room exists for active users
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        messages: [], // Messages will be fetched from DB
        lastActivity: Date.now()
      });
    }
    const room = rooms.get(roomId);

    const username = generateUsername();
    socket.join(roomId);
    room.users.set(socket.id, { username, lastActivity: Date.now() });
    room.lastActivity = Date.now(); // Update in-memory last activity

    // Fetch messages from Supabase
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('username, content, timestamp')
      .eq('room_id', roomId)
      .order('timestamp', { ascending: true })
      .limit(MESSAGE_HISTORY_LIMIT);

    if (messagesError) {
      console.error('Supabase error fetching messages:', messagesError);
      return callback({ success: false, message: 'Failed to load messages from database.' });
    }

    // Map Supabase messages to client format
    const formattedMessages = messages.map(msg => ({
      username: msg.username,
      message: msg.content,
      timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    const activeUsers = Array.from(room.users.values()).map(u => u.username);
    io.to(roomId).emit('user-joined', { username, activeUsers });
    console.log(`${username} (${socket.id}) joined room: ${roomId}`);

    callback({ success: true, username, messages: formattedMessages, activeUsers });
  });

  socket.on('send-message', async ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (!user) return; // User not in this room

    // Apply rate limiting
    const limit = rateLimits.get(socket.id);
    const now = Date.now();

    if (now - limit.lastReset > RATE_LIMIT_WINDOW_MS) {
      limit.count = 1;
      limit.lastReset = now;
    } else {
      limit.count++;
      if (limit.count > RATE_LIMIT_MAX_MESSAGES) {
        console.warn(`Rate limit exceeded for ${socket.id} in room ${roomId}`);
        socket.emit('rate-limit-exceeded', { message: 'You are sending messages too fast. Please wait.' });
        return;
      }
    }
    rateLimits.set(socket.id, limit);

    // Basic message validation
    if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 500) {
      socket.emit('message-error', { message: 'Invalid message content or length.' });
      return;
    }

    const messageTimestamp = new Date();
    const formattedTimestamp = messageTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Insert message into Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([
        { room_id: roomId, username: user.username, content: message.trim(), timestamp: messageTimestamp.toISOString() }
      ])
      .select(); // Select the inserted row to get its ID

    if (error) {
      console.error('Supabase error inserting message:', error);
      socket.emit('message-error', { message: 'Failed to send message (database error).' });
      return;
    }

    // Update room's last activity in DB
    await supabase
      .from('rooms')
      .update({ last_activity: messageTimestamp.toISOString() })
      .eq('id', roomId);

    room.lastActivity = messageTimestamp.getTime(); // Update in-memory last activity
    user.lastActivity = messageTimestamp.getTime();

    const newMessage = {
      id: data[0].id, // Use ID from Supabase
      username: user.username,
      message: message.trim(),
      timestamp: formattedTimestamp,
      isSelf: false // This will be set on client side
    };

    // Add to in-memory messages for immediate display (optional, but good for consistency)
    room.messages.push(newMessage);
    if (room.messages.length > MESSAGE_HISTORY_LIMIT) {
      room.messages.shift(); // Remove oldest message
    }

    io.to(roomId).emit('new-message', newMessage);
    console.log(`Message in ${roomId} from ${user.username}: ${message} (Persisted to DB)`);
  });

  socket.on('typing', ({ roomId, isTyping }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    if (!user) return;

    // Broadcast typing status to others in the room
    socket.to(roomId).emit('typing-indicator', { username: user.username, isTyping });
  });

  // --- Admin Events ---
  socket.on('admin-login', ({ secret }, callback) => {
    if (secret === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      console.log(`Admin connected: ${socket.id}`);
      callback({ success: true });
      // Immediately send room list to new admin
      // Fetch from Supabase
      supabase.from('rooms').select('id, created_at, last_activity')
        .then(({ data: roomsData, error }) => {
          if (error) {
            console.error('Supabase error fetching rooms for admin login:', error);
            return socket.emit('active-rooms-list', { rooms: [], message: 'Failed to load rooms.' });
          }
          const currentRooms = roomsData.map(dbRoom => ({
            id: dbRoom.id,
            userCount: rooms.has(dbRoom.id) ? rooms.get(dbRoom.id).users.size : 0, // Get active users from in-memory
            createdAt: dbRoom.created_at,
            lastActivity: dbRoom.last_activity
          }));
          socket.emit('active-rooms-list', { rooms: currentRooms });
        });
    } else {
      callback({ success: false, message: 'Invalid admin secret.' });
    }
  });

  socket.on('list-rooms', async (callback) => {
    if (!adminSockets.has(socket.id)) {
      return callback({ success: false, message: 'Unauthorized.' });
    }

    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('id, created_at, last_activity');

    if (error) {
      console.error('Supabase error listing rooms:', error);
      return callback({ success: false, message: 'Failed to fetch rooms from database.' });
    }

    // Augment with in-memory user counts for currently active rooms
    const currentRooms = roomsData.map(dbRoom => ({
      id: dbRoom.id,
      userCount: rooms.has(dbRoom.id) ? rooms.get(dbRoom.id).users.size : 0,
      createdAt: dbRoom.created_at,
      lastActivity: dbRoom.last_activity
    }));
    callback({ success: true, rooms: currentRooms });
  });

  socket.on('delete-room', async ({ roomId }, callback) => {
    if (!adminSockets.has(socket.id)) {
      return callback({ success: false, message: 'Unauthorized.' });
    }

    // Check if room exists in DB
    const { data: dbRoom, error: dbRoomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (dbRoomError || !dbRoom) {
      console.error('Supabase error checking room for deletion:', dbRoomError);
      return callback({ success: false, message: 'Room not found in database.' });
    }

    // Notify and disconnect users in the room (if active in-memory)
    const roomToDeleteInMemory = rooms.get(roomId);
    if (roomToDeleteInMemory) {
      io.to(roomId).emit('room-deleted-user-notify', { message: `This room (${roomId}) has been deleted by an administrator. You will be disconnected.` });
      roomToDeleteInMemory.users.forEach((userData, userId) => {
        const userSocket = io.sockets.sockets.get(userId);
        if (userSocket) {
          userSocket.leave(roomId);
          userSocket.disconnect(true); // Force disconnect
        }
      });
      rooms.delete(roomId); // Remove from in-memory
    }

    // Delete messages first (due to foreign key constraint)
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId);

    if (deleteMessagesError) {
      console.error('Supabase error deleting messages:', deleteMessagesError);
      return callback({ success: false, message: 'Failed to delete room messages in database.' });
    }

    // Then delete the room from Supabase
    const { error: deleteRoomError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (deleteRoomError) {
      console.error('Supabase error deleting room:', deleteRoomError);
      return callback({ success: false, message: 'Failed to delete room in database.' });
    }

    console.log(`Room deleted by admin: ${roomId} (DB & In-memory if active)`);
    callback({ success: true, message: `Room ${roomId} deleted.` });

    // Notify other admins about the deletion
    adminSockets.forEach(adminSocketId => {
      if (adminSocketId !== socket.id) { // Don't notify the admin who initiated the deletion
        io.to(adminSocketId).emit('room-deleted-admin-notify', { roomId, message: `Room ${roomId} was deleted by another administrator.` });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    rateLimits.delete(socket.id);
    adminSockets.delete(socket.id); // Remove from admin list if they were an admin

    // Find which room the user was in and remove them from in-memory map
    for (const [roomId, roomData] of rooms.entries()) {
      if (roomData.users.has(socket.id)) {
        const username = roomData.users.get(socket.id).username;
        roomData.users.delete(socket.id);
        roomData.lastActivity = Date.now(); // Update in-memory last activity

        // Notify everyone in the room about the user leaving
        const activeUsers = Array.from(roomData.users.values()).map(u => u.username);
        io.to(roomId).emit('user-left', { username, activeUsers });
        console.log(`${username} (${socket.id}) left room: ${roomId}`);

        // If room becomes empty in-memory, it's now eligible for DB cleanup if inactive
        if (roomData.users.size === 0) {
          console.log(`Room ${roomId} is now empty in-memory.`);
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin Secret (for testing): ${ADMIN_SECRET}`);
  console.log('Remember to set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
});
