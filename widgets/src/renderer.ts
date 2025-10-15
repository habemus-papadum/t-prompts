/**
 * Widget renderer for structured prompts - Phase 1: Minimal Static Renderer
 */

import MarkdownIt from 'markdown-it';
// @ts-expect-error - markdown-it-katex doesn't have types
import markdownItKatex from 'markdown-it-katex';

// Type definitions for widget data structures
interface WidgetData {
  prompt_id?: string;
  children?: ElementData[];
  ir_id?: string;
  source_prompt?: WidgetData;
  chunks?: ChunkData[];
}

interface ElementData {
  type: string;
  key: string | number;
  value?: string;
  expression?: string;
  children?: ElementData[];
  separator?: string;
  image_data?: ImageData;
  [key: string]: unknown;
}

interface ChunkData {
  type: string;
  text?: string;
  image_data?: ImageData;
}

interface ImageData {
  base64_data?: string;
  format?: string;
  width?: number;
  height?: number;
  error?: string;
}

// Initialize markdown-it with KaTeX support
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItKatex);

/**
 * Render a tree view from JSON data
 */
function renderTree(data: WidgetData, depth = 0): string {
  if (!data) return '';

  const indent = '  '.repeat(depth);
  let html = '';

  if (data.prompt_id && data.children) {
    // This is a StructuredPrompt
    html += `${indent}<ul class="tp-tree">\n`;
    html += `${indent}  <li class="tp-tree-prompt">\n`;
    html += `${indent}    <span class="tp-tree-label">Prompt (${data.prompt_id.substring(0, 8)}...)</span>\n`;
    html += `${indent}    <ul>\n`;

    for (const child of data.children) {
      html += renderTreeElement(child, depth + 2);
    }

    html += `${indent}    </ul>\n`;
    html += `${indent}  </li>\n`;
    html += `${indent}</ul>\n`;
  }

  return html;
}

function renderTreeElement(element: ElementData, depth: number): string {
  const indent = '  '.repeat(depth);
  let html = '';

  html += `${indent}<li class="tp-tree-${element.type}">\n`;

  if (element.type === 'static') {
    const preview = element.value.substring(0, 30).replace(/\n/g, '\\n');
    html += `${indent}  <span class="tp-tree-label">Static[${element.key}]: "${preview}${element.value.length > 30 ? '...' : ''}"</span>\n`;
  } else if (element.type === 'interpolation') {
    html += `${indent}  <span class="tp-tree-label">Interpolation[${element.key}]: ${element.expression}</span>\n`;
  } else if (element.type === 'nested_prompt' && element.children) {
    html += `${indent}  <span class="tp-tree-label">Nested[${element.key}]</span>\n`;
    html += `${indent}  <ul>\n`;
    for (const child of element.children) {
      html += renderTreeElement(child, depth + 1);
    }
    html += `${indent}  </ul>\n`;
  } else if (element.type === 'list' && element.children) {
    html += `${indent}  <span class="tp-tree-label">List[${element.key}] (${element.children.length} items)</span>\n`;
    html += `${indent}  <ul>\n`;
    for (let i = 0; i < element.children.length; i++) {
      const item = element.children[i];
      html += `${indent}    <li class="tp-tree-list-item">\n`;
      html += `${indent}      <span class="tp-tree-label">Item ${i}</span>\n`;
      if (item.children) {
        html += `${indent}      <ul>\n`;
        for (const child of item.children) {
          html += renderTreeElement(child, depth + 2);
        }
        html += `${indent}      </ul>\n`;
      }
      html += `${indent}    </li>\n`;
    }
    html += `${indent}  </ul>\n`;
  } else if (element.type === 'image') {
    html += `${indent}  <span class="tp-tree-label">Image[${element.key}]</span>\n`;
  }

  html += `${indent}</li>\n`;
  return html;
}

/**
 * Render code view from chunks (showing rendered output with images)
 */
