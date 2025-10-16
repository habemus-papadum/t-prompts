/**
 * Widget renderer for structured prompts
 */

// Type definitions for widget data structures
interface WidgetData {
  compiled_ir?: CompiledIRData;
  ir?: IRData;
  source_prompt?: PromptData;
  config?: ConfigData;
}

interface ConfigData {
  wrapping: boolean;
  sourcePrefix: string;
}

interface CompiledIRData {
  ir_id: string;
  subtree_map: Record<string, string[]>;
  num_elements: number;
}

interface IRData {
  chunks: ChunkData[];
  source_prompt_id: string | null;
  id: string;
  metadata: Record<string, unknown>;
}

interface PromptData {
  prompt_id: string;
  children: ElementData[];
}

interface SourceLocationData {
  filename: string | null;
  filepath: string | null;
  line: number | null;
}

interface ElementData {
  type: string;
  key: string | number;
  id: string;
  source_location?: SourceLocationData | null;
  creation_location?: SourceLocationData | null;
  children?: ElementData[];
  [key: string]: unknown;
}

interface ChunkData {
  type: string;
  text?: string;
  image?: ImageData;
  element_id: string;
  id: string;
  metadata: Record<string, unknown>;
}

interface ImageData {
  base64_data: string;
  format: string;
  width: number;
  height: number;
}

interface TextMapping {
  fullText: string;
  offsetToChunkId: string[];
  chunkIdToOffsets: Record<string, { start: number; end: number }>;
}

interface RenderResult {
  container: HTMLDivElement;
  textMapping: TextMapping;
}

/**
 * Centralized metadata computed from widget data.
 * These maps are view-agnostic and can be reused across different visualizations.
 */
interface WidgetMetadata {
  elementTypeMap: Record<string, string>;
  elementLocationMap: Record<string, string>;
}

/**
 * ID Conversion Utilities
 *
 * Convention: Python UUIDs are prefixed with "id-" when used as DOM element IDs.
 * This ensures IDs always start with a letter (HTML spec compliant) and avoids
 * CSS selector issues with IDs starting with digits.
 */

/**
 * Convert a Python UUID to a DOM element ID by prefixing with "id-"
 */
export function toElementId(pythonId: string): string {
  return `id-${pythonId}`;
}

/**
 * Convert a DOM element ID back to Python UUID by removing the "id-" prefix
 */
export function fromElementId(elementId: string): string {
  if (elementId.startsWith('id-')) {
    return elementId.substring(3);
  }
  return elementId;
}

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
function computeWidgetMetadata(data: WidgetData): WidgetMetadata {
  const sourcePrefix = data.config?.sourcePrefix || '';

  return {
    elementTypeMap: buildElementTypeMap(data.source_prompt || null),
    elementLocationMap: buildElementLocationMap(data.source_prompt || null, sourcePrefix),
  };
}

/**
 * Render chunks to DOM elements with text mapping
 */
