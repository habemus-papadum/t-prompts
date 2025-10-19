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

  it('shows help tooltip on hover', () => {
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

    const helpContainer = toolbar.element.querySelector('.tp-toolbar-help') as HTMLElement | null;
    const tooltip = helpContainer?.querySelector('.tp-toolbar-tooltip') as HTMLElement | null;

    expect(helpContainer).not.toBeNull();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.classList.contains('visible')).toBe(false);

    helpContainer?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(tooltip?.classList.contains('visible')).toBe(true);

    helpContainer?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(tooltip?.classList.contains('visible')).toBe(false);

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
});
