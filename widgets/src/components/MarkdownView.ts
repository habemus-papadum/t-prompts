/**
 * Markdown View Component
 *
 * Renders markdown output with semantic highlighting and element boundaries.
 * Maintains mapping from chunk IDs to DOM elements for folding/selection.
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata } from '../types';
import type { FoldingController } from '../folding/controller';
import type { FoldingEvent, FoldingClient } from '../folding/types';
import MarkdownIt from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import {
  sourcePositionPlugin,
  convertLineToCharPositions,
  resetElementIdCounter,
  type ElementPositionMap,
} from './MarkdownView.plugin';

/**
 * Position range in the markdown source text
 */
interface PositionRange {
  start: number;
  end: number;
}

/**
 * Markdown view component interface
 */
export interface MarkdownView extends Component {
  // Markdown-specific data
  chunkIdToElements: Map<string, HTMLElement[]>; // chunkId → array of DOM elements
}

/**
 * Build a MarkdownView component from widget data and metadata
 *
 * @param data - Widget data containing IR chunks
 * @param metadata - Widget metadata
 * @param foldingController - Folding controller for managing code folding state
 */
export function buildMarkdownView(
  data: WidgetData,
  metadata: WidgetMetadata,
  foldingController: FoldingController
): MarkdownView {
  // 1. Create initial DOM structure
  const element = document.createElement('div');
  element.className = 'tp-markdown-container';

  // 2. Build chunk ID to elements map
  const chunkIdToElements = new Map<string, HTMLElement[]>();

  // 3. Stage 1: Generate markdown text with position tracking
  const { markdownText, chunkPositions } = generateMarkdownWithPositions(data);

  // 4. Stage 2: Render markdown and create position-to-element mapping
  const { html, positionToElements } = renderMarkdownWithPositionTracking(markdownText);

  // 5. Combine mappings: chunkId → positions → elements
  element.innerHTML = html;
  buildChunkToElementMapping(element, chunkPositions, positionToElements, chunkIdToElements);

  // 6. Create folding client (placeholder for now)
  const foldingClient: FoldingClient = {
    onStateChanged(event: FoldingEvent): void {
      // TODO: Handle folding events
      console.log('Folding event:', event.type);
    },
  };

  // 7. Register as client
  foldingController.addClient(foldingClient);

  // 8. Return component
  return {
    element,
    chunkIdToElements,

    destroy(): void {
      // Unregister from folding controller
      foldingController.removeClient(foldingClient);

      // Cleanup DOM and data
      element.remove();
      chunkIdToElements.clear();
    },
  };
}

/**
 * Stage 1: Generate markdown text and track chunk positions
 */
function generateMarkdownWithPositions(data: WidgetData): {
  markdownText: string;
  chunkPositions: Map<string, PositionRange>;
} {
  const chunks = data.ir?.chunks || [];
  let markdownText = '';
  const chunkPositions = new Map<string, PositionRange>();

  for (const chunk of chunks) {
    const start = markdownText.length;
    let text = '';

    // Handle different chunk types
    if (chunk.type === 'ImageChunk' && chunk.image) {
      // Convert image to markdown syntax with data URL
      text = imageToMarkdown(chunk.image);
    } else {
      // Text chunk
      text = chunk.text || '';
    }

    markdownText += text;
    const end = markdownText.length;

    chunkPositions.set(chunk.id, { start, end });
  }

  return { markdownText, chunkPositions };
}

/**
 * Convert an image chunk to markdown image syntax with data URL
 */
function imageToMarkdown(image: any): string {
  try {
    // Extract image data - Python serialization uses 'base64_data', not 'data'
    const format = image.format?.toLowerCase() || 'png';
    const base64Data = image.base64_data || image.data; // Support both for compatibility

    if (!base64Data) {
      console.warn('Image missing base64_data:', image);
      return '[Image: No data]';
    }

    // Build data URL
    const dataUrl = `data:image/${format};base64,${base64Data}`;

    // Return markdown image syntax
    // Could optionally add size info to alt text: ![width x height]
    return `![](${dataUrl})`;
  } catch (error) {
    console.error('Error converting image to markdown:', error);
    return '[Image: Error]';
  }
}

/**
 * Stage 2: Render markdown with position tracking
 */
function renderMarkdownWithPositionTracking(markdownText: string): {
  html: string;
  positionToElements: ElementPositionMap; // element-id → position range
} {
  // Reset element ID counter for consistent IDs
  resetElementIdCounter();

  // Initialize markdown-it with KaTeX support
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  // Add KaTeX plugin with all delimiters enabled
  // Supports: $...$ (inline), $$...$$ (block), \(...\) (inline), \[...\] (block)
  md.use(katex, {
    delimiters: 'all',
  });

  // Add custom plugin for position tracking
  const linePositionMap: ElementPositionMap = new Map();
  md.use(sourcePositionPlugin, linePositionMap);

  // Render markdown
  const html = md.render(markdownText);

  // Convert line-based positions to character positions
  const positionToElements = convertLineToCharPositions(markdownText, linePositionMap);

  return { html, positionToElements };
}

/**
 * Stage 3: Combine mappings to build chunkId → DOM elements map
 */
function buildChunkToElementMapping(
  container: HTMLElement,
  chunkPositions: Map<string, PositionRange>,
  positionToElements: ElementPositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  // For each chunk, find all elements whose positions overlap with the chunk
  for (const [chunkId, chunkRange] of chunkPositions.entries()) {
    const elements: HTMLElement[] = [];

    for (const [elementId, elementRange] of positionToElements.entries()) {
      // Check if ranges overlap
      if (rangesOverlap(chunkRange, elementRange)) {
        // Find the DOM element with this data-md-id
        const element = container.querySelector(`[data-md-id="${elementId}"]`);

        // Check if element exists (use duck typing instead of instanceof for JSDOM compatibility)
        if (element && element.nodeType === 1) {
          // Add chunk ID to the element
          element.setAttribute('data-chunk-id', chunkId);
          elements.push(element as HTMLElement);
        }
      }
    }

    if (elements.length > 0) {
      chunkIdToElements.set(chunkId, elements);
    }
  }
}

/**
 * Check if two position ranges overlap
 */
function rangesOverlap(range1: PositionRange, range2: PositionRange): boolean {
  // Ranges overlap if one starts before the other ends
  return range1.start < range2.end && range2.start < range1.end;
}
