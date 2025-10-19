import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initWidget } from '../index';
import type { WidgetContainer } from '../components/WidgetContainer';
import { buildCodeView } from './CodeView';
import type { CodeView } from '../components/CodeView';
import type { Component } from '../components/base';
import { FoldingController } from '../folding/controller';
import { computeWidgetMetadata } from '../metadata';
import type { WidgetData } from '../types';
import type { StructuredPromptDiffData, RenderedPromptDiffData } from '../diff-types';
import { buildDiffOverlayModel } from '../diff-overlay';

type WidgetHostElement = HTMLDivElement & { _widgetComponent?: WidgetContainer };

function getWidget(container: WidgetHostElement): WidgetContainer {
  if (!container._widgetComponent) {
    throw new Error('Widget component not initialized');
  }
  return container._widgetComponent;
}

function isCodeView(component: Component): component is CodeView {
  return typeof (component as Partial<CodeView>).chunkIdToTopElements !== 'undefined';
}

function findCodeView(widget: WidgetContainer): CodeView | undefined {
  return widget.views.find(isCodeView);
}

describe('CodeView image truncation', () => {
  let container: WidgetHostElement;

  beforeEach(() => {
    container = document.createElement('div') as WidgetHostElement;
    container.setAttribute('data-tp-widget', 'true');
  });

  it('truncates image chunks before and after a collapse cycle', () => {
    const imageChunkId = 'chunk-image';
    const textChunkId = 'chunk-text';
    const elementIds = ['element-image', 'element-text'];

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-image',
        subtree_map: {
          [elementIds[0]]: [imageChunkId],
          [elementIds[1]]: [textChunkId],
        },
        num_elements: 2,
      },
      ir: {
        chunks: [
          {
            type: 'ImageChunk',
            image: {
              base64_data: 'abc123',
              format: 'PNG',
              width: 50,
              height: 50,
            },
            element_id: elementIds[0],
            id: imageChunkId,
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'visible text',
            element_id: elementIds[1],
            id: textChunkId,
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-1',
        id: 'ir-image',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-1',
        children: [
          {
            type: 'static',
            id: elementIds[0],
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: '![PNG 50x50](...)',
          },
          {
            type: 'static',
            id: elementIds[1],
            parent_id: 'prompt-1',
            key: 1,
            index: 1,
            source_location: null,
            value: 'visible text',
          },
        ],
      },
    };

    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    initWidget(container);

    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer).toBeTruthy();

    const foldingController = getWidget(container).foldingController;
    expect(foldingController).toBeTruthy();

    const getImageSpan = (): HTMLElement | null =>
      container.querySelector(`[data-chunk-id="${imageChunkId}"]`);

    let imageSpan = getImageSpan();
    expect(imageSpan).toBeTruthy();
    expect(imageSpan?.textContent).toBe('![PNG 50x50](...)');
    expect(imageSpan?.hasAttribute('title')).toBe(false);

    foldingController.selectByIds([imageChunkId]);

    const keydownEvent = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    outputContainer.dispatchEvent(keydownEvent);

    const collapsedPill = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
    expect(collapsedPill).toBeTruthy();

    const dblclickEvent = new MouseEvent('dblclick', {
      bubbles: true,
    });
    collapsedPill.dispatchEvent(dblclickEvent);

    imageSpan = getImageSpan();
    expect(imageSpan).toBeTruthy();
    expect(imageSpan?.textContent).toBe('![PNG 50x50](...)');
    expect(imageSpan?.hasAttribute('title')).toBe(false);
  });
});

