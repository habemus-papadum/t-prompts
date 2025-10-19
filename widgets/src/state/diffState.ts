import type {
  ChunkDelta,
  DiffStats,
  NodeDelta,
  RenderedDiffMetrics,
  RenderedPromptDiffData,
  StructuredDiffMetrics,
  StructuredPromptDiffData,
} from '../diff-types';

export interface RenderedChunkAnnotation {
  chunkId: string;
  op: 'insert' | 'replace';
  beforeText?: string;
  beforeElementId?: string | null;
}

export interface RenderedGhostChunk {
  chunkId: string;
  text: string;
  elementId: string | null;
  anchorAfterId: string | null;
  op: 'delete' | 'replace';
}

export interface StructuredDiffSnapshot {
  stats: DiffStats;
  metrics: StructuredDiffMetrics;
  statusByElementId: Map<string, NodeDelta>;
  removedNodes: NodeDelta[];
}

export interface RenderedDiffSnapshot {
  stats: RenderedPromptDiffData['stats'];
  metrics: RenderedDiffMetrics;
  chunkAnnotations: Map<string, RenderedChunkAnnotation>;
  deletedChunks: RenderedGhostChunk[];
}

export interface DiffStateSnapshot {
  available: boolean;
  enabled: boolean;
  structured?: StructuredDiffSnapshot;
  rendered?: RenderedDiffSnapshot;
}

type DiffStateListener = (snapshot: DiffStateSnapshot) => void;

function collectStructuredSnapshot(
  diff: StructuredPromptDiffData | null | undefined
): StructuredDiffSnapshot | undefined {
  if (!diff) {
    return undefined;
  }

  const statusByElementId = new Map<string, NodeDelta>();
  const removedNodes: NodeDelta[] = [];

  const stack: NodeDelta[] = [diff.root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (node.after_id) {
      statusByElementId.set(node.after_id, node);
    }

    if (node.status === 'deleted' && node.before_id) {
      removedNodes.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }

  return {
    stats: diff.stats,
    metrics: diff.metrics,
    statusByElementId,
    removedNodes,
  };
}

function nextAfterChunkId(deltas: ChunkDelta[], startIndex: number): string | null {
  for (let index = startIndex; index < deltas.length; index += 1) {
    const afterChunk = deltas[index].after?.chunk_id;
    if (afterChunk) {
      return afterChunk;
    }
  }
  return null;
}

function collectRenderedSnapshot(
  diff: RenderedPromptDiffData | null | undefined
): RenderedDiffSnapshot | undefined {
  if (!diff) {
    return undefined;
  }

  const chunkAnnotations = new Map<string, RenderedChunkAnnotation>();
  const deletedChunks: RenderedGhostChunk[] = [];
  const deltas = diff.chunk_deltas ?? [];

  for (let index = 0; index < deltas.length; index += 1) {
    const delta = deltas[index];
    switch (delta.op) {
      case 'equal':
        break;
      case 'insert': {
        const chunkId = delta.after?.chunk_id;
        if (chunkId) {
          chunkAnnotations.set(chunkId, {
            chunkId,
            op: 'insert',
            beforeElementId: delta.after?.element_id ?? null,
          });
        }
        break;
      }
      case 'replace': {
        const chunkId = delta.after?.chunk_id;
        if (chunkId) {
          chunkAnnotations.set(chunkId, {
            chunkId,
            op: 'replace',
            beforeText: delta.before?.text ?? '',
            beforeElementId: delta.before?.element_id ?? null,
          });
        }

        if (delta.before?.chunk_id) {
          deletedChunks.push({
            chunkId: delta.before.chunk_id,
            text: delta.before.text,
            elementId: delta.before.element_id ?? null,
            anchorAfterId: chunkId ?? nextAfterChunkId(deltas, index + 1),
            op: 'replace',
          });
        }
        break;
      }
      case 'delete': {
        if (delta.before?.chunk_id) {
          deletedChunks.push({
            chunkId: delta.before.chunk_id,
            text: delta.before.text,
            elementId: delta.before.element_id ?? null,
            anchorAfterId: nextAfterChunkId(deltas, index + 1),
            op: 'delete',
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    stats: diff.stats,
    metrics: diff.metrics,
    chunkAnnotations,
    deletedChunks,
  };
}

export class DiffState {
  private snapshot: DiffStateSnapshot;

  private listeners: Set<DiffStateListener> = new Set();

  constructor(options: {
    structured?: StructuredPromptDiffData | null;
    rendered?: RenderedPromptDiffData | null;
  }) {
    const structuredSnapshot = collectStructuredSnapshot(options.structured);
    const renderedSnapshot = collectRenderedSnapshot(options.rendered);
    const available = Boolean(structuredSnapshot || renderedSnapshot);

    this.snapshot = {
      available,
      enabled: available,
      structured: structuredSnapshot,
      rendered: renderedSnapshot,
    };
  }

  getSnapshot(): DiffStateSnapshot {
    return this.snapshot;
  }

  isAvailable(): boolean {
    return this.snapshot.available;
  }

  isEnabled(): boolean {
    return this.snapshot.available && this.snapshot.enabled;
  }

  setEnabled(value: boolean): void {
    const nextValue = Boolean(value && this.snapshot.available);
    if (this.snapshot.enabled === nextValue) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      enabled: nextValue,
    };
    this.notify();
  }

  toggle(): void {
    this.setEnabled(!this.snapshot.enabled);
  }

  subscribe(listener: DiffStateListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}
