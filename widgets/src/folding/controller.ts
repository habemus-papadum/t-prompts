/**
 * Folding Controller
 *
 * Manages the state of code folding/unfolding and notifies clients of changes.
 * Maintains a linear sequence of visible chunks and tracks collapsed chunks.
 */

import type {
  ChunkId,
  CollapsedChunk,
  Selection,
  FoldingState,
  FoldingEvent,
  FoldingClient,
} from './types';
import { generateUUID } from './utils';

export class FoldingController {
  private state: FoldingState;
  private clients: Set<FoldingClient>;
  private indexMap: Map<ChunkId, number>; // ChunkId → index in visibleSequence

  /**
   * Create a new folding controller
   *
   * @param initialSequence - The initial linear sequence of chunk IDs
   */
  constructor(initialSequence: ChunkId[]) {
    this.state = {
      visibleSequence: [...initialSequence], // Clone to avoid external mutation
      collapsedChunks: new Map(),
      selections: [],
    };
    this.clients = new Set();
    this.indexMap = this.buildIndexMap();
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Add a selection range. If it overlaps with existing selections, merge them.
   *
   * @param start - Start index in visible sequence
   * @param end - End index in visible sequence (inclusive)
   * @throws Error if indices are out of bounds
   */
  addSelection(start: number, end: number): void {
    // Validate indices
    if (start < 0 || end >= this.state.visibleSequence.length) {
      throw new Error(
        `Selection indices out of bounds: [${start}, ${end}] (sequence length: ${this.state.visibleSequence.length})`
      );
    }

    if (start > end) {
      throw new Error(`Invalid selection: start (${start}) must be <= end (${end})`);
    }

    // Create new selection
    const newSelection: Selection = { start, end };

    // Find overlapping selections and merge them
    const merged = this.mergeSelections([...this.state.selections, newSelection]);
    this.state.selections = merged;

    // Notify clients
    this.notifyClients({
      type: 'selections-changed',
      selections: merged,
    });
  }

  /**
   * Clear all selections
   */
  clearSelections(): void {
    if (this.state.selections.length === 0) {
      return; // Already cleared
    }

    this.state.selections = [];

    // Notify clients
    this.notifyClients({
      type: 'selections-changed',
      selections: [],
    });
  }

  /**
   * Select chunks by their IDs in the visible sequence
   *
   * Given an iterable of chunk IDs, finds all maximal contiguous ranges
   * that contain those IDs and adds selections for each range.
   *
   * @param chunkIds - Iterable of chunk IDs to select (can include both regular and collapsed chunks)
   *
   * @example
   * // Select chunks by ID
   * controller.selectByIds(['chunk1', 'chunk2', 'chunk5']);
   * // If chunk1 and chunk2 are at indices 0,1 and chunk5 is at index 4,
   * // this creates two selections: [0,1] and [4,4]
   */
  selectByIds(chunkIds: Iterable<ChunkId>): void {
    // 1. Convert input to Set for O(1) lookup
    const idSet = new Set(chunkIds);

    if (idSet.size === 0) {
      return; // Nothing to select
    }

    // 2. Find indices for all valid IDs using cached index map
    const validIndices: number[] = [];
    for (const id of idSet) {
      const index = this.indexMap.get(id);
      if (index !== undefined) {
        validIndices.push(index);
      } else {
        // Log error for IDs not in visible sequence (logic bug)
        console.error(`selectByIds: Chunk ID "${id}" not found in visible sequence`);
      }
    }

    if (validIndices.length === 0) {
      return; // No valid IDs found
    }

    // 3. Sort indices and find maximal contiguous ranges
    validIndices.sort((a, b) => a - b);

    const ranges: Array<[number, number]> = [];
    let rangeStart = validIndices[0];
    let rangeEnd = validIndices[0];

    for (let i = 1; i < validIndices.length; i++) {
      const currentIndex = validIndices[i];

      if (currentIndex === rangeEnd + 1) {
        // Extend current range
        rangeEnd = currentIndex;
      } else {
        // End current range and start new one
        ranges.push([rangeStart, rangeEnd]);
        rangeStart = currentIndex;
        rangeEnd = currentIndex;
      }
    }

    // Don't forget the last range
    ranges.push([rangeStart, rangeEnd]);

    // 4. Apply each range as a selection
    for (const [start, end] of ranges) {
      this.addSelection(start, end);
    }
  }

  /**
   * Commit all current selections as collapsed chunks
   *
   * Creates one collapsed chunk for each disjoint selection range.
   * Processes selections from right to left to maintain correct indices.
   *
   * @returns Array of IDs of the newly created collapsed chunks
   * @throws Error if there are no active selections
   */
  commitSelections(): ChunkId[] {
    if (this.state.selections.length === 0) {
      throw new Error('Cannot commit: no active selections');
    }

    // Create array of [selection, originalIndex] to track original order
    const indexedSelections = this.state.selections.map((sel, idx) => ({ sel, idx }));

    // Sort by start index (descending) to process right-to-left
    indexedSelections.sort((a, b) => b.sel.start - a.sel.start);

    // Build mapping from original index to collapsed ID
    const collapsedMap = new Map<number, { id: ChunkId; range: [number, number] }>();

    // Process each selection from right to left
    for (const { sel, idx } of indexedSelections) {
      const { start, end } = sel;

      // Extract the selected chunks
      const selectedChunks = this.state.visibleSequence.slice(start, end + 1);

      // Generate a new collapsed chunk ID
      const collapsedId = generateUUID();

      // Create the collapsed chunk
      const collapsedChunk: CollapsedChunk = {
        id: collapsedId,
        children: selectedChunks,
        type: 'collapsed',
      };

      // Store in collapsed chunks map
      this.state.collapsedChunks.set(collapsedId, collapsedChunk);

      // Replace the selected range with the collapsed chunk in visible sequence
      this.state.visibleSequence.splice(start, end - start + 1, collapsedId);

      // Store result with original index
      collapsedMap.set(idx, { id: collapsedId, range: [start, end] });
    }

    // Clear all selections
    this.state.selections = [];

    // Rebuild index map since visible sequence changed
    this.indexMap = this.buildIndexMap();

    // Build result arrays in original selection order
    const collapsedIds: ChunkId[] = [];
    const affectedRanges: Array<[number, number]> = [];

    for (let i = 0; i < indexedSelections.length; i++) {
      const result = collapsedMap.get(i)!;
      collapsedIds.push(result.id);
      affectedRanges.push(result.range);
    }

    // Notify clients
    this.notifyClients({
      type: 'chunks-collapsed',
      collapsedIds,
      affectedRanges,
    });

    return collapsedIds;
  }

  /**
   * Expand a collapsed chunk
   *
   * @param collapsedId - The ID of the collapsed chunk to expand
   * @throws Error if the chunk is not found or not in the visible sequence
   */
  expandChunk(collapsedId: ChunkId): void {
    // Find the collapsed chunk
    const collapsedChunk = this.state.collapsedChunks.get(collapsedId);
    if (!collapsedChunk) {
      throw new Error(`Collapsed chunk not found: ${collapsedId}`);
    }

    // Find the index in visible sequence
    const index = this.state.visibleSequence.indexOf(collapsedId);
    if (index === -1) {
      throw new Error(`Collapsed chunk not in visible sequence: ${collapsedId}`);
    }

    // Replace the collapsed chunk with its children
    this.state.visibleSequence.splice(index, 1, ...collapsedChunk.children);

    // Rebuild index map since visible sequence changed
    this.indexMap = this.buildIndexMap();

    // Note: We keep the collapsed chunk in the map (for potential undo/history)

    // Notify clients
    this.notifyClients({
      type: 'chunk-expanded',
      expandedId: collapsedId,
      insertIndex: index,
    });
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get the current visible sequence
   *
   * @returns A copy of the visible sequence
   */
  getVisibleSequence(): ChunkId[] {
    return [...this.state.visibleSequence];
  }

  /**
   * Get all current selections
   *
   * @returns Array of current selections (may be empty)
   */
  getSelections(): Selection[] {
    return this.state.selections.map((s) => ({ ...s }));
  }

  /**
   * Get a collapsed chunk by ID
   *
   * @param id - The collapsed chunk ID
   * @returns The collapsed chunk, or undefined if not found
   */
  getCollapsedChunk(id: ChunkId): CollapsedChunk | undefined {
    const chunk = this.state.collapsedChunks.get(id);
    return chunk ? { ...chunk, children: [...chunk.children] } : undefined;
  }

  /**
   * Get the complete state (read-only)
   *
   * @returns A readonly view of the current state
   */
  getState(): Readonly<FoldingState> {
    return {
      visibleSequence: [...this.state.visibleSequence],
      collapsedChunks: new Map(this.state.collapsedChunks),
      selections: this.state.selections.map((s) => ({ ...s })),
    };
  }

  // ============================================================================
  // Client Management
  // ============================================================================

  /**
   * Add a client to receive state change notifications
   *
   * @param client - The client to add
   */
  addClient(client: FoldingClient): void {
    this.clients.add(client);
  }

  /**
   * Remove a client from receiving notifications
   *
   * @param client - The client to remove
   */
  removeClient(client: FoldingClient): void {
    this.clients.delete(client);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build index map from chunk IDs to their positions in visible sequence
   *
   * @returns Map from ChunkId to index
   */
  private buildIndexMap(): Map<ChunkId, number> {
    const map = new Map<ChunkId, number>();
    for (let i = 0; i < this.state.visibleSequence.length; i++) {
      map.set(this.state.visibleSequence[i], i);
    }
    return map;
  }

  /**
   * Merge overlapping selections into disjoint ranges
   *
   * @param selections - Array of selections to merge
   * @returns Array of non-overlapping selections, sorted by start index
   */
  private mergeSelections(selections: Selection[]): Selection[] {
    if (selections.length === 0) {
      return [];
    }

    // Sort by start index
    const sorted = [...selections].sort((a, b) => a.start - b.start);

    const merged: Selection[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Check if current and next overlap or are adjacent
      if (next.start <= current.end + 1) {
        // Merge: extend current to include next
        current = {
          start: current.start,
          end: Math.max(current.end, next.end),
        };
      } else {
        // No overlap: push current and start new range
        merged.push(current);
        current = next;
      }
    }

    // Push the last range
    merged.push(current);

    return merged;
  }

  /**
   * Notify all clients of a state change
   */
  private notifyClients(event: FoldingEvent): void {
    const state = this.getState();
    for (const client of this.clients) {
      client.onStateChanged(event, state);
    }
  }
}
