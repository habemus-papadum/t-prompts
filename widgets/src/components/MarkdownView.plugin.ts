/**
 * Custom markdown-it plugin for source position tracking
 *
 * This plugin tracks the mapping between source text positions and rendered DOM elements.
 * It works by intercepting the token stream and adding position metadata to each token,
 * theIt needs all this run-time infrastructure. But at the same time, don't try writing unit tests for this; it was basically very difficult. What I don't know is if you've changed the logic.n modifying the renderer to add data attributes to the output HTML.
 */

import type MarkdownIt from 'markdown-it';
import type { RenderRule } from 'markdown-it/lib/renderer';

/**
 * Position range in source text
 */
export interface PositionRange {
  start: number;
  end: number;
}

/**
 * Element position map: element ID → source position range
 */
export type ElementPositionMap = Map<string, PositionRange>;

/**
 * Inline element position map: inline ID → source position range
 */
export type InlinePositionMap = Map<string, PositionRange>;

/**
 * Position maps used by the markdown-it plugin
 */
interface SourcePositionMaps {
  block: ElementPositionMap;
  inline: InlinePositionMap;
}

/**
 * Counter for generating unique element IDs
 */
let elementIdCounter = 0;
let inlineIdCounter = 0;

/**
 * Reset the element ID counter (useful for testing)
 */
export function resetElementIdCounter(): void {
  elementIdCounter = 0;
  inlineIdCounter = 0;
}

/**
 * markdown-it plugin that adds source position tracking
 *
 * Usage:
 *   const md = new MarkdownIt();
 *   const positionMap = new Map();
 *   md.use(sourcePositionPlugin, positionMap);
 *   const html = md.render(markdownText);
 *   // Now positionMap contains element-id → position mappings
 *
 * @param md - The markdown-it instance
 * @param positionMap - Map to populate with element positions
 */
