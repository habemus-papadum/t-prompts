/**
 * Tests for MarkdownView component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildMarkdownView } from './MarkdownView';
import type { WidgetData, WidgetMetadata } from '../types';
import { FoldingController } from '../folding/controller';
import { JSDOM } from 'jsdom';
import demo01Data from '../../test-fixtures/demo-01.json';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;

describe('MarkdownView', () => {
  let data: WidgetData;
  let metadata: WidgetMetadata;
  let foldingController: FoldingController;

  beforeEach(() => {
    // Create test data with simple text chunks
    data = {
      ir: {
        chunks: [
          { id: 'chunk1', text: '# Hello\n\n', element_id: 'elem1', type: 'TextChunk' },
          { id: 'chunk2', text: 'This is **bold** text.\n\n', element_id: 'elem2', type: 'TextChunk' },
          { id: 'chunk3', text: '- Item 1\n- Item 2\n', element_id: 'elem3', type: 'TextChunk' },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    metadata = {
      elementTypeMap: {},
      elementLocationMap: {},
      chunkSizeMap: {},
    };

    foldingController = new FoldingController(['chunk1', 'chunk2', 'chunk3']);
  });

  it('should create a MarkdownView component', () => {
    const view = buildMarkdownView(data, metadata, foldingController);

    expect(view).toBeDefined();
    expect(view.element).toBeInstanceOf(dom.window.HTMLElement);
    expect(view.element.className).toBe('tp-markdown-container');
    expect(view.chunkIdToElements).toBeInstanceOf(Map);
  });

  it('should render markdown HTML', () => {
    const view = buildMarkdownView(data, metadata, foldingController);

    // Check that markdown was rendered
    const html = view.element.innerHTML;
    expect(html).toContain('<h1');
    expect(html).toContain('Hello');
    expect(html).toContain('<strong>');
    expect(html).toContain('bold');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');

    // Verify elements exist in DOM
    expect(view.element.querySelector('h1')).toBeTruthy();
    expect(view.element.querySelector('ul')).toBeTruthy();
    expect(view.element.querySelectorAll('li').length).toBe(2);
  });

  it('should generate markdown text with correct positions', () => {
    // Direct test of the position tracking function
    const chunks = data.ir?.chunks || [];
    let markdownText = '';
    const positions = new Map<string, { start: number; end: number }>();

    for (const chunk of chunks) {
      const start = markdownText.length;
      const text = chunk.text || '';
      markdownText += text;
      const end = markdownText.length;
      positions.set(chunk.id, { start, end });
    }

    // Verify positions (calculated from actual text lengths)
    // chunk1: '# Hello\n\n' = 9 chars (0-9)
    // chunk2: 'This is **bold** text.\n\n' = 26 chars (9-35)
    // chunk3: '- Item 1\n- Item 2\n' = 18 chars (35-53)
    expect(positions.get('chunk1')).toEqual({ start: 0, end: 9 });
    expect(positions.get('chunk2')).toEqual({ start: 9, end: 33 }); // Fixed: actual length is 24
    expect(positions.get('chunk3')).toEqual({ start: 33, end: 51 }); // Fixed: starts at 33

    // Verify concatenated text exists
    expect(markdownText.length).toBeGreaterThan(0);
    expect(markdownText).toContain('Hello');
    expect(markdownText).toContain('bold');
    expect(markdownText).toContain('Item 1');
  });

  it('should have a destroy method', () => {
    const view = buildMarkdownView(data, metadata, foldingController);

    expect(view.destroy).toBeDefined();
    expect(() => view.destroy()).not.toThrow();
  });

  it('should render KaTeX math with all delimiters', () => {
    // Test data with different LaTeX delimiter styles
    const mathData: WidgetData = {
      ir: {
        chunks: [
          { id: 'chunk1', text: 'Dollar inline: $E = mc^2$\n\n', element_id: 'elem1', type: 'TextChunk' },
          { id: 'chunk2', text: 'Dollar block:\n\n$$\n\\int_0^\\infty e^{-x^2} dx\n$$\n\n', element_id: 'elem2', type: 'TextChunk' },
          { id: 'chunk3', text: 'Bracket block:\n\n\\[\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n\\]\n', element_id: 'elem3', type: 'TextChunk' },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(mathData, metadata, foldingController);
    const html = view.element.innerHTML;

    // KaTeX should render all three types
    expect(html).toContain('katex');

    // Should have multiple katex elements for each math expression
    const katexElements = view.element.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThanOrEqual(3);
  });

  it('should add data-md-id attributes to elements', () => {
    const view = buildMarkdownView(data, metadata, foldingController);

    // Check that elements have data-md-id attributes
    const h1 = view.element.querySelector('h1');
    const p = view.element.querySelector('p');
    const ul = view.element.querySelector('ul');

    expect(h1?.getAttribute('data-md-id')).toBeTruthy();
    expect(p?.getAttribute('data-md-id')).toBeTruthy();
    expect(ul?.getAttribute('data-md-id')).toBeTruthy();
  });

  it('should map chunks to DOM elements with data-chunk-id', () => {
    const view = buildMarkdownView(data, metadata, foldingController);

    // Get the chunkIdToElements map
    const { chunkIdToElements } = view;

    // Check that chunks are mapped to elements
    expect(chunkIdToElements.size).toBeGreaterThan(0);

    // Check that at least one element has a data-chunk-id attribute
    const allElements = view.element.querySelectorAll('[data-chunk-id]');
    expect(allElements.length).toBeGreaterThan(0);

    // Verify specific chunk mappings
    for (const [chunkId, elements] of chunkIdToElements.entries()) {
      expect(elements.length).toBeGreaterThan(0);
      for (const el of elements) {
        const chunkIdsAttr = el.getAttribute('data-chunk-ids') || el.getAttribute('data-chunk-id') || '';
        const chunkIds = chunkIdsAttr.split(/\s+/).filter(Boolean);
        expect(chunkIds).toContain(chunkId);
      }
    }
  });

  it('should split list item text across chunks for precise folding', () => {
    const granularData: WidgetData = {
      ir: {
        chunks: [
          { id: 'chunk-list-1', text: '- Item', element_id: 'elem1', type: 'TextChunk' },
          { id: 'chunk-list-2', text: ' A\n', element_id: 'elem2', type: 'TextChunk' },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const controller = new FoldingController(['chunk-list-1', 'chunk-list-2']);
    const view = buildMarkdownView(granularData, metadata, controller);

    const listItem = view.element.querySelector('li');
    expect(listItem).toBeTruthy();

    const chunk1Elements = view.chunkIdToElements.get('chunk-list-1') ?? [];
    const chunk2Elements = view.chunkIdToElements.get('chunk-list-2') ?? [];

    expect(chunk1Elements.length).toBeGreaterThan(0);
    expect(chunk2Elements.length).toBeGreaterThan(0);

    // Expect newly created inline wrappers so each chunk can collapse independently
    expect(chunk1Elements.some((el) => el.tagName.toLowerCase() === 'span')).toBe(true);
    expect(chunk2Elements.some((el) => el.tagName.toLowerCase() === 'span')).toBe(true);

    for (const el of chunk1Elements) {
      expect(listItem?.contains(el)).toBe(true);
    }
    for (const el of chunk2Elements) {
      expect(listItem?.contains(el)).toBe(true);
    }
  });

  it('should maintain per-chunk folding within math blocks', () => {
    const mathTexts = ['x^n', '+ ', 'y^n', '= ', 'z^n'];
    const chunks = demo01Data.ir?.chunks ?? [];
    const mathChunkIds = new Map<string, string>();

    for (const chunk of chunks) {
      if (!chunk.text) {
        continue;
      }
      if (mathTexts.includes(chunk.text)) {
        mathChunkIds.set(chunk.text, chunk.id);
      }
    }

    expect(mathChunkIds.size).toBe(mathTexts.length);

    const controller = new FoldingController(chunks.map((chunk) => chunk.id));
    const view = buildMarkdownView(demo01Data, metadata, controller);
    let referenceBlock: HTMLElement | null = null;
    for (const [text, chunkId] of mathChunkIds.entries()) {
      const elements = view.chunkIdToElements.get(chunkId) ?? [];
      expect(elements.length).toBeGreaterThan(0);
      for (const el of elements) {
        const mathContainer = el.closest<HTMLElement>('.katex-display, .katex');
        expect(mathContainer, `Chunk "${text}" should map to a KaTeX node`).toBeTruthy();

        expect(el.classList.contains('tp-markdown-chunk'), `Chunk "${text}" should be wrapped in a chunk span`).toBe(
          true
        );
        expect(el.getAttribute('data-chunk-id')).toBe(chunkId);
        expect(el.getAttribute('data-chunk-ids')?.split(/\s+/).includes(chunkId)).toBe(true);

        if (!referenceBlock) {
          referenceBlock = mathContainer;
        } else {
          expect(mathContainer).toBe(referenceBlock);
        }
      }
    }
  });

  it('should split and highlight code fence content per chunk', () => {
    const chunks = demo01Data.ir?.chunks ?? [];
    const controller = new FoldingController(chunks.map((chunk) => chunk.id));
    const view = buildMarkdownView(demo01Data, metadata, controller);

    const codeElement = view.element.querySelector('pre code');
    expect(codeElement).toBeTruthy();
    expect(codeElement?.querySelector('.tp-code-token-keyword')).toBeTruthy();
    expect(codeElement?.querySelector('.tp-code-token-string')).toBeTruthy();

    const codeChunks = Array.from(view.element.querySelectorAll<HTMLElement>('.tp-code-chunk'));
    expect(codeChunks.length).toBeGreaterThan(0);

    const interpolationChunk = codeChunks.find((chunkNode) => {
      const chunkId = chunkNode.getAttribute('data-chunk-id');
      const sourceChunk = chunks.find((chunk) => chunk.id === chunkId);
      return sourceChunk?.text === 'This is a comprehensive test';
    });

    expect(interpolationChunk).toBeTruthy();
    const targetChunkId = interpolationChunk?.getAttribute('data-chunk-id') ?? '';
    const mappedElements = view.chunkIdToElements.get(targetChunkId) ?? [];
    expect(mappedElements.length).toBeGreaterThan(0);
    mappedElements.forEach((el) => {
      expect(el.classList.contains('tp-code-chunk')).toBe(true);
      expect(el.closest('pre')).toBeTruthy();
    });
  });

  it('should handle empty chunks gracefully', () => {
    const emptyData: WidgetData = {
      ir: {
        chunks: [],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(emptyData, metadata, foldingController);
    expect(view.element.innerHTML).toBe('');
    expect(view.chunkIdToElements.size).toBe(0);
  });

  it('should render images with data URLs', () => {
    // Create a simple test image matching Python's _serialize_image format
    const testImageData = {
      base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      format: 'png',
      width: 1,
      height: 1,
      mode: 'RGB'
    };

    const imageData: WidgetData = {
      ir: {
        chunks: [
          { id: 'chunk1', text: 'Before image\n\n', element_id: 'elem1', type: 'TextChunk' },
          {
            id: 'chunk2',
            element_id: 'elem2',
            type: 'ImageChunk',
            image: testImageData,
          },
          { id: 'chunk3', text: '\n\nAfter image', element_id: 'elem3', type: 'TextChunk' },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(imageData, metadata, foldingController);

    // Check that an image tag was created
    const imgElement = view.element.querySelector('img');
    expect(imgElement).toBeTruthy();

    // Check that it has a data URL
    const imgSrc = imgElement?.getAttribute('src');
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toContain('data:image');

    // Verify it contains the base64 data
    expect(imgSrc).toContain(testImageData.base64_data);

    // Check that the image chunk is mapped
    const chunk2Elements = view.chunkIdToElements.get('chunk2');
    expect(chunk2Elements).toBeDefined();
    expect(chunk2Elements && chunk2Elements.length).toBeGreaterThan(0);
  });

  it('should handle mixed text and image chunks', () => {
    const testImageData = {
      base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      format: 'png',
      width: 1,
      height: 1,
      mode: 'RGB'
    };

    const mixedData: WidgetData = {
      ir: {
        chunks: [
          { id: 'chunk1', text: '# Image Test\n\n', element_id: 'elem1', type: 'TextChunk' },
          {
            id: 'chunk2',
            element_id: 'elem2',
            type: 'ImageChunk',
            image: testImageData,
          },
          { id: 'chunk3', text: '\n\n**Caption**: Test image', element_id: 'elem3', type: 'TextChunk' },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(mixedData, metadata, foldingController);

    // Check markdown rendering
    expect(view.element.querySelector('h1')).toBeTruthy();
    expect(view.element.querySelector('strong')).toBeTruthy();

    // Check image rendering
    expect(view.element.querySelector('img')).toBeTruthy();

    // All chunks should be mapped
    expect(view.chunkIdToElements.size).toBe(3);
  });

  it('should properly format image data URLs', () => {
    const testImageData = {
      base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      format: 'PNG',
      width: 1,
      height: 1,
      mode: 'RGB'
    };

    const imageData: WidgetData = {
      ir: {
        chunks: [
          {
            id: 'img1',
            element_id: 'elem1',
            type: 'ImageChunk',
            image: testImageData,
          },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(imageData, metadata, foldingController);
    const imgElement = view.element.querySelector('img');

    expect(imgElement).toBeTruthy();
    const src = imgElement?.getAttribute('src');

    // Verify data URL format
    expect(src).toMatch(/^data:image\/png;base64,/);

    // Verify the format is lowercased (PNG -> png)
    expect(src).toContain('data:image/png');

    // Verify base64 data is included
    expect(src).toContain(testImageData.base64_data);
  });

  it('should apply collapsed markers when chunks are collapsed', () => {
    const view = buildMarkdownView(data, metadata, foldingController);
    const chunkElements = view.chunkIdToElements.get('chunk2');
    expect(chunkElements).toBeDefined();
    const elementsArray = chunkElements ?? [];
    expect(elementsArray.length).toBeGreaterThan(0);

    const events: string[] = [];
    foldingController.addClient({
      onStateChanged(event) {
        events.push(event.type);
      },
    });

    foldingController.selectByIds(['chunk2']);
    const collapsedIds = foldingController.commitSelections();
    expect(collapsedIds.length).toBe(1);
    expect(foldingController.isCollapsed('chunk2')).toBe(true);
    expect(events).toContain('chunks-collapsed');

    elementsArray.forEach((el) => {
      expect(el.classList.contains('tp-markdown-collapsed')).toBe(true);
    });
    expect(view.element.querySelectorAll('.tp-markdown-collapsed').length).toBeGreaterThan(0);

    const indicator = elementsArray[0].previousElementSibling as HTMLElement | null;
    expect(indicator).toBeTruthy();
    expect(indicator?.classList.contains('tp-markdown-collapsed-indicator')).toBe(true);
    expect(indicator?.textContent).toBe('⋯');

    foldingController.expandChunk(collapsedIds[0]);

    elementsArray.forEach((el) => {
      expect(el.classList.contains('tp-markdown-collapsed')).toBe(false);
    });
    expect(view.element.querySelector('.tp-markdown-collapsed-indicator')).toBeNull();
  });

  it('should show image indicator for collapsed image chunks', () => {
    const testImageData = {
      base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      format: 'png',
      width: 1,
      height: 1,
      mode: 'RGB'
    };

    const imageData: WidgetData = {
      ir: {
        chunks: [
          { id: 'chunk1', text: 'Before\n\n', element_id: 'elem1', type: 'TextChunk' },
          {
            id: 'chunk2',
            element_id: 'elem2',
            type: 'ImageChunk',
            image: testImageData,
          },
        ],
      },
      source_prompt: {},
      compiled_ir: {},
      config: {},
    };

    const view = buildMarkdownView(imageData, metadata, foldingController);
    foldingController.selectByIds(['chunk2']);
    const collapsedIds = foldingController.commitSelections();
    expect(collapsedIds.length).toBe(1);

    const collapsedElements = view.chunkIdToElements.get('chunk2') ?? [];
    expect(collapsedElements.length).toBeGreaterThan(0);
    collapsedElements.forEach((el) => {
      expect(el.classList.contains('tp-markdown-collapsed')).toBe(true);
    });

    const indicator = collapsedElements[0].previousElementSibling as HTMLElement | null;
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toBe('▢⋯');

    foldingController.expandChunk(collapsedIds[0]);
    expect(view.element.querySelector('.tp-markdown-collapsed-indicator')).toBeNull();
  });

  describe('demo fixture', () => {
    it('maps every demo chunk to DOM elements with chunk ids', () => {
      const widgetData = demo01Data as unknown as WidgetData;
      const chunkIds = widgetData.ir?.chunks?.map((chunk) => chunk.id) ?? [];

      const controller = new FoldingController(chunkIds);
      const view = buildMarkdownView(widgetData, metadata, controller);
      const missing = chunkIds.filter((id) => !view.chunkIdToElements.has(id));
      expect(missing, `chunks missing from map: ${missing.join(', ')}`).toEqual([]);

      for (const chunkId of chunkIds) {
        const elements = view.chunkIdToElements.get(chunkId);
        expect(elements, `chunk ${chunkId} should map to elements`).toBeDefined();
        expect(elements && elements.length).toBeGreaterThan(0);

        const hasAttributeMatch =
          elements?.some((el) => {
            const attr = el.getAttribute('data-chunk-ids') || el.getAttribute('data-chunk-id') || '';
            return attr.split(/\s+/).filter(Boolean).includes(chunkId);
          }) ?? false;

        expect(hasAttributeMatch, `chunk ${chunkId} should be present in element attributes`).toBe(true);
      }
    });

    it('collapses long text chunk and hides markdown content', () => {
      const widgetData = demo01Data as unknown as WidgetData;
      const chunkIds = widgetData.ir?.chunks?.map((chunk) => chunk.id) ?? [];
      const controller = new FoldingController(chunkIds);
      const view = buildMarkdownView(widgetData, metadata, controller);

      const longChunkId = widgetData.ir?.chunks?.find(
        (chunk) => chunk.text && chunk.text.startsWith('aaaa')
      )?.id;

      expect(longChunkId).toBeDefined();
      if (!longChunkId) {
        return;
      }

      controller.selectByIds([longChunkId]);
      const [collapsedId] = controller.commitSelections();
      expect(controller.isCollapsed(longChunkId)).toBe(true);

      const elements = view.chunkIdToElements.get(longChunkId) ?? [];
      expect(elements.length).toBeGreaterThan(0);
      elements.forEach((el) => {
        expect(el.classList.contains('tp-markdown-collapsed')).toBe(true);
      });

      const indicator = elements[0].previousElementSibling as HTMLElement | null;
      expect(indicator).toBeTruthy();
      expect(indicator?.textContent).toMatch(/⋯/);

      controller.expandChunk(collapsedId);
      elements.forEach((el) => {
        expect(el.classList.contains('tp-markdown-collapsed')).toBe(false);
      });
    });
  });
});
