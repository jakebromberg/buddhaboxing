import { NativeEffect } from './NativeEffect.js';
import { DistortionEffect } from './DistortionEffect.js';
import { DelayEffect } from './DelayEffect.js';
import { ReverbEffect } from './ReverbEffect.js';
import { ConvolverReverbEffect } from './ConvolverReverbEffect.js';
import { FlangerEffect } from './FlangerEffect.js';
import { StereoChorusEffect } from './StereoChorusEffect.js';
import { BitcrusherEffect } from './BitcrusherEffect.js';
import { RingModulatorEffect } from './RingModulatorEffect.js';

export function createEffect(effectName, audioCtx) {
  const effectClasses = {
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

  const EffectClass = effectClasses[effectName];
  if (!EffectClass) {
    console.error(`Unknown effect type: ${effectName}`);
    return null;
  }

  return new EffectClass(audioCtx);
}

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