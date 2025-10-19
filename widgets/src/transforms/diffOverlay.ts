/**
 * Diff Overlay Transform
 *
 * Adds diff information to chunks based on rendered diff data.
 * Marks chunks as added, deleted, or replaced for visual styling.
 */

import type { TransformState } from './base';
import type { ChunkDelta } from '../diff-types';

/**
 * Apply diff overlay styling to chunks
 */
export function applyTransform_DiffOverlay(state: TransformState): TransformState {
  const { chunks, data } = state;

  // Only apply if we have rendered diff data
  if (!data.rendered_diff || data.rendered_diff.diff_type !== 'rendered') {
    return state;
  }

  const renderedDiff = data.rendered_diff;
  const chunkDeltas = renderedDiff.chunk_deltas;

  // Build a map from chunk text to delta operation for "after" chunks
  const afterChunkMap = new Map<string, ChunkDelta>();

  for (const delta of chunkDeltas) {
    if (delta.after) {
      // Map by element_id for more reliable matching
      const key = `${delta.after.element_id}:${delta.after.text}`;
      afterChunkMap.set(key, delta);
    }
  }

  // Now go through our actual chunks and mark them with diff info
  for (const [chunkId, elements] of chunks.entries()) {
    // Find the chunk data to get element_id and text
    const chunkData = data.ir?.chunks.find(c => c.id === chunkId);
    if (!chunkData || chunkData.type !== 'TextChunk' || !chunkData.text) {
      continue;
    }

    const key = `${chunkData.element_id}:${chunkData.text}`;
    const delta = afterChunkMap.get(key);

    if (delta) {
      // Apply diff marking to all elements for this chunk
      for (const element of elements) {
        element.setAttribute('data-diff-op', delta.op);

        // Add CSS class for styling
        if (delta.op === 'insert') {
          element.classList.add('tp-diff-insert');
        } else if (delta.op === 'delete') {
          element.classList.add('tp-diff-delete');
        } else if (delta.op === 'replace') {
          element.classList.add('tp-diff-replace');
        }
      }
    }
  }

  return state;
}
