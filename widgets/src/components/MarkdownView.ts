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
import type { PluginWithOptions } from 'markdown-it';
import { katex as katexPlugin } from '@mdit/plugin-katex';
import katex from 'katex';
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
    markdownText,
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
interface SerializedImage {
  base64_data?: string;
  data?: string;
  format?: string;
  width?: number;
  height?: number;
  mode?: string;
}

function imageToMarkdown(image: SerializedImage): string {
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
  type KatexPluginOptions = {
    delimiters?: 'all' | 'dollars' | Array<[string, string]>;
  };
  const katexPluginWithOptions = katexPlugin as unknown as PluginWithOptions<KatexPluginOptions>;
  md.use(katexPluginWithOptions, {
    delimiters: 'all',
  });

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
  markdownText: string,
  chunkPositions: Map<string, PositionRange>,
  chunkTexts: Map<string, string>,
  positionToElements: ElementPositionMap,
  inlinePositions: InlinePositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  assignChunksFromInline(container, chunkPositions, inlinePositions, chunkIdToElements);

  const chunkOrder = Array.from(chunkPositions.keys());

  let remainingChunks = chunkOrder.filter((chunkId) => !chunkIdToElements.has(chunkId));
  if (remainingChunks.length > 0) {
    assignCodeFenceChunks(
      container,
      remainingChunks,
      chunkPositions,
      positionToElements,
      chunkIdToElements,
      markdownText
    );
  }

  remainingChunks = chunkOrder.filter((chunkId) => !chunkIdToElements.has(chunkId));
  if (remainingChunks.length > 0) {
    assignChunksFromBlock(container, chunkPositions, positionToElements, chunkIdToElements, remainingChunks);
  }

  remainingChunks = chunkOrder.filter((chunkId) => !chunkIdToElements.has(chunkId));
  if (remainingChunks.length > 0) {
    assignLatexChunks(container, remainingChunks, chunkTexts, chunkIdToElements);
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

function assignCodeFenceChunks(
  container: HTMLElement,
  chunkIds: string[],
  chunkPositions: Map<string, PositionRange>,
  positionToElements: ElementPositionMap,
  chunkIdToElements: Map<string, HTMLElement[]>,
  markdownText: string
): void {
  if (chunkIds.length === 0) {
    return;
  }

  const preElements = Array.from(container.querySelectorAll<HTMLPreElement>('pre'));
  if (preElements.length === 0) {
    return;
  }

  for (const pre of preElements) {
    const codeElement = pre.querySelector<HTMLElement>('code');
    if (!codeElement) {
      continue;
    }

    const elementId = pre.getAttribute('data-md-id') ?? codeElement.getAttribute('data-md-id');
    if (!elementId) {
      continue;
    }

    const blockRange = positionToElements.get(elementId);
    if (!blockRange) {
      continue;
    }

    const blockMarkdown = markdownText.slice(blockRange.start, blockRange.end);
    const codeSection = extractCodeSection(blockMarkdown);
    if (!codeSection) {
      continue;
    }

    const { code, startOffset, endOffset, languageHint } = codeSection;
    if (!code) {
      continue;
    }

    const codeStart = blockRange.start + startOffset;
    const codeEnd = blockRange.start + endOffset;

    const segments: Array<{ chunkId: string; start: number; end: number; text: string }> = [];
    for (const chunkId of chunkIds) {
      if (chunkIdToElements.has(chunkId)) {
        continue;
      }

      const range = chunkPositions.get(chunkId);
      if (!range) {
        continue;
      }

      const overlapStart = Math.max(range.start, codeStart);
      const overlapEnd = Math.min(range.end, codeEnd);
      if (overlapStart >= overlapEnd) {
        continue;
      }

      segments.push({
        chunkId,
        start: overlapStart - codeStart,
        end: overlapEnd - codeStart,
        text: markdownText.slice(overlapStart, overlapEnd),
      });
    }

    if (segments.length === 0) {
      continue;
    }

    segments.sort((a, b) => a.start - b.start || a.end - b.end);

    const language = detectCodeLanguage(pre, codeElement, languageHint);
    const tokens = tokenizeCode(code, language);
    renderCodeSegments(codeElement, code, segments, tokens, chunkIdToElements);
  }
}

function extractCodeSection(blockMarkdown: string): {
  code: string;
  startOffset: number;
  endOffset: number;
  languageHint?: string;
} | null {
  if (!blockMarkdown) {
    return null;
  }

  const fenceMatch = blockMarkdown.match(/^(?<fence>```|~~~)(?<info>[^\n]*)\n/);
  if (!fenceMatch || !fenceMatch.groups) {
    return {
      code: blockMarkdown,
      startOffset: 0,
      endOffset: blockMarkdown.length,
    };
  }

  const fence = fenceMatch.groups.fence;
  const info = fenceMatch.groups.info?.trim() ?? '';
  const openingLength = fenceMatch[0].length;

  let closingIndex = blockMarkdown.lastIndexOf(fence);
  if (closingIndex === -1 || closingIndex < openingLength) {
    return {
      code: blockMarkdown.slice(openingLength),
      startOffset: openingLength,
      endOffset: blockMarkdown.length,
      languageHint: info.split(/\s+/)[0] || undefined,
    };
  }

  return {
    code: blockMarkdown.slice(openingLength, closingIndex),
    startOffset: openingLength,
    endOffset: closingIndex,
    languageHint: info.split(/\s+/)[0] || undefined,
  };
}

function detectCodeLanguage(
  pre: HTMLElement,
  codeElement: HTMLElement,
  languageHint: string | undefined
): string {
  const classNames = new Set<string>([...Array.from(pre.classList), ...Array.from(codeElement.classList)]);
  for (const className of classNames) {
    if (className.startsWith('language-')) {
      const normalized = normalizeLanguage(className.slice('language-'.length));
      if (normalized) {
        return normalized;
      }
    }
  }

  if (languageHint) {
    const normalized = normalizeLanguage(languageHint);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

type CodeTokenType = 'plain' | 'keyword' | 'string' | 'comment' | 'number';

interface CodeToken {
  type: CodeTokenType;
  start: number;
  end: number;
}

function tokenizeCode(code: string, language: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  const length = code.length;
  const keywordSet = getKeywordSet(language);

  let i = 0;
  let plainStart = 0;

  const pushPlainUpTo = (end: number): void => {
    if (end > plainStart) {
      tokens.push({ type: 'plain', start: plainStart, end });
      plainStart = end;
    }
  };

  const pushToken = (type: CodeTokenType, start: number, end: number): void => {
    if (end <= start) {
      return;
    }
    pushPlainUpTo(start);
    tokens.push({ type, start, end });
    plainStart = end;
  };

  while (i < length) {
    const ch = code[i];
    const nextTwo = code.slice(i, i + 2);
    const nextThree = code.slice(i, i + 3);

    if ((language === 'javascript' || language === 'bash' || language === 'python') && ch === '#') {
      const newlineIndex = code.indexOf('\n', i);
      const end = newlineIndex === -1 ? length : newlineIndex;
      pushToken('comment', i, end);
      i = end;
      continue;
    }

    if (language === 'javascript' && nextTwo === '//') {
      const newlineIndex = code.indexOf('\n', i);
      const end = newlineIndex === -1 ? length : newlineIndex;
      pushToken('comment', i, end);
      i = end;
      continue;
    }

    if (language === 'javascript' && nextTwo === '/*') {
      const closingIndex = code.indexOf('*/', i + 2);
      const end = closingIndex === -1 ? length : closingIndex + 2;
      pushToken('comment', i, end);
      i = end;
      continue;
    }

    if (language === 'python' && (nextThree === "'''" || nextThree === '"""')) {
      const delimiter = nextThree;
      const closingIndex = code.indexOf(delimiter, i + 3);
      const end = closingIndex === -1 ? length : closingIndex + 3;
      pushToken('string', i, end);
      i = end;
      continue;
    }

    if (language === 'javascript' && ch === '`') {
      const end = findStringEnd(code, i, '`', true);
      pushToken('string', i, end);
      i = end;
      continue;
    }

    if (ch === '\'' || ch === '"') {
      const end = findStringEnd(code, i, ch, false);
      pushToken('string', i, end);
      i = end;
      continue;
    }

    if (isNumberStart(code, i)) {
      const end = readNumber(code, i);
      pushToken('number', i, end);
      i = end;
      continue;
    }

    if (isIdentifierStart(ch)) {
      const end = readIdentifier(code, i);
      const identifier = code.slice(i, end);
      if (keywordSet && keywordSet.has(identifier)) {
        pushToken('keyword', i, end);
      } else {
        // Treat identifiers as plain text
        // No explicit token push; will be part of plain region
      }
      i = end;
      continue;
    }

    i += 1;
  }

  pushPlainUpTo(length);
  return mergePlainTokens(tokens);
}

function renderCodeSegments(
  codeElement: HTMLElement,
  codeText: string,
  segments: Array<{ chunkId: string; start: number; end: number; text: string }>,
  tokens: CodeToken[],
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  const doc = codeElement.ownerDocument;
  const fragment = doc.createDocumentFragment();

  let cursor = 0;
  let tokenIndex = 0;
  let tokenOffset = 0;

  const appendPlainRange = (start: number, end: number): void => {
    if (start < end) {
      fragment.appendChild(doc.createTextNode(codeText.slice(start, end)));
    }
  };

  for (const segment of segments) {
    if (segment.start >= segment.end) {
      continue;
    }

    if (segment.start > cursor) {
      appendPlainRange(cursor, segment.start);
    }

    const wrapper = doc.createElement('span');
    wrapper.classList.add(INLINE_CHUNK_CLASS, 'tp-code-chunk');
    addChunkIdToElement(wrapper, segment.chunkId);
    upsertChunkElement(chunkIdToElements, segment.chunkId, wrapper);

    let pos = segment.start;

    while (tokenIndex < tokens.length && tokens[tokenIndex].end <= pos) {
      tokenIndex += 1;
      tokenOffset = 0;
    }

    while (pos < segment.end) {
      if (tokenIndex >= tokens.length) {
        const text = codeText.slice(pos, segment.end);
        if (text) {
          wrapper.appendChild(doc.createTextNode(text));
        }
        pos = segment.end;
        break;
      }

      const token = tokens[tokenIndex];
      const tokenStart = token.start + tokenOffset;
      const tokenEnd = token.end;

      if (tokenEnd <= pos) {
        tokenIndex += 1;
        tokenOffset = 0;
        continue;
      }

      const chunkStart = Math.max(pos, tokenStart);
      const chunkEnd = Math.min(segment.end, tokenEnd);

      if (chunkStart > pos) {
        const plainText = codeText.slice(pos, chunkStart);
        if (plainText) {
          wrapper.appendChild(doc.createTextNode(plainText));
        }
        pos = chunkStart;
      }

      if (chunkEnd > chunkStart) {
        const tokenText = codeText.slice(chunkStart, chunkEnd);
        appendTokenNode(wrapper, token.type, tokenText);
        pos = chunkEnd;
        tokenOffset += chunkEnd - tokenStart;
      }

      if (chunkEnd >= tokenEnd) {
        tokenIndex += 1;
        tokenOffset = 0;
      }
    }

    fragment.appendChild(wrapper);
    cursor = segment.end;
  }

  if (cursor < codeText.length) {
    appendPlainRange(cursor, codeText.length);
  }

  codeElement.textContent = '';
  codeElement.appendChild(fragment);
}

function appendTokenNode(parent: HTMLElement, type: CodeTokenType, text: string): void {
  if (!text) {
    return;
  }

  if (type === 'plain') {
    parent.appendChild(parent.ownerDocument.createTextNode(text));
    return;
  }

  const span = parent.ownerDocument.createElement('span');
  span.classList.add('tp-code-token', `tp-code-token-${type}`);
  span.textContent = text;
  parent.appendChild(span);
}

function mergePlainTokens(tokens: CodeToken[]): CodeToken[] {
  if (tokens.length === 0) {
    return [{ type: 'plain', start: 0, end: 0 }];
  }

  const merged: CodeToken[] = [];
  for (const token of tokens) {
    if (token.type !== 'plain') {
      merged.push(token);
      continue;
    }

    const last = merged[merged.length - 1];
    if (last && last.type === 'plain' && last.end === token.start) {
      last.end = token.end;
    } else {
      merged.push({ ...token });
    }
  }

  if (merged.length === 0) {
    return [{ type: 'plain', start: 0, end: 0 }];
  }

  return merged;
}

function findStringEnd(code: string, start: number, delimiter: string, allowMultiline: boolean): number {
  const length = code.length;
  let i = start + delimiter.length;

  while (i < length) {
    if (!allowMultiline && code[i] === '\n') {
      return i;
    }

    if (code.startsWith('\\', i)) {
      i += 2;
      continue;
    }

    if (code.startsWith(delimiter, i)) {
      return i + delimiter.length;
    }

    i += 1;
  }

  return length;
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function isNumberStart(code: string, index: number): boolean {
  const ch = code[index];
  if (/\d/.test(ch)) {
    return true;
  }

  if (ch === '.' && index + 1 < code.length && /\d/.test(code[index + 1])) {
    return true;
  }

  return false;
}

function readNumber(code: string, start: number): number {
  let index = start;
  const length = code.length;

  if (code[index] === '0' && index + 1 < length && (code[index + 1] === 'x' || code[index + 1] === 'X')) {
    index += 2;
    while (index < length && /[0-9A-Fa-f_]/.test(code[index])) {
      index += 1;
    }
    return index;
  }

  while (index < length && /[0-9_]/.test(code[index])) {
    index += 1;
  }

  if (index < length && code[index] === '.') {
    index += 1;
    while (index < length && /[0-9_]/.test(code[index])) {
      index += 1;
    }
  }

  if (index < length && (code[index] === 'e' || code[index] === 'E')) {
    index += 1;
    if (code[index] === '+' || code[index] === '-') {
      index += 1;
    }
    while (index < length && /[0-9_]/.test(code[index])) {
      index += 1;
    }
  }

  return index;
}

function readIdentifier(code: string, start: number): number {
  let index = start;
  while (index < code.length && isIdentifierPart(code[index])) {
    index += 1;
  }
  return index;
}

function getKeywordSet(language: string): Set<string> | null {
  switch (language) {
    case 'python':
      return PYTHON_KEYWORDS;
    case 'javascript':
      return JAVASCRIPT_KEYWORDS;
    case 'bash':
      return BASH_KEYWORDS;
    default:
      return null;
  }
}

function normalizeLanguage(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const lower = value.toLowerCase();
  if (lower === 'python' || lower === 'py') {
    return 'python';
  }
  if (
    lower === 'javascript' ||
    lower === 'js' ||
    lower === 'jsx' ||
    lower === 'ts' ||
    lower === 'tsx' ||
    lower === 'node'
  ) {
    return 'javascript';
  }
  if (lower === 'bash' || lower === 'sh' || lower === 'shell' || lower === 'zsh') {
    return 'bash';
  }
  return '';
}

const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

const JAVASCRIPT_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'await',
  'async',
  'of',
  'true',
  'false',
  'null',
  'undefined',
]);

const BASH_KEYWORDS = new Set([
  'if',
  'then',
  'fi',
  'else',
  'elif',
  'for',
  'while',
  'do',
  'done',
  'in',
  'case',
  'esac',
  'break',
  'continue',
  'function',
  'select',
  'time',
  'coproc',
  'exec',
  'exit',
  'return',
]);

function assignLatexChunks(
  container: HTMLElement,
  chunkIds: string[],
  chunkTexts: Map<string, string>,
  chunkIdToElements: Map<string, HTMLElement[]>
): void {
  if (chunkIds.length === 0) {
    return;
  }

  const displayBlocks = Array.from(container.querySelectorAll<HTMLElement>('.katex-display'));
  const inlineBlocks = Array.from(container.querySelectorAll<HTMLElement>('.katex')).filter((element) => {
    return !element.parentElement || !element.parentElement.classList.contains('katex-display');
  });
  const katexBlocks = [...displayBlocks, ...inlineBlocks];

  if (katexBlocks.length === 0) {
    return;
  }

  let chunkIndex = 0;

  for (const block of katexBlocks) {
    if (chunkIndex >= chunkIds.length) {
      break;
    }

    const annotationElement = block.querySelector('annotation[encoding="application/x-tex"]');
    const originalLatex = annotationElement?.textContent ?? '';

    const displayMode = block.classList.contains('katex-display');
    const katexContainer = displayMode ? block.querySelector<HTMLElement>('.katex') : block;

    if (!katexContainer) {
      continue;
    }

    const contentChunks: Array<{ chunkId: string; text: string }> = [];

    let encounteredContent = false;
    while (chunkIndex < chunkIds.length) {
      const chunkId = chunkIds[chunkIndex];
      const rawText = chunkTexts.get(chunkId) ?? '';
      const trimmed = rawText.trim();
      const isDelimiter = isMathDelimiter(trimmed);

      if (!encounteredContent && isDelimiter) {
        // Opening delimiter belongs to this block but doesn't contribute to visual content
        addChunkIdToElement(block, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, block);
        chunkIndex += 1;
        continue;
      }

      if (isDelimiter) {
        // Closing delimiter ends the current math group
        addChunkIdToElement(block, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, block);
        chunkIndex += 1;
        break;
      }

      if (!rawText) {
        chunkIndex += 1;
        continue;
      }

      encounteredContent = true;
      contentChunks.push({ chunkId, text: rawText });
      chunkIndex += 1;

      if (!displayMode) {
        // Inline math expressions may not use explicit delimiters; stop when we reach the end of content
        if (chunkIndex >= chunkIds.length || isMathDelimiter((chunkTexts.get(chunkIds[chunkIndex]) ?? '').trim())) {
          break;
        }
      }
    }

    if (contentChunks.length === 0) {
      continue;
    }

    const decoratedLatex = buildDecoratedLatex(originalLatex, contentChunks);
    if (!decoratedLatex) {
      for (const { chunkId } of contentChunks) {
        addChunkIdToElement(block, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, block);
      }
      continue;
    }

    try {
      katex.render(decoratedLatex, katexContainer, {
        displayMode,
        throwOnError: false,
        trust: true,
        strict: 'ignore',
      });
    } catch (error) {
      console.error('Failed to render decorated KaTeX expression', error);
      for (const { chunkId } of contentChunks) {
        addChunkIdToElement(block, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, block);
      }
      continue;
    }

    for (const { chunkId } of contentChunks) {
      const wrappers = block.querySelectorAll<HTMLElement>(`[data-chunk-id="${chunkId}"]`);
      if (wrappers.length === 0) {
        addChunkIdToElement(block, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, block);
        continue;
      }

      wrappers.forEach((wrapper) => {
        wrapper.classList.add(INLINE_CHUNK_CLASS);
        addChunkIdToElement(wrapper, chunkId);
        upsertChunkElement(chunkIdToElements, chunkId, wrapper);
      });
    }
  }
}

function buildDecoratedLatex(
  originalLatex: string,
  contentChunks: Array<{ chunkId: string; text: string }>
): string {
  if (!originalLatex) {
    return contentChunks.map(({ chunkId, text }) => wrapChunkLatex(chunkId, text)).join('');
  }

  let cursor = 0;
  let result = '';

  for (const { chunkId, text } of contentChunks) {
    if (!text) {
      continue;
    }

    let start = originalLatex.indexOf(text, cursor);
    let end = start === -1 ? -1 : start + text.length;

    if (start === -1) {
      const trimmed = text.trim();
      if (trimmed) {
        start = originalLatex.indexOf(trimmed, cursor);
        end = start === -1 ? -1 : start + trimmed.length;
      }
    }

    if (start === -1 || end === -1) {
      return contentChunks.map(({ chunkId: id, text: segment }) => wrapChunkLatex(id, segment)).join('');
    }

    if (start > cursor) {
      result += originalLatex.slice(cursor, start);
    }

    result += wrapChunkLatex(chunkId, originalLatex.slice(start, end));
    cursor = end;
  }

  if (cursor < originalLatex.length) {
    result += originalLatex.slice(cursor);
  }

  return result;
}

function wrapChunkLatex(chunkId: string, latex: string): string {
  const sanitized = latex || '';
  const attr = `chunk-id=${chunkId},chunk-ids=${chunkId}`;
  return `\\htmlData{${attr}}{${sanitized}}`;
}

function isMathDelimiter(value: string): boolean {
  return value === '$$' || value === '\\[' || value === '\\]' || value === '\\(' || value === '\\)';
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
  targetChunks: string[]
): void {
  if (targetChunks.length === 0) {
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
