import AudioEngine from './AudioEngine.js';
import { Box } from './Box.js';
import { nativeEffects } from './nativeEffects.js';
import AudioPlayer from './AudioPlayer.js';

// Create audio manager instance
const audioManager = new AudioEngine();

// Initialize audio files
const audioFiles = {
  "Ma": 1,
  "Zheng": 2,
  "Sheng": 3,
  "B1": 4,
  "Yang": 5,
  "Xiao": 6,
  "Zhong": 7,
  "B2": 8,
  "Wu": 9
};

// Update interval for syncing box positions
const UPDATE_INTERVAL = 100; // milliseconds

// 1. Session & Socket Setup
// Get session ID from URL params or generate random one
let sessionId;
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('session')) {
  sessionId = urlParams.get('session');
  console.log('Using session ID from URL:', sessionId);
} else {
  sessionId = "session-" + Math.floor(Math.random() * 1000000);
  console.log('Generated new session ID:', sessionId);
}

// Safari detection
const isSafari = audioManager.isSafariBrowser();
console.log(`Safari detected: ${isSafari}`);

// Connect to Socket.IO
const socket = io();

// Socket connection logging
socket.on('connect', () => {
  console.log('Socket connected:', {
    id: socket.id,
    sessionId,
    connected: socket.connected,
    timestamp: new Date().toISOString()
  });

  // Re-join session if we reconnect
  socket.emit('joinSession', { sessionId }, (response) => {
    console.log('Join session response:', {
      response,
      sessionId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
  });
});

// Start session ping interval
const PING_INTERVAL = 5 * 60 * 1000; // Ping every 5 minutes (half the timeout period)
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping', { sessionId });
  }
}, PING_INTERVAL);

// Handle session timeout
socket.on('sessionTimeout', () => {
  console.log('Session timed out due to inactivity');
  alert('This session has been closed due to inactivity. Please refresh the page to start a new session.');
  // Optionally, redirect to a new session
  window.location.href = window.location.pathname;
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', {
    id: socket.id,
    sessionId,
    reason,
    timestamp: new Date().toISOString()
  });
});

// Join the specified session/room on the server
socket.emit('joinSession', { sessionId });

socket.on('joinedSession', (data) => {
  console.log('Successfully joined session:', {
    sessionId,
    socketId: socket.id,
    data,
    timestamp: new Date().toISOString()
  });
});

socket.on('userJoinedSession', (data) => {
  console.log('Another user joined the session:', {
    ...data,
    mySessionId: sessionId,
    mySocketId: socket.id,
    timestamp: new Date().toISOString()
  });
});