describe('CodeView diff overlays', () => {
  it('applies diff classes and ghost chunks when enabled', () => {
    const diffData: WidgetData = {
      compiled_ir: {
        ir_id: 'ir-diff',
        subtree_map: {
          'elem-static': ['chunk-static'],
          'elem-interp': ['chunk-interp'],
        },
        num_elements: 2,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'Hello diff world',
            element_id: 'elem-static',
            id: 'chunk-static',
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Dynamic',
            element_id: 'elem-interp',
            id: 'chunk-interp',
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-diff',
        id: 'ir-diff',
        metadata: {},
      },
      source_prompt: {
        prompt_id: 'prompt-diff',
        children: [
          {
            id: 'elem-static',
            type: 'static',
            key: 'Hello diff world',
            children: [
              {
                id: 'elem-interp',
                type: 'interpolation',
                key: 'query',
                children: [],
              },
            ],
          },
        ],
      },
      config: { wrapping: true, sourcePrefix: '' },
    };

    const structuredDiff: StructuredPromptDiffData = {
      diff_type: 'structured',
      root: {
        status: 'equal',
        element_type: 'prompt',
        key: 'root',
        before_id: 'prompt-before',
        after_id: 'prompt-after',
        before_index: 0,
        after_index: 0,
        attr_changes: {},
        text_edits: [],
        children: [
          {
            status: 'modified',
            element_type: 'static',
            key: 'Hello diff world',
            before_id: 'elem-static-before',
            after_id: 'elem-static',
            before_index: 0,
            after_index: 0,
            attr_changes: {},
            text_edits: [
              { op: 'replace', before: 'Hello world', after: 'Hello diff world' },
            ],
            children: [
              {
                status: 'deleted',
                element_type: 'interpolation',
                key: 'old',
                before_id: 'elem-old',
                after_id: null,
                before_index: 0,
                after_index: null,
                attr_changes: {},
                text_edits: [],
                children: [],
              },
              {
                status: 'inserted',
                element_type: 'interpolation',
                key: 'query',
                before_id: null,
                after_id: 'elem-interp',
                before_index: null,
                after_index: 0,
                attr_changes: {},
                text_edits: [],
                children: [],
              },
            ],
          },
        ],
      },
      stats: {
        nodes_added: 1,
        nodes_removed: 1,
        nodes_modified: 1,
        nodes_moved: 0,
        text_added: 5,
        text_removed: 5,
      },
      metrics: {
        struct_edit_count: 2,
        struct_span_chars: 10,
        struct_char_ratio: 0.5,
        struct_order_score: 0.6,
      },
    };

    const renderedDiff: RenderedPromptDiffData = {
      diff_type: 'rendered',
      chunk_deltas: [
        {
          op: 'replace',
          before: { text: 'Hello world', element_id: 'elem-static' },
          after: { text: 'Hello diff world', element_id: 'elem-static' },
        },
        {
          op: 'insert',
          before: null,
          after: { text: 'Dynamic', element_id: 'elem-interp' },
        },
        {
          op: 'delete',
          before: { text: 'Old chunk', element_id: 'elem-old' },
          after: null,
        },
      ],
      stats: { insert: 1, delete: 1, replace: 1, equal: 0 },
      metrics: {
        render_token_delta: 2,
        render_non_ws_delta: 2,
        render_ws_delta: 0,
        render_chunk_drift: 0.1,
      },
    };

    diffData.structured_diff = structuredDiff;
    diffData.rendered_diff = renderedDiff;

    const metadata = computeWidgetMetadata(diffData);
    const foldingController = new FoldingController(['chunk-static', 'chunk-interp']);
    const diffModel = buildDiffOverlayModel(diffData);
    const codeView = buildCodeView(diffData, metadata, foldingController, diffModel);

    codeView.setDiffMode?.(true);

    const interpElement = codeView.element.querySelector('[data-chunk-id="chunk-interp"]');
    expect(interpElement?.getAttribute('data-diff-op')).toBe('insert');

    const ghostContainer = codeView.element.querySelector('.tp-diff-ghost-container');
    expect(ghostContainer).toBeTruthy();
    expect((ghostContainer as HTMLElement).hidden).toBe(false);

    codeView.destroy();
  });
});

