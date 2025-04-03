// Audio Context Manager for handling initialization and Safari-specific unlocks
class AudioContextManager {
  #audioCtx = null;
  
  constructor() {
    this.isInitialized = false;
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log(`Safari detected: ${this.isSafari}`);
  }

  // Initialize the audio context
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Create audio context if it doesn't exist
    if (!this.#audioCtx) {
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Wait for audio context to be ready
    if (this.#audioCtx.state === 'running') {
      this.isInitialized = true;
      return;
    }

    try {
      // For Safari, try the special unlock first
      if (this.isSafari) {
        console.log('Safari detected, attempting special unlock');
        try {
          await this.safariAudioUnlock();
          console.log('Safari unlock completed, resuming context');
          await this.#audioCtx.resume();
          console.log('Audio context resumed after Safari unlock');
        } catch (e) {
          console.log('Safari unlock failed, trying direct resume');
          try {
            await this.#audioCtx.resume();
            console.log('Audio context resumed directly');
          } catch (e) {
            console.warn('Audio context resume failed:', e);
            // For Safari, we need to wait for user interaction
            if (this.isSafari) {
              await this.waitForUserInteraction();
            }
          }
        }
      } else {
        // For other browsers, try direct resume
        try {
          await this.#audioCtx.resume();
          console.log('Audio context resumed');
        } catch (e) {
          console.warn('Audio context resume failed:', e);
        }
      }
    } catch (e) {
      console.warn('Audio context initialization failed:', e);
    } finally {
      this.isInitialized = true;
    }
  }

  async waitForUserInteraction() {
    console.log('Waiting for user interaction to resume audio context');
    
    return new Promise((resolve) => {
      const handleInteraction = async () => {
        console.log('User interaction detected, attempting to resume audio context');
        try {
          await this.#audioCtx.resume();
          console.log('Audio context resumed after user interaction');
        } catch (e) {
          console.warn('Audio context resume failed after user interaction:', e);
        } finally {
          resolve();
        }
      };

      // Add listeners for various user interactions
      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('mousedown', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });
    });
  }

  // Helper function to create a delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Safari-specific audio unlock
  async safariAudioUnlock() {
    if (!this.isSafari) return;
    
    console.log("Applying Safari-specific audio unlock");
    
    // Check if audio context is already running
    if (this.#audioCtx && this.#audioCtx.state === 'running') {
      console.log("Audio context already running, skipping unlock");
      return;
    }

    // Ensure audio context is properly initialized
    if (!this.#audioCtx) {
      console.log("Creating new audio context");
      this.#audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create a silent oscillator instead of using an MP3 file
    const oscillator = this.#audioCtx.createOscillator();
    const gainNode = this.#audioCtx.createGain();
    
    // Configure for silence
    oscillator.type = 'sine';
    oscillator.frequency.value = 1; // Ultra low frequency
    gainNode.gain.value = 0; // Zero gain
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this.#audioCtx.destination);
    
    // Start the oscillator
    oscillator.start(0);
    
    try {
      // Stop after a very short time
      await this.delay(100);
      
      oscillator.stop();
      oscillator.disconnect();
      gainNode.disconnect();
      
      // Try to resume the audio context
      console.log("Attempting to resume audio context");
      try {
        await this.#audioCtx.resume();
        console.log("Audio context resumed successfully");
      } catch (e) {
        console.warn("Failed to resume audio context:", e);
        // If resume fails, check if context is already running
        if (this.#audioCtx.state === 'running') {
          console.log("Audio context is already running despite resume error");
        } else {
          // Try one more time with a delay
          await this.delay(100);
          try {
            await this.#audioCtx.resume();
            console.log("Audio context resumed on second attempt");
          } catch (e) {
            console.warn("Second resume attempt failed:", e);
          }
        }
      }
    } catch (e) {
      console.warn("Error during Safari unlock:", e);
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
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.currentTime;
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
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.destination;
  }

  // Get state
  getState() {
    if (!this.#audioCtx) {
      return 'not-initialized';
    }
    return this.#audioCtx.state;
  }

  // Resume audio context
  async resume() {
    if (!this.#audioCtx) {
      throw new Error('Audio context not initialized');
    }
    return this.#audioCtx.resume();
  }

  // Check if the context is initialized
  isReady() {
    return this.isInitialized && this.#audioCtx !== null;
  }

  // Check if running in Safari
  isSafariBrowser() {
    return this.isSafari;
  }
}

// Export the AudioContextManager class
export default AudioContextManager; 