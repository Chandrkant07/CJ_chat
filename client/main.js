import { io } from 'socket.io-client';

// Get the server URL from environment or default to localhost
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// DOM Elements
const roomEntryScreen = document.getElementById('room-entry');
const chatRoomScreen = document.getElementById('chat-room');
const adminPanelScreen = document.getElementById('admin-panel'); // New admin panel screen

const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const roomError = document.getElementById('room-error');
const currentRoomCodeSpan = document.querySelector('#current-room-code .code');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const activeUsersList = document.getElementById('active-users-list');
const userCountSpan = document.getElementById('user-count');
const typingIndicatorsDiv = document.getElementById('typing-indicators');

// Admin Panel Elements
const adminPanelBtn = document.getElementById('admin-panel-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');
const adminLoginSection = document.getElementById('admin-login-section');
const adminRoomsSection = document.getElementById('admin-rooms-section');
const adminSecretInput = document.getElementById('admin-secret-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminError = document.getElementById('admin-error');
const adminRoomsList = document.getElementById('admin-rooms-list');
const adminRoomCountSpan = document.getElementById('admin-room-count');
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');


let socket;
let currentRoomId = null;
let currentUsername = null;
let typingTimeout = null;
let isTyping = false;
let isAdminAuthenticated = false; // Track admin authentication status

// --- UI Management Functions ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function displayError(message, targetElement = roomError) {
  targetElement.textContent = message;
  targetElement.classList.add('show');
  setTimeout(() => {
    targetElement.classList.remove('show');
  }, 3000);
}

function updateRoomCodeDisplay(roomId) {
  currentRoomCodeSpan.textContent = roomId;
  // Make the room code more prominent and copyable
  currentRoomCodeSpan.style.fontWeight = 'bold';
  currentRoomCodeSpan.style.color = '#007bff';
  currentRoomCodeSpan.style.cursor = 'pointer';
  currentRoomCodeSpan.title = 'Click to copy room code';
  
  // Also update the share room code section
  const shareRoomCode = document.querySelector('#share-room-code .code');
  if (shareRoomCode) {
    shareRoomCode.textContent = roomId;
  }
  
  // Add click to copy functionality
  currentRoomCodeSpan.onclick = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      displayError('Room code copied to clipboard!', roomError);
    });
  };
  
  // Add click to copy functionality to share section
  const shareSection = document.getElementById('share-room-code');
  if (shareSection) {
    shareSection.onclick = () => {
      navigator.clipboard.writeText(roomId).then(() => {
        displayError('Room code copied to clipboard!', roomError);
      });
    };
  }
}

function addMessageToChat(message, isSelf = false) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(isSelf ? 'self' : 'other');

  const bubble = document.createElement('div');
  bubble.classList.add('message-bubble');

  const usernameSpan = document.createElement('span');
  usernameSpan.classList.add('message-username');
  usernameSpan.textContent = message.username;

  const textSpan = document.createElement('p');
  textSpan.classList.add('message-text');
  textSpan.textContent = message.message;

  const timestampSpan = document.createElement('span');
  timestampSpan.classList.add('message-timestamp');
  timestampSpan.textContent = message.timestamp;

  bubble.appendChild(usernameSpan);
  bubble.appendChild(textSpan);
  bubble.appendChild(timestampSpan);
  messageElement.appendChild(bubble);
  chatMessages.appendChild(messageElement);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateActiveUsers(users) {
  activeUsersList.innerHTML = '';
  userCountSpan.textContent = users.length;
  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = user;
    activeUsersList.appendChild(li);
  });
}

