import { NativeEffect } from './NativeEffect.js';

export class FlangerEffect extends NativeEffect {
  constructor(audioCtx) {
    super('flanger', audioCtx);
    this.params = {
      rate: { 
        min: 0.1, 
        max: 20, 
        default: 1, 
        callback: (value) => this.updateRate(value)
      },
      depth: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateDepth(value)
      },
      feedback: { 
        min: 0, 
        max: 0.95, 
        default: 0.5, 
        callback: (value) => this.updateFeedback(value)
      },
      intensity: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateIntensity(value)
      }
    };
  }

  create() {
    const delay = this.audioCtx.createDelay();
    const feedback = this.audioCtx.createGain();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    const lfo = this.audioCtx.createOscillator();
    const lfoGain = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(delay);
    input.connect(dryGain);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    // Set up LFO
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    
    this.nodes = {
      input: input,
      output: output,
      _delay: delay,
      _feedback: feedback,
      _wetGain: wetGain,
      _dryGain: dryGain,
      _lfo: lfo,
      _lfoGain: lfoGain
    };
    
    // Initialize with default values
    this.updateRate(this.params.rate.default);
    this.updateDepth(this.params.depth.default);
    this.updateFeedback(this.params.feedback.default);
    this.updateIntensity(this.params.intensity.default);
    
    // Start LFO
    lfo.start();
    
    return this.nodes;
  }

  updateRate(value) {
    if (!this.nodes || !this.nodes._lfo) {
      console.error('Flanger nodes not initialized');
      return;
    }
    this.nodes._lfo.frequency.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateDepth(value) {
    if (!this.nodes || !this.nodes._lfoGain) {
      console.error('Flanger nodes not initialized');
      return;
    }
    this.nodes._lfoGain.gain.setValueAtTime(value * 0.01, this.audioCtx.currentTime);
  }

  updateFeedback(value) {
    if (!this.nodes || !this.nodes._feedback) {
      console.error('Flanger nodes not initialized');
      return;
    }
    this.nodes._feedback.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateIntensity(value) {
    if (!this.nodes || !this.nodes._wetGain || !this.nodes._dryGain) {
      console.error('Flanger nodes not initialized');
      return;
    }
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }
} 