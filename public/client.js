// Import AudioContextManager
import AudioContextManager from './audioContextManager.js';
import { BoxState } from './boxState.js';
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

// Reusable event handler functions
const eventHandlers = {
  // Box dragging handlers
  handleDragStart: (box, index, e, updateBoxPosition) => {
    console.log('Mouse down on box:', index + 1);
    // Don't start dragging if clicking on controls
    if (e.target === box.effectSelect || e.target === box.mixSlider || e.target === box.volumeSlider || 
        e.target.closest('select') || e.target.closest('input')) {
      console.log('Ignoring mousedown on controls');
      return;
    }
    
    box.isDragging = true;
    box.hasDragged = false; // Reset drag flag on mousedown
    box.startX = e.clientX - box.offsetLeft;
    box.startY = e.clientY - box.offsetTop;
    box.initialX = box.offsetLeft;
    box.initialY = box.offsetTop;
    
    console.log('Starting drag:', {
      startX: box.startX,
      startY: box.startY,
      initialX: box.initialX,
      initialY: box.initialY
    });
    
    // Start smooth position updates
    updateBoxPosition(box, index);
  },

  handleDragMove: (box, index, e, debouncedCheckPosition) => {
    if (!box.isDragging) return;
    
    e.preventDefault();
    const newX = e.clientX - box.startX;
    const newY = e.clientY - box.startY;
    
    // Check if we've actually moved
    if (Math.abs(newX - box.initialX) > 5 || Math.abs(newY - box.initialY) > 5) {
      box.hasDragged = true;
      
      // Use debounced version of checkBoxPosition
      debouncedCheckPosition();
    }
    
    box.style.left = `${newX}px`;
    box.style.top = `${newY}px`;
  },

  handleDragEnd: (box, index, debouncedCheckPosition, audioManager, isSafari) => {
    if (box.isDragging) {
      console.log('Mouse up on box:', index + 1, 'hasDragged:', box.hasDragged);
      box.isDragging = false;
      
      // Use debounced version for final position check
      debouncedCheckPosition();
      
      // Check if box is inside the table
      const table = document.getElementById('table');
      if (table) {
        const tableRect = table.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        
        const insideTable = (
          boxRect.left >= tableRect.left &&
          boxRect.right <= tableRect.right &&
          boxRect.top >= tableRect.top &&
          boxRect.bottom <= tableRect.bottom
        );
        
        if (insideTable) {
          console.log('Box dragged into table, initializing audio');
          // Initialize audio context if needed
          if (!audioManager.isReady()) {
            audioManager.initialize().then(() => {
              if (box.startAudio) {
                box.startAudio();
              }
            }).catch(e => {
              console.warn('Failed to initialize audio context:', e);
            });
          } else if (isSafari && audioManager.getState() === 'suspended') {
            console.log('Safari detected, attempting audio unlock');
            audioManager.safariAudioUnlock()
              .then(() => {
                console.log('Safari unlock completed after drag');
                return audioManager.resume();
              })
              .then(() => {
                console.log('Audio context resumed after drag');
                // Start audio playback
                if (box.startAudio) {
                  box.startAudio();
                }
              })
              .catch(e => {
                console.warn('Failed to unlock audio after drag:', e);
              });
          } else {
            // Audio context is already initialized and running
            if (box.startAudio) {
              box.startAudio();
            }
          }
        } else {
          // Box is outside the table, stop audio
          console.log('Box dragged out of table, stopping audio');
          if (box.stopAudio) {
            box.stopAudio();
          }
        }
      }
      
      // Only collapse if we actually dragged
      if (box.hasDragged) {
        box.classList.remove('expanded');
        const controlsContainer = box.querySelector('.controls-container');
        controlsContainer.style.opacity = '0';
        box.style.height = '40px';
      }
      
      // Reset the drag flag after a delay
      setTimeout(() => {
        box.hasDragged = false;
      }, 300);
    }
  },

  // Box click handler
  handleBoxClick: (box, index, audioManager, isSafari, adjustBoxSize, e) => {
    // If we're currently dragging, ignore the click
    if (box.isDragging) {
      console.log('Ignoring click during drag');
      return;
    }

    // If we just finished dragging, ignore the click
    if (box.hasDragged) {
      console.log('Ignoring click after drag');
      return;
    }

    console.log('Click on box:', index + 1, 'hasDragged:', box.hasDragged, 'Current state:', {
      isPlaying: box.isPlaying,
      audioContextState: audioManager.getState(),
      hasEffectNode: !!box.effectNode,
      timestamp: new Date().toISOString()
    });
    
    // Don't expand if clicking on controls
    if (box.effectSelect && (box.effectSelect === e.target || box.mixSlider === e.target || box.volumeSlider === e.target)) {
      console.log('Ignoring click on controls');
      return;
    }
    
    // Toggle expanded state
    const isExpanded = box.classList.contains('expanded');
    box.classList.toggle('expanded');
    
    // Show/hide controls container
    const controlsContainer = box.querySelector('.controls-container');
    controlsContainer.style.opacity = !isExpanded ? '1' : '0';
    
    // Adjust box size based on current effect
    adjustBoxSize(box.effectSelect.value);
  },

  // Effect change handler
  handleEffectChange: (box, state, nativeEffects, createParamSliders, activeBoxForDebug, adjustBoxSize, sendBoxUpdate) => {
    const effectName = box.effectSelect.value;
    console.log(`Effect changed to: ${effectName}`);
    
    // Clean up existing effect if any
    state.cleanupEffect();
    
    // Setup new effect
    state.setupEffect(effectName, nativeEffects, createParamSliders, activeBoxForDebug);
    
    // If we have an effect selected, ensure the box is expanded
    if (effectName !== 'none') {
      // Force the box to be expanded
      box.classList.add('expanded');
      const controlsContainer = box.querySelector('.controls-container');
      controlsContainer.style.opacity = '1';
      
      // Adjust box size based on effect parameters
      adjustBoxSize(effectName);
      
      // Ensure parameters are visible
      if (box.paramContainer) {
        box.paramContainer.style.display = 'block';
        box.paramLabel.style.display = 'block';
      }
      if (box.mixLabel) {
        box.mixLabel.style.display = 'block';
        box.mixSlider.style.display = 'block';
      }
    }
    
    // Send update to server
    sendBoxUpdate({ effect: effectName });
  },

  // Mix control handler
  handleMixChange: (box, state, sendBoxUpdate) => {
    const mixValue = box.mixSlider.value / 100;
    
    // Only apply mix if an effect is selected and created
    if (box.effectSelect.value !== 'none' && state.effectNode) {
      // Apply the mix
      state.applyMix(mixValue);
      
      // Send update to server
      sendBoxUpdate({ mixValue });
    }
  },

  // Volume control handler
  handleVolumeChange: (box, state, sendBoxUpdate) => {
    // Only adjust volume if box is inside the table and audio is playing
    if (state.sourceNode) {
      const volume = box.volumeSlider.value / 100;
      state.setVolume(volume);
      
      // Send update to server
      sendBoxUpdate({ volume });
    }
  }
};

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
let createdBoxes = [];
let syncEnabled = true;
let lastUpdateTime = 0;
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

