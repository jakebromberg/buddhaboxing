/***********************************************
 * Audio Effects with Tuna.js - Multi-user Edition
 ***********************************************/

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
    },
    params: {
      amount: { min: 0, max: 100, default: 50, callback: (effect, value) => {
        // Recreate distortion curve with new intensity
        const intensity = value / 10; // Scale from 0-100 to 0-10
        const curve = new Float32Array(44100);
        const deg = Math.PI / 180;
        for (let i = 0; i < 44100; i++) {
          const x = i * 2 / 44100 - 1;
          curve[i] = (3 + intensity) * x * 20 * deg / (Math.PI + intensity * Math.abs(x));
        }
        effect.curve = curve;
      }}
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
        output: delay,
        _delay: delay,        // Store references to internal nodes
        _feedback: feedback   // for parameter control
      };
    },
    params: {
      time: { min: 0, max: 1.0, default: 0.3, callback: (effect, value) => {
        effect._delay.delayTime.setValueAtTime(value, audioCtx.currentTime);
      }},
      feedback: { min: 0, max: 0.9, default: 0.4, callback: (effect, value) => {
        effect._feedback.gain.setValueAtTime(value, audioCtx.currentTime);
      }}
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
      convolver._decay = decay; // Store for recreation
      return convolver;
    },
    params: {
      decay: { min: 0.1, max: 5.0, default: 2.0, callback: (effect, oldValue, newValue) => {
        // Need to create a new impulse with the new decay
        const attack = 0;
        const decay = newValue;
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
        
        effect.buffer = impulse;
        effect._decay = decay;
      }}
    }
  },
  'flanger': {
    create: () => {
      // Create delay node for flanger
      const delay = audioCtx.createDelay();
      delay.delayTime.value = 0.005; // 5ms initial delay
      
      // Create LFO to modulate delay time
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5; // 0.5Hz LFO - slow flanger
      lfoGain.gain.value = 0.002; // Modulation depth
      
      // Connect LFO to delay time
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start(0);
      
      // Feedback path
      const feedback = audioCtx.createGain();
      feedback.gain.value = 0.6; // Medium feedback
      
      // Connect feedback loop
      delay.connect(feedback);
      feedback.connect(delay);
      
      // Mixer for flanger intensity
      const flangerIntensity = audioCtx.createGain();
      flangerIntensity.gain.value = 0.7; // Default intensity
      
      const output = audioCtx.createGain();
      
      // Connect the direct and delayed signals to output
      delay.connect(flangerIntensity);
      flangerIntensity.connect(output);
      
      return {
        input: delay,
        output: output,
        _delay: delay,
        _lfo: lfo,
        _feedback: feedback,
        _flangerIntensity: flangerIntensity
      };
    },
    params: {
      rate: { min: 0.05, max: 5, default: 0.5, callback: (effect, value) => {
        effect._lfo.frequency.setValueAtTime(value, audioCtx.currentTime);
      }},
      depth: { min: 0.0001, max: 0.01, default: 0.002, callback: (effect, value) => {
        // Scale for better UI control
        effect._lfo.frequency.cancelScheduledValues(audioCtx.currentTime);
        effect._lfo.frequency.setValueAtTime(effect._lfo.frequency.value, audioCtx.currentTime);
        effect._lfo.connect(effect._delay.delayTime);
      }},
      feedback: { min: 0, max: 0.9, default: 0.6, callback: (effect, value) => {
        effect._feedback.gain.setValueAtTime(value, audioCtx.currentTime);
      }},
      intensity: { min: 0, max: 1, default: 0.7, callback: (effect, value) => {
        effect._flangerIntensity.gain.setValueAtTime(value, audioCtx.currentTime);
      }}
    }
  },
  'stereo-chorus': {
    create: () => {
      // Create two delay lines for stereo effect
      const delayLeft = audioCtx.createDelay();
      const delayRight = audioCtx.createDelay();
      delayLeft.delayTime.value = 0.025; // 25ms initial delay
      delayRight.delayTime.value = 0.027; // slightly different for stereo
      
      // Create two LFOs for left and right channels
      const lfoLeft = audioCtx.createOscillator();
      const lfoRight = audioCtx.createOscillator();
      const lfoGainLeft = audioCtx.createGain();
      const lfoGainRight = audioCtx.createGain();
      
      lfoLeft.type = 'sine';
      lfoRight.type = 'sine';
      lfoLeft.frequency.value = 0.33;  // 0.33Hz - slow chorus
      lfoRight.frequency.value = 0.38; // slightly different for more stereo width
      
      lfoGainLeft.gain.value = 0.005;  // Modulation depth
      lfoGainRight.gain.value = 0.006; // slightly different depth
      
      // Connect LFOs to delay times
      lfoLeft.connect(lfoGainLeft);
      lfoRight.connect(lfoGainRight);
      lfoGainLeft.connect(delayLeft.delayTime);
      lfoGainRight.connect(delayRight.delayTime);
      lfoLeft.start(0);
      lfoRight.start(0);
      
      // Create channel splitter and merger for stereo processing
      const splitter = audioCtx.createChannelSplitter(2);
      const merger = audioCtx.createChannelMerger(2);
      
      // Create mixing gains
      const chorusGain = audioCtx.createGain();
      chorusGain.gain.value = 0.5; // 50% wet by default
      
      // Create input and output nodes
      const input = audioCtx.createGain();
      const output = audioCtx.createGain();
      
      // Connect everything
      input.connect(splitter);
      input.connect(output); // Direct signal
      
      // Left channel processing
      splitter.connect(delayLeft, 0);
      delayLeft.connect(merger, 0, 0);
      
      // Right channel processing
      splitter.connect(delayRight, 1);
      delayRight.connect(merger, 0, 1);
      
      // Mix processed signal with direct
      merger.connect(chorusGain);
      chorusGain.connect(output);
      
      return {
        input: input,
        output: output,
        _delayLeft: delayLeft,
        _delayRight: delayRight,
        _lfoLeft: lfoLeft,
        _lfoRight: lfoRight,
        _chorusGain: chorusGain
      };
    },
    params: {
      rate: { min: 0.05, max: 2, default: 0.33, callback: (effect, value) => {
        // Set slightly different rates for L/R
        effect._lfoLeft.frequency.setValueAtTime(value, audioCtx.currentTime);
        effect._lfoRight.frequency.setValueAtTime(value * 1.15, audioCtx.currentTime);
      }},
      depth: { min: 0.001, max: 0.02, default: 0.005, callback: (effect, value) => {
        // Different depths for L/R
        const lfoGainLeft = effect._lfoLeft.connect(effect._delayLeft.delayTime);
        const lfoGainRight = effect._lfoRight.connect(effect._delayRight.delayTime);
        if (lfoGainLeft) lfoGainLeft.gain.setValueAtTime(value, audioCtx.currentTime);
        if (lfoGainRight) lfoGainRight.gain.setValueAtTime(value * 1.2, audioCtx.currentTime);
      }},
      mix: { min: 0, max: 1, default: 0.5, callback: (effect, value) => {
        effect._chorusGain.gain.setValueAtTime(value, audioCtx.currentTime);
      }}
    }
  },
  'bitcrusher': {
    create: () => {
      // We need to use ScriptProcessorNode for bitcrushing
      // (Yes, it's deprecated but it's the simplest way to do this)
      const bufferSize = 4096;
      const crusher = audioCtx.createScriptProcessor(bufferSize, 2, 2);
      
      // Set default values
      crusher.bits = 8;        // Bit depth 
      crusher.normFreq = 0.15; // Normalized frequency (1=sample rate, 0.5=half sample rate)
      crusher.step = Math.pow(0.5, crusher.bits);
      crusher._lastValues = [0, 0]; // Store last values for sample rate reduction
      
      // The actual bitcrushing logic
      crusher.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        // Calculate parameters from properties
        const step = Math.pow(0.5, crusher.bits);
        const phaseIncr = crusher.normFreq;
        
        // Process samples
        for (let i = 0; i < bufferSize; i++) {
          // Check if we need to compute a new sample (sample rate reduction)
          if ((i % Math.floor(1/phaseIncr)) === 0) {
            // Apply bit depth reduction by quantizing to steps
            crusher._lastValues[0] = Math.round(inputL[i] / step) * step;
            crusher._lastValues[1] = Math.round(inputR[i] / step) * step;
          }
          
          // Copy reduced values to output
          outputL[i] = crusher._lastValues[0];
          outputR[i] = crusher._lastValues[1];
        }
      };
      
      return crusher;
    },
    params: {
      bits: { min: 1, max: 16, default: 8, callback: (effect, value) => {
        effect.bits = value;
        effect.step = Math.pow(0.5, value);
      }},
      frequency: { min: 0.01, max: 1, default: 0.15, callback: (effect, value) => {
        effect.normFreq = value;
      }}
    }
  },
  'ring-modulator': {
    create: () => {
      // Create oscillator for modulation
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440; // 440Hz - "A" note
      
      // Create gain node for math operations
      const modulationGain = audioCtx.createGain();
      modulationGain.gain.value = 1.0;
      
      // Connect oscillator to gain
      osc.connect(modulationGain);
      osc.start(0);
      
      // Create actual ring modulator using a gain node
      // Ring modulation works by multiplying the audio signal by a sine wave
      const ringMod = audioCtx.createGain();
      
      // Create worklet to do the multiplication
      const bufferSize = 4096;
      const modulator = audioCtx.createScriptProcessor(bufferSize, 2, 2);
      modulator._ringFreq = 440;
      modulator._depth = 1.0;
      
      modulator.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        // Perform the ring modulation
        for (let i = 0; i < bufferSize; i++) {
          // Generate modulator signal
          const mod = Math.sin(2 * Math.PI * modulator._ringFreq * i / audioCtx.sampleRate);
          
          // Apply depth - mix between modulated and original signal
          const modDepth = modulator._depth;
          const origDepth = 1 - modDepth;
          
          // Apply modulation and write to output
          outputL[i] = (inputL[i] * mod * modDepth) + (inputL[i] * origDepth);
          outputR[i] = (inputR[i] * mod * modDepth) + (inputR[i] * origDepth);
        }
      };
      
      return {
        input: modulator,
        output: modulator,
        _modulator: modulator
      };
    },
    params: {
      frequency: { min: 50, max: 5000, default: 440, callback: (effect, value) => {
        effect._modulator._ringFreq = value;
      }},
      depth: { min: 0, max: 1, default: 1.0, callback: (effect, value) => {
        effect._modulator._depth = value;
      }}
    }
  }
};

