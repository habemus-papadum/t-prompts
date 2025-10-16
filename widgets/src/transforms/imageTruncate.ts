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

  // Process all chunks
  for (const [, chunkElement] of chunks) {
    // Check if this chunk has image data stored
    const imageData = (chunkElement as HTMLElement & { _imageData?: ImageData })._imageData;
    if (!imageData) continue;

    // Truncate the text to remove the long base64 data URL
    const format = imageData.format || 'PNG';
    const truncatedText = `![${format} ${imageData.width}x${imageData.height}](...)`;
    chunkElement.textContent = truncatedText;

    // Remove title attribute - we don't want source location tooltip on images
    // since they'll have hover preview instead
    chunkElement.removeAttribute('title');
  }

  return state;
}