function updateTypingIndicators(typingUsers) {
  typingIndicatorsDiv.innerHTML = '';
  if (typingUsers.length > 0) {
    const text = typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.join(', ')} are typing...`;
    const p = document.createElement('p');
    p.classList.add('typing-user');
    p.textContent = text;
    typingIndicatorsDiv.appendChild(p);
  }
}

function updateAdminRoomList(roomsData) {
  adminRoomsList.innerHTML = '';
  adminRoomCountSpan.textContent = roomsData.length;
  if (roomsData.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No active rooms.';
    adminRoomsList.appendChild(li);
    return;
  }

  roomsData.forEach(room => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="room-info">
        <span class="room-id">Room: ${room.id}</span>
        <span class="user-count">Users: ${room.userCount}</span>
      </div>
      <button class="delete-btn" data-room-id="${room.id}">Delete</button>
    `;
    adminRoomsList.appendChild(li);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const roomIdToDelete = event.target.dataset.roomId;
      if (confirm(`Are you sure you want to delete room ${roomIdToDelete}? This will disconnect all users.`)) {
        socket.emit('delete-room', { roomId: roomIdToDelete }, ({ success, message }) => {
          if (success) {
            displayError(message, adminError); // Use adminError for admin messages
            // Refresh list after deletion
            socket.emit('list-rooms', ({ success: listSuccess, rooms: updatedRooms, message: listMessage }) => {
              if (listSuccess) {
                updateAdminRoomList(updatedRooms);
              } else {
                displayError(listMessage || 'Failed to refresh room list.', adminError);
              }
            });
          } else {
            displayError(message || 'Failed to delete room.', adminError);
          }
        });
      }
    });
  });
}

