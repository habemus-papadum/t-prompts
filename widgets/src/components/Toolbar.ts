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
import type { DiffState, DiffStateSnapshot } from '../state/diffState';

export interface ToolbarCallbacks {
  onViewModeChange: (mode: ViewMode) => void;
  onScrollSyncToggle?: (enabled: boolean) => void;
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
  diffState?: DiffState;
}

export interface ToolbarComponent {
  element: HTMLElement;
  setScrollSyncEnabled(enabled: boolean): void;
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
    // Document icon with lines representing rendered/formatted view
    svg.innerHTML =
      '<path d="M4 1.5v13h8v-13H4zm7 12H5v-11h6v11z"/><path d="M6 4h4v1H6V4zm0 2h4v1H6V6zm0 2h3v1H6V8z"/>';
    return svg;
  },
  split: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    // Vertical divider with panels - clearer split view representation
    svg.innerHTML =
      '<path d="M1 2h6v12H1V2zm1 1v10h4V3H2zm6-1h6v12H9V2zm1 1v10h4V3h-4z"/><rect x="7.5" y="2" width="1" height="12"/>';
    return svg;
  },
  sync: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    // Vertical arrows representing scroll sync
    svg.innerHTML =
      '<path d="M8 3.5L11 6.5 10.3 7.2 8.5 5.4V10.6L10.3 8.8 11 9.5 8 12.5 5 9.5 5.7 8.8 7.5 10.6V5.4L5.7 7.2 5 6.5 8 3.5Z"/>';
    return svg;
  },
};

/**
 * Create toolbar with view toggle buttons
 */
export function createToolbar(options: ToolbarOptions): ToolbarComponent {
  const { currentMode, callbacks, foldingController, metrics, diffState } = options;

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

  let scrollSyncEnabled = true;
  let diffUnsubscribe: (() => void) | null = null;

  // Add visibility meter first (leftmost in right container)
  rightContainer.appendChild(visibilityMeter.element);

  if (diffState?.isAvailable()) {
    const diffToggle = document.createElement('button');
    diffToggle.type = 'button';
    diffToggle.className = 'tp-toolbar-button tp-toolbar-diff-toggle';

    const applySnapshot = (snapshot: DiffStateSnapshot): void => {
      const active = snapshot.available && snapshot.enabled;
      diffToggle.disabled = !snapshot.available;
      diffToggle.classList.toggle('active', active);
      diffToggle.textContent = active ? 'Hide diff' : 'Show diff';
      diffToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
      diffToggle.title = active ? 'Hide diff overlays' : 'Show diff overlays';
    };

    diffToggle.addEventListener('click', () => {
      diffState.setEnabled(!diffState.isEnabled());
    });

    diffUnsubscribe = diffState.subscribe(applySnapshot);

    rightContainer.appendChild(diffToggle);
  }

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

  // Add scroll sync button after view toggles
  const scrollSyncButton = createScrollSyncButton(scrollSyncEnabled);
  rightContainer.appendChild(scrollSyncButton);
  const helpFeature = createHelpFeature();
  rightContainer.appendChild(helpFeature.container);
  toolbar.appendChild(rightContainer);

  // Store buttons for updating active state
  toolbar._buttons = { code: codeBtn, markdown: markdownBtn, split: splitBtn };

  function applyScrollSyncState(enabled: boolean): void {
    scrollSyncEnabled = enabled;
    scrollSyncButton.classList.toggle('active', enabled);
    scrollSyncButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    scrollSyncButton.title = enabled ? 'Disable scroll sync' : 'Enable scroll sync';
    scrollSyncButton.setAttribute(
      'aria-label',
      enabled ? 'Disable scroll synchronization' : 'Enable scroll synchronization'
    );
  }

  applyScrollSyncState(scrollSyncEnabled);

  const handleScrollSyncClick = (): void => {
    const next = !scrollSyncEnabled;
    applyScrollSyncState(next);
    callbacks.onScrollSyncToggle?.(next);
  };

  scrollSyncButton.addEventListener('click', handleScrollSyncClick);

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
    setScrollSyncEnabled(enabled: boolean): void {
      applyScrollSyncState(enabled);
    },
    destroy(): void {
      foldingController.removeClient(foldingClient);
      diffUnsubscribe?.();
      visibilityMeter.destroy();
      helpFeature.destroy();
      scrollSyncButton.removeEventListener('click', handleScrollSyncClick);
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

function createScrollSyncButton(initiallyEnabled: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tp-toolbar-sync-btn tp-view-toggle-btn';
  button.setAttribute('aria-pressed', initiallyEnabled ? 'true' : 'false');

  const icon = icons.sync();
  button.appendChild(icon);

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

  const sections: Array<{
    title: string;
    items: Array<{ heading: string; description: string }>;
  }> = [
    {
      title: 'Code view',
      items: [
        {
          heading: 'Switch view modes',
          description: 'Use the toolbar toggles to switch between Code, Markdown, or Split views.',
        },
        {
          heading: 'Collapse selections',
          description: 'Select one or more elements and press the space bar to collapse them.',
        },
        {
          heading: 'Expand collapsed content',
          description: 'Double-click a collapsed segment or double-tap the space bar when nothing is selected.',
        },
      ],
    },
    {
      title: 'Tree view',
      items: [
        {
          heading: 'Single-click rows',
          description:
            'Open or close tree nodes to inspect nested elements. The arrow button performs the same action.',
        },
        {
          heading: 'Double-click rows',
          description:
            'Toggle the matching content in the code view—collapse visible sections or restore previously collapsed ones.',
        },
        {
          heading: 'Hide the panel',
          description: 'Use the « button in the tree header to tuck the tree away. Click the side strip to show it again.',
        },
      ],
    },
  ];

  popover.appendChild(title);

  for (const section of sections) {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'tp-help-section';

    const sectionTitle = document.createElement('h4');
    sectionTitle.className = 'tp-help-section-title';
    sectionTitle.textContent = section.title;
    sectionElement.appendChild(sectionTitle);

    const list = document.createElement('ul');
    list.className = 'tp-help-list';

    for (const { heading, description } of section.items) {
      const item = document.createElement('li');
      const itemHeading = document.createElement('strong');
      itemHeading.textContent = `${heading}: `;
      item.appendChild(itemHeading);
      item.append(description);
      list.appendChild(item);
    }

    sectionElement.appendChild(list);
    popover.appendChild(sectionElement);
  }

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
