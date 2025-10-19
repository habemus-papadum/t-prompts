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
      scrollSyncEnabled: true,
      callbacks: {
        onViewModeChange: () => {},
        onToggleScrollSync: () => {},
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
      scrollSyncEnabled: true,
      callbacks: {
        onViewModeChange: () => {},
        onToggleScrollSync: () => {},
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

  it('toggles scroll sync button and emits callback', () => {
    const toggled: boolean[] = [];
    const toolbar = createToolbar({
      currentMode: 'split',
      scrollSyncEnabled: true,
      callbacks: {
        onViewModeChange: () => {},
        onToggleScrollSync: (enabled) => toggled.push(enabled),
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

    const button = toolbar.element.querySelector('.tp-toolbar-sync-btn') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.classList.contains('tp-toolbar-sync-btn--active')).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');

    button?.click();

    expect(button?.classList.contains('tp-toolbar-sync-btn--active')).toBe(false);
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(toggled).toEqual([false]);

    button?.click();

    expect(button?.classList.contains('tp-toolbar-sync-btn--active')).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(toggled).toEqual([false, true]);

    toolbar.destroy();
  });
});
