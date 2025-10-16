/**
 * Create Chunks Transform
 *
 * Creates initial <span> elements for each chunk and adds them to the DOM.
 * This is the first transform in the pipeline - it builds the raw structure.
 */

import type { TransformState } from './base';
import { toElementId } from './base';

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
      span.id = toElementId(chunk.id);
      span.textContent = chunk.text;
      chunkElement = span;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunk - container with text placeholder and hidden preview
      const imgData = chunk.image;
      const format = imgData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imgData.base64_data}`;
      const chunkText = `![${format} ${imgData.width}x${imgData.height}](${dataUrl})`;

      // Create container for text + preview image
      const container = document.createElement('span');
      container.className = 'tp-chunk-image-container';
      container.id = toElementId(chunk.id);

      // Text placeholder
      const textSpan = document.createElement('span');
      textSpan.className = 'tp-chunk-image';
      textSpan.textContent = chunkText;

      // Hidden preview image (shown on hover via CSS)
      const previewImg = document.createElement('img');
      previewImg.className = 'tp-chunk-image-preview';
      previewImg.src = dataUrl;
      previewImg.alt = `${format} ${imgData.width}x${imgData.height}`;

      container.appendChild(textSpan);
      container.appendChild(previewImg);

      chunkElement = container;
    } else {
      // Unknown chunk type - empty span
      const span = document.createElement('span');
      span.id = toElementId(chunk.id);
      chunkElement = span;
    }

    // Add to chunks map
    chunks.set(chunk.id, chunkElement);

    // Append to DOM
    element.appendChild(chunkElement);
  }

  return state;
}
