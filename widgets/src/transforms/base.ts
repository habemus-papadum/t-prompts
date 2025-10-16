/**
 * Transform pipeline infrastructure
 *
 * Transforms are pure functions that take state and return modified state.
 * They allow incremental modification of DOM structure and data.
 */

import type { WidgetData, WidgetMetadata, TextMapping } from '../types';

/**
 * State that flows through the transform pipeline
 */
export interface TransformState {
  // DOM
  element: HTMLElement;
  chunks: Map<string, HTMLElement>; // chunkId → DOM element

  // Data
  data: WidgetData;
  metadata: WidgetMetadata;

  // Analysis results (built incrementally)
  textMapping?: TextMapping;
  // Future: lineBreaks, syntaxTree, etc.
}

/**
 * Transform function signature
 * Takes state, returns modified state
 */
export type Transform = (state: TransformState) => TransformState;

/**
 * ID Conversion Utilities
 *
 * Convention: Python UUIDs are prefixed with "id-" when used as DOM element IDs.
 * This ensures IDs always start with a letter (HTML spec compliant) and avoids
 * CSS selector issues with IDs starting with digits.
 */

/**
 * Convert a Python UUID to a DOM element ID by prefixing with "id-"
 */
export function toElementId(pythonId: string): string {
  return `id-${pythonId}`;
}

/**
 * Convert a DOM element ID back to Python UUID by removing the "id-" prefix
 */
export function fromElementId(elementId: string): string {
  if (elementId.startsWith('id-')) {
    return elementId.substring(3);
  }
  return elementId;
}
