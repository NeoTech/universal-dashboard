import { computeRects, insertLeaf, removeLeaf, setRatio, swapLeaves, findLeaf } from './tree';
import { serializeTree } from './serialization';
import type { Tree, Rect } from './tree';
import type { WorkerInbound, WorkerOutbound } from './protocol';

export class LayoutEngine {
  private tree: Tree | null = null;
  private viewport: Rect;
  private rects: Record<string, Rect> = {};

  constructor(viewport: { w: number; h: number; x?: number; y?: number }) {
    this.viewport = { x: viewport.x ?? 0, y: viewport.y ?? 0, w: viewport.w, h: viewport.h };
  }

  cmd(command: WorkerInbound): WorkerOutbound {
    switch (command.type) {
      case 'PING':
        return { type: 'PONG' };

      case 'SET_VIEWPORT':
        this.viewport = { x: 0, y: 0, w: command.w, h: command.h };
        this._recompute();
        return { type: 'ACK' };

      case 'SET_TREE':
        this.tree = command.tree;
        this._recompute();
        return { type: 'RECTS', rects: { ...this.rects } };

      case 'GET_RECTS':
        return { type: 'RECTS', rects: { ...this.rects } };

      case 'GET_TREE':
        return {
          type: 'TREE',
          layout: this.tree ? serializeTree(this.tree) : null,
        };

      case 'INSERT_LEAF':
        return this._mutate(() => {
          if (!this.tree) throw new Error('No tree set');
          this.tree = insertLeaf(this.tree, command.targetId, command.dir, command.newId);
        });

      case 'REMOVE_LEAF':
        return this._mutate(() => {
          if (!this.tree) throw new Error('No tree set');
          if (!findLeaf(this.tree, command.id)) throw new Error(`Leaf "${command.id}" not found`);
          this.tree = removeLeaf(this.tree, command.id);
        });

      case 'SET_RATIO':
        return this._mutate(() => {
          if (!this.tree) throw new Error('No tree set');
          this.tree = setRatio(this.tree, command.splitId, command.ratio);
        });

      case 'SWAP_LEAVES':
        return this._mutate(() => {
          if (!this.tree) throw new Error('No tree set');
          this.tree = swapLeaves(this.tree, command.idA, command.idB);
        });

      default: {
        const _exhaustive: never = command;
        return { type: 'ERROR', message: `Unknown command: ${JSON.stringify(_exhaustive)}` };
      }
    }
  }

  private _mutate(fn: () => void): WorkerOutbound {
    try {
      fn();
      this._recompute();
      return { type: 'RECTS', rects: { ...this.rects } };
    } catch (err) {
      return { type: 'ERROR', message: err instanceof Error ? err.message : String(err) };
    }
  }

  private _recompute(): void {
    if (!this.tree) {
      this.rects = {};
      return;
    }
    const map = computeRects(this.tree, this.viewport);
    this.rects = Object.fromEntries(map);
  }
}
