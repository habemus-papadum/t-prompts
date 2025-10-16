/**
 * Code View Component
 *
 * Renders text output with semantic coloring and element boundaries.
 * Uses a transform pipeline to incrementally build and annotate the DOM.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata } from '../types';
import type { TransformState } from '../transforms/base';
import { applyTransform_CreateChunks } from '../transforms/createChunks';
import { applyTransform_AddTyping } from '../transforms/typing';
import { applyTransform_ImageTruncate } from '../transforms/imageTruncate';
import { applyTransform_ImageHoverPreview } from '../transforms/imageHoverPreview';
import { applyTransform_MarkBoundaries } from '../transforms/boundaries';

/**
 * Code view component interface
 */
export interface CodeView extends Component {
  // Text-specific data
  chunks: Map<string, HTMLElement[]>; // chunkId → array of top-level DOM elements
}

/**
 * Build a CodeView component from widget data and metadata
 */
export function buildCodeView(data: WidgetData, metadata: WidgetMetadata): CodeView {
  // 1. Create initial DOM structure
  const element = document.createElement('div');
  element.className = 'tp-output-container wrap';

  // 2. Build chunks map
  const chunks = new Map<string, HTMLElement[]>();

  // 3. Apply transformation pipeline
  let state: TransformState = { element, chunks, data, metadata };

  // Transform pipeline - each function modifies state
  state = applyTransform_CreateChunks(state);
  state = applyTransform_AddTyping(state);
  state = applyTransform_ImageTruncate(state);
  state = applyTransform_ImageHoverPreview(state);
  state = applyTransform_MarkBoundaries(state);

  // Future transforms can be added here:
  // state = applyTransform_LineWrapping(state);
  // state = applyTransform_SyntaxHighlighting(state);

  // 4. Return component with operations
  return {
    element: state.element,
    chunks: state.chunks,

    hide(ids: string[]): void {
      ids.forEach((id) => {
        const elements = chunks.get(id);
        if (elements) {
          elements.forEach((el) => (el.style.display = 'none'));
        }
      });
    },

    show(ids: string[]): void {
      ids.forEach((id) => {
        const elements = chunks.get(id);
        if (elements) {
          elements.forEach((el) => (el.style.display = ''));
        }
      });
    },

    destroy(): void {
      element.remove();
      chunks.clear();
    },
  };
}
