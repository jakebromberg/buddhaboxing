/***********************************************
 * Audio Effects with Tuna.js - Multi-user Edition
 ***********************************************/

// Import AudioContextManager
import AudioContextManager from './audioContextManager.js';
import { BoxState } from './boxState.js';

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

  handleDragEnd: (box, index, debouncedCheckPosition, audioManager, audioCtx, isSafari) => {
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
          if (!audioCtx) {
            audioManager.initialize().then(() => {
              audioCtx = audioManager.getContext();
              if (box.startAudio) {
                box.startAudio();
              }
            }).catch(e => {
              console.warn('Failed to initialize audio context:', e);
            });
          } else if (isSafari && audioCtx.state === 'suspended') {
            console.log('Safari detected, attempting audio unlock');
            audioManager.safariAudioUnlock()
              .then(() => {
                console.log('Safari unlock completed after drag');
                return audioCtx.resume();
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
  handleBoxClick: (box, index, audioManager, audioCtx, isSafari, adjustBoxSize, e) => {
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
      audioContextState: audioCtx ? audioCtx.state : 'not-initialized',
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
  handleEffectChange: (box, state, availableEffectPresets, createParamSliders, activeBoxForDebug, adjustBoxSize, sendBoxUpdate) => {
    const effectName = box.effectSelect.value;
    console.log(`Effect changed to: ${effectName}`);
    
    // Clean up existing effect if any
    state.cleanupEffect();
    
    // Setup new effect
    state.setupEffect(effectName, availableEffectPresets, createParamSliders, activeBoxForDebug);
    
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

// Initialize audio context and ensure it's unlocked before creating boxes
let audioCtx = null;
let isInitialized = false;

// Function to ensure everything is initialized
async function ensureInitialized() {
  if (isInitialized) {
    return Promise.resolve();
  }

  return audioManager.initialize().then(() => {
    audioCtx = audioManager.getContext();
    isInitialized = true;
  });
}

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
      try {
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
      } catch (error) {
        console.error("Failed to create bitcrusher effect:", error);
        // Fallback for Safari - use a simple distortion instead
        const distortion = audioCtx.createWaveShaper();
        const curve = new Float32Array(44100);
        for (let i = 0; i < 44100; i++) {
          const x = i * 2 / 44100 - 1;
          // Create a harsh distortion curve as a rough approximation
          curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.5);
        }
        distortion.curve = curve;
        distortion.oversample = '4x';
        
        // Add dummy properties to mimic the bitcrusher
        distortion.bits = 8;
        distortion.normFreq = 0.15;
        return distortion;
      }
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
      try {
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
      } catch (error) {
        console.error("Failed to create ring-modulator effect:", error);
        // Fallback for Safari - use a simpler approach with an oscillator and gain
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 440;
        gain.gain.value = 0.5;
        
        osc.connect(gain);
        osc.start(0);
        
        // Create a gain node that will be our input & output
        const ringMod = audioCtx.createGain();
        
        return {
          input: ringMod,
          output: ringMod,
          _modulator: {
            _ringFreq: 440,
            _depth: 1.0
          }
        };
      }
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

// Effect management functions
function cleanupEffect(effectNode, gainNode, dryNode) {
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
  return null;
}

function setupEffect(effectName, gainNode, wetNode, box) {
  // If selecting "none", just return
  if (effectName === 'none') {
    return null;
  }
  
  // Get effect creator
  const effect = availableEffectPresets[effectName];
  if (!effect) {
    console.error(`Effect "${effectName}" not found in available effects`);
    return null;
  }
  
  // Create the effect with Web Audio API
  try {
    console.log(`Creating effect: ${effectName}`);
    
    // Create a new effect instance using our factory function
    const effectNode = effect.create();
    
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
    
    return effectNode;
  } catch (e) {
    console.error(`Error creating ${effectName} effect:`, e);
    return null;
  }
}

// Initialize available effects
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
      const dummyBuffer = audioCtx.createBuffer(2, audioCtx.sampleRate * 2, audioCtx.sampleRate);
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
    audioContextState: audioCtx ? audioCtx.state : 'not-initialized',
    hasEffectNode: !!box.effectNode,
    timestamp: new Date().toISOString()
  });
  
  // Start or stop audio based on position
  if (insideTable) {
    if (box.startAudio) {
      console.log(`Starting audio for box ${boxId + 1} - Current state:`, {
        isPlaying: box.isPlaying,
        audioContextState: audioCtx ? audioCtx.state : 'not-initialized',
        timestamp: new Date().toISOString()
      });
      // Don't set isPlaying here - let startAudio handle it
      box.startAudio();
    }
  } else {
    if (box.stopAudio && box.isPlaying) {
      console.log(`Stopping audio for box ${boxId + 1} - Current state:`, {
        isPlaying: box.isPlaying,
        audioContextState: audioCtx ? audioCtx.state : 'not-initialized',
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
  Object.keys(availableEffectPresets).forEach(effectName => {
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
    eventHandlers.handleDragEnd(box, index, debouncedCheckPosition, audioManager, audioCtx, isSafari);
  });
  
  // Add click handler to expand/collapse box
  box.addEventListener('click', (e) => {
    eventHandlers.handleBoxClick(box, index, audioManager, audioCtx, isSafari, adjustBoxSize, e);
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
    eventHandlers.handleEffectChange(box, state, availableEffectPresets, createParamSliders, activeBoxForDebug, adjustBoxSize, sendBoxUpdate.bind(box));
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
      audioContextState: audioCtx ? audioCtx.state : 'not-initialized',
      timestamp: new Date().toISOString()
    });
    
    // If already playing, don't start again
    if (state.isPlaying) {
      console.log(`Box ${box.boxId + 1} is already playing, skipping start`);
      return;
    }

    // Initialize audio context if needed
    if (!audioCtx) {
      audioManager.initialize().then(() => {
        audioCtx = audioManager.getContext();
        // Start actual playback after initialization
        startAudioPlayback();
      }).catch(e => {
        console.warn('Failed to initialize audio context:', e);
      });
    } else if (isSafari && audioCtx.state === 'suspended') {
      console.log('Safari detected, attempting audio unlock');
      audioManager.safariAudioUnlock()
        .then(() => {
          console.log('Safari unlock completed after drag');
          return audioCtx.resume();
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
    if (audioCtx && state.gainNode) {
      // Fade out
      state.gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      state.gainNode.gain.setValueAtTime(state.gainNode.gain.value, audioCtx.currentTime);
      state.gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

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
      audioContextState: audioCtx.state,
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
        audioContextState: audioCtx.state,
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
              audioContextState: audioCtx.state,
              timestamp: new Date().toISOString()
            });
            state.sourceNode = audioCtx.createBufferSource();
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
              audioContextState: audioCtx.state,
              timestamp: new Date().toISOString()
            });
            state.gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
            
            // Start playback
            state.sourceNode.start(0);
            
            // Set playing state after successful playback start
            state.isPlaying = true;
            box.isPlaying = true;
            
            console.log(`Audio started for box ${box.boxId + 1} - Current state:`, {
              isPlaying: state.isPlaying,
              audioContextState: audioCtx.state,
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
              audioContextState: audioCtx.state,
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