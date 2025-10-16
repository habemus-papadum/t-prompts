import { describe, it, expect, beforeEach } from 'vitest';
import { initWidget } from '../index';

describe('CodeView collapse/expand cycle', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div');
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
    const widget = (container as any)._widgetComponent;
    expect(widget).toBeTruthy();

    // Get the output container (where chunks are rendered)
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer).toBeTruthy();

    // Get folding controller from widget
    const foldingController = (widget as any).foldingController;
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
    const widget = (container as any)._widgetComponent;
    expect(widget).toBeTruthy();

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
      const foldingController = (widget as any).foldingController;
      const selections = foldingController.getSelections();
      console.log('Folding controller selections:', selections);

      // Check the CodeView's chunkIdToTopElements map
      console.log('Widget has views?', !!widget.views);
      console.log('Widget views length:', widget.views?.length);
      const codeView = widget.views?.[0];
      console.log('CodeView exists?', !!codeView);
      const chunkMap = (codeView as any)?.chunkIdToTopElements;
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

        // Check that a collapsed chunk pill is present
        const collapsedPill2 = container.querySelector('.tp-chunk-collapsed') as HTMLElement;
        expect(collapsedPill2).toBeTruthy();
        console.log('Second collapsed pill:', collapsedPill2.textContent);
      });
    });
  });
});
