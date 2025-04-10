import { NativeEffect } from './NativeEffect.js';

export class DistortionEffect extends NativeEffect {
  constructor(audioCtx) {
    super('distortion', audioCtx);
    this.params = {
      amount: { 
        min: 0, 
        max: 100, 
        default: 50, 
        callback: (value) => this.updateDistortion(value)
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
    const distortion = this.audioCtx.createWaveShaper();
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    distortion.oversample = '4x';
    
    // Set up the routing
    input.connect(distortion);
    input.connect(dryGain);
    distortion.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _distortion: distortion,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Initialize with default values
    this.updateDistortion(this.params.amount.default);
    this.updateMix(this.params.mix.default);
    
    return this.nodes;
  }

  updateDistortion(value) {
    if (!this.nodes || !this.nodes._distortion) {
      console.warn('Distortion node not initialized yet');
      return;
    }

    const intensity = value / 10; // Scale from 0-100 to 0-10
    const curve = new Float32Array(44100);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < 44100; i++) {
      const x = i * 2 / 44100 - 1;
      curve[i] = (3 + intensity) * x * 20 * deg / (Math.PI + intensity * Math.abs(x));
    }
    
    this.nodes._distortion.curve = curve;
  }

  updateMix(value) {
    if (!this.nodes || !this.nodes._wetGain || !this.nodes._dryGain) {
      console.error('Distortion nodes not initialized');
      return;
    }
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }
} 