// 2. Load all audio files
const audioFiles = ['01.m4a', '02.m4a', '03.m4a', '04.m4a', '05.m4a', '06.m4a', '07.m4a', '08.m4a', '09.m4a'];
const audioBuffers = new Array(audioFiles.length);
let loadedCount = 0;
let boxesCreated = false; // Track if boxes have been created

// Add a new flag to track if effects are ready
let effectsReady = false;

// Create boxes immediately
// First ensure audio context is initialized
createBoxes();
createSessionDisplay();
boxesCreated = true;

// Then start loading audio files
setTimeout(loadAudioFiles, 100);

// Function to load audio files
function loadAudioFiles() {
  console.log("Starting audio file loading process...");
  
  // Initialize load status tracking
  window.audioLoadStatus = Array(audioFiles.length).fill('pending');
  
  // First, check which files exist
  const checkPromises = audioFiles.map((url, index) => {
    return fetch(`/loops/${url}`, { method: 'HEAD' })
      .then(() => {
        window.audioLoadStatus[index] = 'found';
        return { url, index, exists: true };
      })
      .catch(() => {
        window.audioLoadStatus[index] = 'not-found';
        return { url, index, exists: false };
      });
  });

  Promise.all(checkPromises)
    .then(results => {
      // Filter to only load files that exist
      const filesToLoad = results.filter(r => r.exists);
      
      // Load files in parallel with a limit
      const loadPromises = filesToLoad.map(({ url, index }) => {
        return loadSingleAudioFile(url, index);
      });

      return Promise.allSettled(loadPromises)
        .then((results) => {
          // Count successful loads
          const successfulLoads = results.filter(r => r.status === 'fulfilled').length;
          console.log(`Successfully loaded ${successfulLoads} audio files`);
          console.log('Audio load status:', window.audioLoadStatus);
        });
    })
    .catch(error => {
      console.error('Error during audio loading:', error);
      showAudioLoadingErrorMessage();
    });
}

