/**
 * Typing Transform
 *
 * Adds type-based CSS classes to chunks and source location tooltips.
 * This enables semantic coloring and provides developer metadata on hover.
 */

import type { TransformState } from './base';

/**
 * Add type classes and location tooltips to all chunks
 */
export function applyTransform_AddTyping(state: TransformState): TransformState {
  const { chunks, data, metadata } = state;

  if (!data.ir?.chunks) {
    return state;
  }

  for (const chunk of data.ir.chunks) {
    const elements = chunks.get(chunk.id);
    if (!elements) continue;

    // Apply typing to all elements for this chunk
    for (const chunkElement of elements) {
      // Determine element type and apply CSS class
      const elementType = metadata.elementTypeMap[chunk.element_id] || 'unknown';
      chunkElement.className = `tp-chunk-${elementType}`;

      // Add source location as title (hover tooltip) if available
      const location = metadata.elementLocationMap[chunk.element_id];
      if (location) {
        chunkElement.title = location;
      }
    }
  }

  return state;
}
