import type { Component } from './base';
import type { WidgetData, WidgetMetadata, ViewMode } from '../types';
import { buildTreeView } from './TreeView';
import { buildCodeView } from './CodeView';
import { buildBeforeCodeView } from './BeforeCodeView';
import { buildMarkdownView } from './MarkdownView';
import { FoldingController } from '../folding/controller';
import { createToolbar } from './Toolbar';
import type { ToolbarComponent } from './Toolbar';
import {
  buildStructuredPromptShell,
  type StructuredPromptShell,
  type ShellMetrics,
  type StructuredPromptShellContext,
} from './StructuredPromptShell';
import { buildDiffContext } from '../metadata';
import { DiffOverlayController } from './DiffOverlayController';

export interface WidgetContainer extends Component {
  shell: StructuredPromptShell;
  views: Component[];
  toolbar: HTMLElement;
  contentArea: HTMLElement;
  foldingController: FoldingController;
  viewMode: ViewMode;
  scrollSyncManager: import('./ScrollSyncManager').ScrollSyncManager;
  diffController?: DiffOverlayController;
  setViewMode(mode: ViewMode): void;
}

function computeShellMetrics(chunkIds: string[], chunkSizeMap: Record<string, import('../types').ChunkSize>): ShellMetrics {
  let totalCharacters = 0;
  let totalPixels = 0;

  for (const chunkId of chunkIds) {
    const size = chunkSizeMap[chunkId];
    if (!size) {
      continue;
    }
    totalCharacters += size.character ?? 0;
    totalPixels += size.pixel ?? 0;
  }

  return {
    totalCharacters,
    totalPixels,
    chunkIds,
    chunkSizeMap,
  };
}

export function buildWidgetContainer(data: WidgetData, metadata: WidgetMetadata): WidgetContainer {
  const element = document.createElement('div');
  element.className = 'tp-widget-output';

  const diffContext = buildDiffContext(data);
  const initialChunkIds = data.ir?.chunks?.map((chunk) => chunk.id) ?? [];
  const foldingController = new FoldingController(initialChunkIds);

  const beforeChunkIds = diffContext?.beforePrompt.chunks?.map((chunk) => chunk.id) ?? [];
  const beforeFoldingController = beforeChunkIds.length ? new FoldingController(beforeChunkIds) : null;

  let collapseTreePanel: () => void = () => {};

  const treeView = buildTreeView({
    data,
    metadata,
    foldingController,
    onCollapse: () => collapseTreePanel(),
  });

  const codeView = buildCodeView(data, metadata, foldingController);
  const markdownView = buildMarkdownView(data, metadata, foldingController);
  const beforeView = diffContext && beforeFoldingController
    ? buildBeforeCodeView(data, metadata, beforeFoldingController)
    : null;

  const metrics = computeShellMetrics(initialChunkIds, metadata.chunkSizeMap);
  const treeStorageKey = `tp-tree-collapsed:${data.compiled_ir?.ir_id ?? 'default'}`;
  const treeWidthStorageKey = `tp-tree-width:${data.compiled_ir?.ir_id ?? 'default'}`;
  const splitRatioStorageKey = `tp-split-ratio:${data.compiled_ir?.ir_id ?? 'default'}`;
  const beforeWidthStorageKey = diffContext ? `tp-before-width:${data.compiled_ir?.ir_id ?? 'default'}` : undefined;
  const toolbarStoragePrefix = `tp-diff:${data.compiled_ir?.ir_id ?? 'default'}`;

  let diffController: DiffOverlayController | undefined;

  let activeToolbar: ToolbarComponent | undefined;

  const shell = buildStructuredPromptShell({
    element,
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
    diffController: undefined,
    toolbarFactory(context: StructuredPromptShellContext): ToolbarComponent {
      if (diffContext && !diffController) {
        diffController = new DiffOverlayController({
          host: element,
          diffContext,
          storagePrefix: toolbarStoragePrefix,
          initialBeforeVisible: false,
          initialDiffEnabled: true,
        });
      }

      const toolbarComponent = createToolbar({
        currentMode: context.currentMode,
        beforeVisible: diffContext ? diffController?.getState().beforeVisible ?? false : undefined,
        callbacks: {
          onViewModeChange: context.setViewMode,
          onScrollSyncToggle: context.setScrollSyncEnabled,
          onBeforeToggle: diffController
            ? (visible: boolean) => {
                diffController?.setBeforeVisible(visible);
              }
            : undefined,
          onDiffToggle: diffController
            ? (enabled: boolean) => {
                diffController?.setDiffEnabled(enabled);
              }
            : undefined,
        },
        foldingController: context.foldingController,
        metrics: context.metrics,
        diffData: diffContext
          ? {
              structured: diffContext.structured,
              rendered: diffContext.rendered,
            }
          : undefined,
        diffEnabled: diffContext ? diffController?.getState().diffEnabled ?? true : undefined,
      });

      activeToolbar = toolbarComponent;
      return toolbarComponent;
    },
  });

  if (diffController) {
    diffController.on((state) => {
      shell.setBeforeVisible(state.beforeVisible);
      activeToolbar?.setBeforeVisible(state.beforeVisible);
      activeToolbar?.setDiffEnabled(state.diffEnabled);
    });
  }

  collapseTreePanel = shell.collapseTree;

  const widget: WidgetContainer = {
    shell,
    element: shell.element,
    views: shell.views,
    toolbar: shell.toolbar,
    contentArea: shell.contentArea,
    foldingController,
    viewMode: shell.viewMode,
    scrollSyncManager: shell.scrollSyncManager,
    diffController,
    setViewMode(mode: ViewMode): void {
      shell.setViewMode(mode);
      widget.viewMode = shell.viewMode;
    },
    destroy(): void {
      diffController?.destroy();
      shell.destroy();
    },
  };

  return widget;
}
