import demoPackets from '../../../assets/demo-stream.json';

const STREAM_HZ = 10;
const STREAM_INTERVAL_MS = 1000 / STREAM_HZ;

export default class DemoStreamer {
  constructor({ packets = demoPackets } = {}) {
    this.packets = packets;
    this.index = 0;
    this.interval = null;
    this.subscribers = new Set();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emitNext();
    this.interval = setInterval(() => this.emitNext(), STREAM_INTERVAL_MS);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getSource() {
    return 'demo';
  }

  emitNext() {
    if (!this.packets.length) return;
    const sourcePacket = this.packets[this.index % this.packets.length];
    const packet = {
      ...sourcePacket,
      t: Date.now(),
      demoSequenceT: sourcePacket.t,
    };

    this.subscribers.forEach((callback) => callback(packet));
    this.index = (this.index + 1) % this.packets.length;
  }
}
