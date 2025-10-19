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
  ChunkSize,
  IRData,
  ElementLocationDetails,
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
function buildElementLocationMetadata(
  promptData: PromptData | null,
  sourcePrefix: string
): {
  displayMap: Record<string, string>;
  detailMap: Record<string, ElementLocationDetails>;
} {
  const displayMap: Record<string, string> = {};
  const detailMap: Record<string, ElementLocationDetails> = {};

  if (!promptData) {
    return { displayMap, detailMap };
  }

  const cloneLocation = (location: SourceLocationData | null | undefined): SourceLocationData | null => {
    if (!location) {
      return null;
    }
    return {
      filename: location.filename ?? null,
      filepath: location.filepath ?? null,
      line: location.line ?? null,
    };
  };

  function walkElements(elements: ElementData[]): void {
    for (const element of elements) {
      // Format source_location (where interpolated/used)
      const sourceLoc = formatSourceLocation(element.source_location, sourcePrefix);

      // Format creation_location (where originally created)
      const creationLoc = formatSourceLocation(element.creation_location, sourcePrefix);

      // Build location string
      if (sourceLoc && creationLoc && sourceLoc !== creationLoc) {
        // Both locations exist and differ (nested prompt case)
        displayMap[element.id] = `${sourceLoc} (created: ${creationLoc})`;
      } else if (sourceLoc) {
        // Just source location
        displayMap[element.id] = sourceLoc;
      } else if (creationLoc) {
        // Just creation location (shouldn't happen normally)
        displayMap[element.id] = creationLoc;
      }
      // If neither exists, no entry in map

      const details: ElementLocationDetails = {};
      const sourceClone = cloneLocation(element.source_location);
      const creationClone = cloneLocation(element.creation_location);
      if (sourceClone) {
        details.source = sourceClone;
      }
      if (creationClone) {
        details.creation = creationClone;
      }
      if (details.source || details.creation) {
        detailMap[element.id] = details;
      }

      // Recursively process nested elements
      if (element.children) {
        walkElements(element.children);
      }
    }
  }

  // Start walking from the root prompt's children
  walkElements(promptData.children);
  return { displayMap, detailMap };
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
 * Build a map from chunk ID to chunk size (character count and pixel width).
 *
 * For text chunks:
 *   - character: number of text characters (for LLM token estimation)
 *   - pixel: 0 (text doesn't have pixel dimensions)
 *
 * For image chunks:
 *   - character: 0 (images don't have text characters)
 *   - pixel: width * height in pixels
 *
 * @param irData - The IR data containing chunks
 * @returns Map from chunk ID to size information
 */
function buildChunkSizeMap(irData: IRData | null): Record<string, ChunkSize> {
  const map: Record<string, ChunkSize> = {};

  if (!irData || !irData.chunks) {
    return map;
  }

  for (const chunk of irData.chunks) {
    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      // Text chunks: count characters, no pixel size
      map[chunk.id] = {
        character: chunk.text.length,
        pixel: 0,
      };
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunks: no character count, use pixel dimensions (width * height)
      const imgData = chunk.image;
      map[chunk.id] = {
        character: 0,
        pixel: imgData.width * imgData.height,
      };
    } else {
      // Unknown chunk type
      map[chunk.id] = {
        character: 0,
        pixel: 0,
      };
    }
  }

  return map;
}

function buildChunkLocationMap(
  irData: IRData | null,
  elementLocationDetails: Record<string, ElementLocationDetails>
): Record<
  string,
  {
    elementId: string;
    source?: SourceLocationData | null;
    creation?: SourceLocationData | null;
  }
> {
  const map: Record<
    string,
    {
      elementId: string;
      source?: SourceLocationData | null;
      creation?: SourceLocationData | null;
    }
  > = {};

  if (!irData || !irData.chunks) {
    return map;
  }

  for (const chunk of irData.chunks) {
    const elementId = chunk.element_id;
    const elementDetails = elementLocationDetails[elementId];
    map[chunk.id] = {
      elementId,
      source: elementDetails?.source ?? null,
      creation: elementDetails?.creation ?? null,
    };
  }

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

  const { displayMap, detailMap } = buildElementLocationMetadata(data.source_prompt || null, sourcePrefix);

  const chunkLocationMap = buildChunkLocationMap(data.ir || null, detailMap);

  return {
    elementTypeMap: buildElementTypeMap(data.source_prompt || null),
    elementLocationMap: displayMap,
    elementLocationDetails: detailMap,
    chunkSizeMap: buildChunkSizeMap(data.ir || null),
    chunkLocationMap,
  };
}
