import { describe, it, expect } from 'vitest';
import { getDiffContext } from './diffContext';
import type { IRData, WidgetData, ChunkData } from '../types';
import type { StructuredPromptDiffData, RenderedPromptDiffData } from '../diff-types';

function makeChunk(id: string, elementId: string, text: string): ChunkData {
  return {
    type: 'TextChunk',
    id,
    element_id: elementId,
    text,
    metadata: {},
  };
}

const beforeChunk = makeChunk('before-1', 'before-element', 'Hello');
const afterChunk = makeChunk('after-1', 'after-element', 'Hello world');

const beforeIr: IRData = {
  id: 'before-ir',
  source_prompt_id: 'prompt-before',
  chunks: [beforeChunk],
  metadata: {},
};

const afterIr: IRData = {
  id: 'after-ir',
  source_prompt_id: 'prompt-after',
  chunks: [afterChunk],
  metadata: {},
};

const structuredDiff: StructuredPromptDiffData = {
  diff_type: 'structured',
  root: {
    status: 'modified',
    element_type: 'StaticText',
    key: null,
    before_id: 'before-element',
    after_id: 'after-element',
    before_index: 0,
    after_index: 0,
    attr_changes: {},
    text_edits: [
      { op: 'equal', before: 'Hello', after: 'Hello' },
      { op: 'insert', before: '', after: ' world' },
    ],
    children: [],
  },
  stats: {
    nodes_added: 0,
    nodes_removed: 0,
    nodes_modified: 1,
    nodes_moved: 0,
    text_added: 6,
    text_removed: 0,
  },
  metrics: {
    struct_edit_count: 1,
    struct_span_chars: 11,
    struct_char_ratio: 1,
    struct_order_score: 1,
  },
};

const renderedDiff: RenderedPromptDiffData = {
  diff_type: 'rendered',
  chunk_deltas: [
    {
      op: 'replace',
      before: { text: 'Hello', element_id: 'before-element' },
      after: { text: 'Hello world', element_id: 'after-element' },
    },
  ],
  stats: {
    insert: 1,
    delete: 0,
    replace: 0,
    equal: 0,
  },
  metrics: {
    render_token_delta: 1,
    render_non_ws_delta: 1,
    render_ws_delta: 0,
    render_chunk_drift: 0,
  },
};

describe('getDiffContext', () => {
  const baseData: WidgetData = {
    ir: afterIr,
    source_prompt: { prompt_id: 'prompt-after', children: [] },
    config: { wrapping: true, sourcePrefix: '' },
  };

  it('returns null when diff payloads are absent', () => {
    expect(getDiffContext(baseData)).toBeNull();
  });

  it('builds lookup maps when diff_context is provided', () => {
    const data: WidgetData = {
      ...baseData,
      diff_context: {
        before_prompt_ir: beforeIr,
        structured_diff: structuredDiff,
        rendered_diff: renderedDiff,
      },
    };

    const context = getDiffContext(data);
    expect(context).not.toBeNull();
    expect(context?.beforePrompt).toBe(beforeIr);
    expect(context?.afterPrompt).toBe(afterIr);
    expect(context?.structured).toBe(structuredDiff);
    expect(context?.rendered).toBe(renderedDiff);
    expect(context?.beforeChunkMap['before-1']).toEqual(beforeChunk);
    expect(context?.afterChunkMap['after-1']).toEqual(afterChunk);
    expect(context?.beforeElementChunks['before-element']).toEqual(['before-1']);
    expect(context?.afterElementChunks['after-element']).toEqual(['after-1']);
  });

  it('falls back to legacy diff fields when diff_context missing', () => {
    const data: WidgetData = {
      ...baseData,
      before_prompt_ir: beforeIr,
      structured_diff: structuredDiff,
      rendered_diff: renderedDiff,
    };

    const context = getDiffContext(data);
    expect(context).not.toBeNull();
    expect(context?.beforePrompt).toBe(beforeIr);
    expect(context?.afterPrompt).toBe(afterIr);
  });
});