// Function to load single audio file
function loadSingleAudioFile(url, index) {
  return new Promise((resolve, reject) => {
    console.log(`Starting to load audio file: ${url} for index ${index}`);

    // Check if we're in debug mode
    if (window.debugNoAudio) {
      console.log(`Debug mode: Creating dummy buffer for ${url}`);
      const dummyBuffer = audioManager.createNode('Buffer', { 
        numberOfChannels: 2, 
        length: audioManager.getSampleRate() * 2, 
        sampleRate: audioManager.getSampleRate() 
      });
      audioBuffers[index] = dummyBuffer;
      window.audioLoadStatus[index] = 'loaded';
      resolve();
      return;
    }

    // First, load the raw audio for immediate playback
    console.log(`Fetching audio file: /loops/${url}`);
    fetch(`/loops/${url}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log(`Successfully fetched ${url}, converting to array buffer`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        console.log(`Creating temporary audio element for ${url}`);
        // Create a temporary audio element for immediate playback
        const tempAudio = new Audio();
        tempAudio.src = URL.createObjectURL(new Blob([arrayBuffer]));
        
        // Store the temp audio for this box
        window.tempAudioElements = window.tempAudioElements || {};
        window.tempAudioElements[index] = tempAudio;
        
        // Update status to indicate basic playback is ready
        window.audioLoadStatus[index] = 'basic-ready';
        
        // Start playing immediately if the box is inside the table
        const box = createdBoxes[index];
        if (box) {
          const table = document.getElementById('table');
          if (table) {
            const tableRect = table.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            
            const insideTable = (
              boxRect.left >= tableRect.left &&
              boxRect.right <= tableRect.right &&
              boxRect.top >= tableRect.top &&
              boxRect.bottom <= tableRect.bottom
            );
            
            if (insideTable) {
              console.log(`Starting immediate playback for box ${index + 1}`);
              tempAudio.loop = true;
              tempAudio.volume = box.volumeSlider ? box.volumeSlider.value / 100 : 1;
              tempAudio.play().catch(e => {
                console.warn(`Could not start immediate playback for box ${index + 1}:`, e);
              });
            }
          }
        }
        
        // Store the array buffer for later decoding
        window.audioBuffers = window.audioBuffers || {};
        window.audioBuffers[index] = arrayBuffer;
        
        resolve();
      })
      .catch(error => {
        console.error(`Error loading audio file ${url}:`, error);
        window.audioLoadStatus[index] = 'error';
        reject(error);
      });
  });
}

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
  if (!syncEnabled || !createdBoxes[boxId]) return;
  
  const box = createdBoxes[boxId];
  
  // Temporarily disable syncing to avoid loops
  const oldSync = syncEnabled;
  syncEnabled = false;
  
  // Update position (if provided)
  if (newX !== undefined && newY !== undefined) {
    box.style.left = newX + 'px';
    box.style.top = newY + 'px';
    
    // Check if inside table and play/stop audio
    checkBoxPosition(box, boxId);
  }
  
  // Update effect (if provided)
  if (effect !== undefined && box.effectSelect) {
    box.effectSelect.value = effect;
    
    // Trigger the change event to apply the effect
    const changeEvent = new Event('change');
    box.effectSelect.dispatchEvent(changeEvent);
  }
  
  // Update mix value (if provided)
  if (mixValue !== undefined && box.mixSlider) {
    box.mixSlider.value = mixValue * 100;
    
    // Trigger the input event to apply the mix
    const inputEvent = new Event('input');
    box.mixSlider.dispatchEvent(inputEvent);
  }
  
  // Update volume (if provided)
  if (volume !== undefined && box.volumeSlider) {
    box.volumeSlider.value = volume * 100;
    
    // Trigger the input event to apply the volume
    const inputEvent = new Event('input');
    box.volumeSlider.dispatchEvent(inputEvent);
  }
  
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
    createBox(index, table);
  });
  
  // Apply any positions received from server
  if (boxPositionsFromServer) {
    boxPositionsFromServer.forEach((pos, index) => {
      if (createdBoxes[index]) {
        createdBoxes[index].style.left = pos.x + 'px';
        createdBoxes[index].style.top = pos.y + 'px';
        
        // Check if inside table and play/stop audio
        checkBoxPosition(createdBoxes[index], index);
      }
    });
  }
  
  // Log how many boxes were created
  console.log(`Created ${createdBoxes.length} boxes`);
  
  // Add a small delay and recheck visibility of all boxes
  setTimeout(() => {
    createdBoxes.forEach((box, index) => {
      if (box && !box.isConnected) {
        console.error(`Box ${index+1} is not connected to DOM, recreating`);
        document.body.appendChild(box);
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
  const boxRect = box.getBoundingClientRect();
  
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
  const rect = box.getBoundingClientRect();
  
  // Create update object
  const boxUpdate = {
    boxId: createdBoxes.indexOf(box),
    newX: rect.left,
    newY: rect.top,
    ...update
  };
  
  // Send to server
  socket.emit('boxUpdated', boxUpdate);
}

function createBox(index, table) {
  console.log(`Creating box ${index+1}`);
  
  // Create box element
  const box = document.createElement('div');
  box.classList.add('box');
  box.style.backgroundColor = boxColors[index];
  
  // Make boxes visible with explicit visibility and opacity
  box.style.visibility = 'visible';
  box.style.opacity = '1';
  box.style.zIndex = '1';
  
  // Store reference to this box
  createdBoxes[index] = box;
  
  // Create box state manager - but don't initialize audio yet
  const state = new BoxState(box, index);
  
  // Store boxId for reference
  box.boxId = index;
  
  // Add box number
  const boxNumber = document.createElement('div');
  boxNumber.classList.add('box-number');
  boxNumber.textContent = (index + 1).toString().padStart(2, '0');
  box.appendChild(boxNumber);

  // Create a container for controls that will be shown/hidden
  const controlsContainer = document.createElement('div');
  controlsContainer.classList.add('controls-container');
  controlsContainer.style.opacity = '0'; // Initially hidden
  controlsContainer.style.transition = 'opacity 0.3s ease';
  box.appendChild(controlsContainer);

  // Add effect selector
  const effectLabel = document.createElement('div');
  effectLabel.classList.add('control-label');
  effectLabel.textContent = 'EFFECT';
  controlsContainer.appendChild(effectLabel);
  
  const effectSelect = document.createElement('select');
  effectSelect.classList.add('effect-select');
  box.effectSelect = effectSelect; // Store reference for sync
  
  // Add effect options
  Object.keys(nativeEffects).forEach(effectName => {
    const option = document.createElement('option');
    option.value = effectName;
    option.textContent = effectName.charAt(0).toUpperCase() + effectName.slice(1);
    effectSelect.appendChild(option);
  });
  
  // Set initial value to 'none'
  effectSelect.value = 'none';
  
  controlsContainer.appendChild(effectSelect);
  
  // Create parameter container for effect parameters
  const paramLabel = document.createElement('div');
  paramLabel.classList.add('control-label');
  paramLabel.textContent = 'PARAMETERS';
  paramLabel.style.display = 'none'; // Hide by default
  controlsContainer.appendChild(paramLabel);
  
  const paramContainer = document.createElement('div');
  paramContainer.classList.add('param-container');
  paramContainer.style.display = 'none'; // Hide by default
  controlsContainer.appendChild(paramContainer);
  box.paramContainer = paramContainer; // Store reference for updating parameters
  box.paramLabel = paramLabel; // Store reference to the label
  
  // Add mix slider (moved from earlier to be grouped with parameters)
  const mixLabel = document.createElement('div');
  mixLabel.classList.add('control-label');
  mixLabel.textContent = 'DRY/WET';
  mixLabel.style.display = 'none'; // Hide by default
  controlsContainer.appendChild(mixLabel);
  
  const mixSlider = document.createElement('input');
  mixSlider.type = 'range';
  mixSlider.min = 0;
  mixSlider.max = 100;
  mixSlider.value = 0; // Start completely dry
  mixSlider.classList.add('mix-control');
  mixSlider.style.display = 'none'; // Hide by default
  box.mixSlider = mixSlider; // Store reference for sync
  controlsContainer.appendChild(mixSlider);
  box.mixLabel = mixLabel; // Store reference to the label
  
  // Add volume label
  const volumeLabel = document.createElement('div');
  volumeLabel.classList.add('control-label');
  volumeLabel.textContent = 'VOLUME';
  controlsContainer.appendChild(volumeLabel);
  
  // Add volume slider
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = 0;
  volumeSlider.max = 100;
  volumeSlider.value = 100;
  volumeSlider.classList.add('volume-control');
  box.volumeSlider = volumeSlider; // Store reference for sync
  controlsContainer.appendChild(volumeSlider);
  
  // Position all boxes on the left side initially - ensure these styles are applied
  box.style.position = 'absolute';
  box.style.left = '10px';
  box.style.top = `${20 + index * 50}px`; // Closer together when collapsed
  box.style.width = '120px';
  box.style.height = '40px';
  
  // Add box to body instead of table
  document.body.appendChild(box);
  
  // Add drag functionality with smooth updates
  let isDragging = false;
  let startX, startY, initialX, initialY;
  let hasDragged = false; // New flag to track if a drag occurred
  
  // Create a debounced version of checkBoxPosition specifically for this box
  const debouncedCheckPosition = debounce(() => {
    const boxId = createdBoxes.indexOf(box);
    checkBoxPosition(box, boxId);
  }, 100);
  
  box.addEventListener('mousedown', (e) => {
    eventHandlers.handleDragStart(box, index, e, updateBoxPosition);
  });
  
  document.addEventListener('mousemove', (e) => {
    eventHandlers.handleDragMove(box, index, e, debouncedCheckPosition);
  });
  
  document.addEventListener('mouseup', () => {
    eventHandlers.handleDragEnd(box, index, debouncedCheckPosition, audioManager, isSafari);
  });
  
  // Add click handler to expand/collapse box
  box.addEventListener('click', (e) => {
    console.log('Click on box:', index + 1, 'hasDragged:', hasDragged, 'Current state:', {
      isPlaying: box.isPlaying,
      audioContextState: audioManager.getState(),
      hasEffectNode: !!box.effectNode,
      timestamp: new Date().toISOString()
    });
    
    // Don't expand if clicking on controls or if the event came from a slider
    if (e.target === effectSelect || 
        e.target === mixSlider || 
        e.target === volumeSlider ||
        e.target.closest('input[type="range"]')) {
      console.log('Ignoring click on controls');
      return;
    }
    
    // If we dragged, don't toggle the box state
    if (hasDragged) {
      console.log('Ignoring click after drag');
      hasDragged = false; // Reset the flag for next interaction
      return;
    }
    
    // Toggle expanded state
    box.classList.toggle('expanded');
    
    // Show/hide controls container
    const controlsContainer = box.querySelector('.controls-container');
    controlsContainer.style.opacity = box.classList.contains('expanded') ? '1' : '0';
    
    // Adjust box size based on current effect
    adjustBoxSize(effectSelect.value);
  });
  
  // Add mousedown handler to sliders to prevent box click
  mixSlider.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  volumeSlider.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  // Function to adjust box size based on effect parameters
  function adjustBoxSize(effectName) {
    // Create parameters for the selected effect
    const paramCount = createParamSliders(box, effectName);
    
    // Base height for the expanded box (without parameters)
    const baseHeight = 180; // Reduced from 220 to 180
    
    // Show or hide the parameter section based on whether there are parameters
    if (paramCount > 0 && effectName !== 'none') {
      box.paramLabel.style.display = 'block';
      box.paramContainer.style.display = 'block';
      box.mixLabel.style.display = 'block';
      box.mixSlider.style.display = 'block';
      
      // Additional height per parameter - reduced for more compact display
      const paramHeight = 60; // Reduced from 100 to 60px per parameter
      
      // Calculate new height based on number of parameters plus the mix control
      const newHeight = baseHeight + ((paramCount + 1) * paramHeight);
      
      // Apply the height with a transition effect
      box.style.transition = 'height 0.3s ease';
      
      if (box.classList.contains('expanded')) {
        box.style.height = `${newHeight}px`;
      } else {
        box.style.height = '40px';
      }
    } else {
      // Hide parameters section when no effect is selected or no parameters
      box.paramLabel.style.display = 'none';
      box.paramContainer.style.display = 'none';
      box.mixLabel.style.display = effectName !== 'none' ? 'block' : 'none';
      box.mixSlider.style.display = effectName !== 'none' ? 'block' : 'none';
      
      // Use base height without parameters
      if (box.classList.contains('expanded')) {
        // Add extra height if we have the mix control but no parameters
        const mixHeight = effectName !== 'none' ? 60 : 0; // Reduced from 100 to 60
        box.style.height = `${baseHeight + mixHeight}px`;
      } else {
        box.style.height = '40px';
      }
    }
  }
  
  // Add effect selection handler
  effectSelect.addEventListener('change', (e) => {
    eventHandlers.handleEffectChange(box, state, nativeEffects, createParamSliders, activeBoxForDebug, adjustBoxSize, sendBoxUpdate.bind(box));
  });
  
  // Mix control
  mixSlider.addEventListener('input', (e) => {
    eventHandlers.handleMixChange(box, state, sendBoxUpdate.bind(box));
  });
  
  // Volume control
  volumeSlider.addEventListener('input', (e) => {
    eventHandlers.handleVolumeChange(box, state, sendBoxUpdate.bind(box));
  });
  
  // Modify startAudio function to handle initialization
  function startAudio() {
    console.log('startAudio called, checking initialization - Current state:', {
      isPlaying: state.isPlaying,
      audioContextState: audioManager.getState(),
      timestamp: new Date().toISOString()
    });
    
    // If already playing, don't start again
    if (state.isPlaying) {
      console.log(`Box ${box.boxId + 1} is already playing, skipping start`);
      return;
    }

    // Initialize audio context if needed
    if (!audioManager.isReady()) {
      audioManager.initialize().then(() => {
        // Start actual playback after initialization
        startAudioPlayback();
      }).catch(e => {
        console.warn('Failed to initialize audio context:', e);
      });
    } else if (isSafari && audioManager.getState() === 'suspended') {
      console.log('Safari detected, attempting audio unlock');
      audioManager.safariAudioUnlock()
        .then(() => {
          console.log('Safari unlock completed after drag');
          return audioManager.resume();
        })
        .then(() => {
          console.log('Audio context resumed after drag');
          // Start actual playback after unlock
          startAudioPlayback();
        })
        .catch(e => {
          console.warn('Failed to unlock audio after drag:', e);
        });
    } else {
      // Audio context is already initialized and running
      startAudioPlayback();
    }
  }
  
  // Attach startAudio to box for external calling
  box.startAudio = startAudio;

  // Modify stopAudio to use state
  function stopAudio() {
    console.log(`Stopping audio for box ${box.boxId + 1}`);
    
    // Clear playing state immediately
    state.isPlaying = false;
    box.isPlaying = false;
    
    // Only try to fade out if we have an audio context and a gain node
    if (audioManager.isReady() && state.gainNode) {
      // Fade out
      state.gainNode.gain.cancelScheduledValues(audioManager.getCurrentTime());
      state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, audioManager.getCurrentTime());
      state.gainNode.gain.linearRampToValueAtTime(0, audioManager.getCurrentTime() + 0.5);

      // Stop source after fade
      setTimeout(() => {
        state.cleanup();
      }, 600);
    } else {
      // If no audio context or gain node, just stop the basic audio
      const tempAudio = window.tempAudioElements[box.boxId];
      if (tempAudio) {
        tempAudio.pause();
        tempAudio.currentTime = 0;
      }
    }
  }
  
  // Attach stopAudio to box for external calling
  box.stopAudio = stopAudio;

  // Separate function for actual audio playback
  function startAudioPlayback() {
    console.log('Starting audio after initialization - Current state:', {
      audioContextState: audioManager.getState(),
      timestamp: new Date().toISOString()
    });
    
    // Add a longer delay for Safari to ensure everything is properly initialized
    const delayMs = isSafari ? 300 : 50;
    
    setTimeout(() => {
      // Check if we have either basic audio or full audio buffer
      const hasBasicAudio = window.tempAudioElements && window.tempAudioElements[box.boxId];
      const hasFullAudio = audioBuffers[box.boxId];
      
      console.log(`Box ${box.boxId + 1} audio state before playback:`, {
        hasBasicAudio,
        hasFullAudio,
        audioContextState: audioManager.getState(),
        sourceNode: !!state.sourceNode,
        timestamp: new Date().toISOString()
      });
      
      if (!hasBasicAudio && !hasFullAudio) {
        console.error(`No audio available for box ${box.boxId + 1}`);
        box.style.border = '2px solid red';
        box.style.backgroundColor = '#ffebee';
        
        // Add reload button if not already present
        if (!box.querySelector('.reload-btn')) {
          const reloadBtn = document.createElement('button');
          reloadBtn.className = 'reload-btn';
          reloadBtn.textContent = '↻';
          reloadBtn.onclick = (e) => {
            e.stopPropagation();
            loadSingleAudioFile(audioFiles[box.boxId], box.boxId);
          };
          box.appendChild(reloadBtn);
        }
        return;
      }
      
      // Remove error styling if we have audio
      box.style.border = '';
      const reloadBtn = box.querySelector('.reload-btn');
      if (reloadBtn) box.removeChild(reloadBtn);
      
      // If we have full audio buffer, use Web Audio API
      if (hasFullAudio) {
        if (!state.sourceNode) {
          try {
            console.log(`Creating new source node for box ${box.boxId + 1} - Current state:`, {
              audioContextState: audioManager.getState(),
              timestamp: new Date().toISOString()
            });
            state.sourceNode = audioManager.createNode('BufferSource');
            state.sourceNode.buffer = audioBuffers[box.boxId];
            state.sourceNode.loop = true;

            // Pitch control
            state.sourceNode.playbackRate.value = 1.0;

            // Connect source to gain
            state.sourceNode.connect(state.gainNode);
            
            // Setup initial effect if one is selected and effects are ready
            if (effectsReady && effectSelect.value !== 'none') {
              console.log(`Setting up effect ${effectSelect.value} for box ${box.boxId + 1}`);
              state.effectNode = cleanupEffect(state.effectNode, state.gainNode, state.dryNode);
              state.setupAudioRouting();
              state.effectNode = setupEffect(effectSelect.value, state.gainNode, state.wetNode, box);
              const mixValue = mixSlider.value / 100;
              state.applyMix(mixValue);
            }

            // Set the gain based on the current slider value
            const volume = volumeSlider.value / 100;
            console.log(`Setting volume to ${volume} for box ${box.boxId + 1} - Current state:`, {
              audioContextState: audioManager.getState(),
              timestamp: new Date().toISOString()
            });
            state.gainNode.gain.setValueAtTime(volume, audioManager.getCurrentTime());
            
            // Start playback
            state.sourceNode.start(0);
            
            // Set playing state after successful playback start
            state.isPlaying = true;
            box.isPlaying = true;
            
            console.log(`Audio started for box ${box.boxId + 1} - Current state:`, {
              isPlaying: state.isPlaying,
              audioContextState: audioManager.getState(),
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error(`Error starting audio for box ${box.boxId + 1}:`, e);
            state.isPlaying = false;
            box.isPlaying = false;
          }
        }
      } else if (hasBasicAudio) {
        // Use basic audio if Web Audio API isn't available
        const tempAudio = window.tempAudioElements[box.boxId];
        if (tempAudio) {
          tempAudio.currentTime = 0;
          tempAudio.play().then(() => {
            state.isPlaying = true;
            box.isPlaying = true;
            console.log(`Basic audio started for box ${box.boxId + 1} - Current state:`, {
              isPlaying: state.isPlaying,
              audioContextState: audioManager.getState(),
              timestamp: new Date().toISOString()
            });
          }).catch(e => {
            console.error(`Error starting basic audio for box ${box.boxId + 1}:`, e);
            state.isPlaying = false;
            box.isPlaying = false;
          });
        }
      }
    }, delayMs);
  }
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
