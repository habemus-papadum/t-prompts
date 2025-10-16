/**
 * Folding module - Code folding/unfolding system
 *
 * Provides a controller for managing code folding state and notifying clients of changes.
 */

export { FoldingController } from './controller';
export type {
  ChunkId,
  CollapsedChunk,
  Selection,
  FoldingState,
  FoldingEvent,
  FoldingClient,
} from './types';
export { generateUUID } from './utils';
