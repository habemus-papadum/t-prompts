/**
 * Visibility Meter Component
 *
 * Renders inline indicators for how much content is visible relative to the total
 * character and pixel counts. Supports textual displays and miniature pie charts
 * for both metrics, each of which can be toggled independently.
 */

export interface VisibilityMeterOptions {
  totalCharacters: number;
  totalPixels: number;
  showCharacterText?: boolean;
  showPixelText?: boolean;
  showCharacterPie?: boolean;
  showPixelPie?: boolean;
}

export interface VisibilityMeter {
  element: HTMLElement;
  update(visibleCharacters: number, visiblePixels: number): void;
  destroy(): void;
}

interface PieElements {
  wrapper: HTMLElement;
  foregroundCircle: SVGCircleElement;
  circumference: number;
}

interface MeterEntry {
  type: 'characters' | 'pixels';
  container: HTMLElement;
  text?: HTMLElement;
  pie?: PieElements;
}

const DEFAULT_OPTIONS = {
  showCharacterText: true,
  showPixelText: true,
  showCharacterPie: true,
  showPixelPie: true,
} satisfies Required<Pick<VisibilityMeterOptions, 'showCharacterText' | 'showPixelText' | 'showCharacterPie' | 'showPixelPie'>>;

/**
 * Create a new visibility meter instance.
 */
export function createVisibilityMeter(options: VisibilityMeterOptions): VisibilityMeter {
  const {
    totalCharacters,
    totalPixels,
    showCharacterText = DEFAULT_OPTIONS.showCharacterText,
    showPixelText = DEFAULT_OPTIONS.showPixelText,
    showCharacterPie = DEFAULT_OPTIONS.showCharacterPie,
    showPixelPie = DEFAULT_OPTIONS.showPixelPie,
  } = options;

  const element = document.createElement('span');
  element.className = 'tp-visibility-meter';

  const effectiveShowCharacterText = showCharacterText && totalCharacters > 0;
  const effectiveShowPixelText = showPixelText && totalPixels > 0;
  const effectiveShowCharacterPie = showCharacterPie && totalCharacters > 0;
  const effectiveShowPixelPie = showPixelPie && totalPixels > 0;

  const entries: MeterEntry[] = [];

  function createEntry(
    type: 'characters' | 'pixels',
    enableText: boolean,
    enablePie: boolean
  ): void {
    if (!enableText && !enablePie) {
      return;
    }

    const container = document.createElement('span');
    container.className = `tp-meter-entry tp-meter-entry--${type}`;

    const entry: MeterEntry = {
      type,
      container,
    };

    if (enableText) {
      const text = document.createElement('span');
      text.className = `tp-meter-text tp-meter-text--${type}`;
      entry.text = text;
    }

    if (enablePie) {
      const pie = createPie(`tp-meter-pie--${type}`);
      entry.pie = pie;
    }

    if (entry.pie) {
      container.appendChild(entry.pie.wrapper);
    }

    if (entry.text) {
      container.appendChild(entry.text);
    }

    element.appendChild(container);
    entries.push(entry);
  }

  createEntry('characters', effectiveShowCharacterText, effectiveShowCharacterPie);
  createEntry('pixels', effectiveShowPixelText, effectiveShowPixelPie);

  if (entries.length === 0) {
    const fallbackEntry: MeterEntry = {
      type: 'characters',
      container: document.createElement('span'),
    };
    fallbackEntry.container.className = 'tp-meter-entry tp-meter-entry--characters';
    const fallbackText = document.createElement('span');
    fallbackText.className = 'tp-meter-text tp-meter-text--characters';
    fallbackText.textContent = '0/0ch';
    fallbackEntry.container.appendChild(fallbackText);
    fallbackEntry.text = fallbackText;
    element.appendChild(fallbackEntry.container);
    entries.push(fallbackEntry);
  }

  function update(visibleCharacters: number, visiblePixels: number): void {
    const characterRatio = totalCharacters > 0 ? clamp(visibleCharacters / totalCharacters) : 0;
    const pixelRatio = totalPixels > 0 ? clamp(visiblePixels / totalPixels) : 0;

    for (const entry of entries) {
      const isCharacters = entry.type === 'characters';
      const ratio = isCharacters ? characterRatio : pixelRatio;
      const currentValue = isCharacters ? visibleCharacters : visiblePixels;
      const totalValue = isCharacters ? totalCharacters : totalPixels;
      const unit = isCharacters ? 'ch' : 'px';

      if (entry.text) {
        entry.text.textContent = formatMeterText(currentValue, totalValue, unit);
      }

      if (entry.pie) {
        updatePie(entry.pie, ratio);
        entry.pie.wrapper.setAttribute('aria-label', formatMeterText(currentValue, totalValue, unit));
      }
    }
  }

  update(options.totalCharacters, options.totalPixels);

  return {
    element,
    update,
    destroy(): void {
      element.remove();
    },
  };
}

