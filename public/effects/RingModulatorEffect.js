import { NativeEffect } from './NativeEffect.js';

export class RingModulatorEffect extends NativeEffect {
  constructor(audioCtx) {
    super('ring-modulator', audioCtx);
    this.params = {
      frequency: { 
        min: 0, 
        max: 2000, 
        default: 440, 
        callback: (value) => this.updateFrequency(value)
      },
      depth: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateDepth(value)
      },
      mix: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateMix(value)
      }
    };
  }

  create() {
    const oscillator = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const multiplier = this.audioCtx.createGain();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(multiplier);
    input.connect(dryGain);
    oscillator.connect(gain);
    gain.connect(multiplier.gain);
    multiplier.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _oscillator: oscillator,
      _gain: gain,
      _multiplier: multiplier,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Initialize with default values
    this.updateFrequency(this.params.frequency.default);
    this.updateDepth(this.params.depth.default);
    this.updateMix(this.params.mix.default);
    
    // Start oscillator
    oscillator.start();
    
    return this.nodes;
  }

  updateFrequency(value) {
    if (!this.nodes || !this.nodes._oscillator) {
      console.error('RingModulator nodes not initialized');
      return;
    }
    this.nodes._oscillator.frequency.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateDepth(value) {
    if (!this.nodes || !this.nodes._gain) {
      console.error('RingModulator nodes not initialized');
      return;
    }
    this.nodes._gain.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }
} 