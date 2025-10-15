/**
 * Widget renderer for structured prompts
 */

// Type definitions for widget data structures
interface WidgetData {
  compiled_ir?: CompiledIRData;
  ir?: IRData;
  source_prompt?: PromptData;
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

interface ElementData {
  type: string;
  key: string | number;
  id: string;
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
 * Build a map from element_id to element_type by walking the source prompt tree
 */
function buildElementTypeMap(promptData: PromptData | null): Record<string, string> {
  const map: Record<string, string> = {};

  if (!promptData) {
    return map;
  }

  function walkElements(elements: ElementData[]) {
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
 * Render chunks to DOM elements with text mapping
 */
function renderChunksToDOM(
  chunks: ChunkData[],
  elementTypeMap: Record<string, string>
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
    const span = document.createElement('span');
    span.id = toElementId(chunk.id);

    let chunkText = '';

    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      // Text chunk - use actual text
      chunkText = chunk.text;
      span.textContent = chunkText;

      // Determine element type and apply class
      const elementType = elementTypeMap[chunk.element_id] || 'unknown';
      span.className = `tp-chunk-${elementType}`;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunk - use markdown-style placeholder with data URL
      const imgData = chunk.image;
      const format = imgData.format || 'PNG';
      const dataUrl = `data:image/${format.toLowerCase()};base64,${imgData.base64_data}`;
      chunkText = `![${format} ${imgData.width}x${imgData.height}](${dataUrl})`;
      span.textContent = chunkText;
      span.className = 'tp-chunk-image';

      // Add title with full info for hover
      span.title = `Image: ${format} ${imgData.width}x${imgData.height}`;
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

    // Append span to container
    container.appendChild(span);
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
  elementTypeMap: Record<string, string>
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
    const elementType = elementTypeMap[elementId] || 'unknown';

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

    // Build element type map from source prompt
    const elementTypeMap = buildElementTypeMap(data.source_prompt || null);

    // Render chunks to DOM with text mapping
    const { container: outputContainer, textMapping } = renderChunksToDOM(
      data.ir.chunks,
      elementTypeMap
    );

    // Mark element boundaries using compiled IR
    markElementBoundaries(outputContainer, data.compiled_ir || null, elementTypeMap);

    // Store text mapping on container for future use
    (outputContainer as any)._textMapping = textMapping;

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