function renderCodeFromChunks(chunks: ChunkData[]): string {
  if (!chunks || chunks.length === 0) return '';

  let html = '';
  for (const chunk of chunks) {
    if (chunk.type === 'text') {
      // Text chunks are escaped and shown as-is
      html += '<span class="tp-code-text">' + escapeHtml(chunk.text) + '</span>';
    } else if (chunk.type === 'image' && chunk.image_data) {
      // Image chunks rendered as actual img tags
      const imgData = chunk.image_data;
      if (imgData.base64_data) {
        const src = `data:image/${(imgData.format || 'png').toLowerCase()};base64,${imgData.base64_data}`;
        html += `<img class="tp-code-image" src="${src}" alt="Image chunk" title="Image: ${imgData.width}x${imgData.height} ${imgData.format}" style="max-width: 200px; max-height: 200px; display: block; margin: 4px 0;" />`;
      } else if (imgData.error) {
        html += `<span class="tp-code-image-error" title="${escapeHtml(imgData.error)}">[image error]</span>`;
      }
    }
  }
  return html;
}

/**
 * Render code view from StructuredPrompt by reconstructing the text
 */
function renderCodeFromPrompt(data: WidgetData): string {
  if (!data || !data.children) return '';

  let code = '';
  for (const element of data.children) {
    code += renderCodeElement(element);
  }
  return code;
}

function renderCodeElement(element: ElementData): string {
  let code = '';

  if (element.type === 'static') {
    code += escapeHtml(element.value);
  } else if (element.type === 'interpolation') {
    // For interpolations, show the actual value
    code += `<span class="tp-code-interp" title="Interpolation: ${escapeHtml(element.expression)}">${escapeHtml(element.value)}</span>`;
  } else if (element.type === 'nested_prompt' && element.children) {
    // For nested prompts, recursively render their children
    for (const child of element.children) {
      code += renderCodeElement(child);
    }
  } else if (element.type === 'list' && element.children) {
    // For lists, render each item with separator
    for (let i = 0; i < element.children.length; i++) {
      const item = element.children[i];
      if (i > 0) {
        code += escapeHtml(element.separator || '\n');
      }
      if (item.children) {
        for (const child of item.children) {
          code += renderCodeElement(child);
        }
      }
    }
  } else if (element.type === 'image' && element.image_data) {
    // Render actual image using base64 data
    const imgData = element.image_data;
    if (imgData.base64_data) {
      const src = `data:image/${(imgData.format || 'png').toLowerCase()};base64,${imgData.base64_data}`;
      code += `<img class="tp-code-image" src="${src}" alt="Image interpolation" title="Image: ${imgData.width}x${imgData.height} ${imgData.format}" style="max-width: 200px; max-height: 200px; display: block; margin: 4px 0;" />`;
    } else if (imgData.error) {
      code += `<span class="tp-code-image-error" title="${escapeHtml(imgData.error)}">[image error]</span>`;
    } else {
      code += '<span class="tp-code-image-placeholder">[image]</span>';
    }
  }

  return code;
}

/**
 * Render Markdown preview from text
 */
function renderMarkdownPreview(text: string): string {
  try {
    return md.render(text);
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return `<pre>${escapeHtml(text)}</pre>`;
  }
}

/**
 * Render preview from chunks (text + images)
 */
function renderPreviewFromChunks(chunks: ChunkData[]): string {
  if (!chunks || chunks.length === 0) return '';

  let html = '';
  for (const chunk of chunks) {
    if (chunk.type === 'text') {
      // Render text as Markdown
      html += renderMarkdownPreview(chunk.text);
    } else if (chunk.type === 'image' && chunk.image_data) {
      // Render image
      const imgData = chunk.image_data;
      if (imgData.base64_data) {
        const src = `data:image/${(imgData.format || 'png').toLowerCase()};base64,${imgData.base64_data}`;
        html += `<img class="tp-preview-image" src="${src}" alt="Image chunk" title="Image: ${imgData.width}x${imgData.height} ${imgData.format}" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />`;
      } else if (imgData.error) {
        html += `<div class="tp-preview-error">Image error: ${escapeHtml(imgData.error)}</div>`;
      }
    }
  }
  return html;
}

