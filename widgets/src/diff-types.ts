/**
 * Type definitions for Diff widgets
 *
 * These types mirror the Python dataclasses in t_prompts/diff.py
 */

/**
 * Status of a node in a structured prompt diff
 */
export type DiffStatus = 'equal' | 'modified' | 'inserted' | 'deleted' | 'moved';

/**
 * Chunk operation type for rendered prompt diffs
 */
export type ChunkOp = 'equal' | 'insert' | 'delete' | 'replace';

/**
 * Atomic text edit for leaf comparisons
 */
export interface TextEdit {
  op: 'equal' | 'insert' | 'delete' | 'replace';
  before: string;
  after: string;
}

/**
 * Diff result for a single Element node
 */
export interface NodeDelta {
  status: DiffStatus;
  element_type: string;
  key: string | number | null;
  before_id: string | null;
  after_id: string | null;
  before_index: number | null;
  after_index: number | null;
  attr_changes: Record<string, [unknown, unknown]>;
  text_edits: TextEdit[];
  children: NodeDelta[];
}

/**
 * Aggregate statistics for a StructuredPrompt diff
 */
export interface DiffStats {
  nodes_added: number;
  nodes_removed: number;
  nodes_modified: number;
  nodes_moved: number;
  text_added: number;
  text_removed: number;
}

export interface StructuredDiffMetrics {
  edit_count: number;
  span_chars: number;
  char_ratio: number;
  order_score: number;
}

/**
 * Data for StructuredPromptDiff widget
 */
export interface StructuredPromptDiffData {
  diff_type: 'structured';
  root: NodeDelta;
  stats: DiffStats;
  metrics: StructuredDiffMetrics;
}

/**
 * Chunk reference in rendered diff
 */
export interface ChunkReference {
  text: string;
  element_id: string;
}

/**
 * Chunk-level diff entry for rendered prompts
 */
export interface ChunkDelta {
  op: ChunkOp;
  before: ChunkReference | null;
  after: ChunkReference | null;
}

/**
 * Data for RenderedPromptDiff widget
 */
export interface RenderedPromptDiffData {
  diff_type: 'rendered';
  chunk_deltas: ChunkDelta[];
  stats: {
    insert: number;
    delete: number;
    replace: number;
    equal: number;
  };
  metrics: {
    token_delta: number;
    non_ws_delta: number;
    ws_delta: number;
    chunk_drift: number;
  };
}

/**
 * Union type for all diff data
 */
export type DiffData = StructuredPromptDiffData | RenderedPromptDiffData;
