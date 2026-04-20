import { NativeEffect } from './NativeEffect.js';

export class BitcrusherEffect extends NativeEffect {
  constructor(audioCtx) {
    super('bitcrusher', audioCtx);
    this.params = {
      bits: { 
        min: 1, 
        max: 16, 
        default: 8, 
        callback: (value) => this.updateBits(value)
      },
      frequency: { 
        min: 0, 
        max: 1, 
        default: 0.5, 
        callback: (value) => this.updateFrequency(value)
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
    const scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    const wetGain = this.audioCtx.createGain();
    const dryGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set up the routing
    input.connect(scriptNode);
    input.connect(dryGain);
    scriptNode.connect(wetGain);
    wetGain.connect(output);
    dryGain.connect(output);
    
    this.nodes = {
      input: input,
      output: output,
      _scriptNode: scriptNode,
      _wetGain: wetGain,
      _dryGain: dryGain
    };
    
    // Initialize with default values
    this.updateBits(this.params.bits.default);
    this.updateFrequency(this.params.frequency.default);
    this.updateMix(this.params.mix.default);
    
    // Set up the bitcrusher processing
    scriptNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      
      for (let i = 0; i < input.length; i++) {
        // Apply bit reduction
        const step = Math.pow(2, this.bits);
        const val = Math.floor(input[i] * step) / step;
        
        // Apply sample rate reduction
        if (i % Math.floor(1 / this.frequency) === 0) {
          this.lastSample = val;
        }
        output[i] = this.lastSample;
      }
    };
    
    return this.nodes;
  }

  updateBits(value) {
    this.bits = value;
  }

  updateFrequency(value) {
    this.frequency = value;
  }
} 