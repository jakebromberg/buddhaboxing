/***********************************************
 * Audio Effects with Tuna.js - Multi-user Edition
 ***********************************************/

// 1. Session & Socket Setup
// For simplicity, generate a random session ID
const sessionId = "session-" + Math.floor(Math.random() * 1000000);

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

// 1. Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Create Tuna effects processor
const tuna = new Tuna(audioCtx);

// Debug: Log raw tuna object to see what's available
console.log("Tuna object:", tuna);

// Define our own native WebAudio effects since Tuna effects appear unavailable
const nativeEffects = {
  'none': null,
  'distortion': {
    create: () => {
      const distortion = audioCtx.createWaveShaper();
      // Create distortion curve
      const curve = new Float32Array(44100);
      const deg = Math.PI / 180;
      for (let i = 0; i < 44100; i++) {
        const x = i * 2 / 44100 - 1;
        curve[i] = (3 + 10) * x * 20 * deg / (Math.PI + 10 * Math.abs(x));
      }
      distortion.curve = curve;
      distortion.oversample = '4x';
      return distortion;
    }
  },
  'biquad-lowpass': {
    create: () => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;
      return filter;
    }
  },
  'biquad-highpass': {
    create: () => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      filter.Q.value = 1;
      return filter;
    }
  },
  'delay': {
    create: () => {
      const delay = audioCtx.createDelay();
      delay.delayTime.value = 0.3;
      
      // Add feedback
      const feedback = audioCtx.createGain();
      feedback.gain.value = 0.4;
      
      delay.connect(feedback);
      feedback.connect(delay);
      
      return {
        input: delay,
        output: delay
      };
    }
  },
  'stereo-panner': {
    create: () => {
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = 0.5;
      return panner;
    }
  },
  'reverb': {
    create: () => {
      const convolver = audioCtx.createConvolver();
      
      // Create impulse response
      const attack = 0;
      const decay = 2.0;
      const sampleRate = audioCtx.sampleRate;
      const length = sampleRate * decay;
      const impulse = audioCtx.createBuffer(2, length, sampleRate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);
      
      // Fill the buffer
      for(let i = 0; i < length; i++) {
        const n = i / length;
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
      }
      
      convolver.buffer = impulse;
      return convolver;
    }
  }
};

// Use our native effects instead of Tuna
const availableEffectPresets = nativeEffects;

// Filter out preset effects that don't exist in this version of Tuna
function filterAvailableEffects() {
  console.log("Using native Web Audio effects instead of Tuna.js");
  return nativeEffects;
}

// Debug: Log all available Native Web Audio effects
console.log("Available Native Effects:", Object.keys(nativeEffects));

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
const audioFiles = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
const audioBuffers = new Array(audioFiles.length);
let loadedCount = 0;

