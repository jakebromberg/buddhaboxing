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

  updateMix(value) {
    if (!this.nodes?._wetGain || !this.nodes?._dryGain) {
      console.error(`${this.name} nodes not initialized`);
      return;
    }
    this.nodes._wetGain.gain.setValueAtTime(value, this.audioCtx.currentTime);
    this.nodes._dryGain.gain.setValueAtTime(1 - value, this.audioCtx.currentTime);
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