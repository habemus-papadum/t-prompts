/**
 * Diff overlay utilities for the structured prompt widget.
 *
 * These helpers normalize optional diff payloads supplied by the
 * Python backend into lookup tables that the widget views can use to
 * render diff specific affordances (badges, highlights, ghost nodes).
 */

import type {
  DiffStatus,
  NodeDelta,
  StructuredPromptDiffData,
  RenderedPromptDiffData,
  ChunkOp,
} from './diff-types';
import type { WidgetData, ChunkData } from './types';

export interface TextChangeSummary {
  added: number;
  removed: number;
}

export interface DeletedNodeInfo {
  delta: NodeDelta;
  label: string;
}

export interface GhostChunkInfo {
  op: Extract<ChunkOp, 'delete' | 'replace'>;
  text: string;
  elementId: string | null;
}

export interface DiffOverlayModel {
  structured?: StructuredPromptDiffData | null;
  rendered?: RenderedPromptDiffData | null;
  elementStatuses: Map<string, { status: DiffStatus; delta: NodeDelta }>;
  textChanges: Map<string, TextChangeSummary>;
  deletedNodes: DeletedNodeInfo[];
  chunkStatuses: Map<string, ChunkOp>;
  ghostChunks: GhostChunkInfo[];
}

interface ElementChunkIndex {
  elementId: string;
  chunkIds: string[];
}

function buildElementChunkIndex(chunks: ChunkData[] | undefined): Map<string, ElementChunkIndex> {
  const map = new Map<string, ElementChunkIndex>();
  if (!chunks) {
    return map;
  }

  for (const chunk of chunks) {
    const entry = map.get(chunk.element_id);
    if (entry) {
      entry.chunkIds.push(chunk.id);
    } else {
      map.set(chunk.element_id, { elementId: chunk.element_id, chunkIds: [chunk.id] });
    }
  }

  return map;
}

function summarizeTextEdits(delta: NodeDelta): TextChangeSummary {
  let added = 0;
  let removed = 0;

  for (const edit of delta.text_edits) {
    if (edit.op === 'insert') {
      added += edit.after.length;
    } else if (edit.op === 'delete') {
      removed += edit.before.length;
    } else if (edit.op === 'replace') {
      added += edit.after.length;
      removed += edit.before.length;
    }
  }

  return { added, removed };
}

function visitNodeDelta(
  delta: NodeDelta,
  context: {
    elementStatuses: Map<string, { status: DiffStatus; delta: NodeDelta }>;
    textChanges: Map<string, TextChangeSummary>;
    deleted: DeletedNodeInfo[];
  }
): void {
  if (delta.after_id) {
    context.elementStatuses.set(delta.after_id, { status: delta.status, delta });
    if (delta.text_edits.length > 0) {
      context.textChanges.set(delta.after_id, summarizeTextEdits(delta));
    }
  }

  if (delta.status === 'deleted' && delta.before_id) {
    const labelParts: string[] = [];
    labelParts.push(delta.element_type || 'element');
    if (delta.key !== null && delta.key !== undefined) {
      labelParts.push(`“${String(delta.key)}”`);
    }
    context.deleted.push({
      delta,
      label: labelParts.join(' '),
    });
  }

  for (const child of delta.children) {
    visitNodeDelta(child, context);
  }
}

function collectChunkStatuses(
  rendered: RenderedPromptDiffData | null | undefined,
  chunkIndex: Map<string, ElementChunkIndex>
): { chunkStatuses: Map<string, ChunkOp>; ghostChunks: GhostChunkInfo[] } {
  const chunkStatuses = new Map<string, ChunkOp>();
  const ghostChunks: GhostChunkInfo[] = [];

  if (!rendered) {
    return { chunkStatuses, ghostChunks };
  }

  for (const delta of rendered.chunk_deltas) {
    if (delta.after?.element_id) {
      const indexEntry = chunkIndex.get(delta.after.element_id);
      if (indexEntry) {
        for (const chunkId of indexEntry.chunkIds) {
          chunkStatuses.set(chunkId, delta.op);
        }
      }
    }

    const shouldCreateGhost =
      delta.op === 'delete' ||
      (delta.op === 'replace' && (!delta.after || delta.after.element_id !== delta.before?.element_id));

    if (shouldCreateGhost && delta.before?.text) {
      ghostChunks.push({
        op: delta.op,
        text: delta.before.text,
        elementId: delta.before.element_id ?? null,
      });
    }
  }

  return { chunkStatuses, ghostChunks };
}

/**
 * Build a diff overlay model from widget data. Returns null when no diff
 * payloads are provided so that the UI can gracefully fall back to the
 * classic non-diff experience.
 */
export function buildDiffOverlayModel(data: WidgetData): DiffOverlayModel | null {
  const structured = data.structured_diff ?? null;
  const rendered = data.rendered_diff ?? null;

  if (!structured && !rendered) {
    return null;
  }

  const elementStatuses = new Map<string, { status: DiffStatus; delta: NodeDelta }>();
  const textChanges = new Map<string, TextChangeSummary>();
  const deletedNodes: DeletedNodeInfo[] = [];

  if (structured) {
    visitNodeDelta(structured.root, {
      elementStatuses,
      textChanges,
      deleted: deletedNodes,
    });
  }

  const chunkIndex = buildElementChunkIndex(data.ir?.chunks);
  const { chunkStatuses, ghostChunks } = collectChunkStatuses(rendered, chunkIndex);

  return {
    structured,
    rendered,
    elementStatuses,
    textChanges,
    deletedNodes,
    chunkStatuses,
    ghostChunks,
  };
}
