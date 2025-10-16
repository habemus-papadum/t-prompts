/**
 * Type definitions for the folding/unfolding system
 */

/** Chunk identifier (UUID or regular chunk ID) */
export type ChunkId = string;

/** A collapsed chunk wraps other chunks (both regular and collapsed) */
export interface CollapsedChunk {
  id: ChunkId;
  children: ChunkId[];
  type: 'collapsed';
}

/** Selection within the visible sequence */
export interface Selection {
  start: number; // Index in visible sequence
  end: number; // Index in visible sequence (inclusive)
}

/** Complete state of the folding controller */
export interface FoldingState {
  visibleSequence: ChunkId[]; // Top-level visible chunks
  collapsedChunks: Map<ChunkId, CollapsedChunk>; // All collapsed chunks (by ID)
  selections: Selection[]; // Current selections (can be multiple disjoint ranges)
}

/** Events emitted when folding state changes */
export type FoldingEvent =
  | { type: 'selections-changed'; selections: Selection[] }
  | { type: 'chunks-collapsed'; collapsedIds: ChunkId[]; affectedRanges: Array<[number, number]> }
  | { type: 'chunk-expanded'; expandedId: ChunkId; insertIndex: number }
  | { type: 'state-reset' };

/** Client interface - observers that respond to state changes */
export interface FoldingClient {
  onStateChanged(event: FoldingEvent, state: Readonly<FoldingState>): void;
}
