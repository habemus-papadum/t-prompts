/**
 * Create Chunks Transform
 *
 * Creates initial <span> elements for each chunk and adds them to the DOM.
 * This is the first transform in the pipeline - it builds the raw structure.
 */

import type { TransformState } from './base';
import { addToChunksMap } from './base';

/**
 * Create initial DOM elements for all chunks
 */
export function applyTransform_CreateChunks(state: TransformState): TransformState {
  const { element, chunks, data } = state;

  if (!data.ir?.chunks) {
    return state;
  }

  // Process each chunk
  for (const chunk of data.ir.chunks) {
    let chunkElement: HTMLElement;

    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      // Text chunk - simple span with text content
      const span = document.createElement('span');
      span.setAttribute('data-chunk-id', chunk.id);
      span.textContent = chunk.text;
      chunkElement = span;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunk - simple span with text placeholder
      // (Hover preview can be added via future transform)
      const imgData = chunk.image;
      const format = imgData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imgData.base64_data}`;
      const chunkText = `![${format} ${imgData.width}x${imgData.height}](${dataUrl})`;

      const span = document.createElement('span');
      span.setAttribute('data-chunk-id', chunk.id);
      span.textContent = chunkText;
      // Store image data on element for future transforms
      (span as HTMLElement & { _imageData?: typeof imgData })._imageData = imgData;
      chunkElement = span;
    } else {
      // Unknown chunk type - empty span
      const span = document.createElement('span');
      span.setAttribute('data-chunk-id', chunk.id);
      chunkElement = span;
    }

    // Add to chunks map
    addToChunksMap(chunk.id, chunkElement, chunks);

    // Append to DOM
    element.appendChild(chunkElement);
  }

  return state;
}
