import type { WidgetData, IRData, PromptData } from '../types';
import type {
  StructuredPromptDiffData,
  NodeDelta,
  DiffStats,
  StructuredDiffMetrics,
  RenderedPromptDiffData,
} from '../diff-types';

export interface GhostNode {
  id: string | null;
  key: string;
  elementType: string;
  node: NodeDelta;
  children: GhostNode[];
}

export interface StructuredTreeOverlay {
  stats: DiffStats;
  metrics: StructuredDiffMetrics;
  nodeByAfterId: Map<string, NodeDelta>;
  removed: GhostNode[];
}

export interface ChunkDiffInfo {
  op: RenderedPromptDiffData['chunk_deltas'][number]['op'];
  elementId?: string;
  afterChunkId?: string | null;
  beforeChunkId?: string | null;
  afterText?: string;
  beforeText?: string;
}

export interface RenderedChunkOverlay {
  chunkMap: Map<string, ChunkDiffInfo>;
  ghostChunks: ChunkDiffInfo[];
}

export interface DiffContext {
  structured?: StructuredTreeOverlay;
  rendered?: RenderedChunkOverlay;
  priorIR?: IRData;
  priorPrompt?: PromptData;
  enabledByDefault: boolean;
}

export function buildDiffContext(data: WidgetData): DiffContext | null {
  const structured = data.structured_diff ? buildStructuredOverlay(data.structured_diff) : undefined;
  const rendered = data.rendered_diff ? buildRenderedOverlay(data, data.rendered_diff) : undefined;
  const priorIR = data.prior_prompt_ir;
  const priorPrompt = data.prior_prompt;

  if (!structured && !rendered && !priorIR && !priorPrompt) {
    return null;
  }

  return {
    structured,
    rendered,
    priorIR,
    priorPrompt,
    enabledByDefault: Boolean(structured || rendered),
  };
}

function buildStructuredOverlay(diff: StructuredPromptDiffData): StructuredTreeOverlay {
  const nodeByAfterId = new Map<string, NodeDelta>();
  const removed: GhostNode[] = [];

  const visit = (node: NodeDelta): void => {
    if (node.after_id) {
      nodeByAfterId.set(node.after_id, node);
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  const collectRemoved = (node: NodeDelta, bucket: GhostNode[]): void => {
    for (const child of node.children) {
      if (child.status === 'deleted') {
        bucket.push(buildGhostNode(child));
      } else {
        collectRemoved(child, bucket);
      }
    }
  };

  const buildGhostNode = (node: NodeDelta): GhostNode => ({
    id: node.before_id ?? null,
    key: node.key === null ? '' : String(node.key),
    elementType: node.element_type,
    node,
    children: node.children
      .filter((child) => child.status === 'deleted')
      .map((child) => buildGhostNode(child)),
  });

  visit(diff.root);
  collectRemoved(diff.root, removed);

  return {
    stats: diff.stats,
    metrics: diff.metrics,
    nodeByAfterId,
    removed,
  };
}

function buildRenderedOverlay(data: WidgetData, diff: RenderedPromptDiffData): RenderedChunkOverlay {
  const chunkMap = new Map<string, ChunkDiffInfo>();
  const ghostChunks: ChunkDiffInfo[] = [];

  const afterChunks = new Map<string, string>();
  data.ir?.chunks?.forEach((chunk) => {
    if (chunk.text !== undefined) {
      afterChunks.set(chunk.id, chunk.text);
    }
  });

  const beforeChunks = new Map<string, string>();
  data.prior_prompt_ir?.chunks?.forEach((chunk) => {
    if (chunk.text !== undefined) {
      beforeChunks.set(chunk.id, chunk.text);
    }
  });

  for (const delta of diff.chunk_deltas) {
    const info: ChunkDiffInfo = {
      op: delta.op,
      elementId: delta.after?.element_id ?? delta.before?.element_id ?? undefined,
      afterChunkId: delta.after?.chunk_id ?? null,
      beforeChunkId: delta.before?.chunk_id ?? null,
      afterText: delta.after?.chunk_id ? afterChunks.get(delta.after.chunk_id) ?? delta.after.text : delta.after?.text,
      beforeText: delta.before?.chunk_id ? beforeChunks.get(delta.before.chunk_id) ?? delta.before.text : delta.before?.text,
    };

    if (info.afterChunkId) {
      chunkMap.set(info.afterChunkId, info);
    }

    if (info.beforeChunkId && (delta.op === 'delete' || delta.op === 'replace')) {
      ghostChunks.push({
        op: delta.op,
        elementId: info.elementId,
        beforeChunkId: info.beforeChunkId,
        beforeText: info.beforeText,
        afterText: info.afterText,
      });
    }

    if (!info.afterChunkId && info.beforeChunkId && delta.op === 'delete') {
      // Pure deletions still need to be surfaced
      chunkMap.set(info.beforeChunkId, info);
    }
  }

  return { chunkMap, ghostChunks };
}