// --- Socket.io Event Handlers ---
function setupSocketEvents() {
  socket.on('connect', () => {
    console.log('Connected to server');
    // If coming back from disconnect as admin, try to re-authenticate
    if (isAdminAuthenticated) {
      socket.emit('admin-login', { secret: adminSecretInput.value }, ({ success }) => {
        if (success) {
          console.log('Re-authenticated as admin.');
          adminLoginSection.classList.remove('active');
          adminRoomsSection.classList.add('active');
          socket.emit('list-rooms', ({ success: listSuccess, rooms: currentRooms, message: listMessage }) => {
            if (listSuccess) {
              updateAdminRoomList(currentRooms);
            } else {
              displayError(listMessage || 'Failed to load rooms.', adminError);
            }
          });
        } else {
          isAdminAuthenticated = false; // Reset if re-auth fails
          adminLoginSection.classList.add('active');
          adminRoomsSection.classList.remove('active');
          displayError('Admin session expired or re-authentication failed.', adminError);
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    // Optionally, show a message or return to room entry
    showScreen('room-entry');
    currentRoomId = null;
    currentUsername = null;
    chatMessages.innerHTML = '';
    updateActiveUsers([]);
    updateTypingIndicators([]);
    // Do not reset isAdminAuthenticated here if it's a temporary disconnect
    displayError('Disconnected from chat. Please rejoin.');
  });

  socket.on('new-message', (message) => {
    addMessageToChat(message, message.username === currentUsername);
  });

  socket.on('user-joined', ({ username, activeUsers }) => {
    addMessageToChat({ username: 'System', message: `${username} has joined the room.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    updateActiveUsers(activeUsers);
  });

  socket.on('user-left', ({ username, activeUsers }) => {
    addMessageToChat({ username: 'System', message: `${username} has left the room.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    updateActiveUsers(activeUsers);
  });

  const typingUsers = new Set();
  socket.on('typing-indicator', ({ username, isTyping }) => {
    if (username === currentUsername) return; // Don't show indicator for self

    if (isTyping) {
      typingUsers.add(username);
    } else {
      typingUsers.delete(username);
    }
    updateTypingIndicators(Array.from(typingUsers));
  });

  socket.on('rate-limit-exceeded', ({ message }) => {
    displayError(message);
  });

  socket.on('message-error', ({ message }) => {
    displayError(message);
  });

  // --- Admin Socket Events ---
  socket.on('admin-authenticated', () => {
    isAdminAuthenticated = true;
    adminLoginSection.classList.remove('active');
    adminRoomsSection.classList.add('active');
    displayError('Admin login successful!', adminError);
    // Request initial room list
    socket.emit('list-rooms', ({ success, rooms: currentRooms, message }) => {
      if (success) {
        updateAdminRoomList(currentRooms);
      } else {
        displayError(message || 'Failed to load rooms.', adminError);
      }
    });
  });

  socket.on('active-rooms-list', ({ rooms }) => {
    updateAdminRoomList(rooms);
  });

  socket.on('room-deleted-admin-notify', ({ roomId, message }) => {
    displayError(message || `Room ${roomId} was deleted.`, adminError);
    // Refresh the list to reflect the deletion
    socket.emit('list-rooms', ({ success, rooms: updatedRooms, message: listMessage }) => {
      if (success) {
        updateAdminRoomList(updatedRooms);
      } else {
        displayError(listMessage || 'Failed to refresh room list after deletion.', adminError);
      }
    });
  });

  socket.on('room-created-admin-notify', ({ roomId }) => {
    displayError(`New room created: ${roomId}`, adminError);
    // Refresh the list to reflect the new room
    socket.emit('list-rooms', ({ success, rooms: updatedRooms, message: listMessage }) => {
      if (success) {
        updateAdminRoomList(updatedRooms);
      } else {
        displayError(listMessage || 'Failed to refresh room list after new room creation.', adminError);
      }
    });
  });

  socket.on('room-deleted-user-notify', ({ message }) => {
    displayError(message, roomError);
    // Force disconnect and return to main screen
    if (socket) {
      socket.disconnect();
      socket = null; // Clear socket to ensure new connection on next action
    }
    showScreen('room-entry');
    currentRoomId = null;
    currentUsername = null;
    chatMessages.innerHTML = '';
    updateActiveUsers([]);
    updateTypingIndicators([]);
  });
}

// --- Event Listeners ---
createRoomBtn.addEventListener('click', () => {
  console.log('Create room button clicked');
  
  if (!socket) {
    console.log('Creating new socket connection for create room');
    socket = io(SERVER_URL); // Connect to the server
    setupSocketEvents();
  }

  // Add a small delay to ensure socket is connected
  setTimeout(() => {
    console.log('Emitting create-room event');
    socket.emit('create-room', (response) => {
      console.log('Create room response:', response);
      if (!response || !response.success) {
        const errorMessage = response ? response.message : 'No response from server';
        displayError(errorMessage || 'Failed to create room.');
        console.error('Create room failed:', errorMessage);
      } else {
        currentRoomId = response.roomId;
        updateRoomCodeDisplay(response.roomId);
        showScreen('chat-room');
        console.log(`Room created: ${response.roomId}`);
        displayError(`Room created successfully! Code: ${response.roomId}`, roomError);
        
        // Automatically join the room after creation
        console.log('Automatically joining created room');
        socket.emit('join-room', { roomId: response.roomId }, (joinResponse) => {
          console.log('Auto-join response:', joinResponse);
          if (!joinResponse || !joinResponse.success) {
            const joinErrorMessage = joinResponse ? joinResponse.message : 'No response from server';
            displayError(joinErrorMessage || 'Failed to join created room.');
            showScreen('room-entry');
            currentRoomId = null;
            console.error('Auto-join failed:', joinErrorMessage);
          } else {
            currentUsername = joinResponse.username;
            chatMessages.innerHTML = ''; // Clear previous messages
            joinResponse.messages.forEach(msg => addMessageToChat(msg, msg.username === currentUsername));
            updateActiveUsers(joinResponse.activeUsers);
            console.log(`Joined created room ${currentRoomId} as ${joinResponse.username}`);
          }
        });
      }
    });
  }, 100);
});

joinRoomBtn.addEventListener('click', () => {
  const roomId = roomCodeInput.value.trim().toUpperCase();
  if (!roomId) {
    return displayError('Please enter a room code.');
  }

  console.log(`Attempting to join room: ${roomId}`);

  if (!socket) {
    console.log('Creating new socket connection for join room');
    socket = io(SERVER_URL); // Connect to the server
    setupSocketEvents();
  }

  // Add a small delay to ensure socket is connected
  setTimeout(() => {
    console.log(`Emitting join-room event for room: ${roomId}`);
    socket.emit('join-room', { roomId }, (response) => {
      console.log('Join room response:', response);
      if (!response || !response.success) {
        const errorMessage = response ? response.message : 'No response from server';
        displayError(errorMessage || 'Failed to join room. Invalid code or room does not exist.');
        console.error('Join room failed:', errorMessage);
      } else {
        currentRoomId = roomId;
        currentUsername = response.username;
        updateRoomCodeDisplay(roomId);
        showScreen('chat-room');
        chatMessages.innerHTML = ''; // Clear previous messages
        response.messages.forEach(msg => addMessageToChat(msg, msg.username === currentUsername));
        updateActiveUsers(response.activeUsers);
        console.log(`Successfully joined room ${currentRoomId} as ${response.username}`);
        displayError(`Successfully joined room ${roomId}!`, roomError);
      }
    });
  }, 100);
});

sendMessageBtn.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message && currentRoomId && socket) {
    socket.emit('send-message', { roomId: currentRoomId, message });
    messageInput.value = '';
    // Immediately send typing status off
    if (isTyping) {
      socket.emit('typing', { roomId: currentRoomId, isTyping: false });
      isTyping = false;
      clearTimeout(typingTimeout);
    }
  }
});

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); // Prevent new line
    sendMessageBtn.click();
  }
});

