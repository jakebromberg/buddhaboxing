// Box state management
export class BoxState {
  #effectNode = null;
  #sourceNode = null;
  #gainNode = null;
  #dryNode = null;
  #wetNode = null;
  #mixerNode = null;

  constructor(box, index, audioManager) {
    this.box = box;
    this.index = index;
    this.audioManager = audioManager;
    
    // Store the effect instance
    this.effectInstance = null;
    
    // State flags
    this.isPlaying = false;
  }
  
  // Private method to check if effect exists
  #hasEffect() {
    return this.#effectNode !== null;
  }
  
  // Private method to initialize audio nodes
  #initializeNodes() {
    this.#gainNode = this.audioManager.createGain();
    this.#dryNode = this.audioManager.createGain();
    this.#wetNode = this.audioManager.createGain();
    this.#mixerNode = this.audioManager.createGain();

    // Initialize gain values
    this.#gainNode.gain.value = 0;
    this.#dryNode.gain.value = 1;
    this.#wetNode.gain.value = 0;
  }
  
  // Public method to start audio playback
  startAudio(buffer) {
    if (!this.audioManager.isReady()) {
      console.error('Audio context not ready');
      return;
    }

    // Initialize nodes if needed
    if (!this.#gainNode) {
      this.#initializeNodes();
    }

    // Create and setup source node
    this.#sourceNode = this.audioManager.createBufferSource();
    this.#sourceNode.buffer = buffer;
    this.#sourceNode.loop = true;

    // Connect nodes
    this.#sourceNode.connect(this.#gainNode);
    this.setupAudioRouting();

    // Start playback
    this.#sourceNode.start(0);
    this.isPlaying = true;

    // Fade in
    this.#gainNode.gain.setValueAtTime(0, this.audioManager.getCurrentTime());
    this.#gainNode.gain.linearRampToValueAtTime(1, this.audioManager.getCurrentTime() + 0.5);
  }
  
  // Public method to stop audio playback
  stopAudio() {
    if (this.#sourceNode) {
      try {
        this.#sourceNode.stop();
        this.#sourceNode.disconnect();
        this.#sourceNode = null;
      } catch (e) {
        console.error(`Error stopping audio for box ${this.index + 1}:`, e);
      }
    }

    if (this.#gainNode) {
      this.#gainNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
      this.#gainNode.gain.setValueAtTime(this.#gainNode.gain.value, this.audioManager.getCurrentTime());
      this.#gainNode.gain.linearRampToValueAtTime(0, this.audioManager.getCurrentTime() + 0.5);
    }

    this.isPlaying = false;
  }
  
  setupAudioRouting() {
    if (!this.audioManager.isReady()) {
      console.error('Audio context not ready');
      return;
    }
    
    if (!this.#gainNode || !this.#dryNode || !this.#wetNode || !this.#mixerNode) {
      console.error('Audio nodes not initialized');
      return;
    }
    
    // Connect the dry path
    this.#gainNode.connect(this.#dryNode);
    this.#dryNode.connect(this.#mixerNode);
    
    // Always connect wet node to mixer, even without effect
    this.#wetNode.connect(this.#mixerNode);
    
    // Connect mixer to output
    this.audioManager.connect(this.#mixerNode);
  }
  
  cleanupEffect() {
    if (!this.#effectNode) return;
    
    try {
      // Handle special case for complex effects that have input/output properties
      if (this.#effectNode.input && this.#effectNode.output) {
        // Disconnect complex effect
        this.#gainNode.disconnect(this.#effectNode.input);
        this.#effectNode.output.disconnect();
      } else {
        // Disconnect simple effect
        this.#gainNode.disconnect(this.#effectNode);
        this.#effectNode.disconnect();
      }
      
      // Then disconnect the gain node from everything
      // and reconnect the dry path
      this.#gainNode.disconnect();
      this.#gainNode.connect(this.#dryNode);
      
      // Set to null to ensure garbage collection
      this.#effectNode = null;
      this.effectInstance = null;
      console.log('Previous effect cleaned up');
    } catch (e) {
      console.log('Error disconnecting effect:', e);
    }
  }
  
  setupEffect(effectName, availableEffectPresets, createParamSliders, activeBoxForDebug) {
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
      this.effectInstance = effect(this.audioManager.getAudioContext());
      this.#effectNode = this.effectInstance.create();
      
      // Handle special case for complex effects that have input/output properties
      if (this.#effectNode.input && this.#effectNode.output) {
        // Connect wet path through the effect
        this.#gainNode.connect(this.#effectNode.input);
        this.#effectNode.output.connect(this.#wetNode);
      } else {
        // Connect wet path through the effect (simple node)
        this.#gainNode.connect(this.#effectNode);
        this.#effectNode.connect(this.#wetNode);
      }
      
      console.log(`Effect created and connected: ${effectName}`);
      
      // Update debug panel if this box is active
      if (activeBoxForDebug === this.box) {
        createParamSliders(this.box, effectName);
      }
    } catch (e) {
      console.error(`Error creating ${effectName} effect:`, e);
      this.#effectNode = null;
      this.effectInstance = null;
    }
  }
  
  // Public method to apply mix with internal validation
  applyMix(mixValue) {
    if (!this.#hasEffect()) return;

    // Apply the mix values directly
    this.#dryNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    this.#wetNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    
    this.#dryNode.gain.setValueAtTime(this.#dryNode.gain.value, this.audioManager.getCurrentTime());
    this.#wetNode.gain.setValueAtTime(this.#wetNode.gain.value, this.audioManager.getCurrentTime());
    
    this.#dryNode.gain.linearRampToValueAtTime(1 - mixValue, this.audioManager.getCurrentTime() + 0.1);
    this.#wetNode.gain.linearRampToValueAtTime(mixValue, this.audioManager.getCurrentTime() + 0.1);
  }
  
  setVolume(volume) {
    if (!this.#gainNode) return;
    
    this.#gainNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    this.#gainNode.gain.setValueAtTime(this.#gainNode.gain.value, this.audioManager.getCurrentTime());
    this.#gainNode.gain.linearRampToValueAtTime(volume, this.audioManager.getCurrentTime() + 0.1);
  }
  
  cleanup() {
    this.stopAudio();
    this.cleanupEffect();
  }

  // Public method to get debug info
  getDebugInfo() {
    return {
      hasEffectNode: this.#hasEffect(),
      isPlaying: this.isPlaying
    };
  }
} 