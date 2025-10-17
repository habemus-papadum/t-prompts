import { describe, expect, it, beforeEach } from 'vitest';

const STYLE_SNIPPET = `
<style>
.tp-diff-view {
  font-family: var(--tp-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif);
  font-size: 14px;
}
</style>`;

describe('diff HTML snippets', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders structured diff containers with expected classes', () => {
    const html = `${STYLE_SNIPPET}
    <div class="tp-diff-view" data-role="tp-diff-structured">
      <div class="tp-diff-header">Structured prompt diff</div>
      <div class="tp-diff-summary">
        <span class="tp-diff-pill">Added: 1</span>
        <span class="tp-diff-pill">Removed: 0</span>
      </div>
      <div class="tp-diff-body">
        <ul class="tp-diff-tree">
          <li class="tp-diff-node" data-status="modified">
            <div class="tp-diff-node-title">TextInterpolation · t</div>
            <div class="tp-diff-node-meta">fields: format_spec</div>
          </li>
        </ul>
      </div>
    </div>`;

    document.body.innerHTML = html;

    const root = document.querySelector('.tp-diff-view');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-role')).toBe('tp-diff-structured');

    const header = document.querySelector('.tp-diff-header');
    expect(header?.textContent).toContain('Structured prompt diff');

    const node = document.querySelector('.tp-diff-node');
    expect(node?.getAttribute('data-status')).toBe('modified');
    expect(document.querySelectorAll('.tp-diff-pill')).toHaveLength(2);
  });

  it('renders rendered diff chunks with legend and operations', () => {
    const html = `${STYLE_SNIPPET}
    <div class="tp-diff-view" data-role="tp-diff-rendered">
      <div class="tp-diff-header">Rendered diff</div>
      <div class="tp-diff-summary">
        <span class="tp-diff-pill">Insert: 1</span>
        <span class="tp-diff-pill">Delete: 0</span>
      </div>
      <div class="tp-diff-body">
        <div class="tp-diff-legend">
          <span><span class="tp-diff-dot insert"></span>Insert</span>
          <span><span class="tp-diff-dot delete"></span>Delete</span>
          <span><span class="tp-diff-dot modify"></span>Replace</span>
        </div>
        <ul class="tp-diff-chunks">
          <li class="tp-diff-chunk" data-op="insert">
            <div class="tp-diff-chunk-text">+ Hello</div>
          </li>
        </ul>
      </div>
    </div>`;

    document.body.innerHTML = html;

    const legendDots = document.querySelectorAll('.tp-diff-dot');
    expect(legendDots).toHaveLength(3);
    expect(document.querySelector('.tp-diff-chunk[data-op="insert"]')).not.toBeNull();
  });
});

