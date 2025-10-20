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

  // Build lookup tables for quick matching
  const beforeChunkIndex = new Map(
    diffPayload.before_prompt.chunks.map((chunk) => [chunk.id, chunk])
  );
  const deltasByElement = new Map<string, ChunkDelta[]>();

  for (const delta of chunkDeltas) {
    if (!delta.before || (delta.op !== 'delete' && delta.op !== 'replace')) {
      continue;
    }
    const list = deltasByElement.get(delta.before.element_id);
    if (list) {
      list.push(delta);
    } else {
      deltasByElement.set(delta.before.element_id, [delta]);
    }
  }

  // Now go through our actual chunks and mark them with diff info
  for (const [chunkId, elements] of chunks.entries()) {
    // Find the chunk data to get element_id and text
    const chunkData = beforeChunkIndex.get(chunkId);
    if (!chunkData || chunkData.type !== 'TextChunk' || !chunkData.text) {
      continue;
    }

    const candidates = deltasByElement.get(chunkData.element_id);
    if (!candidates || candidates.length === 0) {
      continue;
    }

    const matchIndex = candidates.findIndex(
      (candidate) => candidate.before?.text === chunkData.text
    );
    if (matchIndex === -1) {
      continue;
    }

    const [delta] = candidates.splice(matchIndex, 1);

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
