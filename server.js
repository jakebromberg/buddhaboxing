const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Add audio files endpoint
app.get(['/loops', '/loops/'], (req, res) => {
  const fs = require('fs');
  const loopsDir = path.join(__dirname, 'public', 'loops');
  
  fs.readdir(loopsDir, (err, files) => {
    if (err) {
      console.error('Error reading loops directory:', err);
      return res.status(500).json({ error: 'Failed to read audio files' });
    }
    
    // Filter for audio files (you might want to adjust this based on your file types)
    const audioFiles = files.filter(file => 
      file.endsWith('.mp3') || 
      file.endsWith('.wav') || 
      file.endsWith('.ogg') ||
      file.endsWith('.m4a')  // Add m4a support
    );
    
    res.json(audioFiles);
  });
});

// Track sessions and their states
const sessions = {};
const sessionLastActivity = {}; // Track last activity time for each session
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach(sessionId => {
    const lastActivity = sessionLastActivity[sessionId] || 0;
    if (now - lastActivity > SESSION_TIMEOUT) {
      console.log(`Cleaning up inactive session: ${sessionId}`);
      delete sessions[sessionId];
      delete sessionLastActivity[sessionId];
      // Notify all clients in the session that it's being closed
      io.to(sessionId).emit('sessionTimeout');
    }
  });
}, 60000); // Check every minute

// Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected:', {
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  let currentSession = null;
  
  // Handle session pings
  socket.on('ping', ({ sessionId }) => {
    if (sessions[sessionId]) {
      sessionLastActivity[sessionId] = Date.now();
      console.log(`Session ${sessionId} pinged at ${new Date().toISOString()}`);
    }
  });

  // Join a session
  socket.on('joinSession', ({ sessionId }, callback) => {
    // Update last activity time when someone joins
    sessionLastActivity[sessionId] = Date.now();
    
    console.log('Client joining session:', {
      socketId: socket.id,
      sessionId,
      previousSession: currentSession,
      timestamp: new Date().toISOString()
    });

    // Leave previous session if any
    if (currentSession) {
      socket.leave(currentSession);
      console.log('Left previous session:', {
        socketId: socket.id,
        previousSession: currentSession,
        timestamp: new Date().toISOString()
      });
    }

    // Join new session
    socket.join(sessionId);
    currentSession = sessionId;

    // Get room info
    const room = io.sockets.adapter.rooms.get(sessionId);
    console.log('Joined session:', {
      socketId: socket.id,
      sessionId,
      roomSize: room ? room.size : 0,
      roomMembers: room ? Array.from(room) : [],
      timestamp: new Date().toISOString()
    });

    // Initialize session if needed
    if (!sessions[sessionId]) {
      sessions[sessionId] = { boxes: [] };
    }

    // Notify other clients in the session
    socket.to(sessionId).emit('userJoinedSession', {
      socketId: socket.id,
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Send initial state
    socket.emit('initialState', {
      boxes: sessions[sessionId].boxes,
      sessionId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Send acknowledgment
    if (callback) {
      callback({ success: true, sessionId });
    }
  });
  
  // Handle box updates
  socket.on('updateBox', (data, callback) => {
    console.log('Received box update:', {
      from: socket.id,
      sessionId: data.sessionId,
      boxId: data.boxId,
      currentSession,
      update: { 
        newX: data.newX, 
        newY: data.newY, 
        effect: data.effect, 
        mixValue: data.mixValue, 
        volume: data.volume,
        isExpanded: data.isExpanded 
      },
      timestamp: new Date().toISOString()
    });
    
    const { sessionId, boxId, newX, newY, effect, mixValue, volume, isExpanded } = data;
    
    // Ignore if no session ID
    if (!sessionId) {
      console.log('Ignoring update - no session ID provided');
      return;
    }
    
    // Verify socket is in the correct room
    const room = io.sockets.adapter.rooms.get(sessionId);
    if (!room || !room.has(socket.id)) {
      console.log(`Socket ${socket.id} not in session ${sessionId}, rejoining...`);
      socket.join(sessionId);
      currentSession = sessionId;
    }
    
    // Initialize session if it doesn't exist
    if (!sessions[sessionId]) {
      console.log(`Creating new session: ${sessionId}`);
      sessions[sessionId] = { boxes: [] };
    }
    
    // Initialize boxes array with enough capacity
    while (sessions[sessionId].boxes.length <= boxId) {
      sessions[sessionId].boxes.push({});
    }
    
    // Update the box state using the same property names as the client
    const box = sessions[sessionId].boxes[boxId] || {};
    box.newX = newX;
    box.newY = newY;
    box.effect = effect;
    box.mixValue = mixValue;
    box.volume = volume;
    box.isExpanded = isExpanded;
    
    // Store the updated box
    sessions[sessionId].boxes[boxId] = box;
    
    // Get current room members
    const roomMembers = room ? Array.from(room) : [];
    
    // Log the update being broadcast
    console.log('Broadcasting box update:', {
      from: socket.id,
      to: roomMembers.filter(id => id !== socket.id), // Only other clients
      sessionId,
      boxId,
      roomMembers,
      roomSize: room ? room.size : 0,
      update: { newX, newY, effect, mixValue, volume, isExpanded },
      timestamp: new Date().toISOString()
    });
    
    // Log room state
    console.log('Room state before broadcast:', {
      sessionId,
      allRooms: Array.from(io.sockets.adapter.rooms.keys()),
      roomMembers,
      socketRooms: Array.from(socket.rooms),
      timestamp: new Date().toISOString()
    });
    
    // Broadcast to other clients in the same session
    socket.to(sessionId).emit('boxUpdated', {
      sessionId,
      socketId: socket.id,
      boxId,
      newX,
      newY,
      effect,
      mixValue,
      volume,
      isExpanded,
      timestamp: new Date().toISOString()
    }, (error) => {
      if (error) {
        console.error('Error broadcasting boxUpdated event:', error);
      } else {
        console.log('boxUpdated event acknowledged by recipients', {
          isExpandedSent: isExpanded !== undefined,
          isExpandedValue: isExpanded,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Verify broadcast
    console.log('Broadcast complete:', {
      sessionId,
      event: 'boxUpdated',
      recipientCount: roomMembers.length - 1,
      timestamp: new Date().toISOString()
    });

    // Send acknowledgment
    if (callback) {
      callback(null);
    }
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected:', {
      socketId: socket.id,
      sessionId: currentSession,
      timestamp: new Date().toISOString()
    });
    
    if (currentSession) {
      const room = io.sockets.adapter.rooms.get(currentSession);
      console.log(`Remaining members in session ${currentSession}:`, {
        count: room ? room.size : 0,
        members: room ? Array.from(room) : []
      });
    }
  });
});

// Development mode hot reload endpoint
if (process.env.NODE_ENV === 'development') {
  app.post('/reload', (req, res) => {
    io.emit('reload');
    res.send('Reloading...');
  });
}

// List active sessions endpoint
app.get('/list-sessions', async (req, res) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Read the template file
    const templatePath = path.join(__dirname, 'public', 'sessionsList.html');
    let html = await fs.readFile(templatePath, 'utf8');
    
    // Generate the sessions list HTML
    const activeSessionIds = Object.keys(sessions);
    const sessionsHtml = activeSessionIds.length > 0 
      ? `<ul class="session-list">
          ${activeSessionIds.map(sessionId => `
            <li class="session-item">
              <a class="session-link" href="/?session=${sessionId}">Session: ${sessionId}</a>
              (${sessions[sessionId].boxes.length} boxes)
            </li>
          `).join('')}
        </ul>`
      : '<p class="no-sessions">No active sessions</p>';
    
    // Insert the sessions list into the template
    html = html.replace('<!-- Content will be dynamically inserted here -->', sessionsHtml);
    
    res.send(html);
  } catch (error) {
    console.error('Error serving sessions list:', error);
    res.status(500).send('Error loading sessions list');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from other devices using: http://<your-ip-address>:${PORT}`);
});
