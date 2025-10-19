import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ViewMode } from '../types';
import { buildTreeView } from './TreeView';
import { buildCodeView } from './CodeView';
import { buildBeforeCodeView } from './BeforeCodeView';
import { buildMarkdownView } from './MarkdownView';
import { ScrollSyncManager } from './ScrollSyncManager';
import { FoldingController } from '../folding/controller';
import { createToolbar, type ToolbarSection } from './Toolbar';
import { createDiffToolbarSection } from './ToolbarSectionDiff';
import { createPromptTreeDataSource } from './treeDataSource';
import { createDiffTreeOverlay } from './DiffTreeOverlay';
import { buildStructuredPromptShell } from './StructuredPromptShell';
import { DiffOverlayController } from '../controllers/DiffOverlayController';
import { getDiffContext } from '../utils/diffContext';

const TREE_WIDTH_KEY_PREFIX = 'tp-tree-width';
const TREE_COLLAPSED_KEY_PREFIX = 'tp-tree-collapsed';
const SPLIT_RATIO_KEY_PREFIX = 'tp-split-ratio';
const DIFF_ENABLED_KEY_PREFIX = 'tp-diff-enabled';
const BEFORE_VISIBLE_KEY_PREFIX = 'tp-before-visible';

export interface WidgetContainer extends Component {
  views: Component[];
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  foldingController: FoldingController;
  viewMode: ViewMode;
  scrollSyncManager: ScrollSyncManager;
  setViewMode(mode: ViewMode): void;
}

export function buildWidgetContainer(data: WidgetData, metadata: WidgetMetadata): WidgetContainer {
  const diffContext = getDiffContext(data);

  const initialChunkIds = data.ir?.chunks?.map((chunk) => chunk.id) ?? [];
  const foldingController = new FoldingController(initialChunkIds);

  const beforeChunkIds = diffContext?.beforePrompt.chunks?.map((chunk) => chunk.id) ?? [];
  const beforeFoldingController = diffContext ? new FoldingController(beforeChunkIds) : null;

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

  const storageSuffix = data.compiled_ir?.ir_id ?? 'default';
  const treeWidthKey = `${TREE_WIDTH_KEY_PREFIX}:${storageSuffix}`;
  const treeCollapsedKey = `${TREE_COLLAPSED_KEY_PREFIX}:${storageSuffix}`;
  const splitRatioKey = `${SPLIT_RATIO_KEY_PREFIX}:${storageSuffix}`;
  const diffEnabledKey = `${DIFF_ENABLED_KEY_PREFIX}:${storageSuffix}`;
  const beforeVisibleKey = `${BEFORE_VISIBLE_KEY_PREFIX}:${storageSuffix}`;

  const treeDataSource = createPromptTreeDataSource(data, metadata, {
    treeShowWhitespace: data.config?.treeShowWhitespace ?? 'default',
  });
  const treeOverlays = diffContext ? [createDiffTreeOverlay(diffContext)] : [];

  let collapseTree: () => void = () => {};

  const treeView = buildTreeView({
    data,
    metadata,
    foldingController,
    onCollapse: () => collapseTree(),
    dataSource: treeDataSource,
    overlays: treeOverlays,
  });

  const codeView = buildCodeView(data, metadata, foldingController);
  const markdownView = buildMarkdownView(data, metadata, foldingController);
  const beforeView = diffContext && beforeFoldingController
    ? buildBeforeCodeView(data, metadata, beforeFoldingController)
    : null;

  let scrollSyncManager: ScrollSyncManager | null = null;

  const toolbar = createToolbar({
    currentMode: 'split',
    callbacks: {
      onViewModeChange: (mode) => setViewMode(mode),
      onScrollSyncToggle: (enabled) => scrollSyncManager?.setEnabled(enabled),
    },
    foldingController,
    metrics: {
      totalCharacters,
      totalPixels,
      chunkIds: initialChunkIds,
      chunkSizeMap,
    },
    sections: [],
  });

  const shell = buildStructuredPromptShell({
    renderTree: () => treeView,
    renderAfter: () => codeView,
    renderMarkdown: () => markdownView,
    renderBefore: beforeView ? () => beforeView : undefined,
    toolbar,
    defaultViewMode: 'split',
    storageKeys: {
      treeWidth: treeWidthKey,
      splitRatio: splitRatioKey,
      treeCollapsed: treeCollapsedKey,
    },
    onTreeCollapse: (): void => treeView.update(),
    onTreeExpand: (): void => treeView.update(),
  });

  collapseTree = (): void => shell.collapseTree();

  const diffController = diffContext
    ? new DiffOverlayController({
        root: shell.element,
        defaultEnabled: true,
        storageKeys: {
          diffEnabled: diffEnabledKey,
          beforeVisible: beforeVisibleKey,
        },
        onDiffChange: () => scrollSyncManager?.markDirty('diff-toggle'),
        onBeforeChange: (visible) => shell.setBeforeVisible(visible),
      })
    : null;

  let diffSection: ToolbarSection | null = null;
  if (diffController && diffContext) {
    const section = createDiffToolbarSection({
      controller: diffController,
      diffContext,
      showBeforeToggle: Boolean(beforeView),
    });
    const rightContainer = shell.toolbar.querySelector('.tp-toolbar-right') ?? shell.toolbar;
    section.mount(rightContainer as HTMLElement);
    diffSection = section;
    shell.setBeforeVisible(diffController.isBeforeVisible());
  }

  scrollSyncManager = new ScrollSyncManager({
    controller: foldingController,
    codeView,
    markdownView,
    codePanel: shell.codePanel,
    markdownPanel: shell.markdownPanel,
  });

  toolbar.setScrollSyncEnabled(true);

  function setViewMode(mode: ViewMode): void {
    shell.setViewMode(mode);
    scrollSyncManager?.handleViewVisibilityChange();
  }

  const assetLoadHandler = (): void => {
    scrollSyncManager?.markDirty('asset-load');
  };

  shell.codePanel.addEventListener('load', assetLoadHandler, true);
  shell.markdownPanel.addEventListener('load', assetLoadHandler, true);

  const views = beforeView ? [treeView, beforeView, codeView, markdownView] : [treeView, codeView, markdownView];

  return {
    element: shell.element,
    views,
    toolbar: shell.toolbar,
    contentArea: shell.contentArea,
    foldingController,
    viewMode: 'split',
    scrollSyncManager: scrollSyncManager!,
    setViewMode,
    destroy(): void {
      shell.codePanel.removeEventListener('load', assetLoadHandler, true);
      shell.markdownPanel.removeEventListener('load', assetLoadHandler, true);
      diffSection?.destroy();
      scrollSyncManager?.destroy();
      shell.destroy();
    },
  };
}
