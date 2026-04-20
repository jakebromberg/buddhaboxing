class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'bits',
        defaultValue: 8,
        minValue: 1,
        maxValue: 16
      },
      {
        name: 'frequency',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1
      }
    ];
  }

  constructor() {
    super();
    this.lastSample = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const bits = parameters.bits[0];
    const frequency = parameters.frequency[0];

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        // Apply bit reduction
        const step = Math.pow(2, bits);
        const val = Math.floor(inputChannel[i] * step) / step;
        
        // Apply sample rate reduction
        if (i % Math.floor(1 / frequency) === 0) {
          this.lastSample = val;
        }
        outputChannel[i] = this.lastSample;
      }
    }

    return true;
  }
}

registerProcessor('bitcrusher-processor', BitcrusherProcessor); 