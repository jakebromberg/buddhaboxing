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