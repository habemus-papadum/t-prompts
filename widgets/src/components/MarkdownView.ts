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
import type { InlinePositionMap } from './MarkdownView.plugin';

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
const INLINE_CHUNK_CLASS = 'tp-markdown-chunk';

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
  const { html, positionToElements, inlinePositions } = renderMarkdownWithPositionTracking(markdownText);

  // 5. Combine mappings: chunkId → positions → elements
  element.innerHTML = html;
  buildChunkToElementMapping(
    element,
    chunkPositions,
    chunkTexts,
    positionToElements,
    inlinePositions,
    chunkIdToElements
  );

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
    indicator.textContent = isImage ? '▢⋯' : '⋯';
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
  inlinePositions: InlinePositionMap;
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
  const inlinePositionMap: InlinePositionMap = new Map();
  md.use(sourcePositionPlugin, {
    block: linePositionMap,
    inline: inlinePositionMap,
  });

  // Render markdown
  const html = md.render(markdownText);

  // Convert line-based positions to character positions
  const positionToElements = convertLineToCharPositions(markdownText, linePositionMap);

  return { html, positionToElements, inlinePositions: inlinePositionMap };
}

/**
 * Stage 3: Combine mappings to build chunkId → DOM elements map
 */
function buildChunkToElementMapping(
  container: HTMLElement,
  chunkPositions: Map<string, PositionRange>,
  chunkTexts: Map<string, string>,
  positionToElements: ElementPositionMap,
  inlinePositions: InlinePositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  assignChunksFromInline(container, chunkPositions, inlinePositions, chunkIdToElements);

  const remainingChunks = new Set<string>();
  for (const chunkId of chunkPositions.keys()) {
    if (!chunkIdToElements.has(chunkId)) {
      remainingChunks.add(chunkId);
    }
  }

  if (remainingChunks.size > 0) {
    assignChunksFromBlock(container, chunkPositions, positionToElements, chunkIdToElements, remainingChunks);
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

function upsertChunkElement(
  chunkIdToElements: Map<string, HTMLElement[]>,
  chunkId: string,
  element: HTMLElement
): void {
  const existing = chunkIdToElements.get(chunkId);
  if (existing) {
    if (!existing.includes(element)) {
      existing.push(element);
    }
    return;
  }
  chunkIdToElements.set(chunkId, [element]);
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

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * Check if two position ranges overlap
 */
function rangesOverlap(range1: PositionRange, range2: PositionRange): boolean {
  // Ranges overlap if one starts before the other ends
  return range1.start < range2.end && range2.start < range1.end;
}
interface ChunkOverlap {
  chunkId: string;
  start: number;
  end: number;
}

function assignChunksFromInline(
  container: HTMLElement,
  chunkPositions: Map<string, PositionRange>,
  inlinePositions: InlinePositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  if (chunkPositions.size === 0 || inlinePositions.size === 0) {
    return;
  }

  const chunkEntries = Array.from(chunkPositions.entries());
  const inlineNodes = container.querySelectorAll<HTMLElement>('[data-md-inline-id]');

  inlineNodes.forEach((inlineNode) => {
    const inlineId = inlineNode.getAttribute('data-md-inline-id');
    if (!inlineId) {
      return;
    }

    const inlineRange = inlinePositions.get(inlineId);
    if (!inlineRange) {
      return;
    }

    const overlaps: ChunkOverlap[] = [];
    for (const [chunkId, chunkRange] of chunkEntries) {
      const overlapStart = Math.max(inlineRange.start, chunkRange.start);
      const overlapEnd = Math.min(inlineRange.end, chunkRange.end);
      if (overlapStart < overlapEnd) {
        overlaps.push({ chunkId, start: overlapStart, end: overlapEnd });
      }
    }

    if (overlaps.length === 0) {
      inlineNode.removeAttribute('data-md-inline-id');
      return;
    }

    overlaps.sort((a, b) => a.start - b.start || a.end - b.end);
    splitInlineNode(inlineNode, inlineRange, overlaps, chunkIdToElements);
  });
}

function assignChunksFromBlock(
  container: HTMLElement,
  chunkPositions: Map<string, PositionRange>,
  positionToElements: ElementPositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>,
  targetChunks: Set<string>
): void {
  if (targetChunks.size === 0) {
    return;
  }

  for (const chunkId of targetChunks) {
    const chunkRange = chunkPositions.get(chunkId);
    if (!chunkRange) {
      continue;
    }

    const elements: HTMLElement[] = [];
    for (const [elementId, elementRange] of positionToElements.entries()) {
      if (!rangesOverlap(chunkRange, elementRange)) {
        continue;
      }

      const element = container.querySelector<HTMLElement>(`[data-md-id="${elementId}"]`);
      if (!element) {
        continue;
      }

      addChunkIdToElement(element, chunkId);
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }

    if (elements.length > 0) {
      chunkIdToElements.set(chunkId, elements);
    }
  }
}

function splitInlineNode(
  inlineNode: HTMLElement,
  inlineRange: PositionRange,
  overlaps: ChunkOverlap[],
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  const textNode = inlineNode.firstChild as Text | null;
  if (!textNode) {
    inlineNode.removeAttribute('data-md-inline-id');
    return;
  }

  const textContent = textNode.textContent ?? '';
  if (!textContent) {
    inlineNode.removeAttribute('data-md-inline-id');
    return;
  }

  const sourceSpanLength = inlineRange.end - inlineRange.start;
  const targetLength = textContent.length;
  const requiresScaling = sourceSpanLength > 0 && sourceSpanLength !== targetLength;
  const scale = requiresScaling ? targetLength / sourceSpanLength : 1;

  const normalizedSegments: ChunkOverlap[] = [];
  const boundaries = new Set<number>([0, targetLength]);

  for (const overlap of overlaps) {
    let relativeStart = overlap.start - inlineRange.start;
    let relativeEnd = overlap.end - inlineRange.start;

    if (requiresScaling) {
      relativeStart = Math.floor(relativeStart * scale);
      relativeEnd = Math.ceil(relativeEnd * scale);
    }

    relativeStart = clamp(relativeStart, 0, targetLength);
    relativeEnd = clamp(relativeEnd, 0, targetLength);

    if (relativeStart >= relativeEnd) {
      continue;
    }

    normalizedSegments.push({
      chunkId: overlap.chunkId,
      start: relativeStart,
      end: relativeEnd,
    });
    boundaries.add(relativeStart);
    boundaries.add(relativeEnd);
  }

  if (normalizedSegments.length === 0) {
    inlineNode.removeAttribute('data-md-inline-id');
    return;
  }

  const splitPoints = Array.from(boundaries)
    .filter((value) => value > 0 && value < targetLength)
    .sort((a, b) => a - b);

  const textSegments: Array<{ node: Text; start: number; end: number }> = [];
  let currentNode: Text | null = textNode;
  let previousBoundary = 0;

  for (const boundary of splitPoints) {
    if (!currentNode) {
      break;
    }

    const relative = boundary - previousBoundary;
    if (relative <= 0) {
      continue;
    }

    const remainder = currentNode.splitText(relative);
    textSegments.push({ node: currentNode, start: previousBoundary, end: boundary });
    currentNode = remainder;
    previousBoundary = boundary;
  }

  if (currentNode && previousBoundary <= targetLength) {
    textSegments.push({ node: currentNode, start: previousBoundary, end: targetLength });
  }

  for (const segment of textSegments) {
    const coveringChunks = normalizedSegments.filter(
      (chunk) => chunk.start < segment.end && chunk.end > segment.start
    );

    if (coveringChunks.length === 0) {
      continue;
    }

    const textSegmentNode = segment.node;
    const wrapper = inlineNode.ownerDocument.createElement('span');
    wrapper.classList.add(INLINE_CHUNK_CLASS);

    for (const chunk of coveringChunks) {
      addChunkIdToElement(wrapper, chunk.chunkId);
      upsertChunkElement(chunkIdToElements, chunk.chunkId, wrapper);
    }

    textSegmentNode.parentNode?.insertBefore(wrapper, textSegmentNode);
    wrapper.appendChild(textSegmentNode);
  }

  inlineNode.removeAttribute('data-md-inline-id');
}
