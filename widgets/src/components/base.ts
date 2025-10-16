/**
 * Base component interfaces
 *
 * Components are lightweight functional objects with:
 * - A root DOM element
 * - A set of operations they support
 * - Optional state
 */

import type { WidgetData, WidgetMetadata } from '../types';

/**
 * Base component interface
 */
export interface Component {
  // Core
  element: HTMLElement; // Root DOM element

  // Operations (extensible)
  destroy(): void; // Cleanup

  // State (optional, stored on component)
  state?: Record<string, unknown>;
}

/**
 * Builder pattern (functional)
 * Functions that create components from data + metadata
 */
export type ComponentBuilder<T extends Component> = (
  data: WidgetData,
  metadata: WidgetMetadata
) => T;
