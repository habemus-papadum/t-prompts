/**
 * Image Truncate Transform
 *
 * Truncates the base64 data URL in image chunks to a simple "(...)".
 * This keeps the text short for better line wrapping and readability,
 * while maintaining the image format and dimensions in the placeholder.
 */

import type { TransformState } from './base';
import type { ImageData } from '../types';

/**
 * Truncate image data URLs in text content
 */
export function applyTransform_ImageTruncate(state: TransformState): TransformState {
  const { chunks } = state;

  for (const [, elements] of chunks) {
    for (const element of elements) {
      const imageElement = element as HTMLElement & { _imageData?: ImageData };
      const imageData = imageElement._imageData;
      if (!imageData) continue;

      const format = imageData.format || 'PNG';
      const truncatedText = `![${format} ${imageData.width}x${imageData.height}](...)`;
      imageElement.textContent = truncatedText;
      imageElement.removeAttribute('title');
    }
  }

  return state;
}
