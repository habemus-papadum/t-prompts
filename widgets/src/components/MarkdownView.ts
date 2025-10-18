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

const COLLAPSED_CLASS = 'tp-markdown-collapsed';
const COLLAPSED_INDICATOR_CLASS = 'tp-markdown-collapsed-indicator';
const CHUNK_IDS_ATTR = 'data-chunk-ids';

/**
 * Build a MarkdownView component from widget data and metadata
 *
 * @param data - Widget data containing IR chunks
 * @param metadata - Widget metadata
 * @param foldingController - Folding controller for managing code folding state
 */
export function buildMarkdownView(
  data: WidgetData,
  _metadata: WidgetMetadata,
  foldingController: FoldingController
): MarkdownView {
  // 1. Create initial DOM structure
  const element = document.createElement('div');
  element.className = 'tp-markdown-container';

  // 2. Build chunk ID to elements map
  const chunkIdToElements = new Map<string, HTMLElement[]>();
  const collapsedIndicators = new WeakMap<HTMLElement, HTMLElement>();

  // 3. Stage 1: Generate markdown text with position tracking
  const { markdownText, chunkPositions, chunkTexts } = generateMarkdownWithPositions(data);

  // 4. Stage 2: Render markdown and create position-to-element mapping
  const { html, positionToElements } = renderMarkdownWithPositionTracking(markdownText);

  // 5. Combine mappings: chunkId → positions → elements
  element.innerHTML = html;
  buildChunkToElementMapping(element, chunkPositions, chunkTexts, positionToElements, chunkIdToElements);

  function clearCollapsedMarkers(): void {
    const collapsedElements = element.querySelectorAll(`.${COLLAPSED_CLASS}`);
    collapsedElements.forEach((node) => {
      const htmlElement = node as HTMLElement;
      htmlElement.classList.remove(COLLAPSED_CLASS);
      const indicator = collapsedIndicators.get(htmlElement);
      if (indicator) {
        indicator.remove();
        collapsedIndicators.delete(htmlElement);
      }
    });

    const indicators = element.querySelectorAll(`.${COLLAPSED_INDICATOR_CLASS}`);
    indicators.forEach((node) => node.remove());
  }

  function insertIndicator(target: HTMLElement, isImage: boolean): void {
    if (!target.parentNode) {
      return;
    }

    const indicator = document.createElement('span');
    indicator.className = COLLAPSED_INDICATOR_CLASS;
    indicator.textContent = isImage ? '🖼⋯' : '⋯';
    indicator.title = isImage ? 'Collapsed image content' : 'Collapsed content';
    indicator.setAttribute('aria-label', indicator.title);

    const defaultView = target.ownerDocument?.defaultView;
    const display = defaultView ? defaultView.getComputedStyle(target).display : '';

    if (display === 'list-item') {
      indicator.classList.add(`${COLLAPSED_INDICATOR_CLASS}--list-item`);
    } else if (display === 'block' || display === 'flex' || display === 'grid') {
      indicator.classList.add(`${COLLAPSED_INDICATOR_CLASS}--block`);
    } else {
      indicator.classList.add(`${COLLAPSED_INDICATOR_CLASS}--inline`);
    }

    target.insertAdjacentElement('beforebegin', indicator);
    collapsedIndicators.set(target, indicator);
  }

  function markCollapsedElement(target: HTMLElement): void {
    target.classList.add(COLLAPSED_CLASS);
    if (collapsedIndicators.has(target)) {
      return;
    }

    const containsImage = target.matches('img, figure') || !!target.querySelector('img');
    insertIndicator(target, containsImage);
  }

  function applyCollapsedState(): void {
    clearCollapsedMarkers();

    for (const [chunkId, elements] of chunkIdToElements.entries()) {
      if (!foldingController.isCollapsed(chunkId)) {
        continue;
      }

      for (const el of elements) {
        if (!el) {
          continue;
        }
        markCollapsedElement(el);
      }
    }
  }

  // 6. Create folding client
  const foldingClient: FoldingClient = {
    onStateChanged(event: FoldingEvent): void {
      switch (event.type) {
        case 'chunks-collapsed':
        case 'chunk-expanded':
        case 'state-reset':
          applyCollapsedState();
          break;
      }
    },
  };

  // 7. Register as client
  foldingController.addClient(foldingClient);
  applyCollapsedState();

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
  chunkTexts: Map<string, string>;
} {
  const chunks = data.ir?.chunks || [];
  let markdownText = '';
  const chunkPositions = new Map<string, PositionRange>();
  const chunkTexts = new Map<string, string>();

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
    chunkTexts.set(chunk.id, text);
  }

  return { markdownText, chunkPositions, chunkTexts };
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
  md.use(katex as any, {
    delimiters: 'all',
  } as any);

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
  chunkTexts: Map<string, string>,
  positionToElements: ElementPositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  // For each chunk, find all elements whose positions overlap with the chunk
  for (const [chunkId, chunkRange] of chunkPositions.entries()) {
    const elements: HTMLElement[] = [];

    for (const [elementId, elementRange] of positionToElements.entries()) {
      // Check if ranges overlap
      if (!rangesOverlap(chunkRange, elementRange)) {
        continue;
      }

      const element = container.querySelector(`[data-md-id="${elementId}"]`);

      if (!element || element.nodeType !== 1) {
        continue;
      }

      const htmlElement = element as HTMLElement;
      addChunkIdToElement(htmlElement, chunkId);
      if (!elements.includes(htmlElement)) {
        elements.push(htmlElement);
      }
    }

    if (elements.length > 0) {
      chunkIdToElements.set(chunkId, elements);
    }
  }

  const missingChunks: string[] = [];
  for (const chunkId of chunkPositions.keys()) {
    if (!chunkIdToElements.has(chunkId)) {
      missingChunks.push(chunkId);
    }
  }

  if (missingChunks.length > 0) {
    assignLatexChunks(container, missingChunks, chunkTexts, chunkIdToElements);
  }
}

