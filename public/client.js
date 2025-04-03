import AudioContextManager from './audioContextManager.js';
import { Box } from './Box.js';
import { nativeEffects } from './nativeEffects.js';

// Create audio manager instance
const audioManager = new AudioContextManager();

// Function to load audio files
async function loadAudioFiles() {
  try {
    console.log('Starting audio file loading...');
    
    console.log('Initializing audio load status...');
    window.audioLoadStatus = {};
    window.audioBuffers = {};
    window.tempAudioElements = {};
    
    // Ensure audio context is initialized
    console.log('Checking audio context before loading files...');
    await audioManager.initialize();
    console.log('Audio context state before loading:', audioManager.getState());
    
    // Load each audio file
    console.log('Starting to load individual audio files...');
    const loadPromises = audioFiles.map(async (url, index) => {
      try {
        console.log(`Loading audio file ${index + 1}: ${url}`);
        const response = await fetch(`/loops/${url}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Create a temporary audio element for immediate playback
        console.log(`Creating temporary audio element for file ${index + 1}`);
        const tempAudio = new Audio();
        tempAudio.src = URL.createObjectURL(new Blob([arrayBuffer]));
        
        window.tempAudioElements[index] = tempAudio;
        window.audioLoadStatus[index] = 'basic-ready';
        
        // Decode the array buffer into an AudioBuffer
        console.log(`Decoding audio buffer for file ${index + 1}`);
        const audioBuffer = await audioManager.decodeAudioData(arrayBuffer);
        window.audioBuffers[index] = audioBuffer;
        console.log(`Successfully loaded and decoded file ${index + 1}`);
        
        return { index, success: true };
      } catch (error) {
        console.error(`Error loading audio file ${url}:`, error);
        window.audioLoadStatus[index] = 'error';
        return { index, success: false, error };
      }
    });
    
    console.log('Waiting for all audio files to load...');
    const results = await Promise.all(loadPromises);
    const failedLoads = results.filter(r => !r.success);
    
    if (failedLoads.length > 0) {
      console.warn('Some audio files failed to load:', failedLoads);
    }
    
    console.log('Audio file loading complete');
    return results;
  } catch (error) {
    console.error('Error loading audio files:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

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
let audioFiles = [];
const UPDATE_INTERVAL = 1000 / 30; // 30 FPS for smooth updates

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
// First ensure audio context is initialized
// createBoxes();  // Remove this line
createSessionDisplay();
boxesCreated = true;

// Then start loading audio files
setTimeout(async () => {
  await loadAudioFiles();
  if (!boxesCreated) {  // Only create boxes if they haven't been created yet
    createBoxes();
  }
}, 100);

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
  });
  
  // Apply any positions received from server
  if (boxPositionsFromServer) {
    boxPositionsFromServer.forEach((pos, index) => {
      if (boxes[index]) {
        boxes[index].element.style.left = pos.x + 'px';
        boxes[index].element.style.top = pos.y + 'px';
        
        // Check if inside table and play/stop audio
        boxes[index].checkBoxPosition();
      }
    });
  }
  
  // Log how many boxes were created
  console.log(`Created ${boxes.length} boxes`);
  
  // Add a small delay and recheck visibility of all boxes
  setTimeout(() => {
    boxes.forEach((box, index) => {
      if (box && !box.element.isConnected) {
        console.error(`Box ${index+1} is not connected to DOM, recreating`);
        document.body.appendChild(box.element);
      }
    });
  }, 500);
}

// Function to send box updates to server
function sendBoxUpdate(update) {
  if (!syncEnabled) return;
  
  // Get current position
  const box = update.box || this;
  const rect = box.element.getBoundingClientRect();
  
  // Create update object
  const boxUpdate = {
    boxId: boxes.indexOf(box),
    newX: rect.left,
    newY: rect.top,
    ...update
  };
  
  // Send to server
  socket.emit('boxUpdated', boxUpdate);
}

// Load audio files and create boxes
async function initializeApp() {
  try {
    console.log('Starting app initialization...');
    
    // Initialize audio files first (without waiting for audio context)
    console.log('Initializing audio files...');
    audioFiles = [
      '01.m4a', '02.m4a', '03.m4a', '04.m4a', '05.m4a',
      '06.m4a', '07.m4a', '08.m4a', '09.m4a'
    ];
    console.log('Audio files initialized');
    
    // Create boxes immediately
    console.log('Creating boxes...');
    createBoxes();
    console.log('Boxes created, checking visibility...');
    
    // Apply Safari-specific rendering fix immediately
    if (navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') === -1) {
      console.log('Safari detected, applying special box rendering fix');
      const boxes = document.querySelectorAll('.box');
      console.log(`Found ${boxes.length} boxes to fix`);
      
      for (const [index, box] of boxes.entries()) {
        console.log(`Fixing box ${index + 1}`);
        // Force repaint
        box.style.display = 'none';
        box.style.display = 'flex';
        console.log(`Box ${index + 1} fixed`);
      }
    }
    
    // Initialize audio context and load buffers in the background
    console.log('Starting audio initialization...');
    try {
      await initializeAudio();
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
    
    console.log('App initialization complete');
  } catch (error) {
    console.error('Error initializing app:', error);
    console.error('Error stack:', error.stack);
  }
}

async function initializeAudio() {
  try {
    // Initialize audio context
    console.log('Initializing audio context...');
    await audioManager.initialize();
    console.log('Audio context initialized, state:', audioManager.getState());
    
    // Load audio files and buffers
    console.log('Loading audio files...');
    await loadAudioFiles();
    console.log('Audio files loaded successfully');
    
    // Update all boxes to use the new audio context
    for (const box of boxes) {
      if (box.updateAudioContext) {
        await box.updateAudioContext();
      }
    }
  } catch (error) {
    console.warn('Error initializing audio:', error);
    throw error;
  }
}

// Start the app
initializeApp();
