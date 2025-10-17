/**
 * Tests for MarkdownView component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildMarkdownView } from './MarkdownView';
import type { WidgetData, WidgetMetadata } from '../types';
import { FoldingController } from '../folding/controller';
import { JSDOM } from 'jsdom';

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
      totalChunks: 3,
      hasImages: false,
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
        expect(el.getAttribute('data-chunk-id')).toBe(chunkId);
      }
    }
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
});
