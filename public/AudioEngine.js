// Audio Engine for handling initialization and Safari-specific unlocks
class AudioEngine {
  #audioCtx = null;
  #stateChangeCallbacks = new Set();
  #currentSource = null;
  
  constructor() {
    this.isInitialized = false;
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log('Creating new AudioContext...');
    this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('AudioContext created, initial state:', this.#audioCtx.state);
    
    this.#audioCtx.onstatechange = () => {
      console.log('Audio context state changed to:', this.#audioCtx.state);
      this.#stateChangeCallbacks.forEach(callback => callback(this.#audioCtx.state));
    };

    console.log(`Safari detected: ${this.isSafari}`);
  }

  // Add a callback for state changes
  onStateChange(callback) {
    console.log('Adding state change callback');
    this.#stateChangeCallbacks.add(callback);
    // If we already have an audio context, call the callback immediately
    if (this.#audioCtx) {
      console.log('Calling state change callback immediately with state:', this.#audioCtx.state);
      callback(this.#audioCtx.state);
    }
    return () => this.#stateChangeCallbacks.delete(callback);
  }

  // Initialize the audio context
  async initialize() {
    console.log('Initializing audio context...');
    console.log('Current state:', this.#audioCtx ? this.#audioCtx.state : 'not created');
    console.log('Is initialized:', this.isInitialized);
    console.log('Is ready:', this.isReady());
    
    if (this.isInitialized && this.isReady()) {
      console.log('Audio context already initialized and running');
      return;
    }

    // For Safari, we need to wait for user interaction before resuming
    if (this.isSafari) {
      console.log('Safari detected, waiting for user interaction before resuming');
      await this.waitForUserInteraction();
    } else {
      // For other browsers, try to resume directly
      try {
        console.log('Attempting to resume audio context...');
        await this.#audioCtx.resume();
        console.log('Audio context resumed successfully, new state:', this.#audioCtx.state);
      } catch (e) {
        console.warn('Audio context resume failed:', e);
        await this.waitForUserInteraction();
      }
    }

    this.isInitialized = true;
    console.log('Audio context initialization complete. Final state:', this.#audioCtx.state);
  }

  async waitForUserInteraction() {
    console.log("Setting up user interaction listeners");
    
    try {
      // Create a function to handle the interaction
      const handleInteraction = async () => {
        console.log("User interaction detected, attempting to resume");
        try {
          await this.resumeWithTimeout();
          console.log("Resume successful after user interaction, new state:", this.#audioCtx.state);
        } catch (e) {
          console.warn("Resume failed after user interaction:", e);
        } finally {
          // Remove event listeners
          events.forEach(event => {
            document.removeEventListener(event, handleInteraction);
          });
        }
      };

      // Add listeners for various user interactions
      const events = ['click', 'touchstart', 'mousedown', 'keydown'];
      events.forEach(event => {
        document.addEventListener(event, handleInteraction, { once: true });
      });
      
      console.log("User interaction listeners set up");
    } catch (error) {
      console.warn("Error in user interaction handler:", error);
      throw error;
    }
  }

  // Safari-specific audio unlock
  async safariAudioUnlock() {
    if (!this.isSafari) return;
    
    console.log("Applying Safari-specific audio unlock");
    console.log("Current audio context state:", this.#audioCtx ? this.#audioCtx.state : 'not created');
    
    // Check if audio context is already running
    if (this.isReady()) {
      console.log("Audio context already running, skipping unlock");
      return;
    }

    // Ensure audio context is properly initialized
    if (!this.#audioCtx) {
      console.log("Creating new audio context for unlock");
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("New audio context state:", this.#audioCtx.state);
    }

    try {
      // First try a simple resume with timeout
      console.log("Attempting initial resume");
      await this.resumeWithTimeout();
      console.log("Initial resume successful, new state:", this.#audioCtx.state);
      return;
    } catch (e) {
      console.log("Initial resume failed, trying oscillator method");
    }

    // If simple resume fails, try the oscillator method
    try {
      // Create a silent oscillator
      console.log("Creating silent oscillator for unlock");
      const oscillator = this.#audioCtx.createOscillator();
      const gainNode = this.#audioCtx.createGain();
      
      // Configure for silence
      oscillator.type = 'sine';
      oscillator.frequency.value = 1; // Ultra low frequency
      gainNode.gain.value = 0; // Zero gain
      
      // Connect nodes
      console.log("Connecting oscillator nodes");
      oscillator.connect(gainNode);
      gainNode.connect(this.#audioCtx.destination);
      
      // Start the oscillator
      console.log("Starting oscillator");
      oscillator.start(0);
      
      // Wait a short time
      console.log("Waiting for oscillator to play");
      
      // Stop and disconnect
      console.log("Stopping and disconnecting oscillator");
      oscillator.stop();
      oscillator.disconnect();
      gainNode.disconnect();
      
      // Try to resume with timeout
      console.log("Attempting to resume after oscillator");
      await this.resumeWithTimeout();
      console.log("Resume successful after oscillator, new state:", this.#audioCtx.state);
    } catch (e) {
      console.warn("Oscillator method failed:", e);
      
      // If both methods fail, wait for user interaction
      console.log("Waiting for user interaction after all methods failed");
      await this.waitForUserInteraction();
    }
  }

  // Create a new audio node
  createNode(type, options = {}) {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx[`create${type}`](options);
  }

  // Get current time
  getCurrentTime() {
    return this.#audioCtx ? this.#audioCtx.currentTime : 0;
  }

  // Get sample rate
  getSampleRate() {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.sampleRate;
  }

  // Get destination
  getDestination() {
    return this.#audioCtx ? this.#audioCtx.destination : null;
  }

  // Get state
  getState() {
    return this.#audioCtx ? this.#audioCtx.state : 'suspended';
  }

  // Resume audio context
  async resume() {
    if (this.#audioCtx && this.#audioCtx.state !== 'running') {
      await this.#audioCtx.resume();
    }
  }

  // Check if the context is initialized
  isReady() {
    return this.#audioCtx && this.#audioCtx.state === 'running';
  }

  // Check if running in Safari
  isSafariBrowser() {
    return this.isSafari;
  }

  // Get the audio context
  getAudioContext() {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx;
  }

  // Decode audio data
  async decodeAudioData(arrayBuffer) {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.decodeAudioData(arrayBuffer);
  }

  createGain() {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.createGain();
  }

  createBufferSource() {
    const source = this.#audioCtx.createBufferSource();
    this.setCurrentSource(source);
    return source;
  }

  connect(node) {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    node.connect(this.#audioCtx.destination);
  }

  async resumeWithTimeout(timeoutMs = 1000) {
    console.log("Starting resume with timeout");
    const startTime = Date.now();
    let timeoutId;
    
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Resume operation timed out'));
        }, timeoutMs);
      });

      // Race between resume and timeout
      await Promise.race([
        this.#audioCtx.resume(),
        timeoutPromise
      ]);

      // Clear the timeout if resume succeeds
      clearTimeout(timeoutId);
      console.log("Resume completed successfully");
      return;
    } catch (error) {
      // Clear the timeout in case of error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (error.message === 'Resume operation timed out') {
        console.warn("Resume operation timed out");
        throw error;
      }
      
      console.warn("Resume failed with error:", error);
      throw error;
    }
  }

  // Get the current source node
  getCurrentSource() {
    return this.#currentSource;
  }

  // Set the current source node
  setCurrentSource(source) {
    this.#currentSource = source;
  }
}

// Export the AudioEngine class
export default AudioEngine; 