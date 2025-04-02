// Box state management
export class BoxState {
  constructor(box, index, audioCtx) {
    this.box = box;
    this.index = index;
    this.audioCtx = audioCtx;
    
    // Audio nodes
    this.sourceNode = null;
    this.gainNode = audioCtx.createGain();
    this.effectNode = null;
    this.dryNode = audioCtx.createGain();
    this.wetNode = audioCtx.createGain();
    this.mixerNode = audioCtx.createGain();
    
    // State flags
    this.isPlaying = false;
    this.effectsReady = false;
    
    // Initialize gain values
    this.gainNode.gain.value = 0;
    this.dryNode.gain.value = 1;
    this.wetNode.gain.value = 0;
    
    // Store effectNode on the box object for debugging
    this.box.effectNode = this.effectNode;
    
    // Set up initial routing
    this.setupAudioRouting();
  }
  
  setupAudioRouting() {
    // Connect the dry path
    this.gainNode.connect(this.dryNode);
    this.dryNode.connect(this.mixerNode);
    
    // Always connect wet node to mixer, even without effect
    this.wetNode.connect(this.mixerNode);
    
    // Connect mixer to output
    this.mixerNode.connect(this.audioCtx.destination);
  }
  
  cleanupEffect() {
    if (this.effectNode) {
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
        this.box.effectNode = null;
        console.log('Previous effect cleaned up');
      } catch (e) {
        console.log('Error disconnecting effect:', e);
      }
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
      this.effectNode = effect.create();
      
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
      
      // Update debug panel if this box is active
      if (activeBoxForDebug === this.box) {
        createParamSliders(this.box, effectName);
      }
      
      // Store effectNode on the box object for debugging
      this.box.effectNode = this.effectNode;
    } catch (e) {
      console.error(`Error creating ${effectName} effect:`, e);
      this.effectNode = null;
      this.box.effectNode = null;
    }
  }
  
  applyMix(mixValue) {
    // Apply the mix values directly
    this.dryNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.wetNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    
    this.dryNode.gain.setValueAtTime(this.dryNode.gain.value, this.audioCtx.currentTime);
    this.wetNode.gain.setValueAtTime(this.wetNode.gain.value, this.audioCtx.currentTime);
    
    this.dryNode.gain.linearRampToValueAtTime(1 - mixValue, this.audioCtx.currentTime + 0.1);
    this.wetNode.gain.linearRampToValueAtTime(mixValue, this.audioCtx.currentTime + 0.1);
  }
  
  setVolume(volume) {
    this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(volume, this.audioCtx.currentTime + 0.1);
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