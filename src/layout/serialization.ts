import { makeLeaf, makeSplit } from './tree';
import type { Tree } from './tree';

export const LAYOUT_VERSION = 1;

// ── Serialized shape ──────────────────────────────────────────────────────────

/** Plain-object form of a Tree node — safe for JSON.stringify */
export type SerializedNode =
  | { kind: 'leaf'; id: string }
  | {
      kind: 'split';
      id: string;
      dir: 'h' | 'v';
      ratio: number;
      first: SerializedNode;
      second: SerializedNode;
    };

export interface SerializedLayout {
  version: number;
  tree: SerializedNode;
}

// ── Serialize ─────────────────────────────────────────────────────────────────

function serializeNode(tree: Tree): SerializedNode {
  if (tree.kind === 'leaf') {
    return { kind: 'leaf', id: tree.id };
  }
  return {
    kind: 'split',
    id: tree.id,
    dir: tree.dir,
    ratio: tree.ratio,
    first: serializeNode(tree.first),
    second: serializeNode(tree.second),
  };
}

export function serializeTree(tree: Tree): SerializedLayout {
  return { version: LAYOUT_VERSION, tree: serializeNode(tree) };
}

// ── Deserialize ───────────────────────────────────────────────────────────────

function deserializeNode(raw: unknown): Tree {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError('Tree node must be a non-null object');
  }
  const node = raw as Record<string, unknown>;

  if (node['kind'] === 'leaf') {
    if (typeof node['id'] !== 'string') throw new TypeError('Leaf node must have a string id');
    return makeLeaf(node['id'] as string);
  }

  if (node['kind'] === 'split') {
    if (node['dir'] !== 'h' && node['dir'] !== 'v') {
      throw new TypeError(`Split dir must be "h" or "v", got "${node['dir']}"`);
    }
    if (typeof node['ratio'] !== 'number') {
      throw new TypeError('Split ratio must be a number');
    }
    const first = deserializeNode(node['first']);
    const second = deserializeNode(node['second']);
    return makeSplit(
      node['dir'] as 'h' | 'v',
      node['ratio'] as number,
      first,
      second,
      node['id'] as string,
    );
  }

  throw new TypeError(`Unknown node kind: "${node['kind']}"`);
}

export function deserializeTree(data: unknown): Tree {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Layout data must be a non-null object');
  }
  const layout = data as Record<string, unknown>;

  if (!('version' in layout)) {
    throw new Error('Layout data missing required "version" field');
  }
  if (layout['version'] !== LAYOUT_VERSION) {
    throw new Error(
      `Unsupported layout version: ${layout['version']} (expected ${LAYOUT_VERSION})`,
    );
  }

  return deserializeNode(layout['tree']);
}
