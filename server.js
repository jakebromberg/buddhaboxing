const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve your static files
app.use(express.static('public'));

// Store session data in-memory, or in a real database
// e.g., { sessionId: { boxes: [...], etc. } }
const sessions = {};

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'buddhaboxing.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a session/room
  socket.on('joinSession', (sessionId) => {
    socket.join(sessionId);

    // If session doesn't exist, create it
    if (!sessions[sessionId]) {
      sessions[sessionId] = { boxes: [] };
    }

    // Send existing state to new client
    socket.emit('initialState', sessions[sessionId]);
  });

  // When a box is moved or updated
  socket.on('updateBox', ({ sessionId, boxId, newX, newY }) => {
    // Update the server's copy of the game state
    const session = sessions[sessionId];
    if (!session) return;

    let box = session.boxes.find(b => b.id === boxId);
    if (box) {
      box.x = newX;
      box.y = newY;
    }

    // Broadcast to everyone else in the session
    socket.to(sessionId).emit('boxUpdated', { boxId, newX, newY });
  });

  // Handle other events like volume/pitch changes, etc.
  socket.on('changeVolume', ({ sessionId, boxId, volume }) => {
    // Update state
    const session = sessions[sessionId];
    if (!session) return;

    let box = session.boxes.find(b => b.id === boxId);
    if (box) {
      box.volume = volume;
    }

    // Broadcast
    socket.to(sessionId).emit('volumeChanged', { boxId, volume });
  });

  // Cleanup if a user disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Possibly handle removing them from session, etc.
  });
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
