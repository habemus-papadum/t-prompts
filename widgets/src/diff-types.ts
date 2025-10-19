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
  struct_edit_count: number;
  struct_span_chars: number;
  struct_char_ratio: number;
  struct_order_score: number;
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
  chunk_id: string;
}

/**
 * Chunk-level diff entry for rendered prompts
 */
export interface ChunkDelta {
  op: ChunkOp;
  before: ChunkReference | null;
  after: ChunkReference | null;
}

export interface RenderedDiffMetrics {
  render_token_delta: number;
  render_non_ws_delta: number;
  render_ws_delta: number;
  render_chunk_drift: number;
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
  metrics: RenderedDiffMetrics;
}

/**
 * Union type for all diff data
 */
export type DiffData = StructuredPromptDiffData | RenderedPromptDiffData;
