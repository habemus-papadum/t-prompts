import { describe, it, expect, beforeEach } from 'vitest';
import { initWidget } from './index';
import { trimSourcePrefix } from './metadata';

describe('Element boundary marking', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div');
    container.setAttribute('data-tp-widget', 'true');
  });

  it('should add tp-first and tp-last classes to single-chunk element', () => {
    // Create widget data with one element that has one chunk
    const chunkId = 'chunk-1';
    const elementId = 'element-1';

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [elementId]: [chunkId],
        },
        num_elements: 1,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Hello world',
            element_id: elementId,
            id: chunkId,
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: elementId,
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Hello world',
          },
        ],
      },
    };

    // Add data to container
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget
    initWidget(container);

    // Check that the chunk span has both type-specific classes
    const span = container.querySelector(`[data-chunk-id="${chunkId}"]`);
    expect(span).toBeTruthy();
    expect(span?.classList.contains('tp-first-static')).toBe(true);
    expect(span?.classList.contains('tp-last-static')).toBe(true);
  });

  it('should add tp-first to first chunk and tp-last to last chunk of multi-chunk element', () => {
    // Create widget data with one element that has three chunks
    const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
    const elementId = 'element-1';

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [elementId]: chunkIds,
        },
        num_elements: 1,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Hello ',
            element_id: elementId,
            id: chunkIds[0],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'beautiful ',
            element_id: elementId,
            id: chunkIds[1],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'world',
            element_id: elementId,
            id: chunkIds[2],
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: elementId,
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Hello beautiful world',
          },
        ],
      },
    };

    // Add data to container
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget
    initWidget(container);

    // Check first chunk has tp-first-static only
    const firstSpan = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`);
    expect(firstSpan).toBeTruthy();
    expect(firstSpan?.classList.contains('tp-first-static')).toBe(true);
    expect(firstSpan?.classList.contains('tp-last-static')).toBe(false);

    // Check middle chunk has neither
    const middleSpan = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`);
    expect(middleSpan).toBeTruthy();
    expect(middleSpan?.classList.contains('tp-first-static')).toBe(false);
    expect(middleSpan?.classList.contains('tp-last-static')).toBe(false);

    // Check last chunk has tp-last-static only
    const lastSpan = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`);
    expect(lastSpan).toBeTruthy();
    expect(lastSpan?.classList.contains('tp-first-static')).toBe(false);
    expect(lastSpan?.classList.contains('tp-last-static')).toBe(true);
  });

  it('should handle multiple elements with different chunk counts', () => {
    // Element 1: single chunk
    // Element 2: three chunks
    const element1Id = 'element-1';
    const element1ChunkId = 'chunk-1';
    const element2Id = 'element-2';
    const element2ChunkIds = ['chunk-2', 'chunk-3', 'chunk-4'];

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [element1Id]: [element1ChunkId],
          [element2Id]: element2ChunkIds,
        },
        num_elements: 2,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Static text',
            element_id: element1Id,
            id: element1ChunkId,
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Part 1',
            element_id: element2Id,
            id: element2ChunkIds[0],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Part 2',
            element_id: element2Id,
            id: element2ChunkIds[1],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Part 3',
            element_id: element2Id,
            id: element2ChunkIds[2],
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: element1Id,
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Static text',
          },
          {
            type: 'interpolation',
            id: element2Id,
            parent_id: 'prompt-1',
            key: 1,
            index: 1,
            source_location: null,
            expression: 'var',
            conversion: null,
            format_spec: 'v',
            render_hints: {},
            value: 'Part 1Part 2Part 3',
          },
        ],
      },
    };

    // Add data to container
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget
    initWidget(container);

    // Check element 1 (single chunk, static type)
    const elem1Span = container.querySelector(`[data-chunk-id="${element1ChunkId}"]`);
    expect(elem1Span?.classList.contains('tp-first-static')).toBe(true);
    expect(elem1Span?.classList.contains('tp-last-static')).toBe(true);

    // Check element 2 (three chunks, interpolation type)
    const elem2FirstSpan = container.querySelector(`[data-chunk-id="${element2ChunkIds[0]}"]`);
    expect(elem2FirstSpan?.classList.contains('tp-first-interpolation')).toBe(true);
    expect(elem2FirstSpan?.classList.contains('tp-last-interpolation')).toBe(false);

    const elem2MiddleSpan = container.querySelector(`[data-chunk-id="${element2ChunkIds[1]}"]`);
    expect(elem2MiddleSpan?.classList.contains('tp-first-interpolation')).toBe(false);
    expect(elem2MiddleSpan?.classList.contains('tp-last-interpolation')).toBe(false);

    const elem2LastSpan = container.querySelector(`[data-chunk-id="${element2ChunkIds[2]}"]`);
    expect(elem2LastSpan?.classList.contains('tp-first-interpolation')).toBe(false);
    expect(elem2LastSpan?.classList.contains('tp-last-interpolation')).toBe(true);
  });

  it('should handle missing compiled_ir gracefully', () => {
    // Widget data without compiled_ir
    const widgetData = {
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Hello',
            element_id: 'element-1',
            id: 'chunk-1',
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: 'element-1',
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Hello',
          },
        ],
      },
    };

    // Add data to container
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget - should not crash
    initWidget(container);

    // Check that widget rendered but no classes added
    const span = container.querySelector(`[data-chunk-id="chunk-1"]`);
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe('Hello');
    expect(span?.classList.contains('tp-first-static')).toBe(false);
    expect(span?.classList.contains('tp-last-static')).toBe(false);
  });

  it('should handle empty subtree_map', () => {
    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {},
        num_elements: 0,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Hello',
            element_id: 'element-1',
            id: 'chunk-1',
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-1',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: 'element-1',
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'Hello',
          },
        ],
      },
    };

    // Add data to container
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget - should not crash
    initWidget(container);

    // Check that widget rendered but no classes added
    const span = container.querySelector(`[data-chunk-id="chunk-1"]`);
    expect(span).toBeTruthy();
    expect(span?.classList.contains('tp-first-static')).toBe(false);
    expect(span?.classList.contains('tp-last-static')).toBe(false);
  });
});

describe('trimSourcePrefix utility', () => {
  it('should trim matching prefix with trailing slash', () => {
    const result = trimSourcePrefix('/Users/dev/project/src/main.py', '/Users/dev/project');
    expect(result).toBe('src/main.py');
  });

  it('should trim matching prefix without trailing slash', () => {
    const result = trimSourcePrefix('/Users/dev/project/src/main.py', '/Users/dev/project/');
    expect(result).toBe('src/main.py');
  });

  it('should return "." when filepath equals prefix', () => {
    const result = trimSourcePrefix('/Users/dev/project', '/Users/dev/project');
    expect(result).toBe('.');
  });

  it('should return original path when prefix does not match', () => {
    const result = trimSourcePrefix('/other/path/file.py', '/Users/dev/project');
    expect(result).toBe('/other/path/file.py');
  });

  it('should handle null filepath', () => {
    const result = trimSourcePrefix(null, '/Users/dev/project');
    expect(result).toBe(null);
  });

  it('should handle nested paths correctly', () => {
    const result = trimSourcePrefix('/home/user/repo/src/lib/utils.ts', '/home/user/repo');
    expect(result).toBe('src/lib/utils.ts');
  });

  it('should not partially match directory names', () => {
    // /Users/dev/project2 should not match /Users/dev/project
    const result = trimSourcePrefix('/Users/dev/project2/file.py', '/Users/dev/project');
    expect(result).toBe('/Users/dev/project2/file.py');
  });
});
