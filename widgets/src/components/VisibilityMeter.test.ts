import { describe, it, expect, afterEach } from 'vitest';
import { createVisibilityMeter } from './VisibilityMeter';

describe('VisibilityMeter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders text and pie charts with updated ratios', () => {
    const meter = createVisibilityMeter({
      totalCharacters: 200,
      totalPixels: 1_200_000,
    });

    document.body.appendChild(meter.element);

    const characterEntry = meter.element.querySelector('.tp-meter-entry--characters') as HTMLElement;
    const pixelEntry = meter.element.querySelector('.tp-meter-entry--pixels') as HTMLElement;
    const characterText = characterEntry.querySelector('.tp-meter-text--characters');
    const pixelText = pixelEntry.querySelector('.tp-meter-text--pixels');

    expect(characterText?.textContent).toBe('200/200ch');
    expect(pixelText?.textContent).toBe('1.2M/1.2Mpx');

    const charPie = characterEntry.querySelector(
      '.tp-meter-pie--characters .tp-meter-ring--foreground'
    ) as SVGCircleElement | null;
    const pixelPie = pixelEntry.querySelector(
      '.tp-meter-pie--pixels .tp-meter-ring--foreground'
    ) as SVGCircleElement | null;

    expect(charPie).not.toBeNull();
    expect(pixelPie).not.toBeNull();

    const charPieWrapper = characterEntry.querySelector('.tp-meter-pie--characters');
    const pixelPieWrapper = pixelEntry.querySelector('.tp-meter-pie--pixels');

    expect(charPieWrapper?.classList.contains('tp-meter-pie--full')).toBe(true);
    expect(pixelPieWrapper?.classList.contains('tp-meter-pie--full')).toBe(true);

    meter.update(50, 300_000);

    expect(characterText?.textContent).toBe('50/200ch');
    expect(pixelText?.textContent).toBe('300k/1.2Mpx');

    const circumference = parseFloat(charPie!.getAttribute('stroke-dasharray') || '0');
    const offset = parseFloat(charPie!.getAttribute('stroke-dashoffset') || '0');

    expect(Number.isFinite(circumference)).toBe(true);
    expect(offset).toBeCloseTo(circumference * 0.75, 5);

    const charPieLabel = charPieWrapper?.getAttribute('aria-label');
    expect(charPieLabel).toBe('50/200ch');

    expect(charPieWrapper?.classList.contains('tp-meter-pie--full')).toBe(false);
    expect(pixelPieWrapper?.classList.contains('tp-meter-pie--full')).toBe(false);

    meter.destroy();
  });

  it('omits pixel indicators when totals are zero', () => {
    const meter = createVisibilityMeter({
      totalCharacters: 150,
      totalPixels: 0,
      showPixelPie: true,
      showPixelText: true,
    });

    document.body.appendChild(meter.element);

    const characterEntry = meter.element.querySelector('.tp-meter-entry--characters');

    expect(characterEntry?.querySelector('.tp-meter-text--characters')).not.toBeNull();
    expect(meter.element.querySelector('.tp-meter-text--pixels')).toBeNull();
    expect(meter.element.querySelector('.tp-meter-pie--pixels')).toBeNull();

    meter.destroy();
  });
});
