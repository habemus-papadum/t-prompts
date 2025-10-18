/**
 * @t-prompts/widgets - TypeScript widget library for visualizing t-prompts structures
 *
 * This is the main library export. For browser IIFE bundle with auto-initialization,
 * see index-iife.ts which is bundled for Python integration.
 */

// Version
export const VERSION = '0.9.0-alpha';

// Core renderer
export { initWidget } from './renderer';

// Metadata computation
export { computeWidgetMetadata } from './metadata';

// Components
export { buildWidgetContainer } from './components/WidgetContainer';
export { buildCodeView } from './components/CodeView';
export { buildMarkdownView } from './components/MarkdownView';
export { buildTreeView } from './components/TreeView';
export { createToolbar, updateToolbarMode } from './components/Toolbar';
export { createVisibilityMeter } from './components/VisibilityMeter';

// Types
export type {
  ViewMode,
  WidgetData,
  ConfigData,
  CompiledIRData,
  IRData,
  PromptData,
  SourceLocationData,
  ElementData,
  ChunkData,
  ImageData,
  ChunkSize,
  WidgetMetadata,
} from './types';

export type { Component } from './components/base';
export type { WidgetContainer } from './components/WidgetContainer';
export type { CodeView } from './components/CodeView';
export type { MarkdownView } from './components/MarkdownView';
export type { TreeView } from './components/TreeView';
export type {
  ToolbarCallbacks,
  ToolbarMetrics,
  ToolbarOptions,
  ToolbarComponent,
} from './components/Toolbar';
export type {
  VisibilityMeterOptions,
  VisibilityMeter,
} from './components/VisibilityMeter';