export function sourcePositionPlugin(md: MarkdownIt, positionMaps: SourcePositionMaps): void {
  const blockPositionMap = positionMaps.block;
  const inlinePositionMap = positionMaps.inline;

  // Store original renderer rules
  const defaultRenderers: Record<string, RenderRule> = {};

  // Override renderer for all token types that generate opening tags
  // NOTE: Only track *_open tokens, not *_close, since only open tags get attributes
  const tokenTypes = [
    'heading_open',
    'paragraph_open',
    'list_item_open',
    'blockquote_open',
    'code_block',
    'fence',
    'hr',
    'bullet_list_open',
    'ordered_list_open',
    'image', // Track images for chunk mapping
    'math_block',
    'math_inline',
    // Don't track other inline elements - they don't have reliable map data
    // 'strong_open',
    // 'em_open',
    // 'link_open',
  ];

  tokenTypes.forEach((type) => {
    // Save original renderer
    defaultRenderers[type] = md.renderer.rules[type] || md.renderer.renderToken.bind(md.renderer);

    // Override with position-tracking version
    md.renderer.rules[type] = (tokens, idx, options, env, self): string => {
      const token = tokens[idx];

      // Add unique element ID to token attributes
      if (token.map !== null && token.map !== undefined) {
        // token.map is [startLine, endLine] - we need to convert to character positions
        // For now, store the line info and generate a unique ID
        const elementId = `md-elem-${elementIdCounter++}`;
        token.attrSet('data-md-id', elementId);

        // Store position info (using line-based mapping for now)
        // Note: We'll improve this to use character positions in the mapping stage
        blockPositionMap.set(elementId, {
          start: token.map[0],
          end: token.map[1],
        });
      }

      // Call original renderer
      const originalRenderer = defaultRenderers[type];
      if (originalRenderer === md.renderer.renderToken.bind(md.renderer)) {
        return md.renderer.renderToken(tokens, idx, options);
      }
      return originalRenderer(tokens, idx, options, env, self);
    };
  });
  const fallbackTextRenderer: RenderRule = (tokens, idx) => tokens[idx].content;
  const originalTextRenderer = md.renderer.rules.text || fallbackTextRenderer;

  md.renderer.rules.text = (tokens, idx, options, env, self): string => {
    const token = tokens[idx];
    const inlineId = token.meta?.inlineId;
    const rendered = originalTextRenderer(tokens, idx, options, env, self);

    if (!inlineId) {
      return rendered;
    }

    return `<span data-md-inline-id="${inlineId}">${rendered}</span>`;
  };

  const fallbackCodeInlineRenderer: RenderRule = (tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options);
  const originalCodeInline = md.renderer.rules.code_inline || fallbackCodeInlineRenderer;

  md.renderer.rules.code_inline = (tokens, idx, options, env, self): string => {
    const token = tokens[idx];
    const inlineId = token.meta?.inlineId;

    if (inlineId) {
      token.attrSet('data-md-inline-id', inlineId);
    }

    return originalCodeInline(tokens, idx, options, env, self);
  };

  md.core.ruler.after('inline', 'tp-track-inline-positions', (state): void => {
    inlinePositionMap.clear();

    const src = state.src;
    const lineOffsets = computeLineOffsets(src);
    inlineIdCounter = 0;

    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.map || !token.children) {
        continue;
      }

      const [startLine, endLine] = token.map;
      const segmentStart = lineOffsets[startLine] ?? 0;
      const segmentEnd = lineOffsets[endLine] ?? src.length;
      const sourceSegment = src.slice(segmentStart, segmentEnd);
      const inlineContent = token.content;

      if (!inlineContent) {
        continue;
      }

      const relativeIndex = sourceSegment.indexOf(inlineContent);
      const inlineStart = relativeIndex === -1 ? segmentStart : segmentStart + relativeIndex;
      let pointer = 0;

      for (const child of token.children) {
        if (!child) {
          continue;
        }

        if (child.type === 'softbreak') {
          const newlineIndex = inlineContent.indexOf('\n', pointer);
          if (newlineIndex !== -1) {
            pointer = newlineIndex + 1;
          }
          continue;
        }

        const childContent = child.content || '';
        if (!childContent) {
          if (child.markup) {
            const markupIndex = inlineContent.indexOf(child.markup, pointer);
            if (markupIndex !== -1) {
              pointer = markupIndex + child.markup.length;
            }
          }
          continue;
        }

        const matchIndex = inlineContent.indexOf(childContent, pointer);
        if (matchIndex === -1) {
          continue;
        }

        const start = inlineStart + matchIndex;
        const end = start + childContent.length;
        const inlineId = `md-inline-${inlineIdCounter++}`;

        child.meta = child.meta || {};
        child.meta.inlineId = inlineId;
        inlinePositionMap.set(inlineId, { start, end });

        pointer = matchIndex + childContent.length;
      }
    }
  });
}

/**
 * Convert line-based positions to character positions
 *
 * markdown-it tokens use line numbers, but we need character offsets.
 * This function converts the line-based position map to character offsets.
 *
 * @param markdownText - The source markdown text
 * @param linePositionMap - Map of element ID → line range
 * @returns Map of element ID → character range
 */
export function convertLineToCharPositions(
  markdownText: string,
  linePositionMap: ElementPositionMap
): ElementPositionMap {
  // Build line offset lookup table
  const lineOffsets = computeLineOffsets(markdownText);

  // Convert each line range to character range
  const charPositionMap = new Map<string, PositionRange>();
  for (const [elementId, lineRange] of linePositionMap.entries()) {
    const startLine = lineRange.start;
    const endLine = lineRange.end;

    // Convert line numbers to character positions
    const start = lineOffsets[startLine] || 0;
    const end = lineOffsets[endLine] || markdownText.length;

    charPositionMap.set(elementId, { start, end });
  }

  return charPositionMap;
}

function computeLineOffsets(markdownText: string): number[] {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < markdownText.length; i++) {
    if (markdownText[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }
  lineOffsets.push(markdownText.length);
  return lineOffsets;
}
