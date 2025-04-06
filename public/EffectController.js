import AudioEngine from './AudioEngine.js';
import { createEffect } from './nativeEffects.js';

// Box state management
export class EffectController {
  #effectNode = null;
  #sourceNode = null;
  #gainNode = null;
  #dryNode = null;
  #wetNode = null;
  #mixerNode = null;

  constructor(element, fileName, audioEngine) {
    this.element = element;
    this.fileName = fileName;
    this.audioEngine = audioEngine;
    this.effectInstance = null;
    this.effect = null;
    this.nodes = {};
    this.params = {};
  }
  
  // Computed property for playing state
  get isPlaying() {
    return this.#sourceNode !== null && 
           this.#gainNode !== null && 
           this.#gainNode.gain.value > 0;
  }
  
  // Private method to check if effect exists
  #hasEffect() {
    return this.#effectNode !== null;
  }
  
  // Private method to initialize audio nodes
  #initializeNodes() {
    const audioCtx = this.audioEngine.getAudioContext();
    
    // Create gain nodes for volume control
    this.nodes.inputGain = audioCtx.createGain();
    this.nodes.outputGain = audioCtx.createGain();
    
    // Create analyzer for visualization
    this.nodes.analyzer = audioCtx.createAnalyser();
    this.nodes.analyzer.fftSize = 2048;
    
    // Connect nodes
    this.nodes.inputGain.connect(this.nodes.analyzer);
    this.nodes.analyzer.connect(this.nodes.outputGain);
    
    // Set initial volume
    this.nodes.inputGain.gain.value = 0.5;
    this.nodes.outputGain.gain.value = 0.5;
  }
  
  // Public method to start audio playback
  async startAudio(buffer) {
    if (!this.audioEngine.isReady()) {
      try {
        await this.audioEngine.initialize();
      } catch (e) {
        console.warn('Failed to initialize audio context:', e);
        return;
      }
    }

    // Initialize nodes if needed
    if (!this.#gainNode) {
      this.#initializeNodes();
    }

    const audioCtx = this.audioEngine.getAudioContext();

    // Create and setup source node
    this.#sourceNode = audioCtx.createBufferSource();
    this.#sourceNode.buffer = buffer;
    this.#sourceNode.loop = true;

    // Connect nodes
    this.#sourceNode.connect(this.#gainNode);
    this.#setupAudioRouting();

    // Start playback
    this.#sourceNode.start(0);

    // Fade in
    this.#gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    this.#gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.5);
  }
  
  // Public method to stop audio playback
  stopAudio() {
    if (this.#sourceNode) {
      try {
        if (this.isPlaying) {
          this.#sourceNode.stop();
        }
        this.#sourceNode.disconnect();
        this.#sourceNode = null;
      } catch (e) {
        console.error(`Error stopping audio for box ${this.fileName}:`, e);
      }
    }

    if (this.#gainNode) {
      const audioCtx = this.audioEngine.getAudioContext();
      this.#gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      this.#gainNode.gain.setValueAtTime(this.#gainNode.gain.value, audioCtx.currentTime);
      this.#gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    }

    this.cleanupEffect();
  }
  
  #setupAudioRouting() {
    if (!this.audioEngine.isReady()) {
      console.warn('Audio context not ready, will retry after initialization');
      // Add a one-time state change listener
      const removeListener = this.audioEngine.onStateChange((state) => {
        if (state === 'running') {
          this.#setupAudioRouting();
          removeListener();
        }
      });
      return;
    }
    
    if (!this.#gainNode || !this.#dryNode || !this.#wetNode || !this.#mixerNode) {
      console.error('Audio nodes not initialized');
      return;
    }
    
    const audioCtx = this.audioEngine.getAudioContext();
    
    // Connect the dry path
    this.#gainNode.connect(this.#dryNode);
    this.#dryNode.connect(this.#mixerNode);
    
    // Always connect wet node to mixer, even without effect
    this.#wetNode.connect(this.#mixerNode);
    
    // Connect mixer to output
    this.#mixerNode.connect(audioCtx.destination);
  }
  
  cleanupEffect() {
    if (this.nodes.effect) {
      try {
        // Disconnect effect nodes
        this.nodes.inputGain.disconnect();
        this.nodes.inputGain.connect(this.nodes.analyzer);
        
        // Clean up effect instance
        if (this.effect && this.effect.cleanup) {
          this.effect.cleanup();
        }
        
        this.effect = null;
        this.nodes.effect = null;
      } catch (error) {
        console.error('Error cleaning up effect:', error);
      }
    }

    if (this.#sourceNode) {
      try {
        if (this.isPlaying) {
          this.#sourceNode.stop();
        }
        this.#sourceNode.disconnect();
        this.#sourceNode = null;
      } catch (e) {
        console.warn('Error stopping source:', e);
      }
    }

    if (this.#gainNode) {
      try {
        this.#gainNode.disconnect();
        this.#gainNode = null;
      } catch (e) {
        console.warn('Error disconnecting gain node:', e);
      }
    }

    if (this.#mixerNode) {
      try {
        this.#mixerNode.disconnect();
        this.#mixerNode = null;
      } catch (e) {
        console.warn('Error disconnecting mixer node:', e);
      }
    }

    if (this.#dryNode) {
      try {
        this.#dryNode.disconnect();
        this.#dryNode = null;
      } catch (e) {
        console.warn('Error disconnecting dry node:', e);
      }
    }

    if (this.#wetNode) {
      try {
        this.#wetNode.disconnect();
        this.#wetNode = null;
      } catch (e) {
        console.warn('Error disconnecting wet node:', e);
      }
    }

    this.effectInstance = null;
  }
  
  async setupEffect(effectName) {
    try {
      console.log(`Setting up effect ${effectName} for ${this.fileName}`);
      
      // Clean up any existing effect first
      this.cleanupEffect();
      
      // Create new effect instance
      this.effectInstance = createEffect(effectName, this.audioEngine.getAudioContext());
      if (!this.effectInstance) {
        throw new Error(`Failed to create effect instance for ${effectName}`);
      }
      
      // Create effect nodes
      const nodes = this.effectInstance.create();
      if (!nodes || !nodes.input || !nodes.output) {
        throw new Error(`Effect ${effectName} did not create required nodes`);
      }
      
      // Store the effect node for later use
      this.effectNode = nodes;
      
      // Create gain nodes for dry/wet mix
      this.dryGain = this.audioEngine.createNode('Gain');
      this.wetGain = this.audioEngine.createNode('Gain');
      this.volumeNode = this.audioEngine.createNode('Gain');

      // Set initial values
      this.dryGain.gain.value = 1.0;  // Start with full dry signal
      this.wetGain.gain.value = 0.0;  // Start with no wet signal
      this.volumeNode.gain.value = 1.0;

      // Set up the effect chain without requiring a source
      this.gainNode = this.audioEngine.createNode('Gain');
      
      // Connect nodes for the effect chain
      this.gainNode.connect(this.dryGain);
      this.gainNode.connect(nodes.input);
      nodes.output.connect(this.wetGain);
      
      // Merge dry and wet paths
      this.dryGain.connect(this.volumeNode);
      this.wetGain.connect(this.volumeNode);
      this.volumeNode.connect(this.audioEngine.getDestination());

      // If there is a current source, connect it
      const currentSource = this.audioEngine.getCurrentSource();
      if (currentSource) {
        currentSource.connect(this.gainNode);
      }

      console.log(`Effect ${effectName} setup complete for ${this.fileName}`, {
        dryGain: this.dryGain.gain.value,
        wetGain: this.wetGain.gain.value,
        effectNodes: nodes,
        sourceConnected: !!currentSource
      });
    } catch (error) {
      console.error(`Error setting up effect ${effectName}:`, error);
      this.cleanupEffect();
      throw error;
    }
  }
  
  // Public method to apply mix with internal validation
  applyMix(mixValue) {
    if (!this.dryGain || !this.wetGain) return;
    
    // Ensure mixValue is between 0 and 1
    mixValue = Math.max(0, Math.min(1, mixValue));
    
    // Set dry and wet gains to create the mix
    // When mixValue is 0, we want full dry signal
    // When mixValue is 1, we want full wet signal
    this.dryGain.gain.value = 1 - mixValue;
    this.wetGain.gain.value = mixValue;
    
    console.log('Mix updated:', {
      mixValue,
      dryGain: this.dryGain.gain.value,
      wetGain: this.wetGain.gain.value
    });
  }
  
  setVolume(volume) {
    if (!this.volumeNode) return;
    this.volumeNode.gain.value = volume;
  }
  
  getDebugInfo() {
    return {
      hasEffectNode: this.effectNode !== null,
      isPlaying: this.isPlaying,
      effectType: this.effectInstance?.constructor.name || 'none',
      audioContextState: this.audioEngine.getState(),
      timestamp: new Date().toISOString()
    };
  }
} 