import AudioContextManager from './audioContextManager.js';
import { Box } from './Box.js';
import { nativeEffects } from './nativeEffects.js';

// Create audio manager instance
const audioManager = new AudioContextManager();

// Function to update box position smoothly
function updateBoxPosition(box, index) {
  // Only update if we're dragging
  if (!box.isDragging) return;
  
  // Get current position
  const currentX = box.offsetLeft;
  const currentY = box.offsetTop;
  
  // Calculate target position
  const targetX = box.initialX;
  const targetY = box.initialY;
  
  // Calculate distance to move
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  
  // If we're close enough to target, stop updating
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
    return;
  }
  
  // Move towards target with easing
  const easing = 0.1; // Adjust this value to control smoothness (0-1)
  const newX = currentX + dx * easing;
  const newY = currentY + dy * easing;
  
  // Update position
  box.style.left = `${newX}px`;
  box.style.top = `${newY}px`;
  
  // Schedule next update
  requestAnimationFrame(() => updateBoxPosition(box, index));
}

// Function to load audio files
async function loadAudioFiles() {
  try {
    // Hardcode the list of audio files we know exist
    audioFiles = [
      '01.m4a', '02.m4a', '03.m4a', '04.m4a', '05.m4a',
      '06.m4a', '07.m4a', '08.m4a', '09.m4a'
    ];
    
    // Initialize audio load status
    window.audioLoadStatus = {};
    window.audioBuffers = {};
    window.tempAudioElements = {};
    
    // Ensure audio context is initialized
    await audioManager.initialize();
    
    // Load each audio file
    const loadPromises = audioFiles.map(async (url, index) => {
      try {
        const response = await fetch(`/loops/${url}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Create a temporary audio element for immediate playback
        const tempAudio = new Audio();
        tempAudio.src = URL.createObjectURL(new Blob([arrayBuffer]));
        
        window.tempAudioElements[index] = tempAudio;
        window.audioLoadStatus[index] = 'basic-ready';
        
        // Decode the array buffer into an AudioBuffer
        const audioBuffer = await audioManager.decodeAudioData(arrayBuffer);
        window.audioBuffers[index] = audioBuffer;
        
        return { index, success: true };
      } catch (error) {
        console.error(`Error loading audio file ${url}:`, error);
        window.audioLoadStatus[index] = 'error';
        return { index, success: false, error };
      }
    });
    
    const results = await Promise.all(loadPromises);
    const failedLoads = results.filter(r => !r.success);
    
    if (failedLoads.length > 0) {
      console.warn('Some audio files failed to load:', failedLoads);
    }
    
    return results;
  } catch (error) {
    console.error('Error loading audio files:', error);
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

// Function to check if a specific audio file is ready
function isAudioFileReady(index) {
  return window.audioLoadStatus && 
    (window.audioLoadStatus[index] === 'loaded' || 
     window.audioLoadStatus[index] === 'basic-ready');
}

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
let lastUpdateTime = 0;
let boxesCreated = false;
let audioFiles = [];
const UPDATE_INTERVAL = 1000 / 30; // 30 FPS for smooth updates

// Debug: Log all available Native Web Audio effects
console.log("Available Native Effects:", Object.keys(nativeEffects));

// Current active box for debugging
let activeBoxForDebug = null;

// Debug panel elements
const debugPanel = document.getElementById('debug-panel');
const paramContainer = document.getElementById('param-container');
const debugTitle = document.getElementById('debug-title');
const closeDebugBtn = document.querySelector('#debug-panel .close-btn');

// Close debug panel when clicking the X
closeDebugBtn.addEventListener('click', () => {
  debugPanel.classList.remove('active');
  activeBoxForDebug = null;
});

// Function to create parameter sliders for a box
function createParamSliders(box, effectName) {
  // Get the parameter container for this specific box
  const boxParamContainer = box.paramContainer;
  
  // Clear existing sliders
  boxParamContainer.innerHTML = '';
  
  // Get the effect and its parameters
  const effect = nativeEffects[effectName];
  if (!effect || !effect.params) {
    return 0; // Return 0 parameters
  }
  
  const paramEntries = Object.entries(effect.params);
  const paramCount = paramEntries.length;
  
  // Create sliders for each parameter
  paramEntries.forEach(([paramName, paramConfig]) => {
    const paramSlider = document.createElement('div');
    paramSlider.classList.add('param-slider');
    // Remove any box styling
    paramSlider.style.margin = '5px 0';
    paramSlider.style.padding = '0';
    paramSlider.style.border = 'none';
    paramSlider.style.background = 'none';
    
    // Create label
    const label = document.createElement('div');
    label.classList.add('control-label');
    label.textContent = paramName.toUpperCase();
    label.style.marginBottom = '2px';
    paramSlider.appendChild(label);
    
    // Create slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = paramConfig.min;
    slider.max = paramConfig.max;
    slider.step = (paramConfig.max - paramConfig.min) / 100;
    slider.value = paramConfig.default;
    slider.classList.add('param-control');
    slider.style.width = '100%';
    slider.style.margin = '0';
    paramSlider.appendChild(slider);
    
    // Create value display
    const valueDisplay = document.createElement('span');
    valueDisplay.classList.add('value');
    valueDisplay.textContent = paramConfig.default.toFixed(2);
    valueDisplay.style.marginLeft = '5px';
    paramSlider.appendChild(valueDisplay);
    
    // Event listener for slider
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      valueDisplay.textContent = value.toFixed(2);
      
      // Apply parameter change to the effect
      if (box.effectNode && paramConfig.callback) {
        paramConfig.callback(box.effectNode, value);
      }
    });
    
    // Add to the container
    boxParamContainer.appendChild(paramSlider);
  });
  
  return paramCount; // Return the number of parameters
}

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

// Add debounce function at the top level
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function checkBoxPosition(box, boxId) {
  // Get table boundaries
  const table = document.getElementById('table');
  
  // Safety check - if table doesn't exist, don't try to position boxes
  if (!table) {
    console.error('Table element not found - check if table element exists in HTML');
    return;
  }
  
  const tableRect = table.getBoundingClientRect();
  const boxRect = box.element.getBoundingClientRect();
  
  // Check if box is within the table
  const insideTable = (
    boxRect.left >= tableRect.left &&
    boxRect.right <= tableRect.right &&
    boxRect.top >= tableRect.top &&
    boxRect.bottom <= tableRect.bottom
  );
  
  console.log(`Box ${boxId + 1} position check:`, {
    insideTable,
    boxPosition: { left: boxRect.left, top: boxRect.top },
    tableBounds: { left: tableRect.left, top: tableRect.top },
    isPlaying: box.isPlaying,
    audioContextState: audioManager.getState(),
    hasEffectNode: !!box.effectNode,
    timestamp: new Date().toISOString()
  });
  
  // Start or stop audio based on position
  if (insideTable) {
    if (box.startAudio) {
      console.log(`Starting audio for box ${boxId + 1} - Current state:`, {
        isPlaying: box.isPlaying,
        audioContextState: audioManager.getState(),
        timestamp: new Date().toISOString()
      });
      // Don't set isPlaying here - let startAudio handle it
      box.startAudio();
    }
  } else {
    if (box.stopAudio && box.isPlaying) {
      console.log(`Stopping audio for box ${boxId + 1} - Current state:`, {
        isPlaying: box.isPlaying,
        audioContextState: audioManager.getState(),
        timestamp: new Date().toISOString()
      });
      box.stopAudio();
    }
  }
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

// Hide debug panel when clicking elsewhere
document.addEventListener('click', (e) => {
  // If clicking outside the debug panel and not on a box
  if (!debugPanel.contains(e.target) && !e.target.classList.contains('box') && 
      !e.target.closest('.box')) {
    debugPanel.classList.remove('active');
    activeBoxForDebug = null;
  }
});

// Add extra check for Safari to ensure boxes render
if (navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') === -1) {
  console.log('Safari detected, applying special box rendering fix');
  // Safari-specific rendering fix
  setTimeout(() => {
    document.querySelectorAll('.box').forEach((box, index) => {
      // Force repaint
      box.style.display = 'none';
      setTimeout(() => {
        box.style.display = 'flex';
      }, 10);
    });
  }, 1000);
}

// Load audio files and create boxes
async function initializeApp() {
  try {
    console.log('Loading audio files...');
    await loadAudioFiles();
    console.log('Audio files loaded, creating boxes...');
    createBoxes();
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Start the app
initializeApp();
