export default class BleStreamer {
  constructor() {
    this.subscribers = new Set();
    this.isRunning = false;
  }

  start() {
    this.isRunning = false;
  }

  stop() {
    this.isRunning = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getSource() {
    return 'ble-stub';
  }
}
