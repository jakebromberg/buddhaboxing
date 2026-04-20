import { NativeEffect } from './NativeEffect.js';

export class StereoChorusEffect extends NativeEffect {
  constructor(audioCtx) {
    super('stereo-chorus', audioCtx);
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
      mix: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateMix(value)
      }
    };
  }

  create() {
    const delayL = this.audioCtx.createDelay();
    const delayR = this.audioCtx.createDelay();
    const wetGainL = this.audioCtx.createGain();
    const wetGainR = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    const lfoL = this.audioCtx.createOscillator();
    const lfoR = this.audioCtx.createOscillator();
    const lfoGainL = this.audioCtx.createGain();
    const lfoGainR = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(delayL);
    input.connect(delayR);
    input.connect(dryGain);
    delayL.connect(wetGainL);
    delayR.connect(wetGainR);
    wetGainL.connect(output);
    wetGainR.connect(output);
    dryGain.connect(output);
    
    // Set up LFOs
    lfoL.connect(lfoGainL);
    lfoR.connect(lfoGainR);
    lfoGainL.connect(delayL.delayTime);
    lfoGainR.connect(delayR.delayTime);
    
    // Set LFO phases 180 degrees apart for stereo effect
    lfoR.phase = Math.PI;
    
    this.nodes = {
      input: input,
      output: output,
      _delayL: delayL,
      _delayR: delayR,
      _wetGainL: wetGainL,
      _wetGainR: wetGainR,
      _dryGain: dryGain,
      _lfoL: lfoL,
      _lfoR: lfoR,
      _lfoGainL: lfoGainL,
      _lfoGainR: lfoGainR
    };
    
    // Initialize with default values
    this.updateRate(this.params.rate.default);
    this.updateDepth(this.params.depth.default);
    this.updateMix(this.params.mix.default);
    
    // Start LFOs
    lfoL.start();
    lfoR.start();
    
    return this.nodes;
  }

  updateRate(value) {
    if (!this.nodes || !this.nodes._lfoL || !this.nodes._lfoR) {
      console.error('StereoChorus nodes not initialized');
      return;
    }
    this.nodes._lfoL.frequency.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._lfoR.frequency.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateDepth(value) {
    if (!this.nodes || !this.nodes._lfoGainL || !this.nodes._lfoGainR) {
      console.error('StereoChorus nodes not initialized');
      return;
    }
    this.nodes._lfoGainL.gain.setValueAtTime(value * 0.01, this.audioCtx.currentTime);
    this.nodes._lfoGainR.gain.setValueAtTime(value * 0.01, this.audioCtx.currentTime);
  }

  updateMix(value) {
    if (!this.nodes || !this.nodes._wetGainL || !this.nodes._wetGainR || !this.nodes._dryGain) {
      console.error('StereoChorus nodes not initialized');
      return;
    }
    this.nodes._wetGainL.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._wetGainR.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }
} 