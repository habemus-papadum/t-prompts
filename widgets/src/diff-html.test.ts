import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

const STRUCTURED_SAMPLE = `
<div class="tp-diff">
  <style>.tp-diff { color: #000; }</style>
  <ul class="tp-diff-tree">
    <li class="tp-diff-node tp-diff-node--replace" data-change="replace" data-element-type="Static">
      <div class="tp-diff-node-header">Static <span class="tp-diff-key">'title'</span>
        <span class="tp-diff-chip tp-diff-chip--replace">replace</span>
      </div>
      <ul class="tp-diff-children"></ul>
    </li>
  </ul>
</div>
`;

const RENDER_SAMPLE = `
<div class="tp-render-diff">
  <style>.tp-render-diff { color: #000; }</style>
  <table class="tp-render-diff-table">
    <thead><tr><th>op</th><th>element</th><th>before</th><th>after</th></tr></thead>
    <tbody>
      <tr class="tp-render-diff-row tp-render-diff-row--insert"><td>insert</td><td>abc</td><td></td><td>value</td></tr>
    </tbody>
  </table>
</div>
`;

describe('diff HTML structure', () => {
  it('exposes structured diff nodes with change chips', () => {
    const dom = new JSDOM(STRUCTURED_SAMPLE);
    const doc = dom.window.document;
    expect(doc.querySelector('.tp-diff')).not.toBeNull();
    expect(doc.querySelector('.tp-diff-node--replace')).not.toBeNull();
    expect(doc.querySelector('[data-change="replace"]')).not.toBeNull();
    expect(doc.querySelector('.tp-diff-chip--replace')).not.toBeNull();
  });

  it('exposes render diff tables with operation rows', () => {
    const dom = new JSDOM(RENDER_SAMPLE);
    const doc = dom.window.document;
    expect(doc.querySelector('.tp-render-diff')).not.toBeNull();
    expect(doc.querySelector('.tp-render-diff-table')).not.toBeNull();
    const row = doc.querySelector('.tp-render-diff-row--insert');
    expect(row).not.toBeNull();
    expect(row?.querySelector('td:last-child')?.textContent).toBe('value');
  });
});

