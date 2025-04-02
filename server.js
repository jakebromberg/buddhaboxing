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

// Track sessions and their states
const sessions = {};

// Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  let currentSession = null;
  
  // Join a session
  socket.on('joinSession', (sessionId) => {
    console.log(`Client ${socket.id} joining session: ${sessionId}`);
    
    // Leave any current session
    if (currentSession) {
      socket.leave(currentSession);
    }
    
    // Join the new session
    socket.join(sessionId);
    currentSession = sessionId;
    
    // Initialize the session if it doesn't exist
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        boxes: []
      };
    }
    
    // Send initial state to the client
    socket.emit('initialState', sessions[sessionId]);
  });
  
  // Handle box updates
  socket.on('updateBox', (data) => {
    const { sessionId, boxId, newX, newY, effect, mixValue, volume } = data;
    
    // Ignore if no session ID
    if (!sessionId) return;
    
    // Initialize session if it doesn't exist
    if (!sessions[sessionId]) {
      sessions[sessionId] = { boxes: [] };
    }
    
    // Initialize boxes array with enough capacity
    while (sessions[sessionId].boxes.length <= boxId) {
      sessions[sessionId].boxes.push({});
    }
    
    // Update the box state
    const box = sessions[sessionId].boxes[boxId] || {};
    if (newX !== undefined) box.x = newX;
    if (newY !== undefined) box.y = newY;
    if (effect !== undefined) box.effect = effect;
    if (mixValue !== undefined) box.mixValue = mixValue;
    if (volume !== undefined) box.volume = volume;
    
    // Store the updated box
    sessions[sessionId].boxes[boxId] = box;
    
    // Broadcast to other clients in the same session
    socket.to(sessionId).emit('boxUpdated', data);
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Development mode hot reload endpoint
if (process.env.NODE_ENV === 'development') {
  app.post('/reload', (req, res) => {
    io.emit('reload');
    res.send('Reloading...');
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
