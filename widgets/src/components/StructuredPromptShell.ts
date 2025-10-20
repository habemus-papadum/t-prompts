import type { Component } from './base';
import type { ViewMode, ChunkSize } from '../types';
import type { FoldingController } from '../folding/controller';
import { ScrollSyncManager } from './ScrollSyncManager';
import type { ToolbarComponent } from './Toolbar';
import { updateToolbarMode } from './Toolbar';
import type { DiffOverlayController } from './DiffOverlayController';

const TREE_DEFAULT_WIDTH = 280;
const TREE_MIN_WIDTH = 200;
const TREE_MAX_WIDTH = 480;
const SPLIT_DEFAULT_RATIO = 0.5;
const SPLIT_MIN_RATIO = 0.25;
const SPLIT_MAX_RATIO = 0.75;
const BEFORE_DEFAULT_RATIO = 0.3;
const BEFORE_MIN_RATIO = 0.18;
const BEFORE_MAX_RATIO = 0.45;

export interface ShellMetrics {
  totalCharacters: number;
  totalPixels: number;
  chunkIds: string[];
  chunkSizeMap: Record<string, ChunkSize>;
}

export interface StructuredPromptShellOptions {
  rootClassName?: string;
  element?: HTMLElement;
  treeView: Component;
  beforeView?: Component | null;
  codeView: Component;
  markdownView: Component;
  foldingController: FoldingController;
  metrics: ShellMetrics;
  treeStorageKey: string;
  treeWidthStorageKey: string;
  splitRatioStorageKey: string;
  beforeWidthStorageKey?: string;
  toolbarFactory: (context: StructuredPromptShellContext) => ToolbarComponent;
  diffController?: DiffOverlayController;
}

export interface StructuredPromptShellContext {
  currentMode: ViewMode;
  foldingController: FoldingController;
  metrics: ShellMetrics;
  diffController?: DiffOverlayController;
  beforePanel: HTMLElement | null;
  setViewMode(mode: ViewMode): void;
  setScrollSyncEnabled(enabled: boolean): void;
  toggleBeforePanel(visible: boolean): void;
}

export interface StructuredPromptShell extends Component {
  element: HTMLElement;
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  scrollSyncManager: ScrollSyncManager;
  views: Component[];
  viewMode: ViewMode;
  setViewMode(mode: ViewMode): void;
  collapseTree(): void;
  expandTree(): void;
  beforePanel: HTMLElement | null;
  setBeforeVisible(visible: boolean): void;
}

