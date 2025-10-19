import { beforeEach, describe, expect, it } from 'vitest';

import { buildStructuredPromptDiffView } from './StructuredPromptDiffView';
import type { StructuredPromptDiffData } from '../diff-types';

describe('StructuredPromptDiffView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders stats, text edits, and formats null keys as None', () => {
    const data: StructuredPromptDiffData = {
      diff_type: 'structured',
      stats: {
        nodes_added: 1,
        nodes_removed: 0,
        nodes_modified: 1,
        nodes_moved: 0,
        text_added: 5,
        text_removed: 2,
      },
      root: {
        status: 'modified',
        element_type: 'StructuredPrompt',
        key: null,
        before_id: 'root-before',
        after_id: 'root-after',
        before_index: 0,
        after_index: 0,
        attr_changes: {},
        text_edits: [],
        children: [
          {
            status: 'modified',
            element_type: 'Static',
            key: 'body',
            before_id: 'static-before',
            after_id: 'static-after',
            before_index: 0,
            after_index: 0,
            attr_changes: { format_spec: ['old', 'new'] },
            text_edits: [
              { op: 'delete', before: 'Old text', after: '' },
              { op: 'insert', before: '', after: 'New text' },
            ],
            children: [],
          },
        ],
      },
    };

    const component = buildStructuredPromptDiffView(data);
    document.body.appendChild(component.element);

    const header = component.element.querySelector('.tp-diff-header');
    expect(header?.textContent).toBe('Structured prompt diff');

    const pills = component.element.querySelectorAll('.tp-diff-pill');
    expect(pills).toHaveLength(6);
    expect(pills[0]?.textContent).toBe('Added: 1');

    const title = component.element.querySelector('.tp-diff-node-title');
    expect(title?.textContent).toContain('None');

    const metaElements = component.element.querySelectorAll('.tp-diff-node-meta');
    const metaTexts = Array.from(metaElements, (node) => node.textContent || '');
    expect(metaTexts.some((text) => text.includes('fields: format_spec'))).toBe(true);

    const insertSpan = component.element.querySelector('.tp-diff-ins');
    expect(insertSpan?.textContent).toBe('+ New text');

    const deleteSpan = component.element.querySelector('.tp-diff-del');
    expect(deleteSpan?.textContent).toBe('- Old text');
  });
});
