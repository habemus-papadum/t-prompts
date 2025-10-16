/**
 * Metadata computation and analysis (Phase 1 & 2)
 *
 * These functions analyze widget data and build lookup maps
 * that are view-agnostic and reusable across visualizations.
 */

import type {
  WidgetData,
  WidgetMetadata,
  PromptData,
  ElementData,
  SourceLocationData,
} from './types';

/**
 * Trim the source prefix from a file path to make it relative
 *
 * @param filepath - The absolute file path
 * @param prefix - The prefix to remove (e.g., project root directory)
 * @returns The relative path, or original path if prefix doesn't match
 *
 * @example
 * trimSourcePrefix('/Users/dev/project/src/main.py', '/Users/dev/project')
 * // Returns: 'src/main.py'
 */
export function trimSourcePrefix(filepath: string | null, prefix: string): string | null {
  if (!filepath) {
    return null;
  }

  // Normalize prefix to ensure it ends with a separator
  const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';

  // Check if filepath starts with the prefix
  if (filepath.startsWith(normalizedPrefix)) {
    return filepath.substring(normalizedPrefix.length);
  }

  // Also check without trailing slash in case filepath === prefix
  if (filepath === prefix) {
    return '.';
  }

  // Prefix doesn't match - return original path
  return filepath;
}

/**
 * Format a source location as a compact string
 *
 * @param location - The source location data
 * @param sourcePrefix - The prefix to trim from filepaths
 * @returns Formatted location string (e.g., "src/main.py:42") or null if location not available
 */
function formatSourceLocation(
  location: SourceLocationData | null | undefined,
  sourcePrefix: string
): string | null {
  if (!location || !location.filename) {
    return null;
  }

  // Use filepath if available, otherwise use filename
  const path = location.filepath || location.filename;
  const relativePath = trimSourcePrefix(path, sourcePrefix) || path;

  // Add line number if available
  if (location.line !== null && location.line !== undefined) {
    return `${relativePath}:${location.line}`;
  }

  return relativePath;
}

/**
 * Build a map from element_id to formatted location string by walking the source prompt tree
 *
 * For elements with both source_location and creation_location (nested prompts),
 * the format is: "source.py:84 (created: other.py:42)"
 */
function buildElementLocationMap(
  promptData: PromptData | null,
  sourcePrefix: string
): Record<string, string> {
  const map: Record<string, string> = {};

  if (!promptData) {
    return map;
  }

  function walkElements(elements: ElementData[]): void {
    for (const element of elements) {
      // Format source_location (where interpolated/used)
      const sourceLoc = formatSourceLocation(element.source_location, sourcePrefix);

      // Format creation_location (where originally created)
      const creationLoc = formatSourceLocation(element.creation_location, sourcePrefix);

      // Build location string
      if (sourceLoc && creationLoc && sourceLoc !== creationLoc) {
        // Both locations exist and differ (nested prompt case)
        map[element.id] = `${sourceLoc} (created: ${creationLoc})`;
      } else if (sourceLoc) {
        // Just source location
        map[element.id] = sourceLoc;
      } else if (creationLoc) {
        // Just creation location (shouldn't happen normally)
        map[element.id] = creationLoc;
      }
      // If neither exists, no entry in map

      // Recursively process nested elements
      if (element.children) {
        walkElements(element.children);
      }
    }
  }

  // Start walking from the root prompt's children
  walkElements(promptData.children);
  return map;
}

/**
 * Build a map from element_id to element_type by walking the source prompt tree
 */
function buildElementTypeMap(promptData: PromptData | null): Record<string, string> {
  const map: Record<string, string> = {};

  if (!promptData) {
    return map;
  }

  function walkElements(elements: ElementData[]): void {
    for (const element of elements) {
      map[element.id] = element.type;

      // Recursively process nested elements
      if (element.children) {
        walkElements(element.children);
      }
    }
  }

  // Start walking from the root prompt's children
  walkElements(promptData.children);
  return map;
}

/**
 * Compute all widget metadata from widget data.
 * This centralizes all map-building logic and creates view-agnostic metadata
 * that can be reused across different visualizations.
 *
 * @param data - The widget data
 * @returns Metadata containing all computed maps
 */
export function computeWidgetMetadata(data: WidgetData): WidgetMetadata {
  const sourcePrefix = data.config?.sourcePrefix || '';

  return {
    elementTypeMap: buildElementTypeMap(data.source_prompt || null),
    elementLocationMap: buildElementLocationMap(data.source_prompt || null, sourcePrefix),
  };
}
