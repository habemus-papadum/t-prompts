/**
 * Widget Container Component
 *
 * Top-level container that orchestrates multiple views and toolbars.
 * Currently contains just CodeView, but designed to support:
 * - Toolbar for view switching and controls
 * - Multiple visualization views (tree, table, etc.)
 */

import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ViewMode } from '../types';
import { buildTreeView } from './TreeView';
import { buildCodeView } from './CodeView';
import { buildMarkdownView } from './MarkdownView';
import { ScrollSyncManager } from './ScrollSyncManager';
import { FoldingController } from '../folding/controller';
import { createToolbar, updateToolbarMode } from './Toolbar';
import type { ToolbarComponent } from './Toolbar';
import { DiffState } from '../state/diffState';

const TREE_DEFAULT_WIDTH = 280;
const TREE_MIN_WIDTH = 200;
const TREE_MAX_WIDTH = 480;
const SPLIT_DEFAULT_RATIO = 0.5;
const SPLIT_MIN_RATIO = 0.25;
const SPLIT_MAX_RATIO = 0.75;

/**
 * Widget container component interface
 */
export interface WidgetContainer extends Component {
  // Container-specific
  views: Component[]; // Child components
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  foldingController: FoldingController; // Exposed for testing
  viewMode: ViewMode; // Current view mode
  scrollSyncManager: ScrollSyncManager;

  // Operations
  setViewMode(mode: ViewMode): void;
}

/**
 * Build a WidgetContainer component from widget data and metadata
 */
export function buildWidgetContainer(data: WidgetData, metadata: WidgetMetadata): WidgetContainer {
  // 1. Create root element
  const element = document.createElement('div');
  element.className = 'tp-widget-output';

  // 2. Initialize folding controller with chunk sequence
  const initialChunkIds = data.ir?.chunks?.map((chunk) => chunk.id) || [];
  const foldingController = new FoldingController(initialChunkIds);

  const chunkSizeMap = metadata.chunkSizeMap;
  let totalCharacters = 0;
  let totalPixels = 0;
  for (const chunkId of initialChunkIds) {
    const size = chunkSizeMap[chunkId];
    if (!size) {
      continue;
    }
    totalCharacters += size.character ?? 0;
    totalPixels += size.pixel ?? 0;
  }

  const treeStorageKey = `tp-tree-collapsed:${data.compiled_ir?.ir_id ?? 'default'}`;

  // 3. Build views
  const treeWidthStorageKey = `tp-tree-width:${data.compiled_ir?.ir_id ?? 'default'}`;
  const splitRatioStorageKey = `tp-split-ratio:${data.compiled_ir?.ir_id ?? 'default'}`;

  const treeContainer = document.createElement('div');
  treeContainer.className = 'tp-tree-container';

  const expandStrip = document.createElement('button');
  expandStrip.type = 'button';
  expandStrip.className = 'tp-tree-expand-strip';
  expandStrip.textContent = '▸';
  expandStrip.setAttribute('aria-label', 'Show tree view');

  let collapseTreePanel: () => void = () => {};
  let expandTreePanel: () => void = () => {};

  const diffState = new DiffState({
    structured: data.structured_diff ?? null,
    rendered: data.rendered_diff ?? null,
  });

  const treeView = buildTreeView({
    data,
    metadata,
    foldingController,
    diffState,
    onCollapse: () => collapseTreePanel(),
  });

  const treePanel = document.createElement('div');
  treePanel.className = 'tp-panel tp-tree-panel';
  treePanel.appendChild(treeView.element);

  const treeResizer = document.createElement('div');
  treeResizer.className = 'tp-tree-resizer';
  treeResizer.setAttribute('role', 'separator');
  treeResizer.setAttribute('aria-orientation', 'vertical');
  treeResizer.setAttribute('aria-hidden', 'false');
  treeResizer.setAttribute('aria-label', 'Resize tree panel');
  treeResizer.tabIndex = 0;

  const codeView = buildCodeView(data, metadata, foldingController, diffState);
  const markdownView = buildMarkdownView(data, metadata, foldingController, diffState);

  // 4. Create panels
  const codePanel = document.createElement('div');
  codePanel.className = 'tp-panel tp-code-panel';
  codePanel.appendChild(codeView.element);

  const markdownPanel = document.createElement('div');
  markdownPanel.className = 'tp-panel tp-markdown-panel';
  markdownPanel.appendChild(markdownView.element);

  // 5. Create content area
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
  contentArea.appendChild(mainSplit);

  let currentTreeWidth = TREE_DEFAULT_WIDTH;
  let currentSplitRatio = SPLIT_DEFAULT_RATIO;

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

  function updateTreeResizerState(collapsed: boolean): void {
    treeResizer.classList.toggle('tp-tree-resizer--hidden', collapsed);
    treeResizer.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    treeResizer.tabIndex = collapsed ? -1 : 0;
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
  splitResizer.addEventListener('pointerdown', onSplitResizerPointerDown);
  splitResizer.addEventListener('keydown', onSplitResizerKeyDown);

  updateTreeResizerState(false);

  // 6. State management
  let currentViewMode: ViewMode = 'split';
  let scrollSyncEnabled = true;
  let scrollSyncManager: ScrollSyncManager;

  // 7. View mode setter
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

    // Update toolbar active state
    updateToolbarMode(toolbar, mode);

    scrollSyncManager.handleViewVisibilityChange();
  }

  // 8. Create toolbar
  const toolbarComponent: ToolbarComponent = createToolbar({
    currentMode: currentViewMode,
    callbacks: {
      onViewModeChange: setViewMode,
      onScrollSyncToggle: (enabled) => {
        scrollSyncEnabled = enabled;
        scrollSyncManager.setEnabled(enabled);
      },
    },
    foldingController,
    metrics: {
      totalCharacters,
      totalPixels,
      chunkIds: initialChunkIds,
      chunkSizeMap,
    },
    diffState,
  });
  const toolbar = toolbarComponent.element;

  // 9. Assemble
  element.appendChild(toolbar);
  element.appendChild(contentArea);

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

  // 10. Initialize view mode
  setViewMode(currentViewMode);

  // 11. Track views
  const views: Component[] = [treeView, codeView, markdownView];

  expandStrip.addEventListener('click', () => expandTreePanel());

  collapseTreePanel = (): void => {
    treeContainer.classList.add('tp-tree-container--collapsed');
    expandStrip.classList.add('tp-tree-expand-strip--visible');
    treeResizer.classList.remove('tp-tree-resizer--active');
    updateTreeResizerState(true);
    try {
      window.sessionStorage.setItem(treeStorageKey, '1');
    } catch {
      // ignore storage errors (e.g., sandboxed environments)
    }
  };

  expandTreePanel = (): void => {
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

  if (shouldCollapseTreePanel(treeStorageKey)) {
    collapseTreePanel();
  } else {
    expandTreePanel();
  }

  // 12. Return component
  return {
    element,
    views,
    toolbar,
    contentArea,
    foldingController,
    viewMode: currentViewMode,
    scrollSyncManager,

    setViewMode,

    destroy(): void {
      // Cleanup all views
      views.forEach((view) => view.destroy());
      toolbarComponent.destroy();
      scrollSyncManager.destroy();
      treeResizer.removeEventListener('pointerdown', onTreeResizerPointerDown);
      treeResizer.removeEventListener('keydown', onTreeResizerKeyDown);
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
