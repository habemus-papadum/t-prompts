/**
 * Tests for FoldingController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FoldingController } from './controller';
import type { FoldingClient, FoldingEvent, FoldingState } from './types';

describe('FoldingController', () => {
  let controller: FoldingController;
  let mockClient: FoldingClient;
  let clientCalls: Array<{ event: FoldingEvent; state: FoldingState }>;

  beforeEach(() => {
    // Create controller with initial sequence
    controller = new FoldingController(['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']);

    // Create mock client that records calls
    clientCalls = [];
    mockClient = {
      onStateChanged: vi.fn((event, state) => {
        clientCalls.push({ event, state });
      }),
    };

    controller.addClient(mockClient);
  });

  describe('initialization', () => {
    it('should initialize with the provided sequence', () => {
      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']);
    });

    it('should have no selections initially', () => {
      expect(controller.getSelections()).toEqual([]);
    });

    it('should have no collapsed chunks initially', () => {
      const state = controller.getState();
      expect(state.collapsedChunks.size).toBe(0);
    });
  });

  describe('addSelection', () => {
    it('should add a single selection', () => {
      controller.addSelection(1, 3);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 3 }]);
    });

    it('should notify clients when selection is added', () => {
      controller.addSelection(1, 3);

      expect(clientCalls.length).toBe(1);
      expect(clientCalls[0].event).toEqual({
        type: 'selections-changed',
        selections: [{ start: 1, end: 3 }],
      });
    });

    it('should allow single-chunk selection', () => {
      controller.addSelection(2, 2);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 2, end: 2 }]);
    });

    it('should throw on out-of-bounds start index', () => {
      expect(() => controller.addSelection(-1, 2)).toThrow('out of bounds');
    });

    it('should throw on out-of-bounds end index', () => {
      expect(() => controller.addSelection(0, 10)).toThrow('out of bounds');
    });

    it('should throw when start > end', () => {
      expect(() => controller.addSelection(3, 1)).toThrow('start (3) must be <= end (1)');
    });
  });

  describe('multiple disjoint selections', () => {
    it('should handle two non-overlapping selections', () => {
      controller.addSelection(1, 1); // chunk2
      controller.addSelection(3, 4); // chunk4, chunk5

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 1, end: 1 },
        { start: 3, end: 4 },
      ]);
    });

    it('should handle three non-overlapping selections', () => {
      controller.addSelection(0, 0); // chunk1
      controller.addSelection(2, 2); // chunk3
      controller.addSelection(4, 4); // chunk5

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 0, end: 0 },
        { start: 2, end: 2 },
        { start: 4, end: 4 },
      ]);
    });

    it('should keep selections sorted by start index', () => {
      // Add in reverse order
      controller.addSelection(4, 4);
      controller.addSelection(0, 0);
      controller.addSelection(2, 2);

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 0, end: 0 },
        { start: 2, end: 2 },
        { start: 4, end: 4 },
      ]);
    });
  });

  describe('overlapping selection merging', () => {
    it('should merge two overlapping selections', () => {
      controller.addSelection(1, 2); // chunk2, chunk3
      controller.addSelection(2, 3); // chunk3, chunk4 (overlaps at chunk3)

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 3 }]);
    });

    it('should merge selections when one contains another', () => {
      controller.addSelection(1, 3);
      controller.addSelection(2, 2); // Contained within [1,3]

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 3 }]);
    });

    it('should merge adjacent selections', () => {
      controller.addSelection(1, 2);
      controller.addSelection(3, 4); // Adjacent to [1,2]

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 4 }]);
    });

    it('should merge multiple overlapping selections into one', () => {
      controller.addSelection(1, 2);
      controller.addSelection(3, 4);
      controller.addSelection(2, 3); // Bridges the two selections

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 4 }]);
    });

    it('should handle complex merging scenario', () => {
      controller.addSelection(0, 1);
      controller.addSelection(3, 4);
      controller.addSelection(1, 3); // Merges first two

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 0, end: 4 }]);
    });

    it('should preserve disjoint selections while merging overlapping ones', () => {
      controller.addSelection(0, 1);
      controller.addSelection(3, 4);
      controller.addSelection(0, 0); // Overlaps with first
      // Gap at index 2 keeps them separate

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 0, end: 1 },
        { start: 3, end: 4 },
      ]);
    });
  });

  describe('clearSelections', () => {
    it('should clear all selections', () => {
      controller.addSelection(1, 1);
      controller.addSelection(3, 4);
      clientCalls.length = 0; // Reset

      controller.clearSelections();

      expect(controller.getSelections()).toEqual([]);
      expect(clientCalls.length).toBe(1);
      expect(clientCalls[0].event).toEqual({
        type: 'selections-changed',
        selections: [],
      });
    });

    it('should do nothing if no selections are active', () => {
      controller.clearSelections();
      expect(clientCalls.length).toBe(0);
    });
  });

  describe('commitSelections', () => {
    it('should create collapsed chunks from multiple disjoint selections', () => {
      controller.addSelection(1, 1); // chunk2
      controller.addSelection(3, 4); // chunk4, chunk5
      clientCalls.length = 0; // Reset

      const collapsedIds = controller.commitSelections();

      // Check we got two collapsed chunks
      expect(collapsedIds.length).toBe(2);

      // Check first collapsed chunk
      const collapsed1 = controller.getCollapsedChunk(collapsedIds[0]);
      expect(collapsed1).toBeDefined();
      expect(collapsed1!.children).toEqual(['chunk2']);
      expect(collapsed1!.type).toBe('collapsed');

      // Check second collapsed chunk
      const collapsed2 = controller.getCollapsedChunk(collapsedIds[1]);
      expect(collapsed2).toBeDefined();
      expect(collapsed2!.children).toEqual(['chunk4', 'chunk5']);
      expect(collapsed2!.type).toBe('collapsed');
    });

    it('should update visible sequence correctly', () => {
      controller.addSelection(1, 1);
      controller.addSelection(3, 4);

      const collapsedIds = controller.commitSelections();

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', collapsedIds[0], 'chunk3', collapsedIds[1]]);
    });

    it('should clear selections after committing', () => {
      controller.addSelection(1, 1);
      controller.addSelection(3, 4);

      controller.commitSelections();

      expect(controller.getSelections()).toEqual([]);
    });

    it('should notify clients of collapse', () => {
      controller.addSelection(1, 1);
      controller.addSelection(3, 4);
      clientCalls.length = 0; // Reset

      const collapsedIds = controller.commitSelections();

      expect(clientCalls.length).toBe(1);
      expect(clientCalls[0].event.type).toBe('chunks-collapsed');
      const event = clientCalls[0].event as Extract<
        FoldingEvent,
        { type: 'chunks-collapsed' }
      >;
      expect(event.collapsedIds).toEqual(collapsedIds);
      expect(event.affectedRanges).toEqual([
        [1, 1],
        [3, 4],
      ]);
    });

    it('should throw when no selections are active', () => {
      expect(() => controller.commitSelections()).toThrow('no active selections');
    });

    it('should handle single selection', () => {
      controller.addSelection(2, 3);

      const collapsedIds = controller.commitSelections();

      expect(collapsedIds.length).toBe(1);

      const collapsed = controller.getCollapsedChunk(collapsedIds[0]);
      expect(collapsed!.children).toEqual(['chunk3', 'chunk4']);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', 'chunk2', collapsedIds[0], 'chunk5']);
    });

    it('should handle collapsing entire sequence with one selection', () => {
      controller.addSelection(0, 4);

      const collapsedIds = controller.commitSelections();

      expect(collapsedIds.length).toBe(1);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual([collapsedIds[0]]);
    });

    it('should process selections right-to-left to maintain indices', () => {
      controller.addSelection(0, 1);
      controller.addSelection(3, 4); // Not adjacent - gap at index 2

      const collapsedIds = controller.commitSelections();

      // Both should be successfully created
      expect(collapsedIds.length).toBe(2);

      const collapsed1 = controller.getCollapsedChunk(collapsedIds[0]);
      expect(collapsed1!.children).toEqual(['chunk1', 'chunk2']);

      const collapsed2 = controller.getCollapsedChunk(collapsedIds[1]);
      expect(collapsed2!.children).toEqual(['chunk4', 'chunk5']);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual([collapsedIds[0], 'chunk3', collapsedIds[1]]);
    });

    it('should handle three disjoint selections', () => {
      controller.addSelection(0, 0);
      controller.addSelection(2, 2);
      controller.addSelection(4, 4);

      const collapsedIds = controller.commitSelections();

      expect(collapsedIds.length).toBe(3);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual([collapsedIds[0], 'chunk2', collapsedIds[1], 'chunk4', collapsedIds[2]]);
    });
  });

  describe('expandChunk', () => {
    it('should expand a collapsed chunk', () => {
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();
      clientCalls.length = 0; // Reset

      controller.expandChunk(collapsedIds[0]);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']);
    });

    it('should notify clients of expansion', () => {
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();
      clientCalls.length = 0; // Reset

      controller.expandChunk(collapsedIds[0]);

      expect(clientCalls.length).toBe(1);
      expect(clientCalls[0].event).toEqual({
        type: 'chunk-expanded',
        expandedId: collapsedIds[0],
        insertIndex: 1,
      });
    });

    it('should keep collapsed chunk in map after expansion', () => {
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();

      controller.expandChunk(collapsedIds[0]);

      const collapsed = controller.getCollapsedChunk(collapsedIds[0]);
      expect(collapsed).toBeDefined();
    });

    it('should throw when chunk ID not found', () => {
      expect(() => controller.expandChunk('nonexistent')).toThrow('not found');
    });

    it('should throw when chunk not in visible sequence', () => {
      // Create a collapsed chunk, expand it, then try to expand again
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();
      controller.expandChunk(collapsedIds[0]);

      expect(() => controller.expandChunk(collapsedIds[0])).toThrow('not in visible sequence');
    });
  });

  describe('nested collapsing', () => {
    it('should handle collapsing a range that includes a collapsed chunk', () => {
      // First collapse: chunks 1-2
      controller.addSelection(1, 2);
      const firstCollapsedIds = controller.commitSelections();
      const firstCollapsedId = firstCollapsedIds[0];

      // Sequence is now: ['chunk1', firstCollapsedId, 'chunk4', 'chunk5']
      expect(controller.getVisibleSequence()).toEqual(['chunk1', firstCollapsedId, 'chunk4', 'chunk5']);

      // Second collapse: chunks 0-1 (includes chunk1 and firstCollapsedId)
      controller.addSelection(0, 1);
      const secondCollapsedIds = controller.commitSelections();
      const secondCollapsedId = secondCollapsedIds[0];

      // Check nested structure
      const secondCollapsed = controller.getCollapsedChunk(secondCollapsedId);
      expect(secondCollapsed!.children).toEqual(['chunk1', firstCollapsedId]);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual([secondCollapsedId, 'chunk4', 'chunk5']);
    });

    it('should expand nested collapsed chunks correctly', () => {
      // Create nested collapse
      controller.addSelection(1, 2);
      const firstCollapsedIds = controller.commitSelections();
      const firstCollapsedId = firstCollapsedIds[0];

      controller.addSelection(0, 1);
      const secondCollapsedIds = controller.commitSelections();
      const secondCollapsedId = secondCollapsedIds[0];

      // Expand outer collapsed chunk
      controller.expandChunk(secondCollapsedId);

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', firstCollapsedId, 'chunk4', 'chunk5']);

      // First collapsed chunk should still exist
      const firstCollapsed = controller.getCollapsedChunk(firstCollapsedId);
      expect(firstCollapsed).toBeDefined();
    });
  });

  describe('multiple non-overlapping collapses', () => {
    it('should handle collapsing two ranges simultaneously', () => {
      // Select two separate ranges
      controller.addSelection(1, 1); // chunk2
      controller.addSelection(3, 4); // chunk4, chunk5

      const collapsedIds = controller.commitSelections();

      const sequence = controller.getVisibleSequence();
      expect(sequence).toEqual(['chunk1', collapsedIds[0], 'chunk3', collapsedIds[1]]);

      // Check both collapsed chunks
      const firstCollapsed = controller.getCollapsedChunk(collapsedIds[0]);
      expect(firstCollapsed!.children).toEqual(['chunk2']);

      const secondCollapsed = controller.getCollapsedChunk(collapsedIds[1]);
      expect(secondCollapsed!.children).toEqual(['chunk4', 'chunk5']);
    });
  });

  describe('client management', () => {
    it('should add and notify multiple clients', () => {
      const client1Calls: Array<{ event: FoldingEvent; state: FoldingState }> = [];
      const client2Calls: Array<{ event: FoldingEvent; state: FoldingState }> = [];

      const client1: FoldingClient = {
        onStateChanged: vi.fn((event, state) => client1Calls.push({ event, state })),
      };

      const client2: FoldingClient = {
        onStateChanged: vi.fn((event, state) => client2Calls.push({ event, state })),
      };

      controller.addClient(client1);
      controller.addClient(client2);

      controller.addSelection(1, 2);

      expect(client1Calls.length).toBe(1);
      expect(client2Calls.length).toBe(1);
    });

    it('should remove clients', () => {
      controller.removeClient(mockClient);

      controller.addSelection(1, 2);

      // mockClient should not have been called (only the initial add remains)
      expect(clientCalls.length).toBe(0);
    });
  });

  describe('state queries', () => {
    it('should return copies of state to prevent mutation', () => {
      const sequence1 = controller.getVisibleSequence();
      sequence1.push('mutated');

      const sequence2 = controller.getVisibleSequence();
      expect(sequence2).not.toContain('mutated');
    });

    it('should return copy of selections', () => {
      controller.addSelection(1, 2);

      const selections = controller.getSelections();
      selections[0].start = 999;

      const selections2 = controller.getSelections();
      expect(selections2[0].start).toBe(1);
    });

    it('should return copy of collapsed chunk', () => {
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();

      const collapsed = controller.getCollapsedChunk(collapsedIds[0]);
      collapsed!.children.push('mutated');

      const collapsed2 = controller.getCollapsedChunk(collapsedIds[0]);
      expect(collapsed2!.children).not.toContain('mutated');
    });
  });

  describe('selectByIds', () => {
    it('should select a single chunk by ID', () => {
      controller.selectByIds(['chunk2']);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 1 }]);
    });

    it('should select contiguous chunks by IDs', () => {
      controller.selectByIds(['chunk2', 'chunk3', 'chunk4']);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 3 }]);
    });

    it('should select non-contiguous chunks as separate ranges', () => {
      controller.selectByIds(['chunk1', 'chunk2', 'chunk4', 'chunk5']);

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 0, end: 1 },
        { start: 3, end: 4 },
      ]);
    });

    it('should handle chunks in any order', () => {
      controller.selectByIds(['chunk5', 'chunk1', 'chunk3']);

      const selections = controller.getSelections();
      expect(selections).toEqual([
        { start: 0, end: 0 },
        { start: 2, end: 2 },
        { start: 4, end: 4 },
      ]);
    });

    it('should handle Set as input', () => {
      const idSet = new Set(['chunk2', 'chunk3']);
      controller.selectByIds(idSet);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 2 }]);
    });

    it('should handle duplicates in input', () => {
      controller.selectByIds(['chunk2', 'chunk2', 'chunk3']);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 2 }]);
    });

    it('should do nothing for empty input', () => {
      controller.selectByIds([]);

      const selections = controller.getSelections();
      expect(selections).toEqual([]);
    });

    it('should log error for invalid IDs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      controller.selectByIds(['chunk2', 'invalid', 'chunk3']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'selectByIds: Chunk ID "invalid" not found in visible sequence'
      );

      // Should still select the valid IDs
      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 1, end: 2 }]);

      consoleErrorSpy.mockRestore();
    });

    it('should do nothing if all IDs are invalid', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      controller.selectByIds(['invalid1', 'invalid2']);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      const selections = controller.getSelections();
      expect(selections).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should work with collapsed chunks', () => {
      // First create a collapsed chunk
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();
      const collapsedId = collapsedIds[0];

      // Sequence is now: ['chunk1', collapsedId, 'chunk4', 'chunk5']
      // Select by including the collapsed chunk
      controller.selectByIds(['chunk1', collapsedId]);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 0, end: 1 }]);
    });

    it('should handle selecting all chunks', () => {
      controller.selectByIds(['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 0, end: 4 }]);
    });

    it('should merge with existing selections', () => {
      // First select chunk1
      controller.addSelection(0, 0);

      // Then select chunk2 and chunk3 by ID
      controller.selectByIds(['chunk2', 'chunk3']);

      // Should merge into one selection
      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 0, end: 2 }]);
    });

    it('should update index map after collapse', () => {
      // Create a collapsed chunk
      controller.addSelection(1, 2);
      controller.commitSelections();

      // Now select chunk4 by its original ID
      controller.selectByIds(['chunk4']);

      // chunk4 should now be at index 2 (after 'chunk1' and collapsedId)
      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 2, end: 2 }]);
    });

    it('should update index map after expand', () => {
      // Create and then expand a collapsed chunk
      controller.addSelection(1, 2);
      const collapsedIds = controller.commitSelections();
      controller.expandChunk(collapsedIds[0]);

      // Now select chunk3 by ID - should be back at original position
      controller.selectByIds(['chunk3']);

      const selections = controller.getSelections();
      expect(selections).toEqual([{ start: 2, end: 2 }]);
    });
  });
});