export function buildStructuredPromptShell(options: StructuredPromptShellOptions): StructuredPromptShell {
  const {
    rootClassName = 'tp-widget-output',
    element: existingElement,
    treeView,
    beforeView,
    codeView,
    markdownView,
    foldingController,
    metrics,
    treeStorageKey,
    treeWidthStorageKey,
    splitRatioStorageKey,
    beforeWidthStorageKey,
    toolbarFactory,
    diffController,
  } = options;

  const element = existingElement ?? document.createElement('div');
  if (!existingElement) {
    element.className = rootClassName;
  } else {
    element.classList.add(rootClassName);
  }

  const treeContainer = document.createElement('div');
  treeContainer.className = 'tp-tree-container';

  const treePanel = document.createElement('div');
  treePanel.className = 'tp-panel tp-tree-panel';
  treePanel.appendChild(treeView.element);

  const expandStrip = document.createElement('button');
  expandStrip.type = 'button';
  expandStrip.className = 'tp-tree-expand-strip';
  expandStrip.textContent = '▸';
  expandStrip.setAttribute('aria-label', 'Show tree view');

  const treeResizer = document.createElement('div');
  treeResizer.className = 'tp-tree-resizer';
  treeResizer.setAttribute('role', 'separator');
  treeResizer.setAttribute('aria-orientation', 'vertical');
  treeResizer.setAttribute('aria-hidden', 'false');
  treeResizer.setAttribute('aria-label', 'Resize tree panel');
  treeResizer.tabIndex = 0;

  const codePanel = document.createElement('div');
  codePanel.className = 'tp-panel tp-code-panel';
  codePanel.appendChild(codeView.element);

  const markdownPanel = document.createElement('div');
  markdownPanel.className = 'tp-panel tp-markdown-panel';
  markdownPanel.appendChild(markdownView.element);

  const splitResizer = document.createElement('div');
  splitResizer.className = 'tp-split-resizer';
  splitResizer.setAttribute('role', 'separator');
  splitResizer.setAttribute('aria-orientation', 'vertical');
  splitResizer.setAttribute('aria-hidden', 'false');
  splitResizer.setAttribute('aria-label', 'Resize code and markdown views');
  splitResizer.tabIndex = 0;

  const mainSplit = document.createElement('div');
  mainSplit.className = 'tp-main-split';
  mainSplit.appendChild(codePanel);
  mainSplit.appendChild(splitResizer);
  mainSplit.appendChild(markdownPanel);

  treeContainer.appendChild(treePanel);
  treeContainer.appendChild(expandStrip);

  const contentArea = document.createElement('div');
  contentArea.className = 'tp-content-area';
  contentArea.appendChild(treeContainer);
  contentArea.appendChild(treeResizer);

  let beforePanel: HTMLElement | null = null;
  let beforeResizer: HTMLElement | null = null;
  if (beforeView) {
    beforePanel = document.createElement('div');
    beforePanel.className = 'tp-panel tp-before-panel hidden';
    beforePanel.appendChild(beforeView.element);
    beforeResizer = document.createElement('div');
    beforeResizer.className = 'tp-before-resizer tp-before-resizer--hidden';
    beforeResizer.setAttribute('role', 'separator');
    beforeResizer.setAttribute('aria-orientation', 'vertical');
    beforeResizer.setAttribute('aria-hidden', 'true');
    beforeResizer.setAttribute('aria-label', 'Resize before view panel');
    beforeResizer.tabIndex = -1;
    contentArea.appendChild(beforePanel);
    contentArea.appendChild(beforeResizer);
  }

  contentArea.appendChild(mainSplit);

  element.appendChild(contentArea);

  let currentTreeWidth = TREE_DEFAULT_WIDTH;
  let currentSplitRatio = SPLIT_DEFAULT_RATIO;
  let currentBeforeRatio = BEFORE_DEFAULT_RATIO;

  function applyTreeWidth(width: number): void {
    currentTreeWidth = clamp(width, TREE_MIN_WIDTH, TREE_MAX_WIDTH);
    treeContainer.style.setProperty('--tp-tree-width', `${currentTreeWidth}px`);
    treeResizer.setAttribute('aria-valuemin', TREE_MIN_WIDTH.toString());
    treeResizer.setAttribute('aria-valuemax', TREE_MAX_WIDTH.toString());
    treeResizer.setAttribute('aria-valuenow', Math.round(currentTreeWidth).toString());
  }

  function persistTreeWidth(): void {
    storeNumberInSession(treeWidthStorageKey, Math.round(currentTreeWidth));
  }

  function applySplitRatio(ratio: number): void {
    currentSplitRatio = clamp(ratio, SPLIT_MIN_RATIO, SPLIT_MAX_RATIO);
    const percent = `${(currentSplitRatio * 100).toFixed(1)}%`;
    mainSplit.style.setProperty('--tp-code-width', percent);
    splitResizer.setAttribute('aria-valuemin', SPLIT_MIN_RATIO.toString());
    splitResizer.setAttribute('aria-valuemax', SPLIT_MAX_RATIO.toString());
    splitResizer.setAttribute('aria-valuenow', currentSplitRatio.toFixed(2));
  }

  function persistSplitRatio(): void {
    storeNumberInSession(splitRatioStorageKey, Number(currentSplitRatio.toFixed(3)));
  }

  function applyBeforeRatio(ratio: number): void {
    currentBeforeRatio = clamp(ratio, BEFORE_MIN_RATIO, BEFORE_MAX_RATIO);
    if (beforePanel) {
      const percent = `${(currentBeforeRatio * 100).toFixed(1)}%`;
      beforePanel.style.flexBasis = percent;
      beforePanel.style.width = percent;
      beforePanel.style.maxWidth = percent;
    }
    if (beforeResizer) {
      beforeResizer.setAttribute('aria-valuemin', BEFORE_MIN_RATIO.toString());
      beforeResizer.setAttribute('aria-valuemax', BEFORE_MAX_RATIO.toString());
      beforeResizer.setAttribute('aria-valuenow', currentBeforeRatio.toFixed(2));
    }
  }

  function persistBeforeRatio(): void {
    if (!beforeWidthStorageKey) {
      return;
    }
    storeNumberInSession(beforeWidthStorageKey, Number(currentBeforeRatio.toFixed(3)));
  }

  function updateBeforeResizerState(visible: boolean): void {
    if (!beforeResizer) {
      return;
    }
    beforeResizer.classList.toggle('tp-before-resizer--hidden', !visible);
    beforeResizer.setAttribute('aria-hidden', visible ? 'false' : 'true');
    beforeResizer.tabIndex = visible ? 0 : -1;
    if (visible) {
      applyBeforeRatio(currentBeforeRatio);
    }
  }

  currentTreeWidth = clamp(
    readNumberFromSession(treeWidthStorageKey) ?? TREE_DEFAULT_WIDTH,
    TREE_MIN_WIDTH,
    TREE_MAX_WIDTH
  );

  currentSplitRatio = clamp(
    readNumberFromSession(splitRatioStorageKey) ?? SPLIT_DEFAULT_RATIO,
    SPLIT_MIN_RATIO,
    SPLIT_MAX_RATIO
  );

  applyTreeWidth(currentTreeWidth);
  applySplitRatio(currentSplitRatio);
  if (beforePanel) {
    const storedBeforeRatio = beforeWidthStorageKey ? readNumberFromSession(beforeWidthStorageKey) : null;
    currentBeforeRatio = clamp(
      storedBeforeRatio ?? BEFORE_DEFAULT_RATIO,
      BEFORE_MIN_RATIO,
      BEFORE_MAX_RATIO
    );
    applyBeforeRatio(currentBeforeRatio);
  }

  function updateTreeResizerState(collapsed: boolean): void {
    treeResizer.classList.toggle('tp-tree-resizer--hidden', collapsed);
    treeResizer.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    treeResizer.tabIndex = collapsed ? -1 : 0;
  }

  const onTreeResizerPointerDown = (event: PointerEvent): void => {
    if (treeContainer.classList.contains('tp-tree-container--collapsed')) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = currentTreeWidth;

    treeResizer.classList.add('tp-tree-resizer--active');
    treeResizer.setPointerCapture(pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX;
      applyTreeWidth(startWidth + delta);
    };

    const handleUp = (): void => {
      treeResizer.classList.remove('tp-tree-resizer--active');
      try {
        treeResizer.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
      treeResizer.removeEventListener('pointermove', handleMove);
      treeResizer.removeEventListener('pointerup', handleUp);
      treeResizer.removeEventListener('pointercancel', handleUp);
      persistTreeWidth();
    };

    treeResizer.addEventListener('pointermove', handleMove);
    treeResizer.addEventListener('pointerup', handleUp);
    treeResizer.addEventListener('pointercancel', handleUp);
  };

  const onTreeResizerKeyDown = (event: KeyboardEvent): void => {
    if (treeContainer.classList.contains('tp-tree-container--collapsed')) {
      return;
    }

    const step = event.shiftKey ? 40 : 16;
    let handled = false;

    switch (event.key) {
      case 'ArrowLeft':
        applyTreeWidth(currentTreeWidth - step);
        handled = true;
        break;
      case 'ArrowRight':
        applyTreeWidth(currentTreeWidth + step);
        handled = true;
        break;
      case 'Home':
        applyTreeWidth(TREE_MIN_WIDTH);
        handled = true;
        break;
      case 'End':
        applyTreeWidth(TREE_MAX_WIDTH);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      persistTreeWidth();
    }
  };

  const onBeforeResizerPointerDown = (event: PointerEvent): void => {
    if (!beforePanel || beforePanel.classList.contains('hidden') || !beforeResizer) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const containerRect = contentArea.getBoundingClientRect();

    if (containerRect.width <= 0) {
      return;
    }

    const startRatio = currentBeforeRatio;
    beforeResizer.classList.add('tp-before-resizer--active');
    beforeResizer.setPointerCapture(pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX;
      const nextRatio = startRatio + delta / containerRect.width;
      applyBeforeRatio(nextRatio);
    };

    const handleUp = (): void => {
      beforeResizer.classList.remove('tp-before-resizer--active');
      try {
        beforeResizer.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
      beforeResizer.removeEventListener('pointermove', handleMove);
      beforeResizer.removeEventListener('pointerup', handleUp);
      beforeResizer.removeEventListener('pointercancel', handleUp);
      persistBeforeRatio();
    };

    beforeResizer.addEventListener('pointermove', handleMove);
    beforeResizer.addEventListener('pointerup', handleUp);
    beforeResizer.addEventListener('pointercancel', handleUp);
  };

  const onBeforeResizerKeyDown = (event: KeyboardEvent): void => {
    if (!beforePanel || beforePanel.classList.contains('hidden')) {
      return;
    }

    const step = event.shiftKey ? 0.1 : 0.05;
    let handled = false;

    switch (event.key) {
      case 'ArrowLeft':
        applyBeforeRatio(currentBeforeRatio - step);
        handled = true;
        break;
      case 'ArrowRight':
        applyBeforeRatio(currentBeforeRatio + step);
        handled = true;
        break;
      case 'Home':
        applyBeforeRatio(BEFORE_MIN_RATIO);
        handled = true;
        break;
      case 'End':
        applyBeforeRatio(BEFORE_MAX_RATIO);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      persistBeforeRatio();
    }
  };

  const onSplitResizerPointerDown = (event: PointerEvent): void => {
    if (currentViewMode !== 'split') {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const containerRect = mainSplit.getBoundingClientRect();
    const startRatio = currentSplitRatio;

    if (containerRect.width <= 0) {
      return;
    }

    splitResizer.classList.add('tp-split-resizer--active');
    splitResizer.setPointerCapture(pointerId);

    const handleMove = (moveEvent: PointerEvent): void => {
      const delta = moveEvent.clientX - startX;
      const nextRatio = startRatio + delta / containerRect.width;
      applySplitRatio(nextRatio);
    };

    const handleUp = (): void => {
      splitResizer.classList.remove('tp-split-resizer--active');
      try {
        splitResizer.releasePointerCapture(pointerId);
      } catch {
        // ignore release errors
      }
      splitResizer.removeEventListener('pointermove', handleMove);
      splitResizer.removeEventListener('pointerup', handleUp);
      splitResizer.removeEventListener('pointercancel', handleUp);
      persistSplitRatio();
    };

    splitResizer.addEventListener('pointermove', handleMove);
    splitResizer.addEventListener('pointerup', handleUp);
    splitResizer.addEventListener('pointercancel', handleUp);
  };

  const onSplitResizerKeyDown = (event: KeyboardEvent): void => {
    if (currentViewMode !== 'split') {
      return;
    }

    const step = event.shiftKey ? 0.1 : 0.05;
    let handled = false;

    switch (event.key) {
      case 'ArrowLeft':
        applySplitRatio(currentSplitRatio - step);
        handled = true;
        break;
      case 'ArrowRight':
        applySplitRatio(currentSplitRatio + step);
        handled = true;
        break;
      case 'Home':
        applySplitRatio(SPLIT_MIN_RATIO);
        handled = true;
        break;
      case 'End':
        applySplitRatio(SPLIT_MAX_RATIO);
        handled = true;
        break;
      default:
        break;
    }

    if (handled) {
      event.preventDefault();
      persistSplitRatio();
    }
  };

  treeResizer.addEventListener('pointerdown', onTreeResizerPointerDown);
  treeResizer.addEventListener('keydown', onTreeResizerKeyDown);
  if (beforeResizer) {
    beforeResizer.addEventListener('pointerdown', onBeforeResizerPointerDown);
    beforeResizer.addEventListener('keydown', onBeforeResizerKeyDown);
  }
  splitResizer.addEventListener('pointerdown', onSplitResizerPointerDown);
  splitResizer.addEventListener('keydown', onSplitResizerKeyDown);

  updateTreeResizerState(false);
  if (beforeResizer) {
    updateBeforeResizerState(false);
  }

  let currentViewMode: ViewMode = 'split';
  let scrollSyncEnabled = true;
  let scrollSyncManager: ScrollSyncManager;
  let toolbarComponent: ToolbarComponent;

  function setViewMode(mode: ViewMode): void {
    currentViewMode = mode;

    const isCodeOnly = mode === 'code';
    const isMarkdownOnly = mode === 'markdown';
    const isSplit = mode === 'split';

    codePanel.classList.toggle('hidden', isMarkdownOnly);
    markdownPanel.classList.toggle('hidden', isCodeOnly);

    mainSplit.classList.toggle('tp-main-split--code-only', isCodeOnly);
    mainSplit.classList.toggle('tp-main-split--markdown-only', isMarkdownOnly);
    mainSplit.classList.toggle('tp-main-split--split', isSplit);

    splitResizer.classList.toggle('tp-split-resizer--hidden', !isSplit);
    splitResizer.setAttribute('aria-hidden', isSplit ? 'false' : 'true');
    splitResizer.tabIndex = isSplit ? 0 : -1;

    if (toolbarComponent) {
      updateToolbarMode(toolbarComponent.element, mode);
      toolbarComponent.setScrollSyncEnabled(scrollSyncEnabled);
    }
    scrollSyncManager?.handleViewVisibilityChange();
  }

  toolbarComponent = toolbarFactory({
    currentMode: currentViewMode,
    foldingController,
    metrics,
    diffController,
    beforePanel,
    setViewMode,
    setScrollSyncEnabled(enabled) {
      scrollSyncEnabled = enabled;
      scrollSyncManager.setEnabled(enabled);
    },
    toggleBeforePanel(visible) {
      if (!beforePanel) {
        return;
      }
      beforePanel.classList.toggle('hidden', !visible);
      updateBeforeResizerState(visible);
    },
  });

  const toolbar = toolbarComponent.element;
  element.insertBefore(toolbar, contentArea);

  scrollSyncManager = new ScrollSyncManager({
    controller: foldingController,
    codeView,
    markdownView,
    codePanel,
    markdownPanel,
  });

  toolbarComponent.setScrollSyncEnabled(scrollSyncEnabled);

  const handleAssetLoad = (): void => {
    scrollSyncManager.markDirty('asset-load');
  };

  codePanel.addEventListener('load', handleAssetLoad, true);
  markdownPanel.addEventListener('load', handleAssetLoad, true);

  setViewMode(currentViewMode);

  const views: Component[] = beforeView ? [treeView, beforeView, codeView, markdownView] : [treeView, codeView, markdownView];

  const collapseTreePanel = (): void => {
    treeContainer.classList.add('tp-tree-container--collapsed');
    expandStrip.classList.add('tp-tree-expand-strip--visible');
    treeResizer.classList.remove('tp-tree-resizer--active');
    updateTreeResizerState(true);
    try {
      window.sessionStorage.setItem(treeStorageKey, '1');
    } catch {
      // ignore storage errors
    }
  };

  const expandTreePanel = (): void => {
    treeContainer.classList.remove('tp-tree-container--collapsed');
    expandStrip.classList.remove('tp-tree-expand-strip--visible');
    updateTreeResizerState(false);
    applyTreeWidth(currentTreeWidth);
    try {
      window.sessionStorage.setItem(treeStorageKey, '0');
    } catch {
      // ignore storage errors
    }
  };

  expandStrip.addEventListener('click', expandTreePanel);

  if (shouldCollapseTreePanel(treeStorageKey)) {
    collapseTreePanel();
  } else {
    expandTreePanel();
  }

  if (diffController) {
    diffController.on((state) => {
      if (beforePanel) {
        beforePanel.classList.toggle('hidden', !state.beforeVisible);
      }
    });
  }

  return {
    element,
    toolbar,
    contentArea,
    scrollSyncManager,
    views,
    viewMode: currentViewMode,
    beforePanel,
    setViewMode,
    collapseTree: collapseTreePanel,
    expandTree: expandTreePanel,
    setBeforeVisible(visible: boolean): void {
      if (!beforePanel) {
        return;
      }
      beforePanel.classList.toggle('hidden', !visible);
      updateBeforeResizerState(visible);
    },
    destroy(): void {
      views.forEach((view) => view.destroy());
      toolbarComponent.destroy();
      scrollSyncManager.destroy();
      treeResizer.removeEventListener('pointerdown', onTreeResizerPointerDown);
      treeResizer.removeEventListener('keydown', onTreeResizerKeyDown);
      if (beforeResizer) {
        beforeResizer.removeEventListener('pointerdown', onBeforeResizerPointerDown);
        beforeResizer.removeEventListener('keydown', onBeforeResizerKeyDown);
      }
      splitResizer.removeEventListener('pointerdown', onSplitResizerPointerDown);
      splitResizer.removeEventListener('keydown', onSplitResizerKeyDown);
      codePanel.removeEventListener('load', handleAssetLoad, true);
      markdownPanel.removeEventListener('load', handleAssetLoad, true);
      element.remove();
    },
  };
}

function shouldCollapseTreePanel(storageKey: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

function readNumberFromSession(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeNumberInSession(key: string, value: number): void {
  try {
    window.sessionStorage.setItem(key, value.toString());
  } catch {
    // ignore storage errors
  }
}
