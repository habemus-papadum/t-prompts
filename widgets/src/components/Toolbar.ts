/**
 * Toolbar Component
 *
 * Displays view mode toggle buttons (code, markdown, split) and auxiliary
 * status indicators sourced from the folding controller.
 */

import type { ChunkSize, ViewMode } from '../types';
import type { FoldingController } from '../folding/controller';
import type { FoldingClient, FoldingEvent } from '../folding/types';
import { createVisibilityMeter } from './VisibilityMeter';

export interface ToolbarCallbacks {
  onViewModeChange: (mode: ViewMode) => void;
}

export interface ToolbarMetrics {
  totalCharacters: number;
  totalPixels: number;
  chunkIds: string[];
  chunkSizeMap: Record<string, ChunkSize>;
}

export interface ToolbarOptions {
  currentMode: ViewMode;
  callbacks: ToolbarCallbacks;
  foldingController: FoldingController;
  metrics: ToolbarMetrics;
}

export interface ToolbarComponent {
  element: HTMLElement;
  destroy(): void;
}

type ToolbarElement = HTMLElement & {
  _buttons?: Record<ViewMode, HTMLButtonElement>;
};

interface HelpFeature {
  container: HTMLElement;
  destroy(): void;
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
 */
export function createToolbar(options: ToolbarOptions): ToolbarComponent {
  const { currentMode, callbacks, foldingController, metrics } = options;

  const toolbar = document.createElement('div') as ToolbarElement;
  toolbar.className = 'tp-toolbar';

  // Left side: Title
  const title = document.createElement('div');
  title.className = 'tp-toolbar-title';
  title.textContent = 't-prompts';
  toolbar.appendChild(title);

  // Metric indicator (inline component)
  const visibilityMeter = createVisibilityMeter({
    totalCharacters: metrics.totalCharacters,
    totalPixels: metrics.totalPixels,
    showCharacterText: true,
    showPixelText: true,
    showCharacterPie: true,
    showPixelPie: true,
  });

  // Right side: View toggle buttons
  const rightContainer = document.createElement('div');
  rightContainer.className = 'tp-toolbar-right';

  rightContainer.appendChild(visibilityMeter.element);

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

  rightContainer.appendChild(viewToggle);
  const helpFeature = createHelpFeature();
  rightContainer.appendChild(helpFeature.container);
  toolbar.appendChild(rightContainer);

  // Store buttons for updating active state
  toolbar._buttons = { code: codeBtn, markdown: markdownBtn, split: splitBtn };

  const foldingClient: FoldingClient = {
    onStateChanged(event: FoldingEvent): void {
      switch (event.type) {
        case 'chunks-collapsed':
        case 'chunk-expanded':
        case 'state-reset':
          recomputeVisibility();
          break;
        default:
          break;
      }
    },
  };

  foldingController.addClient(foldingClient);

  function recomputeVisibility(): void {
    let visibleCharacters = 0;
    let visiblePixels = 0;

    for (const chunkId of metrics.chunkIds) {
      if (foldingController.isCollapsed(chunkId)) {
        continue;
      }

      const size = metrics.chunkSizeMap[chunkId];
      if (!size) {
        continue;
      }

      if (size.character) {
        visibleCharacters += size.character;
      }

      if (size.pixel) {
        visiblePixels += size.pixel;
      }
    }

    visibilityMeter.update(visibleCharacters, visiblePixels);
  }

  recomputeVisibility();

  return {
    element: toolbar,
    destroy(): void {
      foldingController.removeClient(foldingClient);
      visibilityMeter.destroy();
      helpFeature.destroy();
      toolbar.remove();
    },
  };
}

/**
 * Update toolbar active state
 */
export function updateToolbarMode(toolbar: HTMLElement, mode: ViewMode): void {
  const buttons = (toolbar as ToolbarElement)._buttons;
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

function createHelpFeature(): HelpFeature {
  const container = document.createElement('div');
  container.className = 'tp-help-container';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tp-help-button';
  button.title = 'Widget help';
  button.setAttribute('aria-label', 'Widget help');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');

  button.innerHTML = `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        d="M12 21.75a9.75 9.75 0 1 0 0-19.5 9.75 9.75 0 0 0 0 19.5z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M12 16.5h.008M9.75 9.75a2.25 2.25 0 0 1 4.5 0c0 1.5-2.25 1.875-2.25 3v.375"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;

  const popover = document.createElement('div');
  popover.className = 'tp-help-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.hidden = true;

  const title = document.createElement('h3');
  title.className = 'tp-help-title';
  title.textContent = 'How to use this widget';

  const list = document.createElement('ul');
  list.className = 'tp-help-list';

  const items: Array<[string, string]> = [
    ['View modes', 'Use the toolbar toggles to switch between Code, Markdown, or Split views.'],
    ['Collapse content', 'Select one or more elements and press the space bar to collapse them.'],
    ['Expand content', 'Double-click a collapsed segment or double-tap the space bar when nothing is selected.'],
  ];

  for (const [heading, description] of items) {
    const item = document.createElement('li');
    const itemHeading = document.createElement('strong');
    itemHeading.textContent = `${heading}: `;
    item.appendChild(itemHeading);
    item.append(description);
    list.appendChild(item);
  }

  popover.appendChild(title);
  popover.appendChild(list);

  container.appendChild(button);
  container.appendChild(popover);

  let isOpen = false;

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!container.contains(event.target as Node)) {
      close();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      close();
      button.focus();
    }
  }

  const handleButtonClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  button.addEventListener('click', handleButtonClick);

  return {
    container,
    destroy(): void {
      close();
      button.removeEventListener('click', handleButtonClick);
      container.remove();
    },
  };
}