audioFiles.forEach((file, index) => {
  fetch(`loops/${file}.m4a`)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
    .then(decodedData => {
      audioBuffers[index] = decodedData;
      loadedCount++;
      if (loadedCount === audioFiles.length) {
        createBoxes();
        // Add session display
        createSessionDisplay();
      }
    });
});

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
  
  // Session ID display
  const sessionText = document.createElement('div');
  sessionText.textContent = `Session: ${sessionId}`;
  sessionDisplay.appendChild(sessionText);
  
  // Session URL
  const sessionUrl = document.createElement('div');
  sessionUrl.textContent = `URL: ${window.location.href}`;
  sessionUrl.style.marginTop = '5px';
  sessionUrl.style.cursor = 'pointer';
  sessionUrl.onclick = () => {
    navigator.clipboard.writeText(window.location.href);
    sessionUrl.textContent = 'URL copied!';
    setTimeout(() => {
      sessionUrl.textContent = `URL: ${window.location.href}`;
    }, 2000);
  };
  sessionDisplay.appendChild(sessionUrl);
  
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
  syncContainer.style.marginTop = '5px';
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
  const table = document.getElementById('table');
  const tableRect = table.getBoundingClientRect();
  
  // Create a box for each audio file
  audioFiles.forEach((file, index) => {
    createBox(index, tableRect);
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
}

function checkBoxPosition(box, boxId) {
  // Get table boundaries
  const table = document.getElementById('table');
  const tableRect = table.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  
  // Check if box is within the table
  const insideTable = (
    boxRect.left >= tableRect.left &&
    boxRect.right <= tableRect.right &&
    boxRect.top >= tableRect.top &&
    boxRect.bottom <= tableRect.bottom
  );
  
  // Start or stop audio based on position
  if (insideTable) {
    if (box.startAudio) box.startAudio();
  } else {
    if (box.stopAudio) box.stopAudio();
  }
}

function createBox(index, tableRect) {
  // Create box element
  const box = document.createElement('div');
  box.classList.add('box');
  box.style.backgroundColor = boxColors[index];
  
  // Store reference to this box
  createdBoxes[index] = box;
  
  // Add box number
  const boxNumber = document.createElement('div');
  boxNumber.classList.add('box-number');
  boxNumber.textContent = (index + 1).toString().padStart(2, '0');
  box.appendChild(boxNumber);
  
  // Add effect selector
  const effectLabel = document.createElement('div');
  effectLabel.classList.add('control-label');
  effectLabel.textContent = 'EFFECT';
  box.appendChild(effectLabel);
  
  const effectSelect = document.createElement('select');
  effectSelect.classList.add('effect-select');
  box.effectSelect = effectSelect; // Store reference for sync
  
  // Add effect options
  Object.keys(availableEffectPresets).forEach(effectName => {
    const option = document.createElement('option');
    option.value = effectName;
    option.textContent = effectName.charAt(0).toUpperCase() + effectName.slice(1);
    effectSelect.appendChild(option);
  });
  
  box.appendChild(effectSelect);
  
  // Add mix slider
  const mixLabel = document.createElement('div');
  mixLabel.classList.add('control-label');
  mixLabel.textContent = 'DRY/WET';
  box.appendChild(mixLabel);
  
  const mixSlider = document.createElement('input');
  mixSlider.type = 'range';
  mixSlider.min = 0;
  mixSlider.max = 100;
  mixSlider.value = 0; // Start completely dry
  mixSlider.classList.add('mix-control');
  box.mixSlider = mixSlider; // Store reference for sync
  box.appendChild(mixSlider);
  
  // Add volume label
  const volumeLabel = document.createElement('div');
  volumeLabel.classList.add('control-label');
  volumeLabel.textContent = 'VOLUME';
  box.appendChild(volumeLabel);
  
  // Add volume slider
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = 0;
  volumeSlider.max = 100;
  volumeSlider.value = 100;
  volumeSlider.classList.add('volume-control');
  box.volumeSlider = volumeSlider; // Store reference for sync
  box.appendChild(volumeSlider);
  
  // Position box outside the table initially
  const leftPosition = -120 - (index * 20); // Cascade boxes to the left
  box.style.left = `${leftPosition}px`;
  box.style.top = `${20 + (index * 40)}px`; // Stack vertically with some space between
  
  // Add box to table
  const table = document.getElementById('table');
  table.appendChild(box);
  
  // Setup audio nodes for this box
  let sourceNode = null;
  let gainNode = audioCtx.createGain();
  let effectNode = null;
  let dryNode = audioCtx.createGain(); // For dry signal
  let wetNode = audioCtx.createGain(); // For wet (effected) signal
  let mixerNode = audioCtx.createGain(); // Final output after mixing
  
  // Initialize gain values
  gainNode.gain.value = 0; // start muted
  dryNode.gain.value = 1; // 100% dry by default
  wetNode.gain.value = 0; // 0% wet by default
  
  // Create basic audio routing
  function setupAudioRouting() {
    // Connect the dry path
    gainNode.connect(dryNode);
    dryNode.connect(mixerNode);
    
    // Always connect wet node to mixer, even without effect
    wetNode.connect(mixerNode);
    
    // Connect mixer to output
    mixerNode.connect(audioCtx.destination);
  }
  
  // Set up initial routing
  setupAudioRouting();
  
  // Clean up any existing effect
  function cleanupEffect() {
    if (effectNode) {
      try {
        // Handle special case for complex effects that have input/output properties
        if (effectNode.input && effectNode.output) {
          // Disconnect complex effect
          gainNode.disconnect(effectNode.input);
          effectNode.output.disconnect();
        } else {
          // Disconnect simple effect
          gainNode.disconnect(effectNode);
          effectNode.disconnect();
        }
        
        // Then disconnect the gain node from everything
        // and reconnect the dry path
        gainNode.disconnect();
        gainNode.connect(dryNode);
        
        // Set to null to ensure garbage collection
        effectNode = null;
        console.log('Previous effect cleaned up');
      } catch (e) {
        console.log('Error disconnecting effect:', e);
      }
    }
  }
  
  // Function to create and connect effect
  function setupEffect(effectName) {
    // If selecting "none", just return
    if (effectName === 'none') {
      return;
    }
    
    // Get effect creator
    const effect = availableEffectPresets[effectName];
    if (!effect) {
      console.error(`Effect "${effectName}" not found in available effects`);
      return;
    }
    
    // Create the effect with Web Audio API
    try {
      console.log(`Creating effect: ${effectName}`);
      
      // Create a new effect instance using our factory function
      effectNode = effect.create();
      
      // Handle special case for complex effects that have input/output properties
      if (effectNode.input && effectNode.output) {
        // Connect wet path through the effect
        gainNode.connect(effectNode.input);
        effectNode.output.connect(wetNode);
      } else {
        // Connect wet path through the effect (simple node)
        gainNode.connect(effectNode);
        effectNode.connect(wetNode);
      }
      
      console.log(`Effect created and connected: ${effectName}`);
    } catch (e) {
      console.error(`Error creating ${effectName} effect:`, e);
      effectNode = null;
    }
  }
  
  // Send box state update to server
  function sendBoxUpdate(options = {}) {
    if (!syncEnabled) return;
    
    const defaultOptions = {
      boxId: index,
      newX: parseFloat(box.style.left),
      newY: parseFloat(box.style.top)
    };
    
    const updateData = { ...defaultOptions, ...options, sessionId };
    socket.emit('updateBox', updateData);
  }
  
  // Apply the dry/wet mix
  function applyMix(mixValue) {
    // Apply the mix values directly
    dryNode.gain.cancelScheduledValues(audioCtx.currentTime);
    wetNode.gain.cancelScheduledValues(audioCtx.currentTime);
    
    dryNode.gain.setValueAtTime(dryNode.gain.value, audioCtx.currentTime);
    wetNode.gain.setValueAtTime(wetNode.gain.value, audioCtx.currentTime);
    
    dryNode.gain.linearRampToValueAtTime(1 - mixValue, audioCtx.currentTime + 0.1);
    wetNode.gain.linearRampToValueAtTime(mixValue, audioCtx.currentTime + 0.1);
  }
  
  // Effect selector event
  effectSelect.addEventListener('change', (e) => {
    const effectName = e.target.value;
    
    // Clean up any previous effect first
    cleanupEffect();
    
    // Re-setup basic routing
    setupAudioRouting();
    
    // Add a small delay before creating the new effect
    setTimeout(() => {
      // Create the new effect
      setupEffect(effectName);
      
      // Update the mix to match the slider
      const mixValue = mixSlider.value / 100;
      applyMix(mixValue);
      
      // Send update to server
      sendBoxUpdate({ effect: effectName, mixValue });
    }, 100);
    
    // Prevent the drag event
    e.stopPropagation();
  });
  
  // Mix control
  mixSlider.addEventListener('input', (e) => {
    const mixValue = e.target.value / 100;
    
    // Only apply mix if an effect is selected and created
    if (effectSelect.value !== 'none' && effectNode) {
      // Apply the mix
      applyMix(mixValue);
      
      // Send update to server
      sendBoxUpdate({ mixValue });
    }
    
    // Prevent the drag event
    e.stopPropagation();
  });
  
  // Volume control
  volumeSlider.addEventListener('input', (e) => {
    // Only adjust volume if box is inside the table and audio is playing
    if (sourceNode) {
      const volume = e.target.value / 100;
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.1);
      
      // Send update to server
      sendBoxUpdate({ volume });
    }
    // Prevent the drag event when adjusting volume
    e.stopPropagation();
  });
  
  function startAudio() {
    // Ensure we have a user gesture & audioCtx is resumed
    audioCtx.resume().then(() => {
      if (!sourceNode) {
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffers[index];
        sourceNode.loop = true;

        // Pitch control
        sourceNode.playbackRate.value = 1.0;

        // Connect source to gain
        sourceNode.connect(gainNode);
        
        // Setup initial effect if one is selected
        if (effectSelect.value !== 'none') {
          // First make sure any previous effect is cleaned up
          cleanupEffect();
          
          // Ensure basic routing is set up
          setupAudioRouting();
          
          // Then set up the new effect
          setTimeout(() => {
            setupEffect(effectSelect.value);
            
            // Apply the current mix value
            const mixValue = mixSlider.value / 100;
            applyMix(mixValue);
          }, 100);
        }

        sourceNode.start(0);
      }
      // Set the gain based on the current slider value
      const volume = volumeSlider.value / 100;
      // Fade in
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.5);
    });
  }
  
  // Attach startAudio to box for external calling
  box.startAudio = startAudio;

  function stopAudio() {
    // Fade out
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

    // Stop source after fade
    setTimeout(() => {
      if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
        sourceNode = null;
      }
    }, 600); // slightly more than 0.5s
  }
  
  // Attach stopAudio to box for external calling
  box.stopAudio = stopAudio;
  
  // Drag logic
  let isDragging = false;
  let offsetX, offsetY;

  box.addEventListener('pointerdown', (e) => {
    // Don't initiate drag if clicking on controls
    if (e.target === volumeSlider || e.target === effectSelect || e.target === mixSlider) {
      return;
    }
    
    isDragging = true;
    offsetX = e.clientX - box.offsetLeft;
    offsetY = e.clientY - box.offsetTop;
    box.setPointerCapture(e.pointerId);
    box.style.zIndex = 10; // Bring to front when dragging
  });

  box.addEventListener('pointermove', (e) => {
    if (isDragging) {
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      box.style.left = newX + 'px';
      box.style.top = newY + 'px';
      
      // Throttle updates to server to avoid flooding
      if (!box.lastUpdate || Date.now() - box.lastUpdate > 50) {
        sendBoxUpdate({ newX, newY });
        box.lastUpdate = Date.now();
      }
    }
  });

  box.addEventListener('pointerup', (e) => {
    if (isDragging) {
      isDragging = false;
      box.releasePointerCapture(e.pointerId);
      box.style.zIndex = 1;
      
      // Check if box is within the table boundaries
      const tableRect = table.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      
      const insideTable = (
        boxRect.left >= tableRect.left &&
        boxRect.right <= tableRect.right &&
        boxRect.top >= tableRect.top &&
        boxRect.bottom <= tableRect.bottom
      );
      
      // Final position update with high priority
      sendBoxUpdate({
        newX: parseFloat(box.style.left),
        newY: parseFloat(box.style.top),
        insideTable
      });
      
      if (insideTable) {
        // Start or maintain audio
        startAudio();
      } else {
        // Stop or fade out audio
        stopAudio();
      }
    }
  });
}
