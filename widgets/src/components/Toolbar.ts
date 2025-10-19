import type { ChunkSize, ViewMode } from '../types';
import type { FoldingController } from '../folding/controller';
import type { FoldingClient, FoldingEvent } from '../folding/types';
import { createVisibilityMeter } from './VisibilityMeter';

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
  sections?: ToolbarSection[];
}

export interface ToolbarComponent {
  element: HTMLElement;
  setScrollSyncEnabled(enabled: boolean): void;
  destroy(): void;
}

export interface ToolbarSection {
  mount(container: HTMLElement): void;
  destroy(): void;
}

type ToolbarElement = HTMLElement & {
  _buttons?: Record<ViewMode, HTMLButtonElement>;
};

interface HelpFeature {
  container: HTMLElement;
  destroy(): void;
}

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
    svg.innerHTML = '<path d="M4 1.5v13h8v-13H4zm7 12H5v-11h6v11z"/><path d="M6 4h4v1H6V4zm0 2h4v1H6V6zm0 2h3v1H6V8z"/>';
    return svg;
  },
  split: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M1 2h6v12H1V2zm1 1v10h4V3H2zm6-1h6v12H9V2zm1 1v10h4V3h-4z"/><rect x="7.5" y="2" width="1" height="12"/>';
    return svg;
  },
  sync: (): SVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M8 3.5L11 6.5 10.3 7.2 8.5 5.4V10.6L10.3 8.8 11 9.5 8 12.5 5 9.5 5.7 8.8 7.5 10.6V5.4L5.7 7.2 5 6.5 8 3.5Z"/>';
    return svg;
  },
};

export function createToolbar(options: ToolbarOptions): ToolbarComponent {
  const { currentMode, callbacks, foldingController, metrics, sections = [] } = options;

  const toolbar = document.createElement('div') as ToolbarElement;
  toolbar.className = 'tp-toolbar';

  const title = document.createElement('div');
  title.className = 'tp-toolbar-title';
  title.textContent = 't-prompts';
  toolbar.appendChild(title);

  const visibilityMeter = createVisibilityMeter({
    totalCharacters: metrics.totalCharacters,
    totalPixels: metrics.totalPixels,
    showCharacterText: true,
    showPixelText: true,
    showCharacterPie: true,
    showPixelPie: true,
  });

  const rightContainer = document.createElement('div');
  rightContainer.className = 'tp-toolbar-right';

  let scrollSyncEnabled = true;

  rightContainer.appendChild(visibilityMeter.element);

  const viewToggle = document.createElement('div');
  viewToggle.className = 'tp-view-toggle';

  const codeBtn = createToggleButton('code', 'Code view', currentMode === 'code');
  codeBtn.addEventListener('click', () => callbacks.onViewModeChange('code'));

  const markdownBtn = createToggleButton('markdown', 'Markdown view', currentMode === 'markdown');
  markdownBtn.addEventListener('click', () => callbacks.onViewModeChange('markdown'));

  const splitBtn = createToggleButton('split', 'Split view', currentMode === 'split');
  splitBtn.addEventListener('click', () => callbacks.onViewModeChange('split'));

  viewToggle.appendChild(codeBtn);
  viewToggle.appendChild(markdownBtn);
  viewToggle.appendChild(splitBtn);
  rightContainer.appendChild(viewToggle);

  const scrollSyncButton = createScrollSyncButton(scrollSyncEnabled);
  rightContainer.appendChild(scrollSyncButton);
  const helpFeature = createHelpFeature();
  rightContainer.appendChild(helpFeature.container);

  for (const section of sections) {
    section.mount(rightContainer);
  }

  toolbar.appendChild(rightContainer);

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
      visibilityMeter.destroy();
      helpFeature.destroy();
      scrollSyncButton.removeEventListener('click', handleScrollSyncClick);
      for (const section of sections) {
        section.destroy();
      }
      toolbar.remove();
    },
  };
}

export function updateToolbarMode(toolbar: HTMLElement, mode: ViewMode): void {
  const buttons = (toolbar as ToolbarElement)._buttons;
  if (!buttons) return;

  buttons.code.classList.remove('active');
  buttons.markdown.classList.remove('active');
  buttons.split.classList.remove('active');

  buttons[mode].classList.add('active');
}

function createToggleButton(mode: ViewMode, title: string, active: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'tp-view-toggle-btn';
  button.setAttribute('data-mode', mode);
  button.title = title;

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
  container.className = 'tp-toolbar-help';
  container.innerHTML = '<span class="tp-help-icon">?</span>';

  const tooltip = document.createElement('div');
  tooltip.className = 'tp-toolbar-tooltip';
  tooltip.textContent = 'Use Space to collapse selections. Double-tap Space to expand all.';
  container.appendChild(tooltip);

  function handleMouseEnter(): void {
    tooltip.classList.add('visible');
  }

  function handleMouseLeave(): void {
    tooltip.classList.remove('visible');
  }

  container.addEventListener('mouseenter', handleMouseEnter);
  container.addEventListener('mouseleave', handleMouseLeave);

  return {
    container,
    destroy(): void {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.remove();
    },
  };
}
