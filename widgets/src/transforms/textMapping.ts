/**
 * Text Mapping Transform
 *
 * Builds bidirectional mapping between text positions and chunks.
 * This enables O(1) lookups for text selection, search, and highlighting.
 */

import type { TransformState } from './base';
import type { TextMapping } from '../types';

/**
 * Build bidirectional text mapping
 */
export function applyTransform_BuildTextMapping(state: TransformState): TransformState {
  const { data } = state;

  if (!data.ir?.chunks) {
    return state;
  }

  // Initialize mapping structures
  let fullText = '';
  const offsetToChunkId: string[] = [];
  const chunkIdToOffsets: Record<string, { start: number; end: number }> = {};

  // Process each chunk
  for (const chunk of data.ir.chunks) {
    // Get text for this chunk
    let chunkText = '';
    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      chunkText = chunk.text;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunks have placeholder text
      const imgData = chunk.image;
      const format = imgData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imgData.base64_data}`;
      chunkText = `![${format} ${imgData.width}x${imgData.height}](${dataUrl})`;
    }

    // Record offsets
    const start = fullText.length;
    const end = start + chunkText.length;

    // Add to full text
    fullText += chunkText;

    // Map each character offset to chunk ID
    for (let i = start; i < end; i++) {
      offsetToChunkId.push(chunk.id);
    }

    // Map chunk ID to offsets
    chunkIdToOffsets[chunk.id] = { start, end };
  }

  // Create text mapping
  const textMapping: TextMapping = {
    fullText,
    offsetToChunkId,
    chunkIdToOffsets,
  };

  return {
    ...state,
    textMapping,
  };
}
