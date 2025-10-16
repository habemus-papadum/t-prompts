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
    const chunkElement = chunks.get(chunk.id);
    if (!chunkElement) continue;

    // Determine element type and apply CSS class
    const elementType = metadata.elementTypeMap[chunk.element_id] || 'unknown';

    // For image chunks, the class is already set on the text span, not the container
    if (chunk.type === 'ImageChunk') {
      // Find the text span inside the container
      const textSpan = chunkElement.querySelector('.tp-chunk-image');
      if (textSpan) {
        // The class is already set, just add location
        const location = metadata.elementLocationMap[chunk.element_id];
        if (location) {
          textSpan.setAttribute('title', location);
        }
      }
    } else {
      // Regular text chunk - set class and title
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
