import { LayoutEngine } from './engine';
import type { WorkerInbound } from './protocol';

const engine = new LayoutEngine({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const result = engine.cmd(event.data);
  self.postMessage(result);
};
