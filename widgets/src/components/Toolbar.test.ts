import { describe, it, expect, beforeEach } from 'vitest';
import { createToolbar } from './Toolbar';
import { FoldingController } from '../folding/controller';

describe('Toolbar', () => {
  const chunkIds = ['chunk-a', 'chunk-b', 'chunk-img'];
  const chunkSizeMap = {
    'chunk-a': { character: 100, pixel: 0 },
    'chunk-b': { character: 50, pixel: 0 },
    'chunk-img': { character: 0, pixel: 400 },
  } as const;

  let foldingController: FoldingController;

  beforeEach(() => {
    document.body.innerHTML = '';
    foldingController = new FoldingController(chunkIds);
  });

  it('updates visibility indicators when folding state changes', () => {
    const toolbar = createToolbar({
      currentMode: 'split',
      callbacks: {
        onViewModeChange: () => {},
      },
      foldingController,
      metrics: {
        totalCharacters: 150,
        totalPixels: 400,
        chunkIds,
        chunkSizeMap: {
          ...chunkSizeMap,
        },
      },
    });

    document.body.appendChild(toolbar.element);

    const charEntry = toolbar.element.querySelector('.tp-meter-entry--characters');
    const pixelEntry = toolbar.element.querySelector('.tp-meter-entry--pixels');

    const charText = charEntry?.querySelector('.tp-meter-text--characters');
    const pixelText = pixelEntry?.querySelector('.tp-meter-text--pixels');

    expect(charText?.textContent).toBe('150/150ch');
    expect(pixelText?.textContent).toBe('400/400px');

    foldingController.addSelection(0, 1);
    const collapsedIds = foldingController.commitSelections();

    expect(charText?.textContent).toBe('0/150ch');
    expect(pixelText?.textContent).toBe('400/400px');

    foldingController.expandChunk(collapsedIds[0]);

    expect(charText?.textContent).toBe('150/150ch');

    toolbar.destroy();
  });

  it('toggles help popover when help button is clicked', () => {
    const toolbar = createToolbar({
      currentMode: 'split',
      callbacks: {
        onViewModeChange: () => {},
      },
      foldingController,
      metrics: {
        totalCharacters: 150,
        totalPixels: 400,
        chunkIds,
        chunkSizeMap: {
          ...chunkSizeMap,
        },
      },
    });

    document.body.appendChild(toolbar.element);

    const helpButton = toolbar.element.querySelector('.tp-help-button') as HTMLButtonElement | null;
    const popover = toolbar.element.querySelector('.tp-help-popover') as HTMLElement | null;

    expect(helpButton).not.toBeNull();
    expect(popover).not.toBeNull();
    expect(popover?.hidden).toBe(true);
    expect(helpButton?.getAttribute('aria-expanded')).toBe('false');

    helpButton?.click();

    expect(popover?.hidden).toBe(false);
    expect(helpButton?.getAttribute('aria-expanded')).toBe('true');

    document.body.click();

    expect(popover?.hidden).toBe(true);
    expect(helpButton?.getAttribute('aria-expanded')).toBe('false');

    toolbar.destroy();
  });

  it('provides scroll sync toggle control', () => {
    let latestState: boolean | null = null;

    const toolbar = createToolbar({
      currentMode: 'split',
      callbacks: {
        onViewModeChange: () => {},
        onScrollSyncToggle: (enabled) => {
          latestState = enabled;
        },
      },
      foldingController,
      metrics: {
        totalCharacters: 150,
        totalPixels: 400,
        chunkIds,
        chunkSizeMap: {
          ...chunkSizeMap,
        },
      },
    });

    document.body.appendChild(toolbar.element);

    const syncButton = toolbar.element.querySelector('.tp-toolbar-sync-btn') as HTMLButtonElement | null;
    expect(syncButton).not.toBeNull();
    expect(syncButton?.classList.contains('active')).toBe(true);
    expect(syncButton?.getAttribute('aria-pressed')).toBe('true');

    syncButton?.click();

    expect(latestState).toBe(false);
    expect(syncButton?.getAttribute('aria-pressed')).toBe('false');
    expect(syncButton?.classList.contains('active')).toBe(false);

    toolbar.setScrollSyncEnabled(true);

    expect(syncButton?.classList.contains('active')).toBe(true);
    expect(syncButton?.getAttribute('aria-pressed')).toBe('true');

    toolbar.destroy();
  });

  it('renders diff metrics including replacements', () => {
    const toolbar = createToolbar({
      currentMode: 'split',
      diffEnabled: true,
      callbacks: {
        onViewModeChange: () => {},
      },
      foldingController,
      metrics: {
        totalCharacters: 150,
        totalPixels: 400,
        chunkIds,
        chunkSizeMap: {
          ...chunkSizeMap,
        },
      },
      diffData: {
        structured: {
          stats: { nodes_added: 1, nodes_removed: 0, nodes_modified: 2 },
        } as any,
        rendered: {
          stats: { insert: 0, delete: 0, replace: 3 },
        } as any,
      },
    });

    document.body.appendChild(toolbar.element);

    const metricsText = toolbar.element.querySelector('.tp-diff-metrics-text');
    expect(metricsText?.textContent).toBe('1+ 0− 2~ nodes, 0+ 0− 3~ chunks');

    toolbar.destroy();
  });
});