socket.on('error', (error) => {
  console.error('Socket error:', {
    error,
    sessionId,
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
});

// Handle initial state from server
socket.on('initialState', (data) => {
  console.log('Got initial state from server:', {
    ...data,
    sessionId,
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // If we receive box positions, store them
  if (data.boxes) {
    boxPositionsFromServer = data.boxes;
    
    // If boxes haven't been created yet, create them now
    if (!boxesCreated) {
      initializeApp();
    } else {
      // If boxes were already created, update their positions
      boxes.forEach((box, index) => {
        if (boxPositionsFromServer[index]) {
          box.updateFromServer(boxPositionsFromServer[index]);
        }
      });
    }
  }
});

// Handle state request from server
socket.on('requestState', ({ sessionId }, callback) => {
  console.log('Received state request:', {
    sessionId,
    socketId: socket.id,
    boxCount: Object.keys(boxes).length,
    timestamp: new Date().toISOString()
  });

  // Collect current box states
  const currentState = {
    boxes: Object.entries(boxes).reduce((acc, [fileName, box]) => {
      acc[fileName] = {
        newX: box.element.style.left,
        newY: box.element.style.top,
        effect: box.effect,
        mixValue: box.mixValue,
        volume: box.volume,
        isExpanded: box.isExpanded || false  // Ensure isExpanded is always defined
      };
      return acc;
    }, {})
  };

  // Send state back to server
  if (callback) {
    callback(currentState);
  }
});

// Tracking variables for multi-user functionality
let boxPositionsFromServer = null;
let boxes = [];
let syncEnabled = true;
let boxesCreated = false;
let isProcessingRemoteUpdate = false; // Flag to prevent update loops
let lastUpdateTime = 0; // Track last update time
const UPDATE_THROTTLE = 50; // Minimum time between updates in milliseconds

// Debug: Log all available Native Web Audio effects
console.log("Available Native Effects:", Object.keys(nativeEffects));

// Current active box for debugging
let activeBoxForDebug = null;

// Box colors (9 distinct colors)
const boxColors = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#FFD166', // yellow
  '#6B5B95', // purple
  '#88D8B0', // green
  '#FF8C94', // pink
  '#5D98D2', // blue
  '#E6AA68', // orange
  '#A5AAA3'  // gray
];

// Create boxes immediately
createSessionDisplay();

// Create session display
async function createSessionDisplay() {
  try {
    // Fetch and parse the template
    const response = await fetch('/sessionDisplay.html');
    const templateText = await response.text();
    
    // Create a temporary container and insert the template
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = templateText;
    
    // Extract the template content
    const sessionDisplay = tempContainer.querySelector('#session-display');
    const urlDisplay = sessionDisplay.querySelector('#url-display');
    const syncToggle = sessionDisplay.querySelector('#sync-toggle');
    
    // Create a full URL with session ID as query parameter
    const fullUrl = new URL(window.location.href);
    fullUrl.searchParams.set('session', sessionId);
    const shareUrl = fullUrl.toString();
    
    // Set the URL display text
    urlDisplay.textContent = shareUrl;
    
    // Set initial sync state
    syncToggle.checked = syncEnabled;
    
    // Click to copy functionality
    urlDisplay.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          urlDisplay.textContent = 'URL copied!';
        } else {
          // Fallback for browsers that don't support clipboard API
          const textArea = document.createElement('textarea');
          textArea.value = shareUrl;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            urlDisplay.textContent = 'URL copied!';
          } catch (err) {
            urlDisplay.textContent = 'Press Ctrl+C to copy';
            console.error('Fallback copy failed:', err);
          }
          document.body.removeChild(textArea);
        }
        setTimeout(() => {
          urlDisplay.textContent = shareUrl;
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
        urlDisplay.textContent = 'Press Ctrl+C to copy';
        setTimeout(() => {
          urlDisplay.textContent = shareUrl;
        }, 2000);
      }
    };
    
    // Event handler for sync toggle
    syncToggle.addEventListener('change', (e) => {
      syncEnabled = e.target.checked;
      console.log('Sync status changed:', {
        enabled: syncEnabled,
        sessionId,
        socketId: socket.id,
        socketConnected: socket.connected,
        timestamp: new Date().toISOString()
      });
    });
    
    // Add the session display to the document
    document.body.appendChild(sessionDisplay);
  } catch (error) {
    console.error('Error creating session display:', error);
  }
}

// Receive box updates from other clients
socket.on('boxUpdated', (data) => {
  console.log('Raw box update received:', {
    data,
    mySessionId: sessionId,
    mySocketId: socket.id,
    syncEnabled,
    socketConnected: socket.connected,
    socketEventRegistered: true,
    timestamp: new Date().toISOString()
  });

  const { boxId, newX, newY, effect, mixValue, volume, isExpanded, sessionId: senderSessionId, socketId: senderSocketId } = data;

  // Skip updates from our own socket
  if (senderSocketId === socket.id) {
    console.log('Skipping update from our own socket:', {
      senderSocketId,
      mySocketId: socket.id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Check if box exists
  if (!boxes[boxId]) {
    console.log('Box not found:', {
      boxId,
      availableBoxes: Object.keys(boxes),
      boxesLength: Object.keys(boxes).length,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Check sync state
  if (!syncEnabled) {
    console.log('Sync is disabled:', {
      syncEnabled,
      boxId,
      senderSessionId,
      senderSocketId,
      mySessionId: sessionId,
      mySocketId: socket.id,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  console.log('Processing box update from another client:', {
    boxId,
    newX,
    newY,
    effect,
    mixValue,
    volume,
    isExpanded,
    senderSessionId,
    senderSocketId,
    mySessionId: sessionId,
    mySocketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  const box = boxes[boxId];
  
  try {
    // Set flag to prevent update loops
    isProcessingRemoteUpdate = true;
    
    // Update box using the new method
    box.updateFromServer({ newX, newY, effect, mixValue, volume, isExpanded });
    console.log('Successfully updated box from server:', {
      boxId,
      newX,
      newY,
      effect,
      mixValue,
      volume,
      isExpanded,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to update box from server:', {
      error,
      boxId,
      newX,
      newY,
      effect,
      mixValue,
      volume,
      isExpanded,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Reset flag after update is complete
    isProcessingRemoteUpdate = false;
  }
});

function createBoxes() {
  try {
    // Create boxes based on the audioFiles dictionary
    Object.entries(audioFiles).forEach(([fileName, order]) => {
      const audioPlayer = new AudioPlayer(audioManager, fileName);
      const box = new Box(fileName, audioPlayer, sendBoxUpdate, order, audioManager);
      // Store box by its fileName instead of numeric index
      boxes[fileName] = box;

      // Apply any saved positions from server if available
      if (boxPositionsFromServer && boxPositionsFromServer[fileName]) {
        const boxState = boxPositionsFromServer[fileName];
        // Ensure we pass all state properties, including isExpanded
        box.updateFromServer({
          newX: boxState.newX,
          newY: boxState.newY,
          effect: boxState.effect,
          mixValue: boxState.mixValue,
          volume: boxState.volume,
          isExpanded: boxState.isExpanded
        });
      }
    });

    boxesCreated = true;
    console.log('Boxes created successfully:', {
      boxCount: Object.keys(boxes).length,
      boxNames: Object.keys(boxes),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating boxes:', error);
    throw error;
  }
}

function sendBoxUpdate(update) {
  if (!syncEnabled || isProcessingRemoteUpdate) {
    console.log('Box update not sent - sync disabled or processing remote update:', {
      syncEnabled,
      isProcessingRemoteUpdate,
      sessionId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (!socket.connected) {
    console.error('Cannot send update - socket not connected:', {
      sessionId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Throttle updates during drag operations
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_THROTTLE) {
    return;
  }
  lastUpdateTime = now;
  
  const updateData = {
    sessionId,
    socketId: socket.id,
    ...update,
    timestamp: new Date().toISOString()
  };
  
  console.log('Sending box update:', {
    updateData,
    sessionId,
    socketId: socket.id,
    socketConnected: socket.connected,
    timestamp: new Date().toISOString()
  });
  
  // Send with acknowledgment
  socket.emit('updateBox', updateData, (error) => {
    if (error) {
      console.error('Failed to send box update:', {
        error,
        updateData,
        sessionId,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('Box update confirmed by server:', {
        updateData,
        sessionId,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    }
  });
}

async function initializeApp() {
  try {
    // Initialize audio context
    await audioManager.initialize();
    
    // Only create boxes if we have positions from server or after a longer timeout
    if (boxPositionsFromServer) {
      createBoxes();
      boxesCreated = true;
    } else {
      // Set a longer timeout to create boxes with default positions if we don't get server data
      setTimeout(() => {
        if (!boxesCreated) {
          console.log('Creating boxes with default positions - no server data received after timeout');
          createBoxes();
          boxesCreated = true;
        }
      }, 5000); // Wait 5 seconds for server data before falling back
    }

    // For Safari, set up a one-time click handler to initialize audio
    if (isSafari) {
      const handleFirstInteraction = async () => {
        console.log('First user interaction detected, initializing audio...');
        try {
          await audioManager.initialize();
          // Recheck box positions after audio is initialized
          boxes.forEach(box => {
            box.checkBoxPosition();
          });
        } catch (error) {
          console.error('Error initializing audio after interaction:', error);
        }
        // Remove the event listeners
        ['click', 'touchstart', 'mousedown', 'keydown'].forEach(event => {
          document.removeEventListener(event, handleFirstInteraction);
        });
      };

      // Add the event listeners
      ['click', 'touchstart', 'mousedown', 'keydown'].forEach(event => {
        document.addEventListener(event, handleFirstInteraction, { once: true });
      });
    }
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Add event registration confirmation
console.log('Socket event handlers registered:', {
  events: ['boxUpdated', 'connect', 'connect_error', 'disconnect', 'joinedSession', 'userJoinedSession', 'error', 'initialState'],
  syncEnabled,
  socketConnected: socket.connected,
  socketId: socket.id,
  sessionId,
  timestamp: new Date().toISOString()
});