function renderChunksToDOM(
  chunks: ChunkData[],
  metadata: WidgetMetadata
): RenderResult {
  // Create container
  const container = document.createElement('div');
  container.className = 'tp-output-container wrap';

  // Initialize text mapping
  let fullText = '';
  const offsetToChunkId: string[] = [];
  const chunkIdToOffsets: Record<string, { start: number; end: number }> = {};

  // Process each chunk
  for (const chunk of chunks) {
    let chunkText = '';
    let chunkElement: HTMLElement;

    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      // Text chunk - use actual text
      chunkText = chunk.text;

      const span = document.createElement('span');
      span.id = toElementId(chunk.id);
      span.textContent = chunkText;

      // Determine element type and apply class
      const elementType = metadata.elementTypeMap[chunk.element_id] || 'unknown';
      span.className = `tp-chunk-${elementType}`;

      // Add source location as title (hover tooltip) if available
      const location = metadata.elementLocationMap[chunk.element_id];
      if (location) {
        span.title = location;
      }

      chunkElement = span;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunk - create container with text placeholder and hidden preview image
      const imgData = chunk.image;
      const format = imgData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imgData.base64_data}`;
      chunkText = `![${format} ${imgData.width}x${imgData.height}](${dataUrl})`;

      // Create container for text + preview image
      const container = document.createElement('span');
      container.className = 'tp-chunk-image-container';
      container.id = toElementId(chunk.id);

      // Text placeholder
      const textSpan = document.createElement('span');
      textSpan.className = 'tp-chunk-image';
      textSpan.textContent = chunkText;

      // Add source location as title if available
      const location = metadata.elementLocationMap[chunk.element_id];
      if (location) {
        textSpan.title = location;
      }

      // Hidden preview image (shown on hover via CSS)
      const previewImg = document.createElement('img');
      previewImg.className = 'tp-chunk-image-preview';
      previewImg.src = dataUrl;
      previewImg.alt = `${format} ${imgData.width}x${imgData.height}`;

      container.appendChild(textSpan);
      container.appendChild(previewImg);

      chunkElement = container;
    } else {
      // Unknown chunk type - create empty span
      const span = document.createElement('span');
      span.id = toElementId(chunk.id);
      chunkElement = span;
    }

    // Record text mapping
    const startOffset = fullText.length;
    const endOffset = startOffset + chunkText.length;

    // Add to full text
    fullText += chunkText;

    // Map each character offset to chunk ID
    for (let i = startOffset; i < endOffset; i++) {
      offsetToChunkId.push(chunk.id);
    }

    // Map chunk ID to offsets
    chunkIdToOffsets[chunk.id] = { start: startOffset, end: endOffset };

    // Append element to container
    container.appendChild(chunkElement);
  }

  return {
    container,
    textMapping: {
      fullText,
      offsetToChunkId,
      chunkIdToOffsets,
    },
  };
}

/**
 * Mark first and last spans for each element based on compiled IR
 */
function markElementBoundaries(
  outputContainer: HTMLDivElement,
  compiledIR: CompiledIRData | null,
  metadata: WidgetMetadata
): void {
  if (!compiledIR || !compiledIR.subtree_map) {
    return;
  }

  // Iterate through each element and its chunks
  for (const [elementId, chunkIds] of Object.entries(compiledIR.subtree_map)) {
    if (chunkIds.length === 0) {
      continue;
    }

    // Get element type for this element
    const elementType = metadata.elementTypeMap[elementId] || 'unknown';

    // Mark first chunk - convert Python UUID to element ID for DOM query
    const firstChunkId = chunkIds[0];
    const firstSpan = outputContainer.querySelector(`[id="${toElementId(firstChunkId)}"]`);
    if (firstSpan) {
      firstSpan.classList.add(`tp-first-${elementType}`);
    }

    // Mark last chunk
    const lastChunkId = chunkIds[chunkIds.length - 1];
    const lastSpan = outputContainer.querySelector(`[id="${toElementId(lastChunkId)}"]`);
    if (lastSpan) {
      lastSpan.classList.add(`tp-last-${elementType}`);
    }
  }
}

/**
 * Initialize a widget in the given container
 */
export function initWidget(container: HTMLElement): void {
  try {
    // Find the embedded JSON data
    const scriptTag = container.querySelector('script[data-role="tp-widget-data"]');
    if (!scriptTag || !scriptTag.textContent) {
      container.innerHTML = '<div class="tp-error">No widget data found</div>';
      return;
    }

    const data: WidgetData = JSON.parse(scriptTag.textContent);

    // Extract chunks from the IR
    if (!data.ir || !data.ir.chunks) {
      container.innerHTML = '<div class="tp-error">No chunks found in widget data</div>';
      return;
    }

    // Compute all metadata (element type map, location map, etc.)
    const metadata = computeWidgetMetadata(data);

    // Render chunks to DOM with text mapping
    const { container: outputContainer, textMapping } = renderChunksToDOM(
      data.ir.chunks,
      metadata
    );

    // Mark element boundaries using compiled IR
    markElementBoundaries(outputContainer, data.compiled_ir || null, metadata);

    // Store text mapping on container for future use
    (outputContainer as HTMLDivElement & { _textMapping: TextMapping })._textMapping = textMapping;

    // Wrap in widget output container
    const widgetOutput = document.createElement('div');
    widgetOutput.className = 'tp-widget-output';
    widgetOutput.appendChild(outputContainer);

    // Find the widget mount point and render
    const mountPoint = container.querySelector('.tp-widget-mount');
    if (mountPoint) {
      mountPoint.innerHTML = '';
      mountPoint.appendChild(widgetOutput);
    } else {
      container.innerHTML = '';
      container.appendChild(widgetOutput);
    }
  } catch (error) {
    console.error('Widget initialization error:', error);
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${
      error instanceof Error ? error.message : String(error)
    }</div>`;
  }
}
