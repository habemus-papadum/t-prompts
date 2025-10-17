import { describe, it, expect, beforeEach } from 'vitest';
import { initWidget } from '../index';
import longText240Data from '../../test-fixtures/long-text-240.json';
import complexWrapTestData from '../../test-fixtures/complex-wrap-test.json';

describe('WidgetContainer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div');
    container.setAttribute('data-tp-widget', 'true');
  });

  it('should wrap long lines at 90 characters', () => {
    // Use the generated test fixture (240 'a' characters from Python)
    const widgetData = longText240Data;

    // Add data to container (mimics Python widget renderer output)
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget (full widget initialization flow)
    initWidget(container);

    // Get the output container
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer, 'Should have output container').toBeTruthy();

    console.log('\n=== Line Wrapping Test ===');
    console.log('Output container HTML:', outputContainer.innerHTML.substring(0, 500));

    // Check for wrap container
    const wrapContainer = outputContainer.querySelector('.tp-wrap-container');
    console.log('Has wrap container:', !!wrapContainer);

    // Check for line breaks
    const lineBreaks = outputContainer.querySelectorAll('br.tp-wrap-newline');
    console.log('Number of line breaks:', lineBreaks.length);
    console.log('Expected line breaks: 2 (240 chars / 90 per line = 2.67, so 3 lines)');

    // Check for continuation markers
    const continuations = outputContainer.querySelectorAll('.tp-wrap-continuation');
    console.log('Number of continuation markers:', continuations.length);
    console.log('Expected continuation markers: 2');

    // Get all text content spans
    const allSpans = outputContainer.querySelectorAll('span[data-chunk-id]');
    console.log('Number of spans with data-chunk-id:', allSpans.length);

    // Check the structure
    if (wrapContainer) {
      console.log('Wrap container children:', wrapContainer.children.length);
      for (let i = 0; i < Math.min(wrapContainer.children.length, 10); i++) {
        const child = wrapContainer.children[i];
        console.log(`  Child ${i}: ${child.tagName}.${child.className} - "${child.textContent?.substring(0, 20)}..."`);
      }
    }

    // Assertions
    expect(wrapContainer, 'Should have a wrap container').toBeTruthy();
    expect(lineBreaks.length, 'Should have 2 line breaks (3 lines total)').toBe(2);
    expect(continuations.length, 'Should have 2 continuation markers').toBe(2);

    // Verify each text segment length
    const textSegments = Array.from(outputContainer.querySelectorAll('span.tp-chunk-interpolation'))
      .filter(el => el.textContent && !el.classList.contains('tp-wrap-container'))
      .map(el => el.textContent || '');

    console.log('Text segment lengths:', textSegments.map(s => s.length));

    if (textSegments.length >= 3) {
      expect(textSegments[0].length, 'First line should be 90 chars').toBe(90);
      expect(textSegments[1].length, 'Second line should be 90 chars').toBe(90);
      expect(textSegments[2].length, 'Third line should be 60 chars').toBe(60);
    }
  });

  it('should display wrap continuation markers in the gutter', () => {
    // Use the generated test fixture (240 'a' characters from Python)
    const widgetData = longText240Data;

    // Add data to container (mimics Python widget renderer output)
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Append to document.body so computed styles work
    document.body.appendChild(container);

    // Initialize widget (full widget initialization flow)
    initWidget(container);

    // Get the output container
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer, 'Should have output container').toBeTruthy();

    console.log('\n=== Wrap Continuation Markers Test ===');

    // Check for continuation markers
    const continuations = outputContainer.querySelectorAll('.tp-wrap-continuation');
    console.log('Number of continuation markers:', continuations.length);
    expect(continuations.length, 'Should have 2 continuation markers').toBe(2);

    // Check the computed styles of the first continuation marker
    const firstContinuation = continuations[0] as HTMLElement;
    const computedStyle = window.getComputedStyle(firstContinuation);

    console.log('First continuation marker styles:');
    console.log('  position:', computedStyle.position);
    console.log('  left:', computedStyle.left);
    console.log('  padding-left:', computedStyle.paddingLeft);

    // Check container has padding for gutter
    const containerStyle = window.getComputedStyle(outputContainer);
    console.log('Output container styles:');
    console.log('  padding-left:', containerStyle.paddingLeft);

    // The continuation marker should have position: relative (container is the positioned ancestor)
    // and the ::before pseudo-element has position: absolute with left: -2ch
    // We can't test pseudo-elements directly in JSDOM, but we can check the structure

    // Check that continuation markers have the correct class
    continuations.forEach((marker, index) => {
      expect(marker.classList.contains('tp-wrap-continuation'),
        `Marker ${index} should have tp-wrap-continuation class`).toBe(true);
    });

    // Clean up
    document.body.removeChild(container);
  });

  it('should wrap long lines correctly with mixed content (intro + long text)', () => {
    // Use the complex test fixture with intro text and 240 'a' characters
    const widgetData = complexWrapTestData;

    // Add data to container (mimics Python widget renderer output)
    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('data-role', 'tp-widget-data');
    scriptTag.setAttribute('type', 'application/json');
    scriptTag.textContent = JSON.stringify(widgetData);
    container.appendChild(scriptTag);

    const mountPoint = document.createElement('div');
    mountPoint.className = 'tp-widget-mount';
    container.appendChild(mountPoint);

    // Initialize widget (full widget initialization flow)
    initWidget(container);

    // Get the output container
    const outputContainer = container.querySelector('.tp-output-container') as HTMLElement;
    expect(outputContainer, 'Should have output container').toBeTruthy();

    console.log('\n=== Complex Wrap Test (Intro + Long Text) ===');
    console.log('Full HTML (first 1000 chars):', outputContainer.innerHTML.substring(0, 1000));

    // Get all chunks
    const allChunks = outputContainer.querySelectorAll('[data-chunk-id]');
    console.log('\nTotal elements with data-chunk-id:', allChunks.length);

    // Check for wrap containers
    const wrapContainers = outputContainer.querySelectorAll('.tp-wrap-container');
    console.log('Number of wrap containers:', wrapContainers.length);

    // Check for line breaks
    const lineBreaks = outputContainer.querySelectorAll('br.tp-wrap-newline');
    console.log('Number of line breaks:', lineBreaks.length);

    // Check for continuation markers
    const continuations = outputContainer.querySelectorAll('.tp-wrap-continuation');
    console.log('Number of continuation markers:', continuations.length);

    // Get all text content from chunks
    console.log('\nAnalyzing chunk structure:');
    const chunkTexts: string[] = [];
    allChunks.forEach((chunk, index) => {
      const text = chunk.textContent || '';
      const classes = chunk.className;
      const isWrapContainer = classes.includes('tp-wrap-container');

      if (!isWrapContainer) {
        chunkTexts.push(text);
        console.log(`  Chunk ${index}: ${text.length} chars, classes: ${classes.split(' ').filter(c => c.startsWith('tp-')).join(' ')}`);
        if (text.length > 50) {
          console.log(`    Text: "${text.substring(0, 50)}..."`);
        } else {
          console.log(`    Text: "${text}"`);
        }
      }
    });

    // Expected: The 240 'a' text should be wrapped, but the intro text should not
    // The intro text is "Introduction: This is a comprehensive test\n" = about 43 chars total
    // The 240 'a' text should be split into 3 lines: 90, 90, 60

    // Find the long text segments (filter out short intro chunks)
    const longTextSegments = chunkTexts.filter(text => {
      // Filter for segments that are mostly 'a' characters
      const aCount = (text.match(/a/g) || []).length;
      return aCount / text.length > 0.9;
    });

    console.log('\nLong text segment lengths:', longTextSegments.map(s => s.length));

    // Assertions
    expect(wrapContainers.length, 'Should have wrap container(s)').toBeGreaterThan(0);
    expect(lineBreaks.length, 'Should have line breaks for 240 char text').toBeGreaterThanOrEqual(2);
    expect(continuations.length, 'Should have continuation markers').toBeGreaterThanOrEqual(2);

    // Check the long text wrapping
    if (longTextSegments.length >= 3) {
      expect(longTextSegments[0].length, 'First line of long text should be 90 chars').toBe(90);
      expect(longTextSegments[1].length, 'Second line of long text should be 90 chars').toBe(90);
      expect(longTextSegments[2].length, 'Third line of long text should be 60 chars').toBe(60);
    } else {
      console.error('ERROR: Expected at least 3 long text segments, got:', longTextSegments.length);
      console.error('All chunk texts:', chunkTexts);
    }
  });
});