// Use our native effects instead of Tuna
const availableEffectPresets = nativeEffects;

// Filter available effects
function filterAvailableEffects() {
  console.log("Using native Web Audio effects instead of Tuna.js");
  return nativeEffects;
}

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
  const table = document.getElementById('table');
  
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

function createBox(index, table) {
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
  Object.keys(availableEffectPresets).forEach(effectName => {
    const option = document.createElement('option');
    option.value = effectName;
    option.textContent = effectName.charAt(0).toUpperCase() + effectName.slice(1);
    effectSelect.appendChild(option);
  });
  
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
  
  // Position all boxes on the left side initially
  box.style.left = '10px';
  box.style.top = `${20 + index * 50}px`; // Closer together when collapsed
  
  // Add box to body instead of table
  document.body.appendChild(box);
  
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
      }
    }
  }
  
  // Drag logic
  let isDragging = false;
  let hasMoved = false; // Track if the box has been moved during drag
  let offsetX, offsetY;

  box.addEventListener('pointerdown', (e) => {
    // Don't initiate drag if clicking on controls
    if (e.target === volumeSlider || e.target === effectSelect || e.target === mixSlider ||
        e.target.closest('.param-slider')) {
      return;
    }
    
    isDragging = true;
    hasMoved = false; // Reset the movement flag
    offsetX = e.clientX - box.offsetLeft;
    offsetY = e.clientY - box.offsetTop;
    box.setPointerCapture(e.pointerId);
    
    // If the box isn't expanded, do not consider this a drag yet
    // Give the user a chance to click to expand
    if (!box.classList.contains('expanded')) {
      // Wait a bit to see if this is a drag or just a click
      setTimeout(() => {
        if (isDragging) {
          box.style.zIndex = 10; // Bring to front when dragging
        }
      }, 150);
    } else {
      box.style.zIndex = 10; // Bring to front when dragging
    }
  });

  box.addEventListener('pointermove', (e) => {
    if (isDragging) {
      hasMoved = true; // Mark that movement has occurred
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      box.style.left = newX + 'px';
      box.style.top = newY + 'px';
      
      // Log box position and table bounds for debugging
      const boxRect = box.getBoundingClientRect();
      const tableRect = document.getElementById('table').getBoundingClientRect();
      console.log(`Box ${index+1} position:`, {
        boxLeft: boxRect.left,
        boxRight: boxRect.right,
        boxTop: boxRect.top,
        boxBottom: boxRect.bottom,
        tableLeft: tableRect.left,
        tableRight: tableRect.right,
        tableTop: tableRect.top,
        tableBottom: tableRect.bottom
      });
      
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
  
  // Replace click handler with a more specific handler that only 
  // triggers when there was no movement during the pointerdown/up cycle
  box.addEventListener('click', (e) => {
    // Don't do anything if clicking on controls
    if (e.target === volumeSlider || e.target === effectSelect || e.target === mixSlider ||
        e.target.closest('.param-slider')) {
      return;
    }
    
    // Only toggle expanded state if this wasn't a drag operation
    if (!hasMoved) {
      // Toggle expanded class
      const wasExpanded = box.classList.contains('expanded');
      box.classList.toggle('expanded');
      
      // Show/hide controls
      if (!wasExpanded) {
        // Show controls when expanding
        controlsContainer.style.opacity = '1';
        
        // Adjust box size based on the current effect
        adjustBoxSize(effectSelect.value);
      } else {
        // Hide controls when collapsing
        controlsContainer.style.opacity = '0';
        
        // Reset to default size when collapsing
        box.style.height = '40px';
      }
    }
    
    // Prevent propagation
    e.stopPropagation();
  });

  // Setup audio nodes for this box
  let sourceNode = null;
  let gainNode = audioCtx.createGain();
  let effectNode = null;
  let dryNode = audioCtx.createGain(); // For dry signal
  let wetNode = audioCtx.createGain(); // For wet (effected) signal
  let mixerNode = audioCtx.createGain(); // Final output after mixing
  
  // Store effectNode on the box object for debugging
  box.effectNode = effectNode;
  
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
        box.effectNode = null;  // Also clear the reference on the box
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
      
      // Store on the box for parameter control
      box.effectNode = effectNode;
      
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
      
      // Update debug panel if this box is active
      if (activeBoxForDebug === box) {
        createParamSliders(box, effectName);
      }
    } catch (e) {
      console.error(`Error creating ${effectName} effect:`, e);
      effectNode = null;
      box.effectNode = null;
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
    
    // Adjust box size based on the selected effect
    adjustBoxSize(effectName);
    
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
