import { NativeEffect } from './NativeEffect.js';

export class ConvolverReverbEffect extends NativeEffect {
  constructor(audioCtx) {
    super('convolver-reverb', audioCtx);
    this.params = {
      mix: { 
        min: 0, 
        max: 1.0, 
        default: 0.5, 
        callback: (value) => this.updateMix(value)
      },
      decay: { 
        min: 0.1, 
        max: 5.0, 
        default: 2.0, 
        callback: (value) => this.updateDecay(value)
      }
    };
  }

  async create() {
    const convolver = this.audioCtx.createConvolver();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(convolver);
    input.connect(dryGain);
    convolver.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _convolver: convolver,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Load impulse response
    try {
      const response = await fetch('/impulse-responses/studio.wav');
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      convolver.buffer = audioBuffer;
    } catch (error) {
      console.error('Error loading impulse response:', error);
    }
    
    // Initialize with default values
    this.updateMix(this.params.mix.default);
    this.updateDecay(this.params.decay.default);
    
    return this.nodes;
  }

  updateMix(value) {
    if (!this.nodes) {
      console.error('Convolver nodes not initialized');
      return;
    }
    
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }

  updateDecay(value) {
    if (!this.nodes || !this.nodes._convolver || !this.nodes._convolver.buffer) {
      console.error('Convolver nodes not initialized');
      return;
    }
    
    // Adjust the wet gain based on decay
    const wetGain = value / 5.0; // Scale from 0.1-5.0 to 0.02-1.0
    this.nodes._wetGain.gain.setValueAtTime(wetGain, this.audioCtx.currentTime);
  }
} 