describe('CodeView navigation', () => {
  const chunkId = 'chunk-nav';
  const elementId = 'element-nav';
  const sourcePath = '/Users/test/project/src/app.py';
  const creationPath = '/Users/test/project/src/factory.py';

  function createWidgetData(enableEditorLinks = true): WidgetData {
    return {
      ir: {
        chunks: [
          {
            id: chunkId,
            type: 'TextChunk',
            text: 'Hello world',
            element_id: elementId,
            metadata: {},
          },
        ],
        source_prompt_id: 'prompt-nav',
        id: 'ir-nav',
        metadata: {},
      },
      compiled_ir: {
        ir_id: 'ir-nav',
        subtree_map: { [elementId]: [chunkId] },
        num_elements: 1,
      },
      source_prompt: {
        prompt_id: 'prompt-nav',
        children: [
          {
            id: elementId,
            type: 'static',
            key: 'greeting',
            source_location: {
              filename: 'app.py',
              filepath: sourcePath,
              line: 12,
            },
            creation_location: {
              filename: 'factory.py',
              filepath: creationPath,
              line: 4,
            },
          },
        ],
      },
      config: {
        wrapping: true,
        sourcePrefix: '/Users/test/project',
        enableEditorLinks,
      },
    } as WidgetData;
  }

  it('opens source location on primary modifier click', async () => {
    const data = createWidgetData();
    const metadata = computeWidgetMetadata(data);
    const foldingController = new FoldingController([chunkId]);
    const view = buildCodeView(data, metadata, foldingController);
    document.body.appendChild(view.element);

    await Promise.resolve();

    const chunkElement = view.element.querySelector<HTMLElement>(`[data-chunk-id="${chunkId}"]`);
    expect(chunkElement).toBeTruthy();

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    chunkElement?.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, ctrlKey: true, metaKey: true, button: 0 })
    );

    expect(openSpy).toHaveBeenCalledWith(`vscode://file/${sourcePath}:12`);

    openSpy.mockRestore();
    view.destroy();
  });

  it('opens creation location when shift modifier is held', async () => {
    const data = createWidgetData();
    const metadata = computeWidgetMetadata(data);
    const foldingController = new FoldingController([chunkId]);
    const view = buildCodeView(data, metadata, foldingController);
    document.body.appendChild(view.element);

    await Promise.resolve();

    const chunkElement = view.element.querySelector<HTMLElement>(`[data-chunk-id="${chunkId}"]`);
    expect(chunkElement).toBeTruthy();

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    chunkElement?.dispatchEvent(
      new window.MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
        button: 0,
      })
    );

    expect(openSpy).toHaveBeenCalledWith(`vscode://file/${creationPath}:4`);

    openSpy.mockRestore();
    view.destroy();
  });

  it('disables navigation when editor links are turned off', async () => {
    const data = createWidgetData(false);
    const metadata = computeWidgetMetadata(data);
    const foldingController = new FoldingController([chunkId]);
    const view = buildCodeView(data, metadata, foldingController);
    document.body.appendChild(view.element);

    await Promise.resolve();

    const chunkElement = view.element.querySelector<HTMLElement>(`[data-chunk-id="${chunkId}"]`);
    expect(chunkElement).toBeTruthy();

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    chunkElement?.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, ctrlKey: true, metaKey: true, button: 0 })
    );

    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
    view.destroy();
  });
});

