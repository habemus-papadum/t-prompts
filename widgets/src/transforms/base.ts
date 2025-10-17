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

/**
 * Replace an element in the chunks map with a new element.
 * Only replaces if the old element is actually in the map.
 * Does NOT add new elements if the old element wasn't tracked.
 *
 * This maintains the invariant that only top-level wrapped containers
 * are tracked in the map, not nested containers created during recursive wrapping.
 */
export function replaceInChunksMap(
  oldElement: HTMLElement,
  newElement: HTMLElement,
  map: Map<string, HTMLElement[]>
): void {
  const chunkId = getChunkId(oldElement);
  if (!chunkId) return;

  // Check if old element is tracked
  const existing = map.get(chunkId);
  if (existing) {
    const index = existing.indexOf(oldElement);
    if (index !== -1) {
      // Replace in the array
      existing[index] = newElement;
      return;
    }
  }

  // Old element not found in map - do NOT add the new element.
  // This prevents nested containers from being added to the map during recursive wrapping.
}

/**
 * Rebuild the chunks map from the current DOM tree.
 *
 * This scans the DOM for elements with data-chunk-id attributes and records
 * only the highest-level element for each chunk. Any nested spans created by
 * transforms (such as line wrapping) are ignored so that the map contains
 * stable top-level containers for each chunk ID.
 */
export function rebuildChunksMap(
  root: HTMLElement,
  map: Map<string, HTMLElement[]>
): void {
  const newEntries = new Map<string, HTMLElement[]>();

  const chunkElements = root.querySelectorAll<HTMLElement>('[data-chunk-id]');

  for (const element of chunkElements) {
    const chunkId = element.dataset.chunkId;
    if (!chunkId) {
      continue;
    }

    // Skip elements that are nested inside another element with the same chunk ID.
    let ancestor = element.parentElement;
    let hasSameChunkAncestor = false;
    while (ancestor && ancestor !== root) {
      if (ancestor instanceof HTMLElement && ancestor.dataset.chunkId === chunkId) {
        hasSameChunkAncestor = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    if (hasSameChunkAncestor) {
      continue;
    }

    const existing = newEntries.get(chunkId);
    if (existing) {
      existing.push(element);
    } else {
      newEntries.set(chunkId, [element]);
    }
  }

  map.clear();
  for (const [chunkId, elements] of newEntries.entries()) {
    map.set(chunkId, elements);
  }
}