function createPie(wrapperClass: string): PieElements {
  const wrapper = document.createElement('span');
  wrapper.className = `tp-meter-pie ${wrapperClass}`;
  wrapper.setAttribute('role', 'img');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('focusable', 'false');

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  background.setAttribute('cx', '16');
  background.setAttribute('cy', '16');
  background.setAttribute('r', '14');
  background.setAttribute('fill', 'none');
  background.setAttribute('stroke-width', '3');
  background.setAttribute('class', 'tp-meter-ring tp-meter-ring--background');
  svg.appendChild(background);

  const foreground = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  foreground.setAttribute('cx', '16');
  foreground.setAttribute('cy', '16');
  foreground.setAttribute('r', '14');
  foreground.setAttribute('fill', 'none');
  foreground.setAttribute('stroke-width', '3');
  foreground.setAttribute('stroke-linecap', 'round');
  foreground.setAttribute('class', 'tp-meter-ring tp-meter-ring--foreground');
  foreground.setAttribute('transform', 'rotate(-90 16 16)');
  svg.appendChild(foreground);

  wrapper.appendChild(svg);

  const circumference = 2 * Math.PI * 14;
  foreground.setAttribute('stroke-dasharray', `${circumference}`);
  foreground.setAttribute('stroke-dashoffset', `${circumference}`);

  return { wrapper, foregroundCircle: foreground, circumference };
}

function updatePie(pie: PieElements, ratio: number): void {
  const clampedRatio = clamp(ratio);
  const offsetValue = pie.circumference * (1 - clampedRatio);
  pie.foregroundCircle.setAttribute('stroke-dashoffset', offsetValue.toString());

  if (clampedRatio >= 0.999) {
    pie.wrapper.classList.add('tp-meter-pie--full');
  } else {
    pie.wrapper.classList.remove('tp-meter-pie--full');
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function formatMeterText(current: number, total: number, unit: 'ch' | 'px'): string {
  const safeCurrent = current < 0 ? 0 : current;
  const safeTotal = total <= 0 ? 0 : total;
  return `${formatMagnitude(safeCurrent)}/${formatMagnitude(safeTotal)}${unit}`;
}

function formatMagnitude(value: number): string {
  const absolute = Math.abs(Math.floor(value));

  if (absolute >= 1_000_000_000_000) {
    return formatWithSuffix(absolute, 1_000_000_000_000, 'T');
  }
  if (absolute >= 1_000_000_000) {
    return formatWithSuffix(absolute, 1_000_000_000, 'B');
  }
  if (absolute >= 1_000_000) {
    return formatWithSuffix(absolute, 1_000_000, 'M');
  }
  if (absolute >= 1_000) {
    return formatWithSuffix(absolute, 1_000, 'k');
  }
  return absolute.toString();
}

function formatWithSuffix(value: number, divisor: number, suffix: string): string {
  const raw = value / divisor;
  const precision = raw >= 10 ? 0 : 1;
  const formatted = raw.toFixed(precision);
  return `${trimTrailingZero(formatted)}${suffix}`;
}

function trimTrailingZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}
