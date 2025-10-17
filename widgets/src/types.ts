/**
 * Shared type definitions for widget components
 */

/**
 * View mode for the widget display
 */
export type ViewMode = 'code' | 'markdown' | 'split';

// Widget data structures
export interface WidgetData {
  compiled_ir?: CompiledIRData;
  ir?: IRData;
  source_prompt?: PromptData;
  config?: ConfigData;
}

export interface ConfigData {
  wrapping: boolean;
  sourcePrefix: string;
}

export interface CompiledIRData {
  ir_id: string;
  subtree_map: Record<string, string[]>;
  num_elements: number;
}

export interface IRData {
  chunks: ChunkData[];
  source_prompt_id: string | null;
  id: string;
  metadata: Record<string, unknown>;
}

export interface PromptData {
  prompt_id: string;
  children: ElementData[];
}

export interface SourceLocationData {
  filename: string | null;
  filepath: string | null;
  line: number | null;
}

export interface ElementData {
  type: string;
  key: string | number;
  id: string;
  source_location?: SourceLocationData | null;
  creation_location?: SourceLocationData | null;
  children?: ElementData[];
  [key: string]: unknown;
}

export interface ChunkData {
  type: string;
  text?: string;
  image?: ImageData;
  element_id: string;
  id: string;
  metadata: Record<string, unknown>;
}

export interface ImageData {
  base64_data: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Centralized metadata computed from widget data.
 * These maps are view-agnostic and can be reused across different visualizations.
 */
export interface WidgetMetadata {
  elementTypeMap: Record<string, string>;
  elementLocationMap: Record<string, string>;
}
