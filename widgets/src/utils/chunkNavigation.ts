import type { SourceLocationData, ElementLocationDetails } from '../types';

const NAV_ATTR = 'data-tp-nav';
const MODIFIER_CLASS = 'tp-chunk-modifier-active';

const isMacPlatform =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

export interface ChunkNavigationTarget {
  elementId: string;
  source?: SourceLocationData | null;
  creation?: SourceLocationData | null;
}

export interface ChunkNavigationOptions {
  chunkTargets: Record<string, ChunkNavigationTarget | undefined>;
  elementTargets: Record<string, ElementLocationDetails | undefined>;
  enable: boolean;
}

export interface NavigationActivation {
  disconnect(): void;
}

interface ResolvedTarget {
  key: string;
  chunkId?: string;
  elementId: string;
  source?: SourceLocationData | null;
  creation?: SourceLocationData | null;
}

interface ElementHandler {
  key: string;
  listener: (event: MouseEvent) => void;
}

let globalActivationCount = 0;
let isModifierPressed = false;
let globalListenersAttached = false;

function setModifierState(active: boolean): void {
  if (isModifierPressed === active) {
    return;
  }
  isModifierPressed = active;
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle(MODIFIER_CLASS, active);
  }
}

function isPrimaryModifierKey(event: KeyboardEvent): boolean {
  return isMacPlatform ? event.key === 'Meta' : event.key === 'Control';
}

function handleGlobalKeyDown(event: KeyboardEvent): void {
  if (isPrimaryModifierKey(event) || isPrimaryModifierActive(event)) {
    setModifierState(true);
  }
}

function handleGlobalKeyUp(event: KeyboardEvent): void {
  if (isPrimaryModifierKey(event)) {
    setModifierState(false);
  } else if (!isPrimaryModifierActive(event)) {
    // If neither modifier is pressed after keyup, clear state
    setModifierState(false);
  }
}

function handleWindowBlur(): void {
  setModifierState(false);
}

function attachGlobalListeners(): void {
  if (globalListenersAttached || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('keydown', handleGlobalKeyDown, true);
  window.addEventListener('keyup', handleGlobalKeyUp, true);
  window.addEventListener('blur', handleWindowBlur, true);
  globalListenersAttached = true;
}

function detachGlobalListeners(): void {
  if (!globalListenersAttached || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('keydown', handleGlobalKeyDown, true);
  window.removeEventListener('keyup', handleGlobalKeyUp, true);
  window.removeEventListener('blur', handleWindowBlur, true);
  globalListenersAttached = false;
  setModifierState(false);
}

export function isPrimaryModifierActive(event: MouseEvent | KeyboardEvent): boolean {
  return isMacPlatform ? !!event.metaKey : !!event.ctrlKey;
}

function normalizePath(filepath: string): string {
  if (!filepath) return filepath;
  let normalized = filepath;
  if (/^[A-Za-z]:\\/.test(normalized)) {
    normalized = normalized.replace(/\\/g, '/');
    normalized = normalized.replace(/^([A-Za-z]):/, (_match, drive: string) => `${drive.toLowerCase()}:`);
  }
  return normalized;
}

function buildVscodeUri(location: SourceLocationData | null | undefined): string | null {
  if (!location) {
    return null;
  }

  const rawPath = location.filepath || location.filename;
  if (!rawPath) {
    return null;
  }

  const path = normalizePath(rawPath);
  const encodedPath = encodeURI(path);

  if (location.line !== null && location.line !== undefined) {
    return `vscode://file/${encodedPath}:${location.line}`;
  }

  return `vscode://file/${encodedPath}`;
}

function openInEditor(uri: string): void {
  try {
    const result = window.open(uri);
    if (result === null) {
      window.location.href = uri;
    }
  } catch {
    window.location.href = uri;
  }
}

function resolveTarget(
  element: HTMLElement,
  options: ChunkNavigationOptions
): ResolvedTarget | null {
  const chunkId = element.getAttribute('data-chunk-id') || undefined;
  const elementIdAttr = element.getAttribute('data-element-id') || undefined;

  let targetElementId: string | undefined;
  let source: SourceLocationData | null | undefined;
  let creation: SourceLocationData | null | undefined;
  let key: string | undefined;

  if (chunkId) {
    const chunkTarget = options.chunkTargets[chunkId];
    if (chunkTarget) {
      targetElementId = chunkTarget.elementId;
      source = chunkTarget.source ?? null;
      creation = chunkTarget.creation ?? null;
      key = `chunk:${chunkId}`;
    }
  }

  if (!targetElementId && elementIdAttr) {
    targetElementId = elementIdAttr;
    key = `element:${elementIdAttr}`;
  }

  if (!targetElementId) {
    return null;
  }

  const elementDetails = options.elementTargets[targetElementId];
  source = source ?? elementDetails?.source ?? null;
  creation = creation ?? elementDetails?.creation ?? null;

  if (!source && !creation) {
    return null;
  }

  return {
    key: key ?? `element:${targetElementId}`,
    chunkId,
    elementId: targetElementId,
    source: source ?? null,
    creation: creation ?? null,
  };
}

export function activateChunkNavigation(
  root: HTMLElement,
  options: ChunkNavigationOptions
): NavigationActivation {
  if (!options.enable) {
    return {
      disconnect(): void {
        // no-op
      },
    };
  }

  globalActivationCount += 1;
  attachGlobalListeners();

  const localHandlers = new Map<HTMLElement, ElementHandler>();

  const annotateElement = (element: HTMLElement): void => {
    const resolved = resolveTarget(element, options);
    const existing = localHandlers.get(element);

    if (!resolved) {
      if (existing) {
        element.removeEventListener('click', existing.listener);
        element.removeAttribute(NAV_ATTR);
        localHandlers.delete(element);
      }
      return;
    }

    if (existing && existing.key === resolved.key) {
      return;
    }

    if (existing) {
      element.removeEventListener('click', existing.listener);
      localHandlers.delete(element);
    }

    const listener = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }
      if (!isPrimaryModifierActive(event)) {
        return;
      }

      const targetLocation = event.shiftKey
        ? resolved.creation ?? resolved.source
        : resolved.source ?? resolved.creation;

      if (!targetLocation) {
        return;
      }

      const uri = buildVscodeUri(targetLocation);
      if (!uri) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openInEditor(uri);
    };

    localHandlers.set(element, { key: resolved.key, listener });
    element.setAttribute(NAV_ATTR, 'true');
    element.addEventListener('click', listener);
  };

  const processNode = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;

    if (element.hasAttribute('data-chunk-id') || element.hasAttribute('data-element-id')) {
      annotateElement(element);
    }

    const descendants = element.querySelectorAll<HTMLElement>('[data-chunk-id], [data-element-id]');
    descendants.forEach((el) => annotateElement(el));
  };

  processNode(root);

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => processNode(node));
            } else if (
              mutation.type === 'attributes' &&
              mutation.target instanceof HTMLElement
            ) {
              annotateElement(mutation.target);
            }
          }
        })
      : null;

  if (observer) {
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-chunk-id', 'data-element-id'],
    });
  }

  return {
    disconnect(): void {
      observer?.disconnect();

      for (const [element, handler] of localHandlers.entries()) {
        element.removeEventListener('click', handler.listener);
        element.removeAttribute(NAV_ATTR);
      }
      localHandlers.clear();

      globalActivationCount = Math.max(0, globalActivationCount - 1);
      if (globalActivationCount === 0) {
        detachGlobalListeners();
      }
    },
  };
}
