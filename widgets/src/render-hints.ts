/**
 * Render hints parsing and application
 *
 * Parses and applies render hints like header=X and xml=Y to elements.
 * Matches Python behavior in src/t_prompts/parsing.py
 */

import { createSpan } from './dom-builder';
import { CodeViewBuilder } from './code-view-builder';
import { StringWithMapping } from './string-mapper';

/**
 * Parsed render hints structure
 */
export interface ParsedRenderHints {
  xml?: string;
  header?: string;
  sep?: string;
}

/**
 * Parse render hints from format spec
 *
 * Matches Python's parse_render_hints() function.
 * Format: "header=Text:xml=tag:sep=,"
 *
 * @param renderHints - The render hints string (after first colon in format spec)
 * @param key - The interpolation key (used as default for header if no value)
 * @returns Parsed hints object
 */
export function parseRenderHints(renderHints: string, key: string): ParsedRenderHints {
  if (!renderHints) {
    return {};
  }

  const result: ParsedRenderHints = {};

  // Split on colon and process each hint
  for (const hint of renderHints.split(':')) {
    const trimmed = hint.trim();

    if (trimmed.startsWith('xml=')) {
      // Extract XML tag name (no whitespace allowed in value)
      const xmlValue = trimmed.substring(4).trim();
      if (/\s/.test(xmlValue)) {
        throw new Error(`XML tag name cannot contain whitespace: ${xmlValue}`);
      }
      result.xml = xmlValue;
    } else if (trimmed.startsWith('header=')) {
      // Extract header text (whitespace allowed in heading)
      result.header = trimmed.substring(7).trim();
    } else if (trimmed === 'header') {
      // No value specified, use the key as heading
      result.header = key;
    } else if (hint.trim().startsWith('sep=')) {
      // Extract separator value
      // Use hint (not trimmed) to preserve leading/trailing whitespace in separator
      const sepStart = hint.indexOf('sep=') + 4;
      result.sep = hint.substring(sepStart);
    }
  }

  return result;
}

/**
 * Apply header hint by adding header span and string
 *
 * Creates: "# Header\n" or "## Header\n" etc based on level
 *
 * @param codeView - The code view builder
 * @param string - The string mapper
 * @param parentElementId - ID of parent element
 * @param headerText - The header text
 * @param level - Header level (1-6)
 * @returns The ID of the created header element
 */
export function applyHeaderHint(
  codeView: CodeViewBuilder,
  string: StringWithMapping,
  parentElementId: string,
  headerText: string,
  level: number
): string {
  const headerId = `${parentElementId}-header`;
  const headerContent = '#'.repeat(level) + ' ' + headerText + '\n';

  // Add to code view
  const headerSpan = createSpan(
    {
      'data-element-id': headerId,
      'data-type': 'render-hint-header',
      'data-parent-id': parentElementId,
      'data-level': String(level),
      'class': 'tp-render-hint-header',
    },
    headerContent
  );

  // Note: CodeViewBuilder should handle appending to current parent
  // For now we'll need to get container and append
  codeView.getContainer().appendChild(headerSpan);

  // Add to string
  string.append(headerId, headerContent);

  return headerId;
}

/**
 * Apply XML hint by adding opening or closing tag
 *
 * Creates: "<tag>\n" or "\n</tag>"
 *
 * @param codeView - The code view builder
 * @param string - The string mapper
 * @param parentElementId - ID of parent element
 * @param xmlTag - The XML tag name
 * @param position - Whether this is 'open' or 'close' tag
 * @returns The ID of the created XML element
 */
export function applyXmlHint(
  codeView: CodeViewBuilder,
  string: StringWithMapping,
  parentElementId: string,
  xmlTag: string,
  position: 'open' | 'close'
): string {
  const xmlId = `${parentElementId}-xml-${position}`;
  const xmlContent = position === 'open' ? `<${xmlTag}>\n` : `\n</${xmlTag}>`;

  // Add to code view
  const xmlSpan = createSpan(
    {
      'data-element-id': xmlId,
      'data-type': `render-hint-xml-${position}`,
      'data-parent-id': parentElementId,
      'data-xml-tag': xmlTag,
      'class': `tp-render-hint-xml tp-render-hint-xml-${position}`,
    },
    xmlContent
  );

  codeView.getContainer().appendChild(xmlSpan);

  // Add to string
  string.append(xmlId, xmlContent);

  return xmlId;
}

/**
 * Calculate next header level for nested rendering
 *
 * @param currentLevel - Current header level
 * @param hasHeaderHint - Whether the element has a header hint
 * @returns Next level for nested elements
 */
export function getNextHeaderLevel(
  currentLevel: number,
  hasHeaderHint: boolean
): number {
  return hasHeaderHint ? currentLevel + 1 : currentLevel;
}

/**
 * Cap header level at maximum
 *
 * @param level - Desired level
 * @param maxLevel - Maximum allowed level (default 4)
 * @returns Capped level
 */
export function capHeaderLevel(level: number, maxLevel: number = 4): number {
  return Math.min(level, maxLevel);
}
