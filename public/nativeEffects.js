import AudioContextManager from './audioContextManager.js';

export class NativeEffect {
  constructor(name, audioCtx) {
    this.name = name;
    this.audioCtx = audioCtx;
    this.nodes = {};
    this.params = {};
  }

  create() {
    throw new Error('create() must be implemented by subclass');
  }

  getParams() {
    return this.params;
  }

  cleanup() {
    // Disconnect all nodes
    Object.values(this.nodes).forEach(node => {
      if (node.disconnect) {
        node.disconnect();
      }
    });
    this.nodes = {};
  }
}

export class DistortionEffect extends NativeEffect {
  constructor(audioCtx) {
    super('distortion', audioCtx);
    this.params = {
      amount: { 
        min: 0, 
        max: 100, 
        default: 50, 
        callback: (value) => this.updateDistortion(value)
      }
    };
  }

  create() {
    const distortion = this.audioCtx.createWaveShaper();
    distortion.oversample = '4x';
    
    this.nodes = {
      input: distortion,
      output: distortion,
      _distortion: distortion
    };
    
    // Initialize with default value after nodes are set up
    this.updateDistortion(this.params.amount.default);
    
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
}

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
      }
    };
  }

  create() {
    const delay = this.audioCtx.createDelay();
    const feedback = this.audioCtx.createGain();
    
    // Initialize nodes with default values
    delay.delayTime.value = this.params.time.default;
    feedback.gain.value = this.params.feedback.default;
    
    // Set up the routing
    delay.connect(feedback);
    feedback.connect(delay);
    
    this.nodes = {
      input: delay,
      output: delay,
      _delay: delay,
      _feedback: feedback
    };
    
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

export class ReverbEffect extends NativeEffect {
  constructor(audioCtx) {
    super('reverb', audioCtx);
    this.params = {
      decay: { 
        min: 0.1, 
        max: 5.0, 
        default: 2.0, 
        callback: (value) => this.updateDecay(value)
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
    
    return this.nodes;
  }

  updateDecay(value) {
    if (!this.nodes) {
      console.warn('Reverb nodes not initialized yet');
      return;
    }

    // Set delay times to different prime numbers to create a more natural reverb
    this.nodes._delay1.delayTime.value = 0.0297;
    this.nodes._delay2.delayTime.value = 0.0371;
    this.nodes._delay3.delayTime.value = 0.0411;
    this.nodes._delay4.delayTime.value = 0.0437;
    
    // Set feedback gains based on decay value
    const feedbackGain = Math.pow(0.001, 1 / value);
    this.nodes._feedback1.gain.value = feedbackGain;
    this.nodes._feedback2.gain.value = feedbackGain;
    this.nodes._feedback3.gain.value = feedbackGain;
    this.nodes._feedback4.gain.value = feedbackGain;
    
    // Set wet/dry mix
    this.nodes._wetGain.gain.value = 0.5;
    this.nodes._dryGain.gain.value = 0.5;
  }
}

export class ConvolverReverbEffect extends NativeEffect {
  constructor(audioCtx) {
    super('convolver-reverb', audioCtx);
    this.params = {
      mix: { 
        min: 0, 
        max: 1, 
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

  create() {
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
    
    // Initialize with default values after nodes are set up
    this.updateMix(this.params.mix.default);
    this.updateDecay(this.params.decay.default);
    
    return this.nodes;
  }

  updateMix(value) {
    if (!this.nodes || !this.nodes._wetGain || !this.nodes._dryGain) {
      console.warn('Reverb nodes not initialized yet');
      return;
    }
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
  }

  updateDecay(value) {
    if (!this.nodes || !this.nodes._convolver) {
      console.warn('Reverb nodes not initialized yet');
      return;
    }

    try {
      const sampleRate = this.audioCtx.sampleRate;
      const length = sampleRate * value;
      const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);
      
      for (let i = 0; i < length; i++) {
        const n = i / length;
        const decay = Math.exp(-n * 3);
        const random = (Math.random() * 2 - 1) * 0.1;
        const earlyReflections = Math.exp(-n * 20) * 0.5;
        
        impulseL[i] = (decay + random + earlyReflections) * (1 - n);
        impulseR[i] = (decay + random + earlyReflections) * (1 - n);
      }
      
      this.nodes._convolver.buffer = impulse;
    } catch (error) {
      console.error('Error updating reverb decay:', error);
    }
  }
}

export class FlangerEffect extends NativeEffect {
  constructor(audioCtx) {
    super('flanger', audioCtx);
    this.params = {
      rate: { 
        min: 0.05, 
        max: 5, 
        default: 0.5, 
        callback: (value) => this.updateRate(value)
      },
      depth: { 
        min: 0.0001, 
        max: 0.01, 
        default: 0.002, 
        callback: (value) => this.updateDepth(value)
      },
      feedback: { 
        min: 0, 
        max: 0.9, 
        default: 0.6, 
        callback: (value) => this.updateFeedback(value)
      },
      intensity: { 
        min: 0, 
        max: 1, 
        default: 0.7, 
        callback: (value) => this.updateIntensity(value)
      }
    };
  }

  create() {
    const delay = this.audioCtx.createDelay();
    const lfo = this.audioCtx.createOscillator();
    const lfoGain = this.audioCtx.createGain();
    const feedback = this.audioCtx.createGain();
    const flangerIntensity = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set initial values
    delay.delayTime.value = 0.005;
    lfo.type = 'sine';
    lfo.frequency.value = this.params.rate.default;
    lfoGain.gain.value = this.params.depth.default;
    feedback.gain.value = this.params.feedback.default;
    flangerIntensity.gain.value = this.params.intensity.default;
    
    // Connect everything
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(flangerIntensity);
    flangerIntensity.connect(output);
    
    // Start LFO
    lfo.start(0);
    
    this.nodes = {
      input: delay,
      output: output,
      _delay: delay,
      _lfo: lfo,
      _feedback: feedback,
      _flangerIntensity: flangerIntensity
    };
    
    return this.nodes;
  }

  updateRate(value) {
    this.nodes._lfo.frequency.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateDepth(value) {
    this.nodes._lfo.frequency.cancelScheduledValues(this.audioCtx.currentTime);
    this.nodes._lfo.frequency.setValueAtTime(this.nodes._lfo.frequency.value, this.audioCtx.currentTime);
    this.nodes._lfo.connect(this.nodes._delay.delayTime);
  }

  updateFeedback(value) {
    this.nodes._feedback.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }

  updateIntensity(value) {
    this.nodes._flangerIntensity.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }
}

export class StereoChorusEffect extends NativeEffect {
  constructor(audioCtx) {
    super('stereo-chorus', audioCtx);
    this.params = {
      rate: { 
        min: 0.05, 
        max: 2, 
        default: 0.33, 
        callback: (value) => this.updateRate(value)
      },
      depth: { 
        min: 0.001, 
        max: 0.02, 
        default: 0.005, 
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
    const delayLeft = this.audioCtx.createDelay();
    const delayRight = this.audioCtx.createDelay();
    const lfoLeft = this.audioCtx.createOscillator();
    const lfoRight = this.audioCtx.createOscillator();
    const lfoGainLeft = this.audioCtx.createGain();
    const lfoGainRight = this.audioCtx.createGain();
    const splitter = this.audioCtx.createChannelSplitter(2);
    const merger = this.audioCtx.createChannelMerger(2);
    const chorusGain = this.audioCtx.createGain();
    const input = this.audioCtx.createGain();
    const output = this.audioCtx.createGain();
    
    // Set initial values
    delayLeft.delayTime.value = 0.025;
    delayRight.delayTime.value = 0.027;
    lfoLeft.type = 'sine';
    lfoRight.type = 'sine';
    lfoLeft.frequency.value = this.params.rate.default;
    lfoRight.frequency.value = this.params.rate.default * 1.15;
    lfoGainLeft.gain.value = this.params.depth.default;
    lfoGainRight.gain.value = this.params.depth.default * 1.2;
    chorusGain.gain.value = this.params.mix.default;
    
    // Connect everything
    lfoLeft.connect(lfoGainLeft);
    lfoRight.connect(lfoGainRight);
    lfoGainLeft.connect(delayLeft.delayTime);
    lfoGainRight.connect(delayRight.delayTime);
    
    input.connect(splitter);
    input.connect(output);
    splitter.connect(delayLeft, 0);
    splitter.connect(delayRight, 1);
    delayLeft.connect(merger, 0, 0);
    delayRight.connect(merger, 0, 1);
    merger.connect(chorusGain);
    chorusGain.connect(output);
    
    // Start LFOs
    lfoLeft.start(0);
    lfoRight.start(0);
    
    this.nodes = {
      input: input,
      output: output,
      _delayLeft: delayLeft,
      _delayRight: delayRight,
      _lfoLeft: lfoLeft,
      _lfoRight: lfoRight,
      _chorusGain: chorusGain
    };
    
    return this.nodes;
  }

  updateRate(value) {
    this.nodes._lfoLeft.frequency.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._lfoRight.frequency.setValueAtTime(value * 1.15, this.audioCtx.currentTime);
  }

  updateDepth(value) {
    const lfoGainLeft = this.nodes._lfoLeft.connect(this.nodes._delayLeft.delayTime);
    const lfoGainRight = this.nodes._lfoRight.connect(this.nodes._delayRight.delayTime);
    if (lfoGainLeft) lfoGainLeft.gain.setValueAtTime(value, this.audioCtx.currentTime);
    if (lfoGainRight) lfoGainRight.gain.setValueAtTime(value * 1.2, this.audioCtx.currentTime);
  }

  updateMix(value) {
    this.nodes._chorusGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
  }
}

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
        min: 0.01, 
        max: 1, 
        default: 0.15, 
        callback: (value) => this.updateFrequency(value)
      }
    };
  }

  create() {
    try {
      const bufferSize = 4096;
      const crusher = this.audioCtx.createScriptProcessor(bufferSize, 2, 2);
      
      // Set default values
      crusher.bits = this.params.bits.default;
      crusher.normFreq = this.params.frequency.default;
      crusher.step = Math.pow(0.5, crusher.bits);
      crusher._lastValues = [0, 0];
      
      // The actual bitcrushing logic
      crusher.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        const step = Math.pow(0.5, crusher.bits);
        const phaseIncr = crusher.normFreq;
        
        for (let i = 0; i < bufferSize; i++) {
          if ((i % Math.floor(1/phaseIncr)) === 0) {
            crusher._lastValues[0] = Math.round(inputL[i] / step) * step;
            crusher._lastValues[1] = Math.round(inputR[i] / step) * step;
          }
          
          outputL[i] = crusher._lastValues[0];
          outputR[i] = crusher._lastValues[1];
        }
      };
      
      this.nodes = {
        input: crusher,
        output: crusher,
        _crusher: crusher
      };
      
      return this.nodes;
    } catch (error) {
      console.error("Failed to create bitcrusher effect:", error);
      // Fallback for Safari - use a simple distortion instead
      const distortion = this.audioCtx.createWaveShaper();
      const curve = new Float32Array(44100);
      for (let i = 0; i < 44100; i++) {
        const x = i * 2 / 44100 - 1;
        curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.5);
      }
      distortion.curve = curve;
      distortion.oversample = '4x';
      
      // Add dummy properties to mimic the bitcrusher
      distortion.bits = this.params.bits.default;
      distortion.normFreq = this.params.frequency.default;
      
      this.nodes = {
        input: distortion,
        output: distortion,
        _crusher: distortion
      };
      
      return this.nodes;
    }
  }

  updateBits(value) {
    this.nodes._crusher.bits = value;
    this.nodes._crusher.step = Math.pow(0.5, value);
  }

  updateFrequency(value) {
    this.nodes._crusher.normFreq = value;
  }
}

export class RingModulatorEffect extends NativeEffect {
  constructor(audioCtx) {
    super('ring-modulator', audioCtx);
    this.params = {
      frequency: { 
        min: 50, 
        max: 5000, 
        default: 440, 
        callback: (value) => this.updateFrequency(value)
      },
      depth: { 
        min: 0, 
        max: 1, 
        default: 1.0, 
        callback: (value) => this.updateDepth(value)
      }
    };
  }

  create() {
    try {
      const osc = this.audioCtx.createOscillator();
      const modulationGain = this.audioCtx.createGain();
      const ringMod = this.audioCtx.createGain();
      const bufferSize = 4096;
      const modulator = this.audioCtx.createScriptProcessor(bufferSize, 2, 2);
      
      // Set initial values
      osc.type = 'sine';
      osc.frequency.value = this.params.frequency.default;
      modulationGain.gain.value = 1.0;
      modulator._ringFreq = this.params.frequency.default;
      modulator._depth = this.params.depth.default;
      
      // Connect oscillator to gain
      osc.connect(modulationGain);
      osc.start(0);
      
      // The ring modulation logic
      modulator.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        for (let i = 0; i < bufferSize; i++) {
          const mod = Math.sin(2 * Math.PI * modulator._ringFreq * i / this.audioCtx.sampleRate);
          const modDepth = modulator._depth;
          const origDepth = 1 - modDepth;
          
          outputL[i] = (inputL[i] * mod * modDepth) + (inputL[i] * origDepth);
          outputR[i] = (inputR[i] * mod * modDepth) + (inputR[i] * origDepth);
        }
      };
      
      this.nodes = {
        input: modulator,
        output: modulator,
        _modulator: modulator
      };
      
      return this.nodes;
    } catch (error) {
      console.error("Failed to create ring-modulator effect:", error);
      // Fallback for Safari - use a simpler approach
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const ringMod = this.audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = this.params.frequency.default;
      gain.gain.value = 0.5;
      
      osc.connect(gain);
      osc.start(0);
      
      this.nodes = {
        input: ringMod,
        output: ringMod,
        _modulator: {
          _ringFreq: this.params.frequency.default,
          _depth: this.params.depth.default
        }
      };
      
      return this.nodes;
    }
  }

  updateFrequency(value) {
    this.nodes._modulator._ringFreq = value;
  }

  updateDepth(value) {
    this.nodes._modulator._depth = value;
  }
}

// Export the effects object
export const nativeEffects = {
  'none': null,
  'distortion': DistortionEffect,
  'delay': DelayEffect,
  'reverb': ReverbEffect,
  'convolver-reverb': ConvolverReverbEffect,
  'flanger': FlangerEffect,
  'stereo-chorus': StereoChorusEffect,
  'bitcrusher': BitcrusherEffect,
  'ring-modulator': RingModulatorEffect
};

// Export a factory function to create effects
export function createEffect(effectName, audioCtx) {
  const EffectClass = nativeEffects[effectName];
  if (!EffectClass) {
    throw new Error(`Unknown effect: ${effectName}`);
  }

  return new EffectClass(audioCtx);
} 