/**
 * Widget renderer for structured prompts - Simplified renderer
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
  value?: string;
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

/**
 * Render chunks as simple text and images
 */
function renderChunks(chunks: ChunkData[]): string {
  if (!chunks || chunks.length === 0) {
    return '<div class="tp-empty">No content</div>';
  }

  let html = '';

  for (const chunk of chunks) {
    if (chunk.type === 'TextChunk' && chunk.text !== undefined) {
      // Text chunks: escape HTML and preserve whitespace
      const escaped = escapeHtml(chunk.text);
      html += escaped;
    } else if (chunk.type === 'ImageChunk' && chunk.image) {
      // Image chunks: add newlines around image for separation
      const imgData = chunk.image;
      if (imgData.base64_data) {
        const format = (imgData.format || 'png').toLowerCase();
        const src = `data:image/${format};base64,${imgData.base64_data}`;
        html += `\n<img src="${src}" alt="Image ${imgData.width}x${imgData.height}" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />\n`;
      }
    }
  }

  return html;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

    // Render the chunks
    const contentHtml = renderChunks(data.ir.chunks);

    // Create simple output container
    const widgetHtml = `
      <div class="tp-widget-output">
        <pre style="white-space: pre-wrap; font-family: monospace; margin: 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">${contentHtml}</pre>
      </div>
    `;

    // Find the widget mount point and render
    const mountPoint = container.querySelector('.tp-widget-mount');
    if (mountPoint) {
      mountPoint.innerHTML = widgetHtml;
    } else {
      container.innerHTML = widgetHtml;
    }
  } catch (error) {
    console.error('Widget initialization error:', error);
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}
