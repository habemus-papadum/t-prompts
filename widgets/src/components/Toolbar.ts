/**
 * Toolbar Component
 *
 * Displays view mode toggle buttons (code, markdown, split)
 */

import type { ViewMode } from '../types';

export interface ToolbarCallbacks {
  onViewModeChange: (mode: ViewMode) => void;
}

/**
 * SVG icon generators - VS Code style
 */
const icons = {
  code: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708-3-3V7.87l3-3 .708.708zm7-.708L11 5.578l2.647 2.646L11 10.87l.708.708 3-3V7.87l-3-3zM4.908 13l.894.448 5-10L9.908 3l-5 10z"/>';
    return svg;
  },
  markdown: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M14 3H2c-.55 0-1 .45-1 1v8c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM9 11H7.5V7.5l-1.5 2-1.5-2V11H3V5h1.5l1.5 2 1.5-2H9v6zm4.5-2h-1.5V7h-1l2-2.5L15 7h-1v2h-.5z"/>';
    return svg;
  },
  split: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M1 3h6v10H1V3zm1 1v8h4V4H2zm7-1h6v10H9V3zm1 1v8h4V4h-4z"/>';
    return svg;
  },
};

/**
 * Create toolbar with view toggle buttons
 *
 * @param currentMode - The currently active view mode
 * @param callbacks - Event callbacks
 * @returns Toolbar element
 */
export function createToolbar(currentMode: ViewMode, callbacks: ToolbarCallbacks): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'tp-toolbar';

  // Left side: Title
  const title = document.createElement('div');
  title.className = 'tp-toolbar-title';
  title.textContent = 't-prompts';
  toolbar.appendChild(title);

  // Right side: View toggle buttons
  const viewToggle = document.createElement('div');
  viewToggle.className = 'tp-view-toggle';

  // Code view button
  const codeBtn = createToggleButton('code', 'Code view', currentMode === 'code');
  codeBtn.addEventListener('click', () => callbacks.onViewModeChange('code'));

  // Markdown view button
  const markdownBtn = createToggleButton('markdown', 'Markdown view', currentMode === 'markdown');
  markdownBtn.addEventListener('click', () => callbacks.onViewModeChange('markdown'));

  // Split view button
  const splitBtn = createToggleButton('split', 'Split view', currentMode === 'split');
  splitBtn.addEventListener('click', () => callbacks.onViewModeChange('split'));

  viewToggle.appendChild(codeBtn);
  viewToggle.appendChild(markdownBtn);
  viewToggle.appendChild(splitBtn);

  toolbar.appendChild(viewToggle);

  // Store buttons for updating active state
  (toolbar as any)._buttons = { code: codeBtn, markdown: markdownBtn, split: splitBtn };

  return toolbar;
}

/**
 * Update toolbar active state
 */
export function updateToolbarMode(toolbar: HTMLElement, mode: ViewMode): void {
  const buttons = (toolbar as any)._buttons;
  if (!buttons) return;

  // Remove active class from all buttons
  buttons.code.classList.remove('active');
  buttons.markdown.classList.remove('active');
  buttons.split.classList.remove('active');

  // Add active class to current mode button
  buttons[mode].classList.add('active');
}

/**
 * Create a toggle button with SVG icon
 */
function createToggleButton(
  mode: ViewMode,
  title: string,
  active: boolean
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'tp-view-toggle-btn';
  button.setAttribute('data-mode', mode);
  button.title = title;

  // Add SVG icon
  const icon = icons[mode]();
  button.appendChild(icon);

  if (active) {
    button.classList.add('active');
  }

  return button;
}
