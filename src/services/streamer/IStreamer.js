/**
 * IStreamer contract for packet sources.
 *
 * Packet shape:
 * {
 *   t: number,              // Unix ms timestamp
 *   posture: number,        // 0..1 posture quality
 *   palate: number[],       // 16-zone palatal pressure in Newtons
 *   clenchEvent: boolean,   // sparse event flag
 *   nasal: boolean          // nasal breathing detected
 * }
 *
 * Concrete streamers must implement:
 * - start(): void
 * - stop(): void
 * - subscribe(callback): () => void
 * - getSource(): string
 */

export default class IStreamer {
  start() {
    throw new Error('IStreamer.start must be implemented');
  }

  stop() {
    throw new Error('IStreamer.stop must be implemented');
  }

  subscribe() {
    throw new Error('IStreamer.subscribe must be implemented');
  }

  getSource() {
    throw new Error('IStreamer.getSource must be implemented');
  }
}