describe('CodeView collapse/expand cycle', () => {
  let container: WidgetHostElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div') as WidgetHostElement;
    container.setAttribute('data-tp-widget', 'true');
  });

  it('should handle multiple collapse-expand cycles (programmatic selection)', () => {
    // Create widget data with three chunks
    const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
    const elementIds = ['element-1', 'element-2', 'element-3'];

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [elementIds[0]]: [chunkIds[0]],
          [elementIds[1]]: [chunkIds[1]],
          [elementIds[2]]: [chunkIds[2]],
        },
        num_elements: 3,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'First chunk',
            element_id: elementIds[0],
            id: chunkIds[0],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Second chunk',
            element_id: elementIds[1],
            id: chunkIds[1],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Third chunk',
            element_id: elementIds[2],
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
            id: elementIds[0],
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'First chunk',
          },
          {
            type: 'static',
            id: elementIds[1],
            parent_id: 'prompt-1',
            key: 1,
            index: 1,
            source_location: null,
            value: 'Second chunk',
          },
          {
            type: 'static',
            id: elementIds[2],
            parent_id: 'prompt-1',
            key: 2,
            index: 2,
            source_location: null,
            value: 'Third chunk',
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

    // Get the widget component from container
    const widget = getWidget(container);

    // Get the output container (where chunks are rendered)
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer).toBeTruthy();

    // Get folding controller from widget
    const foldingController = widget.foldingController;
    expect(foldingController).toBeTruthy();

    // ==== CYCLE 1: Select → Collapse ====
    console.log('\n=== CYCLE 1: Select and Collapse ===');

    // Verify initial state - all three chunks should be visible
    let chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
    let chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
    let chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

    expect(chunk1).toBeTruthy();
    expect(chunk2).toBeTruthy();
    expect(chunk3).toBeTruthy();
    expect(chunk1.style.display).not.toBe('none');
    expect(chunk2.style.display).not.toBe('none');
    expect(chunk3.style.display).not.toBe('none');

    console.log('Initial chunks visible:', {
      chunk1: chunk1.textContent,
      chunk2: chunk2.textContent,
      chunk3: chunk3.textContent,
    });

    // Programmatically select chunks 1 and 2 (indices 0 and 1)
    foldingController.selectByIds([chunkIds[0], chunkIds[1]]);

    const selections1 = foldingController.getSelections();
    console.log('Selections after selectByIds:', selections1);
    expect(selections1).toHaveLength(1);
    expect(selections1[0]).toEqual({ start: 0, end: 1 });

    // Simulate spacebar keypress to collapse
    const keydownEvent1 = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    outputContainer.dispatchEvent(keydownEvent1);

    // Check that chunks 1 and 2 are hidden
    chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
    chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
    chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

    console.log('After collapse - chunk displays:', {
      chunk1: chunk1?.style.display,
      chunk2: chunk2?.style.display,
      chunk3: chunk3?.style.display,
    });

    expect(chunk1.style.display).toBe('none');
    expect(chunk2.style.display).toBe('none');
    expect(chunk3.style.display).not.toBe('none');

    const domSelectionAfterCollapse = window.getSelection();
    expect(domSelectionAfterCollapse?.rangeCount ?? 0).toBe(0);

    // Check that a collapsed chunk pill is present
    const collapsedPill1 = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
    expect(collapsedPill1).toBeTruthy();
    console.log('Collapsed pill text:', collapsedPill1.textContent);

    // ==== Expand ====
    console.log('\n=== Expand ===');

    // Double-click the collapsed pill to expand
    const dblclickEvent = new MouseEvent('dblclick', {
      bubbles: true,
    });
    collapsedPill1.dispatchEvent(dblclickEvent);

    // Check that chunks 1 and 2 are visible again
    chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
    chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
    chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

    console.log('After expand - chunk displays:', {
      chunk1: chunk1?.style.display,
      chunk2: chunk2?.style.display,
      chunk3: chunk3?.style.display,
    });

    expect(chunk1.style.display).not.toBe('none');
    expect(chunk2.style.display).not.toBe('none');
    expect(chunk3.style.display).not.toBe('none');

    // Collapsed pill should be gone
    const collapsedPillAfterExpand = container.querySelector('.tp-chunk-collapsed');
    expect(collapsedPillAfterExpand).toBeFalsy();

    // ==== CYCLE 2: Select → Collapse (AGAIN) ====
    console.log('\n=== CYCLE 2: Select and Collapse Again ===');

    // Try to select and collapse again - this is where the bug should manifest
    foldingController.clearSelections();
    foldingController.selectByIds([chunkIds[1], chunkIds[2]]);

    const selections2 = foldingController.getSelections();
    console.log('Selections after second selectByIds:', selections2);
    expect(selections2).toHaveLength(1);
    expect(selections2[0]).toEqual({ start: 1, end: 2 });

    // Simulate spacebar keypress to collapse again
    const keydownEvent2 = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    outputContainer.dispatchEvent(keydownEvent2);

    // Check that chunks 2 and 3 are now hidden
    chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
    chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
    chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

    console.log('After second collapse - chunk displays:', {
      chunk1: chunk1?.style.display,
      chunk2: chunk2?.style.display,
      chunk3: chunk3?.style.display,
    });

    expect(chunk1.style.display).not.toBe('none');
    expect(chunk2.style.display).toBe('none');
    expect(chunk3.style.display).toBe('none');

    // Check that a collapsed chunk pill is present
    const collapsedPill2 = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
    expect(collapsedPill2).toBeTruthy();
    console.log('Second collapsed pill text:', collapsedPill2.textContent);
  });

  it('rewraps chunk containers around collapse and expand', () => {
    const chunkIds = ['chunk-1', 'chunk-2'];
    const elementIds = ['element-1', 'element-2'];

    const longText = 'L'.repeat(140);

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [elementIds[0]]: [chunkIds[0]],
          [elementIds[1]]: [chunkIds[1]],
        },
        num_elements: 2,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: longText,
            element_id: elementIds[0],
            id: chunkIds[0],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'short',
            element_id: elementIds[1],
            id: chunkIds[1],
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
            id: elementIds[0],
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: longText,
          },
          {
            type: 'static',
            id: elementIds[1],
            parent_id: 'prompt-1',
            key: 1,
            index: 1,
            source_location: null,
            value: 'short',
          },
        ],
      },
    };

    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    initWidget(container);

    const widget = getWidget(container);

    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer).toBeTruthy();

    function findTopLevelChunkElement(chunkId: string): HTMLElement | undefined {
      return Array.from(outputContainer.children).find((child) => {
        return child instanceof HTMLElement && child.getAttribute('data-chunk-id') === chunkId;
      }) as HTMLElement | undefined;
    }

    const initialTop = findTopLevelChunkElement(chunkIds[0]);
    expect(initialTop).toBeTruthy();
    expect(initialTop?.classList.contains('tp-wrap-container')).toBe(true);

    const foldingController = widget.foldingController;
    expect(foldingController).toBeTruthy();

    foldingController.selectByIds([chunkIds[0]]);
    const [collapsedId] = foldingController.commitSelections();
    expect(collapsedId).toBeTruthy();

    const afterCollapse = findTopLevelChunkElement(chunkIds[0]);
    expect(afterCollapse).toBeTruthy();
    expect(afterCollapse?.classList.contains('tp-wrap-container')).toBe(true);
    expect(afterCollapse?.style.display).toBe('none');

    const collapsedPill = outputContainer.querySelector(`[data-chunk-id="${collapsedId}"]`);
    expect(collapsedPill).toBeTruthy();

    foldingController.expandChunk(collapsedId);

    const afterExpand = findTopLevelChunkElement(chunkIds[0]);
    expect(afterExpand).toBeTruthy();
    expect(afterExpand?.classList.contains('tp-wrap-container')).toBe(true);
    expect(afterExpand?.style.display).not.toBe('none');

    const pillAfterExpand = outputContainer.querySelector(`[data-chunk-id="${collapsedId}"]`);
    expect(pillAfterExpand).toBeFalsy();
  });

  // NOTE: This test is skipped because JSDOM doesn't persist Selection objects
  // across async boundaries (the 150ms debounce timeout). The selection gets
  // cleared before handleSelectionChange fires. This bug can only be tested
  // in a real browser environment.
  it.skip('should handle multiple collapse-expand cycles with text selection simulation', () => {
    // Create widget data with three chunks
    const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
    const elementIds = ['element-1', 'element-2', 'element-3'];

    const widgetData = {
      compiled_ir: {
        ir_id: 'ir-1',
        subtree_map: {
          [elementIds[0]]: [chunkIds[0]],
          [elementIds[1]]: [chunkIds[1]],
          [elementIds[2]]: [chunkIds[2]],
        },
        num_elements: 3,
      },
      ir: {
        chunks: [
          {
            type: 'TextChunk',
            text: 'First chunk',
            element_id: elementIds[0],
            id: chunkIds[0],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Second chunk',
            element_id: elementIds[1],
            id: chunkIds[1],
            metadata: {},
          },
          {
            type: 'TextChunk',
            text: 'Third chunk',
            element_id: elementIds[2],
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
            id: elementIds[0],
            parent_id: 'prompt-1',
            key: 0,
            index: 0,
            source_location: null,
            value: 'First chunk',
          },
          {
            type: 'static',
            id: elementIds[1],
            parent_id: 'prompt-1',
            key: 1,
            index: 1,
            source_location: null,
            value: 'Second chunk',
          },
          {
            type: 'static',
            id: elementIds[2],
            parent_id: 'prompt-1',
            key: 2,
            index: 2,
            source_location: null,
            value: 'Third chunk',
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

    // Get the widget component from container
    const widget = getWidget(container);

    // Get the output container (where chunks are rendered)
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer).toBeTruthy();

    // Helper to simulate text selection
    function simulateTextSelection(elements: HTMLElement[]): void {
      const selection = window.getSelection();
      if (!selection) return;

      selection.removeAllRanges();
      const range = document.createRange();
      range.setStartBefore(elements[0]);
      range.setEndAfter(elements[elements.length - 1]);
      selection.addRange(range);

      // Trigger selectionchange event
      document.dispatchEvent(new Event('selectionchange'));
    }

    // Helper to clear selection
    function clearSelection(): void {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
      }
    }

    // Helper to wait for debounce
    async function waitForDebounce(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 150));
    }

    // ==== CYCLE 1: Select → Collapse ====
    console.log('\n=== CYCLE 1: Text Selection and Collapse ===');

    // Verify initial state
    let chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
    let chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
    let chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

    expect(chunk1).toBeTruthy();
    expect(chunk2).toBeTruthy();
    expect(chunk3).toBeTruthy();

    console.log('Initial chunks:', {
      chunk1: chunk1.textContent,
      chunk2: chunk2.textContent,
      chunk3: chunk3.textContent,
    });

    // Simulate selecting chunks 1 and 2
    simulateTextSelection([chunk1, chunk2]);

    // Wait for debounced selection handler
    return waitForDebounce().then(() => {
      console.log('After selection debounce');

      // Check if the folding controller has selections
      const foldingController = widget.foldingController;
      const selections = foldingController.getSelections();
      console.log('Folding controller selections:', selections);

      // Check the CodeView's chunkIdToTopElements map
      console.log('Widget has views?', !!widget.views);
      console.log('Widget views length:', widget.views?.length);
      const codeView = findCodeView(widget);
      console.log('CodeView exists?', !!codeView);
      const chunkMap = codeView?.chunkIdToTopElements;
      console.log('chunkIdToTopElements exists?', !!chunkMap);

      if (chunkMap) {
        const chunkMapKeys = Array.from(chunkMap.keys());
        console.log('CodeView chunkIdToTopElements keys:', chunkMapKeys);

        // Check if the chunk elements in the map match those in the DOM
        const chunk1InMap = chunkMap.get(chunkIds[0])?.[0];
        const chunk1InDOM = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`);
        console.log('Chunk 1 - Same element in map and DOM?', chunk1InMap === chunk1InDOM);
      }

      // Simulate spacebar keypress to collapse
      const keydownEvent1 = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });
      outputContainer.dispatchEvent(keydownEvent1);

      // Check that chunks 1 and 2 are hidden
      chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
      chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
      chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

      console.log('After collapse - chunk displays:', {
        chunk1: chunk1?.style.display,
        chunk2: chunk2?.style.display,
        chunk3: chunk3?.style.display,
      });

      expect(chunk1.style.display).toBe('none');
      expect(chunk2.style.display).toBe('none');
      expect(chunk3.style.display).not.toBe('none');

      // Check that a collapsed chunk pill is present
      const collapsedPill1 = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
      expect(collapsedPill1).toBeTruthy();
      console.log('Collapsed pill:', collapsedPill1.textContent);

      // Clear selection
      clearSelection();

      // ==== Expand ====
      console.log('\n=== Expand ===');

      // Double-click the collapsed pill to expand
      const dblclickEvent = new MouseEvent('dblclick', {
        bubbles: true,
      });
      collapsedPill1.dispatchEvent(dblclickEvent);

      // Check that chunks 1 and 2 are visible again
      chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
      chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
      chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

      console.log('After expand - chunk displays:', {
        chunk1: chunk1?.style.display,
        chunk2: chunk2?.style.display,
        chunk3: chunk3?.style.display,
      });

      console.log('After expand - chunk elements exist:', {
        chunk1: !!chunk1,
        chunk2: !!chunk2,
        chunk3: !!chunk3,
      });

      expect(chunk1).toBeTruthy();
      expect(chunk2).toBeTruthy();
      expect(chunk3).toBeTruthy();
      expect(chunk1.style.display).not.toBe('none');
      expect(chunk2.style.display).not.toBe('none');
      expect(chunk3.style.display).not.toBe('none');

      // ==== CYCLE 2: Select → Collapse (AGAIN) ====
      console.log('\n=== CYCLE 2: Text Selection and Collapse Again ===');

      // Re-query chunk elements (they may have been replaced)
      chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
      chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
      chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

      console.log('Before second selection - chunks exist:', {
        chunk1: !!chunk1,
        chunk2: !!chunk2,
        chunk3: !!chunk3,
      });

      // Try to select and collapse again - simulate selecting chunks 2 and 3
      simulateTextSelection([chunk2, chunk3]);

      return waitForDebounce().then(() => {
        console.log('After second selection debounce');

        // Simulate spacebar keypress to collapse again
        const keydownEvent2 = new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
        });
        outputContainer.dispatchEvent(keydownEvent2);

        // Check that chunks 2 and 3 are now hidden
        chunk1 = container.querySelector(`[data-chunk-id="${chunkIds[0]}"]`) as HTMLElement;
        chunk2 = container.querySelector(`[data-chunk-id="${chunkIds[1]}"]`) as HTMLElement;
        chunk3 = container.querySelector(`[data-chunk-id="${chunkIds[2]}"]`) as HTMLElement;

        console.log('After second collapse - chunk displays:', {
          chunk1: chunk1?.style.display,
          chunk2: chunk2?.style.display,
          chunk3: chunk3?.style.display,
        });

        expect(chunk1.style.display).not.toBe('none');
        expect(chunk2.style.display).toBe('none');
        expect(chunk3.style.display).toBe('none');

        const domSelectionSecondCollapse = window.getSelection();
        expect(domSelectionSecondCollapse?.rangeCount ?? 0).toBe(0);

        // Check that a collapsed chunk pill is present
        const collapsedPill2 = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
        expect(collapsedPill2).toBeTruthy();
        console.log('Second collapsed pill:', collapsedPill2.textContent);
      });
    });

    it('expands all collapsed chunks when space bar is double-tapped without selection', () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
      const elementIds = ['element-1', 'element-2', 'element-3'];

      const widgetData = {
        compiled_ir: {
          ir_id: 'ir-double-space',
          subtree_map: {
            [elementIds[0]]: [chunkIds[0]],
            [elementIds[1]]: [chunkIds[1]],
            [elementIds[2]]: [chunkIds[2]],
          },
          num_elements: 3,
        },
        ir: {
          chunks: [
            {
              type: 'TextChunk',
              text: 'First chunk',
              element_id: elementIds[0],
              id: chunkIds[0],
              metadata: {},
            },
            {
              type: 'TextChunk',
              text: 'Second chunk',
              element_id: elementIds[1],
              id: chunkIds[1],
              metadata: {},
            },
            {
              type: 'TextChunk',
              text: 'Third chunk',
              element_id: elementIds[2],
              id: chunkIds[2],
              metadata: {},
            },
          ],
          source_prompt_id: 'prompt-double-space',
          id: 'ir-double-space',
          metadata: {},
        },
        source_prompt: {
          prompt_id: 'prompt-double-space',
          children: [
            {
              type: 'static',
              id: elementIds[0],
              parent_id: 'prompt-double-space',
              key: 0,
              index: 0,
              source_location: null,
              value: 'First chunk',
            },
            {
              type: 'static',
              id: elementIds[1],
              parent_id: 'prompt-double-space',
              key: 1,
              index: 1,
              source_location: null,
              value: 'Second chunk',
            },
            {
              type: 'static',
              id: elementIds[2],
              parent_id: 'prompt-double-space',
              key: 2,
              index: 2,
              source_location: null,
              value: 'Third chunk',
            },
          ],
        },
      };

      const scriptTag = document.createElement('script');
      scriptTag.setAttribute('data-role', 'tp-widget-data');
      scriptTag.setAttribute('type', 'application/json');
      scriptTag.textContent = JSON.stringify(widgetData);
      container.appendChild(scriptTag);

      const mountPoint = document.createElement('div');
      mountPoint.className = 'tp-widget-mount';
      container.appendChild(mountPoint);

      initWidget(container);

      const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
      expect(outputContainer).toBeTruthy();

      const widget = getWidget(container);
      const foldingController = widget.foldingController;

      foldingController.selectByIds([chunkIds[0], chunkIds[1]]);

      const collapseEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });
      outputContainer.dispatchEvent(collapseEvent);

      expect(outputContainer.querySelectorAll('.tp-chunk-collapsed')).toHaveLength(1);

      let mockTime = 0;
      const timeSpy = vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
      });

      mockTime = 100;
      outputContainer.dispatchEvent(spaceEvent);
      expect(outputContainer.querySelectorAll('.tp-chunk-collapsed')).toHaveLength(1);

      mockTime = 240;
      outputContainer.dispatchEvent(spaceEvent);

      expect(outputContainer.querySelectorAll('.tp-chunk-collapsed')).toHaveLength(0);

      timeSpy.mockRestore();
    });
  });
});
