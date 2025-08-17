# 🧪 Testing Guide for CJ Chat

## Testing Room Creation and Joining

### Prerequisites
- Make sure your server is running: `npm run start-server`
- Make sure your client is running: `npm run dev`
- Make sure your Supabase database tables are created

### Test 1: Create a Room

1. **Open your browser** and go to: http://localhost:5173
2. **Click "Create New Room"**
3. **Expected Results:**
   - You should see a room code generated (e.g., ABC123)
   - The room code should be displayed prominently in the chat header
   - You should automatically join the room
   - You should see the chat interface
   - Check the browser console for success messages

### Test 2: Join an Existing Room

1. **Open a new browser tab/window** (or use incognito mode)
2. **Go to:** http://localhost:5173
3. **Enter the room code** from Test 1 in the input field
4. **Click "Join Room"**
5. **Expected Results:**
   - You should join the same room
   - You should see the chat interface
   - You should see the other user in the active users list
   - Check the browser console for success messages

### Test 3: Multiple Users in Same Room

1. **Open 3-4 different browser tabs/windows**
2. **Join the same room** using the room code
3. **Send messages** from different users
4. **Expected Results:**
   - All users should see messages from each other
   - Active users list should show all users
   - Typing indicators should work

### Test 4: Room Code Sharing

1. **Create a room** in one browser
2. **Copy the room code** by clicking on it
3. **Paste the code** in another browser
4. **Join the room**
5. **Expected Results:**
   - Room code should be copyable
   - Joining should work with the copied code

## Debugging

### Check Browser Console
Open Developer Tools (F12) and check the console for:
- ✅ Success messages
- ❌ Error messages
- 📡 Socket connection status

### Check Server Console
Look at your server terminal for:
- ✅ "Room created: [CODE] (DB & In-memory)"
- ✅ "User joined room: [CODE]"
- ✅ "Message in [CODE] from [USER] (Persisted to DB)"

### Common Issues and Solutions

#### Issue: "Room not found"
**Solution:** Make sure you've run the SQL script in Supabase

#### Issue: Can't join room
**Solution:** 
1. Check that the room code is correct
2. Make sure the server is running
3. Check browser console for errors

#### Issue: Messages not appearing
**Solution:**
1. Check that both users are in the same room
2. Check server console for message persistence
3. Verify Supabase connection

## Expected Console Output

### Successful Room Creation:
```
Create room button clicked
Creating new socket connection for create room
Emitting create-room event
Create room response: {success: true, roomId: "ABC123"}
Room created: ABC123
Room created successfully! Code: ABC123
Automatically joining created room
Auto-join response: {success: true, username: "Guest_Swift_Wolf", messages: [], activeUsers: ["Guest_Swift_Wolf"]}
Joined created room ABC123 as Guest_Swift_Wolf
```

### Successful Room Joining:
```
Attempting to join room: ABC123
Creating new socket connection for join room
Emitting join-room event for room: ABC123
Join room response: {success: true, username: "Guest_Brave_Eagle", messages: [...], activeUsers: [...]}
Successfully joined room ABC123 as Guest_Brave_Eagle
Successfully joined room ABC123!
```

## Server Logs to Look For

### Room Creation:
```
Room created: ABC123 (DB & In-memory)
Guest_Swift_Wolf (socket-id) joined room: ABC123
```

### Room Joining:
```
Guest_Brave_Eagle (socket-id) joined room: ABC123
```

### Message Sending:
```
Message in ABC123 from Guest_Swift_Wolf: Hello! (Persisted to DB)
```

If you see these logs, your application is working correctly! 🎉 