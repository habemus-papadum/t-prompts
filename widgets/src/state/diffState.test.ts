import { describe, it, expect } from 'vitest';
import { DiffState } from './diffState';
import type { DiffStateSnapshot } from './diffState';
import type { RenderedPromptDiffData, StructuredPromptDiffData } from '../diff-types';

const structuredSample: StructuredPromptDiffData = {
  diff_type: 'structured',
  stats: {
    nodes_added: 1,
    nodes_removed: 1,
    nodes_modified: 1,
    nodes_moved: 0,
    text_added: 3,
    text_removed: 3,
  },
  metrics: {
    struct_edit_count: 2,
    struct_span_chars: 6,
    struct_char_ratio: 0.5,
    struct_order_score: 0,
  },
  root: {
    status: 'equal',
    element_type: 'root',
    key: 'root',
    before_id: 'root-before',
    after_id: 'root-after',
    before_index: 0,
    after_index: 0,
    attr_changes: {},
    text_edits: [],
    children: [
      {
        status: 'modified',
        element_type: 'interpolation',
        key: 'title',
        before_id: 'node-before',
        after_id: 'node-after',
        before_index: 0,
        after_index: 0,
        attr_changes: {},
        text_edits: [
          {
            op: 'replace',
            before: 'old',
            after: 'new',
          },
        ],
        children: [],
      },
      {
        status: 'deleted',
        element_type: 'static',
        key: 'removed',
        before_id: 'deleted-node',
        after_id: null,
        before_index: 1,
        after_index: null,
        attr_changes: {},
        text_edits: [],
        children: [],
      },
    ],
  },
};

const renderedSample: RenderedPromptDiffData = {
  diff_type: 'rendered',
  stats: {
    insert: 1,
    delete: 1,
    replace: 1,
    equal: 0,
  },
  metrics: {
    render_token_delta: 2,
    render_non_ws_delta: 2,
    render_ws_delta: 0,
    render_chunk_drift: 0,
  },
  chunk_deltas: [
    {
      op: 'replace',
      before: {
        text: 'old text',
        element_id: 'node-before',
        chunk_id: 'chunk-before',
      },
      after: {
        text: 'new text',
        element_id: 'node-after',
        chunk_id: 'chunk-after',
      },
    },
    {
      op: 'delete',
      before: {
        text: 'obsolete',
        element_id: 'deleted-node',
        chunk_id: 'chunk-deleted',
      },
      after: null,
    },
    {
      op: 'insert',
      before: null,
      after: {
        text: 'fresh',
        element_id: 'added-node',
        chunk_id: 'chunk-added',
      },
    },
  ],
};

describe('DiffState', () => {
  it('summarises structured and rendered diff data', () => {
    const diffState = new DiffState({ structured: structuredSample, rendered: renderedSample });
    const snapshot = diffState.getSnapshot();

    expect(snapshot.available).toBe(true);
    expect(snapshot.structured?.statusByElementId.get('node-after')?.status).toBe('modified');
    expect(snapshot.structured?.removedNodes).toHaveLength(1);
    expect(snapshot.rendered?.chunkAnnotations.get('chunk-after')?.op).toBe('replace');
    const deletedChunks = snapshot.rendered?.deletedChunks ?? [];
    expect(deletedChunks.some((chunk) => chunk.chunkId === 'chunk-deleted')).toBe(true);
  });

  it('toggles diff availability', () => {
    const diffState = new DiffState({ structured: structuredSample, rendered: renderedSample });
    expect(diffState.isEnabled()).toBe(true);
    diffState.setEnabled(false);
    expect(diffState.isEnabled()).toBe(false);

    let latest: DiffStateSnapshot | null = null;
    const unsubscribe = diffState.subscribe((snapshot) => {
      latest = snapshot;
    });

    diffState.setEnabled(true);
    expect(latest?.enabled).toBe(true);
    unsubscribe();
  });
});
