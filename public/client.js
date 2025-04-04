import AudioContextManager from './audioContextManager.js';
import { Box } from './Box.js';
import { nativeEffects } from './nativeEffects.js';

// Create audio manager instance
const audioManager = new AudioContextManager();

// Initialize audio files
const audioFiles = [
  '01.m4a', '02.m4a', '03.m4a', '04.m4a', '05.m4a',
  '06.m4a', '07.m4a', '08.m4a', '09.m4a'
];

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

// Join the specified session/room on the server
socket.emit('joinSession', sessionId);

// Handle initial state from server
socket.on('initialState', (data) => {
  console.log('Got initial state from server:', data);
  
  // If we receive box positions, apply them after boxes are created
  if (data.boxes) {
    boxPositionsFromServer = data.boxes;
  }
});

// Tracking variables for multi-user functionality
let boxPositionsFromServer = null;
let boxes = [];
let syncEnabled = true;
let boxesCreated = false;

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
function createSessionDisplay() {
  const body = document.body;
  const sessionDisplay = document.createElement('div');
  sessionDisplay.style.position = 'fixed';
  sessionDisplay.style.top = '10px';
  sessionDisplay.style.right = '10px';
  sessionDisplay.style.padding = '10px';
  sessionDisplay.style.background = 'rgba(0,0,0,0.7)';
  sessionDisplay.style.color = 'white';
  sessionDisplay.style.borderRadius = '5px';
  sessionDisplay.style.fontFamily = 'Arial, sans-serif';
  sessionDisplay.style.fontSize = '12px';
  sessionDisplay.style.zIndex = '1000';
  
  // Create a full URL with session ID as query parameter
  const fullUrl = new URL(window.location.href);
  fullUrl.searchParams.set('session', sessionId);
  const shareUrl = fullUrl.toString();
  
  // Session URL (includes session ID)
  const sessionUrl = document.createElement('div');
  sessionUrl.textContent = `Share URL:`;
  sessionUrl.style.marginBottom = '5px';
  sessionUrl.style.fontWeight = 'bold';
  sessionDisplay.appendChild(sessionUrl);
  
  // URL display element with overflow handling
  const urlDisplay = document.createElement('div');
  urlDisplay.textContent = shareUrl;
  urlDisplay.style.overflow = 'hidden';
  urlDisplay.style.textOverflow = 'ellipsis';
  urlDisplay.style.whiteSpace = 'nowrap';
  urlDisplay.style.maxWidth = '250px';
  urlDisplay.style.padding = '5px';
  urlDisplay.style.background = 'rgba(0,0,0,0.5)';
  urlDisplay.style.borderRadius = '3px';
  urlDisplay.style.cursor = 'pointer';
  urlDisplay.title = 'Click to copy';
  
  // Click to copy functionality
  urlDisplay.onclick = () => {
    navigator.clipboard.writeText(shareUrl);
    urlDisplay.textContent = 'URL copied!';
    setTimeout(() => {
      urlDisplay.textContent = shareUrl;
    }, 2000);
  };
  sessionDisplay.appendChild(urlDisplay);
  
  // Sync toggle
  const syncToggle = document.createElement('input');
  syncToggle.type = 'checkbox';
  syncToggle.checked = syncEnabled;
  syncToggle.style.marginRight = '5px';
  syncToggle.id = 'sync-toggle';
  
  const syncLabel = document.createElement('label');
  syncLabel.textContent = 'Enable sync';
  syncLabel.htmlFor = 'sync-toggle';
  syncLabel.style.cursor = 'pointer';
  
  const syncContainer = document.createElement('div');
  syncContainer.style.marginTop = '10px';
  syncContainer.appendChild(syncToggle);
  syncContainer.appendChild(syncLabel);
  sessionDisplay.appendChild(syncContainer);
  
  // Event handler for sync toggle
  syncToggle.addEventListener('change', (e) => {
    syncEnabled = e.target.checked;
  });
  
  body.appendChild(sessionDisplay);
}

// Receive box updates from other clients
socket.on('boxUpdated', ({ boxId, newX, newY, effect, mixValue, volume }) => {
  if (!syncEnabled || !boxes[boxId]) return;
  
  const box = boxes[boxId];
  
  // Temporarily disable syncing to avoid loops
  const oldSync = syncEnabled;
  syncEnabled = false;
  
  // Update box using the new method
  box.updateFromServer({ newX, newY, effect, mixValue, volume });
  
  // Re-enable syncing
  syncEnabled = oldSync;
});

function createBoxes() {
  console.log('Creating boxes...');
  const table = document.getElementById('table');
  
  // Safety check - if table doesn't exist, log error but continue creating boxes
  if (!table) {
    console.error('Table element not found - boxes will still be created but may not be properly positioned');
  }
  
  // Create a box for each audio file
  audioFiles.forEach((file, index) => {
    const box = new Box(index, audioManager, isSafari, audioFiles);
    boxes[index] = box;
    
    // Apply any saved positions from server
    if (boxPositionsFromServer && boxPositionsFromServer[index]) {
      box.updateFromServer(boxPositionsFromServer[index]);
    }
  });
}

function sendBoxUpdate(update) {
  if (!syncEnabled) return;
  
  socket.emit('boxUpdated', {
    sessionId,
    ...update
  });
}

async function initializeApp() {
  try {
    // Initialize audio context
    await audioManager.initialize();
    
    // Create boxes
    createBoxes();
    boxesCreated = true;
    
    // Start update loop
    setInterval(() => {
      if (!syncEnabled) return;
      
      boxes.forEach((box, index) => {
        if (!box) return;
        
        const boxElement = box.element;
        const rect = boxElement.getBoundingClientRect();
        
        sendBoxUpdate({
          boxId: index,
          newX: rect.left,
          newY: rect.top,
          effect: box.effectSelect.value,
          mixValue: box.mixSlider.value / 100,
          volume: box.volumeSlider.value / 100
        });
      });
    }, UPDATE_INTERVAL);
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Initialize the app
initializeApp();
