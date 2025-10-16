/**
 * Code View Component
 *
 * Renders text output with semantic coloring and element boundaries.
 * Uses a transform pipeline to incrementally build and annotate the DOM.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata, TextMapping } from '../types';
import type { TransformState } from '../transforms/base';
import { applyTransform_CreateChunks } from '../transforms/createChunks';
import { applyTransform_AddTyping } from '../transforms/typing';
import { applyTransform_MarkBoundaries } from '../transforms/boundaries';
import { applyTransform_BuildTextMapping } from '../transforms/textMapping';

/**
 * Code view component interface
 */
export interface CodeView extends Component {
  // Text-specific data
  textMapping: TextMapping | null;
  chunks: Map<string, HTMLElement>; // chunkId → DOM element

  // Operations
  highlightRange(start: number, end: number): void;
  clearHighlight(): void;
}

/**
 * Build a CodeView component from widget data and metadata
 */
export function buildCodeView(data: WidgetData, metadata: WidgetMetadata): CodeView {
  // 1. Create initial DOM structure
  const element = document.createElement('div');
  element.className = 'tp-output-container wrap';

  // 2. Build chunks map
  const chunks = new Map<string, HTMLElement>();

  // 3. Apply transformation pipeline
  let state: TransformState = { element, chunks, data, metadata };

  // Transform pipeline - each function modifies state
  state = applyTransform_CreateChunks(state);
  state = applyTransform_AddTyping(state);
  state = applyTransform_BuildTextMapping(state);
  state = applyTransform_MarkBoundaries(state);

  // Future transforms can be added here:
  // state = applyTransform_LineWrapping(state);
  // state = applyTransform_SyntaxHighlighting(state);

  // 4. Return component with operations
  return {
    element: state.element,
    textMapping: state.textMapping || null,
    chunks: state.chunks,

    hide(ids: string[]): void {
      ids.forEach((id) => {
        const el = chunks.get(id);
        if (el) el.style.display = 'none';
      });
    },

    show(ids: string[]): void {
      ids.forEach((id) => {
        const el = chunks.get(id);
        if (el) el.style.display = '';
      });
    },

    destroy(): void {
      element.remove();
      chunks.clear();
    },

    highlightRange(start: number, end: number): void {
      // Future: Use textMapping to find chunks and highlight them
      console.log(`Highlight range: ${start}-${end}`);
    },

    clearHighlight(): void {
      // Future: Clear highlight styling
      console.log('Clear highlight');
    },
  };
}
