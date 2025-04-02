const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Default route serves the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'buddhaboxing.html'));
});

// Store session data
const sessions = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Handle joining a session
  socket.on('joinSession', (sessionId) => {
    console.log(`Client joined session: ${sessionId}`);
    
    // Join the room for this session
    socket.join(sessionId);
    
    // Create the session if it doesn't exist
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        boxes: []
      };
    }
    
    // Send initial state to the client
    socket.emit('initialState', sessions[sessionId]);
  });
  
  // Handle box updates (position, effect, volume, etc.)
  socket.on('updateBox', (data) => {
    const { sessionId, boxId, newX, newY, effect, mixValue, volume, insideTable } = data;
    
    // Store the updated box state
    if (!sessions[sessionId]) {
      sessions[sessionId] = { boxes: [] };
    }
    
    if (!sessions[sessionId].boxes[boxId]) {
      sessions[sessionId].boxes[boxId] = {};
    }
    
    const box = sessions[sessionId].boxes[boxId];
    
    // Update position if provided
    if (newX !== undefined && newY !== undefined) {
      box.x = newX;
      box.y = newY;
    }
    
    // Update effect if provided
    if (effect !== undefined) {
      box.effect = effect;
    }
    
    // Update mix value if provided
    if (mixValue !== undefined) {
      box.mixValue = mixValue;
    }
    
    // Update volume if provided
    if (volume !== undefined) {
      box.volume = volume;
    }
    
    // Update inside table state if provided
    if (insideTable !== undefined) {
      box.insideTable = insideTable;
    }
    
    // Broadcast the update to all other clients in the session
    socket.to(sessionId).emit('boxUpdated', {
      boxId,
      newX,
      newY,
      effect,
      mixValue,
      volume,
      insideTable
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // You could add cleanup code here if needed
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Buddha Boxing server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