function addChunkIdToElement(element: HTMLElement, chunkId: string): void {
  const existingIdsAttr = element.getAttribute(CHUNK_IDS_ATTR);
  const existingIds = existingIdsAttr ? new Set(existingIdsAttr.split(/\s+/).filter(Boolean)) : new Set<string>();

  if (!existingIds.has(chunkId)) {
    existingIds.add(chunkId);
    element.setAttribute(CHUNK_IDS_ATTR, Array.from(existingIds).join(' '));
  }

  if (!element.hasAttribute('data-chunk-id')) {
    element.setAttribute('data-chunk-id', chunkId);
  }
}

function assignLatexChunks(
  container: HTMLElement,
  chunkIds: string[],
  chunkTexts: Map<string, string>,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  const katexBlocks = Array.from(container.querySelectorAll<HTMLElement>('.katex-block'));
  const usedBlocks = new Set<HTMLElement>();

  for (const chunkId of chunkIds) {
    const chunkText = chunkTexts.get(chunkId) ?? '';
    const normalizedChunkLatex = normalizeLatex(extractLatexFromChunk(chunkText));
    if (!normalizedChunkLatex) {
      continue;
    }

    const matchingBlock = katexBlocks.find((block) => {
      if (usedBlocks.has(block)) {
        return false;
      }

      const annotation = block.querySelector('annotation[encoding="application/x-tex"]');
      const annotationText = annotation?.textContent ? normalizeLatex(annotation.textContent) : '';
      return annotationText === normalizedChunkLatex;
    });

    if (!matchingBlock) {
      continue;
    }

    addChunkIdToElement(matchingBlock, chunkId);
    const existing = chunkIdToElements.get(chunkId) ?? [];
    if (!existing.includes(matchingBlock)) {
      existing.push(matchingBlock);
      chunkIdToElements.set(chunkId, existing);
    }

    usedBlocks.add(matchingBlock);
  }
}

function extractLatexFromChunk(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return trimmed.slice(2, -2);
  }

  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) {
    return trimmed.slice(2, -2);
  }

  if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
    return trimmed.slice(2, -2);
  }

  return trimmed;
}

function normalizeLatex(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

/**
 * Check if two position ranges overlap
 */
function rangesOverlap(range1: PositionRange, range2: PositionRange): boolean {
  // Ranges overlap if one starts before the other ends
  return range1.start < range2.end && range2.start < range1.end;
}
