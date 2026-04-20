import { NativeEffect } from './NativeEffect.js';

export class DelayEffect extends NativeEffect {
  constructor(audioCtx) {
    super('delay', audioCtx);
    this.params = {
      time: { 
        min: 0, 
        max: 1.0, 
        default: 0.3, 
        callback: (value) => this.updateDelayTime(value)
      },
      feedback: { 
        min: 0, 
        max: 0.9, 
        default: 0.4, 
        callback: (value) => this.updateFeedback(value)
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
    const delay = this.audioCtx.createDelay();
    const feedback = this.audioCtx.createGain();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Initialize nodes with default values
    delay.delayTime.value = this.params.time.default;
    feedback.gain.value = this.params.feedback.default;
    
    // Set up the routing
    input.connect(delay);
    input.connect(dryGain);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _delay: delay,
      _feedback: feedback,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Initialize with default values
    this.updateMix(this.params.mix.default);
    
    return this.nodes;
  }

  updateDelayTime(value) {
    if (!this.nodes || !this.nodes._delay) {
      console.error('Delay nodes not initialized');
      return;
    }
    this.nodes._delay.delayTime.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateFeedback(value) {
    if (!this.nodes || !this.nodes._feedback) {
      console.error('Delay nodes not initialized');
      return;
    }
    this.nodes._feedback.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }
} 