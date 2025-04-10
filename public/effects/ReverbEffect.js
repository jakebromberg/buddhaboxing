import { NativeEffect } from './NativeEffect.js';

export class ReverbEffect extends NativeEffect {
  constructor(audioCtx) {
    super('reverb', audioCtx);
    this.params = {
      decay: { 
        min: 0.1, 
        max: 5.0, 
        default: 2.0, 
        callback: (value) => this.updateDecay(value)
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
    const delay1 = this.audioCtx.createDelay();
    const delay2 = this.audioCtx.createDelay();
    const delay3 = this.audioCtx.createDelay();
    const delay4 = this.audioCtx.createDelay();
    const feedback1 = this.audioCtx.createGain();
    const feedback2 = this.audioCtx.createGain();
    const feedback3 = this.audioCtx.createGain();
    const feedback4 = this.audioCtx.createGain();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(delay1);
    input.connect(delay2);
    input.connect(delay3);
    input.connect(delay4);
    input.connect(dryGain);
    
    delay1.connect(feedback1);
    delay2.connect(feedback2);
    delay3.connect(feedback3);
    delay4.connect(feedback4);
    
    feedback1.connect(delay1);
    feedback2.connect(delay2);
    feedback3.connect(delay3);
    feedback4.connect(delay4);
    
    delay1.connect(wetGain);
    delay2.connect(wetGain);
    delay3.connect(wetGain);
    delay4.connect(wetGain);
    
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _delay1: delay1,
      _delay2: delay2,
      _delay3: delay3,
      _delay4: delay4,
      _feedback1: feedback1,
      _feedback2: feedback2,
      _feedback3: feedback3,
      _feedback4: feedback4,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Initialize with default values
    this.updateDecay(this.params.decay.default);
    this.updateMix(this.params.mix.default);
    
    return this.nodes;
  }

  updateDecay(value) {
    if (!this.nodes) {
      console.error('Reverb nodes not initialized');
      return;
    }
    
    const feedbackGain = value / 5.0; // Scale from 0.1-5.0 to 0.02-1.0
    
    this.nodes._feedback1.gain.setValueAtTime(feedbackGain, this.audioCtx.currentTime);
    this.nodes._feedback2.gain.setValueAtTime(feedbackGain, this.audioCtx.currentTime);
    this.nodes._feedback3.gain.setValueAtTime(feedbackGain, this.audioCtx.currentTime);
    this.nodes._feedback4.gain.setValueAtTime(feedbackGain, this.audioCtx.currentTime);
    
    // Set different delay times for a more natural reverb
    this.nodes._delay1.delayTime.setValueAtTime(0.0297, this.audioCtx.currentTime);
    this.nodes._delay2.delayTime.setValueAtTime(0.0371, this.audioCtx.currentTime);
    this.nodes._delay3.delayTime.setValueAtTime(0.0411, this.audioCtx.currentTime);
    this.nodes._delay4.delayTime.setValueAtTime(0.0437, this.audioCtx.currentTime);
  }

  updateMix(value) {
    if (!this.nodes || !this.nodes._wetGain || !this.nodes._dryGain) {
      console.error('Reverb nodes not initialized');
      return;
    }
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }
} 