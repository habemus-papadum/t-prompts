/**
 * Before Diff Overlay Transform
 *
 * Adds diff information to chunks in the "before" view based on rendered diff data.
 * Marks chunks as deleted or replaced-before for visual styling.
 */

import type { TransformState } from './base';
import type { ChunkDelta } from '../diff-types';
import { resolveDiffContext } from '../types';

/**
 * Apply diff overlay styling to chunks in the before view
 */
export function applyTransform_BeforeDiffOverlay(state: TransformState): TransformState {
  const { chunks, data } = state;

  const diffPayload = resolveDiffContext(data);
  if (!diffPayload || diffPayload.rendered.diff_type !== 'rendered') {
    return state;
  }

  const renderedDiff = diffPayload.rendered;
  const chunkDeltas = renderedDiff.chunk_deltas;

  // Build a map from chunk (element_id:text) to delta operation for "before" chunks
  const beforeChunkMap = new Map<string, ChunkDelta>();

  for (const delta of chunkDeltas) {
    // Only care about deletes and replaces - these affect the before view
    if (delta.before && (delta.op === 'delete' || delta.op === 'replace')) {
      // Map by element_id and text for reliable matching
      const key = `${delta.before.element_id}:${delta.before.text}`;
      beforeChunkMap.set(key, delta);
    }
  }

  // Now go through our actual chunks and mark them with diff info
  for (const [chunkId, elements] of chunks.entries()) {
    // Find the chunk data to get element_id and text
    const chunkData = diffPayload.before_prompt.chunks.find(c => c.id === chunkId);
    if (!chunkData || chunkData.type !== 'TextChunk' || !chunkData.text) {
      continue;
    }

    const key = `${chunkData.element_id}:${chunkData.text}`;
    const delta = beforeChunkMap.get(key);

    if (delta) {
      // Apply diff marking to all elements for this chunk
      for (const element of elements) {
        element.setAttribute('data-diff-op', delta.op);

        // Add CSS class for styling
        if (delta.op === 'delete') {
          element.classList.add('tp-diff-delete');
        } else if (delta.op === 'replace') {
          element.classList.add('tp-diff-replace-before');
        }
      }
    }
  }

  return state;
}
