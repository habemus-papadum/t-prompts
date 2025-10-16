/**
 * Transform pipeline infrastructure
 *
 * Transforms are pure functions that take state and return modified state.
 * They allow incremental modification of DOM structure and data.
 */

import type { WidgetData, WidgetMetadata } from '../types';

/**
 * State that flows through the transform pipeline
 */
export interface TransformState {
  // DOM
  element: HTMLElement;
  chunks: Map<string, HTMLElement[]>; // chunkId → array of top-level DOM elements

  // Data
  data: WidgetData;
  metadata: WidgetMetadata;

  // Analysis results (built incrementally)
  // Future: textMapping, lineBreaks, syntaxTree, etc.
}

/**
 * Transform function signature
 * Takes state, returns modified state
 */
export type Transform = (state: TransformState) => TransformState;

/**
 * Chunk ID Utilities
 *
 * Chunks are identified using data-chunk-id attributes rather than HTML IDs.
 * This allows multiple DOM elements to be associated with the same chunk.
 */

/**
 * Get the chunk ID from an element's data-chunk-id attribute
 */
export function getChunkId(element: HTMLElement): string | null {
  return element.getAttribute('data-chunk-id');
}

/**
 * Copy chunk ID from one element to another
 */
export function copyChunkId(fromElement: HTMLElement, toElement: HTMLElement): void {
  const chunkId = getChunkId(fromElement);
  if (chunkId) {
    toElement.setAttribute('data-chunk-id', chunkId);
  }
}

/**
 * Add an element to the chunks map for a given chunk ID
 */
export function addToChunksMap(
  chunkId: string,
  element: HTMLElement,
  map: Map<string, HTMLElement[]>
): void {
  const existing = map.get(chunkId);
  if (existing) {
    existing.push(element);
  } else {
    map.set(chunkId, [element]);
  }
}

/**
 * Remove a specific element from the chunks map for a given chunk ID
 */
export function removeFromChunksMap(
  chunkId: string,
  element: HTMLElement,
  map: Map<string, HTMLElement[]>
): void {
  const existing = map.get(chunkId);
  if (existing) {
    const index = existing.indexOf(element);
    if (index !== -1) {
      existing.splice(index, 1);
    }
    // Remove the key entirely if array is now empty
    if (existing.length === 0) {
      map.delete(chunkId);
    }
  }
}
