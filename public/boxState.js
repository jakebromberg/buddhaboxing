// Box state management
export class BoxState {
  constructor(box, index, audioManager) {
    this.box = box;
    this.index = index;
    this.audioManager = audioManager;
    
    // Audio nodes - will be initialized later
    this.sourceNode = null;
    this.gainNode = null;
    this.effectNode = null;
    this.dryNode = null;
    this.wetNode = null;
    this.mixerNode = null;
    
    // Store the effect instance
    this.effectInstance = null;
    
    // State flags
    this.isPlaying = false;
  }
  
  setupAudioRouting() {
    if (!this.audioManager.isReady()) {
      console.error('Audio context not ready');
      return;
    }
    
    if (!this.gainNode || !this.dryNode || !this.wetNode || !this.mixerNode) {
      console.error('Audio nodes not initialized');
      return;
    }
    
    // Connect the dry path
    this.gainNode.connect(this.dryNode);
    this.dryNode.connect(this.mixerNode);
    
    // Always connect wet node to mixer, even without effect
    this.wetNode.connect(this.mixerNode);
    
    // Connect mixer to output
    this.audioManager.connect(this.mixerNode);
  }
  
  cleanupEffect() {
    if (!this.effectNode) return;
    
    try {
      // Handle special case for complex effects that have input/output properties
      if (this.effectNode.input && this.effectNode.output) {
        // Disconnect complex effect
        this.gainNode.disconnect(this.effectNode.input);
        this.effectNode.output.disconnect();
      } else {
        // Disconnect simple effect
        this.gainNode.disconnect(this.effectNode);
        this.effectNode.disconnect();
      }
      
      // Then disconnect the gain node from everything
      // and reconnect the dry path
      this.gainNode.disconnect();
      this.gainNode.connect(this.dryNode);
      
      // Set to null to ensure garbage collection
      this.effectNode = null;
      this.effectInstance = null;
      this.box.effectNode = null;
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
      this.effectNode = this.effectInstance.create();
      
      // Handle special case for complex effects that have input/output properties
      if (this.effectNode.input && this.effectNode.output) {
        // Connect wet path through the effect
        this.gainNode.connect(this.effectNode.input);
        this.effectNode.output.connect(this.wetNode);
      } else {
        // Connect wet path through the effect (simple node)
        this.gainNode.connect(this.effectNode);
        this.effectNode.connect(this.wetNode);
      }
      
      console.log(`Effect created and connected: ${effectName}`);
      
      // Store effectNode on the box object for debugging
      this.box.effectNode = this.effectNode;
      
      // Update debug panel if this box is active
      if (activeBoxForDebug === this.box) {
        createParamSliders(this.box, effectName);
      }
    } catch (e) {
      console.error(`Error creating ${effectName} effect:`, e);
      this.effectNode = null;
      this.effectInstance = null;
      this.box.effectNode = null;
    }
  }
  
  applyMix(mixValue) {
    // Apply the mix values directly
    this.dryNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    this.wetNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    
    this.dryNode.gain.setValueAtTime(this.dryNode.gain.value, this.audioManager.getCurrentTime());
    this.wetNode.gain.setValueAtTime(this.wetNode.gain.value, this.audioManager.getCurrentTime());
    
    this.dryNode.gain.linearRampToValueAtTime(1 - mixValue, this.audioManager.getCurrentTime() + 0.1);
    this.wetNode.gain.linearRampToValueAtTime(mixValue, this.audioManager.getCurrentTime() + 0.1);
  }
  
  setVolume(volume) {
    this.gainNode.gain.cancelScheduledValues(this.audioManager.getCurrentTime());
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioManager.getCurrentTime());
    this.gainNode.gain.linearRampToValueAtTime(volume, this.audioManager.getCurrentTime() + 0.1);
  }
  
  cleanup() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
        this.sourceNode = null;
      } catch (e) {
        console.error(`Error stopping audio for box ${this.index + 1}:`, e);
      }
    }
    
    this.cleanupEffect();
    this.isPlaying = false;
  }
} 