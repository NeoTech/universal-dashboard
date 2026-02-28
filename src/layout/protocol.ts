import type { Tree, Rect, Direction } from './tree';
import type { SerializedLayout } from './serialization';

// ── Messages sent TO the worker ───────────────────────────────────────────────

export interface SetTreeCmd {
  type: 'SET_TREE';
  tree: Tree;
}

export interface SetViewportCmd {
  type: 'SET_VIEWPORT';
  w: number;
  h: number;
}

export interface GetRectsCmd {
  type: 'GET_RECTS';
}

export interface GetTreeCmd {
  type: 'GET_TREE';
}

export interface InsertLeafCmd {
  type: 'INSERT_LEAF';
  targetId: string;
  dir: Direction;
  newId?: string;
}

export interface RemoveLeafCmd {
  type: 'REMOVE_LEAF';
  id: string;
}

export interface SetRatioCmd {
  type: 'SET_RATIO';
  splitId: string;
  ratio: number;
}

export interface SwapLeavesCmd {
  type: 'SWAP_LEAVES';
  idA: string;
  idB: string;
}

export interface PingCmd {
  type: 'PING';
}

export type WorkerInbound =
  | SetTreeCmd
  | SetViewportCmd
  | GetRectsCmd
  | GetTreeCmd
  | InsertLeafCmd
  | RemoveLeafCmd
  | SetRatioCmd
  | SwapLeavesCmd
  | PingCmd;

// ── Messages sent FROM the worker ─────────────────────────────────────────────

export interface RectsMsg {
  type: 'RECTS';
  rects: Record<string, Rect>;
}

export interface TreeMsg {
  type: 'TREE';
  layout: SerializedLayout | null;
}

export interface AckMsg {
  type: 'ACK';
}

export interface PongMsg {
  type: 'PONG';
}

export interface ErrorMsg {
  type: 'ERROR';
  message: string;
}

export type WorkerOutbound = RectsMsg | TreeMsg | AckMsg | PongMsg | ErrorMsg;
