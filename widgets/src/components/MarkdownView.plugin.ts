/**
 * Custom markdown-it plugin for source position tracking
 *
 * This plugin tracks the mapping between source text positions and rendered DOM elements.
 * It works by intercepting the token stream and adding position metadata to each token,
 * then modifying the renderer to add data attributes to the output HTML.
 */

import type MarkdownIt from 'markdown-it';

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
 * Counter for generating unique element IDs
 */
let elementIdCounter = 0;

/**
 * Reset the element ID counter (useful for testing)
 */
export function resetElementIdCounter(): void {
  elementIdCounter = 0;
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
export function sourcePositionPlugin(md: MarkdownIt, positionMap: ElementPositionMap): void {
  // Store original renderer rules
  const defaultRenderers: Record<string, MarkdownIt.Renderer.RenderRule> = {};

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
    // Don't track other inline elements - they don't have reliable map data
    // 'strong_open',
    // 'em_open',
    // 'link_open',
  ];

  tokenTypes.forEach((type) => {
    // Save original renderer
    defaultRenderers[type] = md.renderer.rules[type] || md.renderer.renderToken.bind(md.renderer);

    // Override with position-tracking version
    md.renderer.rules[type] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];

      // Add unique element ID to token attributes
      if (token.map !== null && token.map !== undefined) {
        // token.map is [startLine, endLine] - we need to convert to character positions
        // For now, store the line info and generate a unique ID
        const elementId = `md-elem-${elementIdCounter++}`;
        token.attrSet('data-md-id', elementId);

        // Store position info (using line-based mapping for now)
        // Note: We'll improve this to use character positions in the mapping stage
        positionMap.set(elementId, {
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
  const lineOffsets: number[] = [0]; // line 0 starts at char 0
  for (let i = 0; i < markdownText.length; i++) {
    if (markdownText[i] === '\n') {
      lineOffsets.push(i + 1); // next line starts after \n
    }
  }
  lineOffsets.push(markdownText.length); // EOF position

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