messageInput.addEventListener('input', () => {
  if (!socket || !currentRoomId) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { roomId: currentRoomId, isTyping: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('typing', { roomId: currentRoomId, isTyping: false });
  }, 1500); // Stop typing after 1.5 seconds of inactivity
});

leaveRoomBtn.addEventListener('click', () => {
  if (socket && currentRoomId) {
    socket.disconnect(); // Disconnect from the server, which will trigger server-side cleanup
    // Re-initialize socket for next connection
    socket = null;
    showScreen('room-entry');
    currentRoomId = null;
    currentUsername = null;
    chatMessages.innerHTML = '';
    updateActiveUsers([]);
    updateTypingIndicators([]);
    displayError('You have left the room.');
  }
});

// --- Admin Panel Event Listeners ---
adminPanelBtn.addEventListener('click', () => {
  if (!socket) {
    socket = io(SERVER_URL); // Connect to the server for admin actions
    setupSocketEvents();
  }
  showScreen('admin-panel');
  // Reset admin panel state
  adminSecretInput.value = '';
  adminError.textContent = '';
  if (isAdminAuthenticated) {
    adminLoginSection.classList.remove('active');
    adminRoomsSection.classList.add('active');
    socket.emit('list-rooms', ({ success, rooms: currentRooms, message }) => {
      if (success) {
        updateAdminRoomList(currentRooms);
      } else {
        displayError(message || 'Failed to load rooms.', adminError);
      }
    });
  } else {
    adminLoginSection.classList.add('active');
    adminRoomsSection.classList.remove('active');
  }
});

adminLoginBtn.addEventListener('click', () => {
  const secret = adminSecretInput.value.trim();
  if (!secret) {
    return displayError('Please enter the admin secret.', adminError);
  }
  if (!socket) {
    socket = io(SERVER_URL);
    setupSocketEvents();
  }
  socket.emit('admin-login', { secret }, ({ success, message }) => {
    if (!success) {
      displayError(message || 'Admin login failed.', adminError);
      isAdminAuthenticated = false;
    } else {
      // 'admin-authenticated' event will handle UI update
    }
  });
});

refreshRoomsBtn.addEventListener('click', () => {
  if (socket && isAdminAuthenticated) {
    socket.emit('list-rooms', ({ success, rooms: currentRooms, message }) => {
      if (success) {
        updateAdminRoomList(currentRooms);
        displayError('Room list refreshed.', adminError);
      } else {
        displayError(message || 'Failed to refresh room list.', adminError);
      }
    });
  } else {
    displayError('Not authenticated as admin.', adminError);
  }
});

backToMainBtn.addEventListener('click', () => {
  showScreen('room-entry');
  // If admin was logged in, keep the socket connected for potential re-entry
  // Otherwise, disconnect if it was only for admin panel
  if (!isAdminAuthenticated && socket) {
    socket.disconnect();
    socket = null;
  }
});


// Initial screen setup
document.addEventListener('DOMContentLoaded', () => {
  showScreen('room-entry');
});
