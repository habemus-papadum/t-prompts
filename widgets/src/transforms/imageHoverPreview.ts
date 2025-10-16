/**
 * Image Hover Preview Transform
 *
 * Adds hover preview functionality for image chunks.
 * Wraps image placeholder text in a container and adds a hidden preview image
 * that appears on hover (via CSS).
 */

import type { TransformState } from './base';
import { copyChunkId, addToChunksMap, removeFromChunksMap } from './base';
import type { ImageData } from '../types';

/**
 * Add hover preview support for images
 */
export function applyTransform_ImageHoverPreview(state: TransformState): TransformState {
  const { chunks } = state;

  // Process all chunks - iterate over a copy since we'll be modifying the map
  for (const [chunkId, elements] of Array.from(chunks.entries())) {
    // Process each element for this chunk
    for (const chunkElement of elements) {
      // Check if this chunk has image data stored
      const imageData = (chunkElement as HTMLElement & { _imageData?: ImageData })._imageData;
      if (!imageData) continue;

      // Build data URL for the preview
      const format = imageData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imageData.base64_data}`;

      // Create container span
      const container = document.createElement('span');
      container.className = 'tp-chunk-image-container';

      // Copy chunk ID to the new container
      copyChunkId(chunkElement, container);

      // Copy any existing classes from the chunk element (e.g., tp-chunk-image, type classes)
      if (chunkElement.className) {
        container.className += ` ${chunkElement.className}`;
      }

      // Create text span (no data-chunk-id needed, just for display)
      const textSpan = document.createElement('span');
      textSpan.className = 'tp-chunk-image';
      textSpan.textContent = chunkElement.textContent;

      // Create preview image (hidden by default, shown on hover via CSS)
      const previewImg = document.createElement('img');
      previewImg.className = 'tp-chunk-image-preview';
      previewImg.src = dataUrl;
      previewImg.alt = `${format} ${imageData.width}x${imageData.height}`;

      // Assemble container
      container.appendChild(textSpan);
      container.appendChild(previewImg);

      // Replace original element in DOM
      if (chunkElement.parentNode) {
        chunkElement.parentNode.replaceChild(container, chunkElement);
      }

      // Update chunks map: remove old element, add new container
      removeFromChunksMap(chunkId, chunkElement, chunks);
      addToChunksMap(chunkId, container, chunks);
    }
  }

  return state;
}
