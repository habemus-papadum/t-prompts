/**
 * Boundaries Transform
 *
 * Marks first and last chunks of each element with boundary classes.
 * This enables visual boundary indicators (colored bars) in the CSS.
 */

import type { TransformState } from './base';

/**
 * Mark first and last chunks for each element
 */
export function applyTransform_MarkBoundaries(state: TransformState): TransformState {
  const { chunks, data, metadata } = state;

  if (!data.compiled_ir?.subtree_map) {
    return state;
  }

  // Iterate through each element and its chunks
  for (const [elementId, chunkIds] of Object.entries(data.compiled_ir.subtree_map)) {
    if (chunkIds.length === 0) {
      continue;
    }

    // Get element type for this element
    const elementType = metadata.elementTypeMap[elementId] || 'unknown';

    // Mark first chunk - get all elements for this chunk
    const firstChunkId = chunkIds[0];
    const firstElements = chunks.get(firstChunkId);
    if (firstElements) {
      for (const el of firstElements) {
        el.classList.add(`tp-first-${elementType}`);
      }
    }

    // Mark last chunk
    const lastChunkId = chunkIds[chunkIds.length - 1];
    const lastElements = chunks.get(lastChunkId);
    if (lastElements) {
      for (const el of lastElements) {
        el.classList.add(`tp-last-${elementType}`);
      }
    }
  }

  return state;
}
