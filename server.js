const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create a write stream for logging
const logStream = fs.createWriteStream(
  path.join(logDir, `server-${new Date().toISOString().replace(/[:.]/g, '-')}.log`),
  { flags: 'a' }
);

// Custom logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  logStream.write(logMessage);
}

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
  log(`New client connected: ${socket.id}`);
  
  let currentSession = null;
  
  // Handle session pings
  socket.on('ping', ({ sessionId }) => {
    if (sessions[sessionId]) {
      sessionLastActivity[sessionId] = Date.now();
      log(`Session ${sessionId} pinged`);
    }
  });

  // Join a session
  socket.on('joinSession', ({ sessionId }, callback) => {
    // Update last activity time when someone joins
    sessionLastActivity[sessionId] = Date.now();
    
    log(`Client joining session: ${socket.id}, ${sessionId}, previous: ${currentSession}`);

    // Leave previous session if any
    if (currentSession) {
      socket.leave(currentSession);
      log(`Left previous session: ${socket.id}, ${currentSession}`);
    }

    // Join new session
    socket.join(sessionId);
    currentSession = sessionId;

    // Get room info
    const room = io.sockets.adapter.rooms.get(sessionId);
    log(`Joined session: ${socket.id}, ${sessionId}, size: ${room ? room.size : 0}, members: ${room ? Array.from(room) : []}`);

    // Initialize session if needed
    if (!sessions[sessionId]) {
      sessions[sessionId] = { boxes: {} };
    }

    // Notify other clients in the session
    socket.to(sessionId).emit('userJoinedSession', {
      socketId: socket.id,
      sessionId,
      timestamp: new Date().toISOString()
    });

    // Function to send initial state
    const sendInitialState = () => {
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
    };

    // If there are other clients in the session, request current state from one of them
    if (room && room.size > 1) {
      const otherClients = Array.from(room).filter(id => id !== socket.id);
      if (otherClients.length > 0) {
        const randomClient = otherClients[Math.floor(Math.random() * otherClients.length)];
        io.to(randomClient).emit('requestState', { sessionId }, (state) => {
          if (state && state.boxes) {
            sessions[sessionId].boxes = state.boxes;
            log(`Received state from existing client: ${randomClient} -> ${socket.id}, ${sessionId}, boxes: ${Object.keys(state.boxes).length}`);
          }
          // Send initial state after receiving response from existing client
          sendInitialState();
        });
        return; // Don't send initial state yet, wait for response
      }
    }

    // If no other clients or request failed, send initial state immediately
    sendInitialState();
  });
  
  // Handle box updates
  socket.on('updateBox', (data, callback) => {
    const { sessionId, boxId, newX, newY, effect, mixValue, volume, isExpanded } = data;
    
    // Update the box state in the session
    sessions[sessionId].boxes[boxId] = {
        newX,
        newY,
        effect,
        mixValue,
        volume,
        isExpanded: isExpanded || false  // Ensure isExpanded is always defined
    };

    // Broadcast the update to other clients in the session
    socket.to(sessionId).emit('boxUpdated', {
        boxId,
        newX,
        newY,
        effect,
        mixValue,
        volume,
        isExpanded: isExpanded || false  // Ensure isExpanded is always defined
    });

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
              (${Object.keys(sessions[sessionId].boxes).length} boxes)
            </li>
          `).join('')}
        </ul>`
      : '<p class="no-sessions">No active sessions</p>';
    
    // Insert the sessions list into the template
    html = html.replace('<!-- Content will be dynamically inserted here -->', sessionsHtml);
    
    res.send(html);
  } catch (error) {
    log(`Error serving sessions list: ${error}`);
    res.status(500).send('Error loading sessions list');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from other devices using: http://<your-ip-address>:${PORT}`);
});