/**
 * Render preview from StructuredPrompt elements
 */
function renderPreviewFromPrompt(data: WidgetData): string {
  if (!data || !data.children) return '';

  // Reconstruct text from elements
  let text = '';
  for (const element of data.children) {
    text += extractTextFromElement(element);
  }

  // Render as Markdown
  return renderMarkdownPreview(text);
}

function extractTextFromElement(element: ElementData): string {
  let text = '';

  if (element.type === 'static') {
    text += element.value;
  } else if (element.type === 'interpolation') {
    text += element.value;
  } else if (element.type === 'nested_prompt' && element.children) {
    for (const child of element.children) {
      text += extractTextFromElement(child);
    }
  } else if (element.type === 'list' && element.children) {
    for (let i = 0; i < element.children.length; i++) {
      const item = element.children[i];
      if (i > 0) {
        text += element.separator || '\n';
      }
      if (item.children) {
        for (const child of item.children) {
          text += extractTextFromElement(child);
        }
      }
    }
  } else if (element.type === 'image' && element.image_data) {
    // For images in StructuredPrompt, insert them inline
    const imgData = element.image_data;
    if (imgData.base64_data) {
      const src = `data:image/${(imgData.format || 'png').toLowerCase()};base64,${imgData.base64_data}`;
      text += `<img class="tp-preview-image" src="${src}" alt="Image" title="Image: ${imgData.width}x${imgData.height} ${imgData.format}" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />`;
    }
  }

  return text;
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
    // Find the embedded JSON IR
    const scriptTag = container.querySelector('script[data-role="tp-widget-data"]');
    if (!scriptTag || !scriptTag.textContent) {
      container.innerHTML = '<div class="tp-error">No widget data found</div>';
      return;
    }

    const data = JSON.parse(scriptTag.textContent);

    // Determine what kind of data we have
    let treeHtml = '';
    let codeHtml = '';
    let previewHtml = '';

    console.log('Widget data type check:', {
      hasPromptId: !!data.prompt_id,
      hasChildren: !!data.children,
      hasIrId: !!data.ir_id,
      hasSourcePrompt: !!data.source_prompt,
      hasChunks: !!data.chunks,
    });

    if (data.prompt_id && data.children) {
      // StructuredPrompt data
      console.log('Rendering StructuredPrompt');
      treeHtml = renderTree(data);
      codeHtml = renderCodeFromPrompt(data);

      // Render as Markdown preview
      previewHtml = renderPreviewFromPrompt(data);
      console.log('Preview HTML length:', previewHtml.length);
    } else if (data.ir_id && data.source_prompt && data.chunks) {
      // IntermediateRepresentation data
      console.log('Rendering IntermediateRepresentation');
      treeHtml = renderTree(data.source_prompt);
      codeHtml = renderCodeFromChunks(data.chunks);

      // Render chunks as Markdown with images
      previewHtml = renderPreviewFromChunks(data.chunks);
      console.log('Preview HTML length:', previewHtml.length);
    } else {
      // Unknown data type
      console.error('Unknown widget data type:', data);
      previewHtml = '<div class="tp-error">Unknown data type - cannot render preview</div>';
    }

    // Ensure previewHtml is never empty
    if (!previewHtml || previewHtml.trim() === '') {
      console.warn('Preview HTML is empty, using fallback');
      previewHtml = '<div class="tp-preview-placeholder">Preview is empty</div>';
    }

    // Create the three-pane layout
    const widgetHtml = `
      <div class="tp-widget-container">
        <div class="tp-pane tp-pane-tree">
          <h4>Structure</h4>
          ${treeHtml}
        </div>
        <div class="tp-pane tp-pane-code">
          <h4>Code View</h4>
          <div class="tp-code">${codeHtml}</div>
        </div>
        <div class="tp-pane tp-pane-preview">
          <h4>Preview</h4>
          <div class="tp-preview">${previewHtml}</div>
        </div>
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
    container.innerHTML = `<div class="tp-error">Failed to initialize widget: ${error}</div>`;
  }
}
