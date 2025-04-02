// Audio Context Manager for handling initialization and Safari-specific unlocks
class AudioContextManager {
  constructor() {
    this.audioCtx = null;
    this.isInitialized = false;
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    console.log(`Safari detected: ${this.isSafari}`);
  }

  // Initialize the audio context
  async initialize() {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // Create audio context if it doesn't exist
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    return new Promise((resolve) => {
      // Wait for audio context to be ready
      const audioContextReady = new Promise((resolveAudio) => {
        if (this.audioCtx.state === 'running') {
          resolveAudio();
        } else {
          const resumeAudio = () => {
            // For Safari, try the special unlock first
            if (this.isSafari) {
              console.log('Safari detected, attempting special unlock');
              this.safariAudioUnlock()
                .then(() => {
                  console.log('Safari unlock completed, resuming context');
                  return this.audioCtx.resume();
                })
                .then(() => {
                  console.log('Audio context resumed after Safari unlock');
                  // Add a small delay for Safari to ensure context is fully ready
                  setTimeout(() => {
                    resolveAudio();
                  }, 100);
                })
                .catch(e => {
                  console.log('Safari unlock failed, trying direct resume');
                  this.audioCtx.resume()
                    .then(() => {
                      console.log('Audio context resumed directly');
                      // Add a small delay for Safari to ensure context is fully ready
                      setTimeout(() => {
                        resolveAudio();
                      }, 100);
                    })
                    .catch(e => {
                      console.warn('Audio context resume failed:', e);
                      resolveAudio(); // Still resolve to continue
                    });
                });
            } else {
              // For other browsers, try direct resume
              this.audioCtx.resume()
                .then(() => {
                  console.log('Audio context resumed');
                  resolveAudio();
                })
                .catch(e => {
                  console.warn('Audio context resume failed:', e);
                  resolveAudio(); // Still resolve to continue
                });
            }
          };

          // Try to resume on any user interaction
          const handleInteraction = () => {
            console.log('User interaction detected, attempting to resume audio context');
            resumeAudio();
          };

          // Add listeners for various user interactions
          document.addEventListener('click', handleInteraction);
          document.addEventListener('touchstart', handleInteraction);
          document.addEventListener('mousedown', handleInteraction);
          document.addEventListener('keydown', handleInteraction);
        }
      });

      audioContextReady.then(() => {
        console.log('Audio context initialized');
        this.isInitialized = true;
        resolve();
      });
    });
  }

  // Safari-specific audio unlock
  async safariAudioUnlock() {
    if (!this.isSafari) return Promise.resolve();
    
    console.log("Applying Safari-specific audio unlock");
    
    return new Promise((resolve) => {
      // Ensure audio context is properly initialized
      if (!this.audioCtx) {
        console.log("Creating new audio context");
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Create a silent oscillator instead of using an MP3 file
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      // Configure for silence
      oscillator.type = 'sine';
      oscillator.frequency.value = 1; // Ultra low frequency
      gainNode.gain.value = 0; // Zero gain
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      // Start the oscillator
      oscillator.start(0);
      
      // Stop after a very short time
      setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
        
        // Try to resume the audio context
        console.log("Attempting to resume audio context");
        this.audioCtx.resume()
          .then(() => {
            console.log("Audio context resumed successfully");
            resolve();
          })
          .catch(e => {
            console.warn("Failed to resume audio context:", e);
            resolve(); // Still resolve to continue with the app
          });
      }, 100);
    });
  }

  // Get the audio context
  getContext() {
    return this.audioCtx;
  }

  // Check if the context is initialized
  isReady() {
    return this.isInitialized;
  }

  // Check if running in Safari
  isSafariBrowser() {
    return this.isSafari;
  }
}

// Export the AudioContextManager class
export default AudioContextManager; 