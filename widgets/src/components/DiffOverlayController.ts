import type { DiffContext } from '../types';

type DiffStateListener = (state: DiffOverlayState) => void;

export interface DiffOverlayState {
  diffEnabled: boolean;
  beforeVisible: boolean;
}

export interface DiffOverlayControllerOptions {
  host: HTMLElement;
  diffContext: DiffContext;
  storagePrefix: string;
  initialDiffEnabled?: boolean;
  initialBeforeVisible?: boolean;
}

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.sessionStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === '1';
  } catch {
    return fallback;
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    window.sessionStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export class DiffOverlayController {
  private readonly host: HTMLElement;
  private readonly diffStorageKey: string;
  private readonly beforeStorageKey: string;
  private readonly listeners = new Set<DiffStateListener>();
  readonly context: DiffContext;
  private state: DiffOverlayState;

  constructor(options: DiffOverlayControllerOptions) {
    this.host = options.host;
    this.context = options.diffContext;

    const prefix = options.storagePrefix || 'tp-diff';
    this.diffStorageKey = `${prefix}:enabled`;
    this.beforeStorageKey = `${prefix}:before-visible`;

    const diffEnabled = readBoolean(this.diffStorageKey, options.initialDiffEnabled ?? true);
    const beforeVisible = readBoolean(this.beforeStorageKey, options.initialBeforeVisible ?? false);

    this.state = { diffEnabled, beforeVisible };
    this.applyState();
  }

  on(listener: DiffStateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  setDiffEnabled(enabled: boolean): void {
    if (this.state.diffEnabled === enabled) {
      return;
    }
    this.state = { ...this.state, diffEnabled: enabled };
    writeBoolean(this.diffStorageKey, enabled);
    this.applyState();
  }

  toggleDiffEnabled(): void {
    this.setDiffEnabled(!this.state.diffEnabled);
  }

  setBeforeVisible(visible: boolean): void {
    if (this.state.beforeVisible === visible) {
      return;
    }
    this.state = { ...this.state, beforeVisible: visible };
    writeBoolean(this.beforeStorageKey, visible);
    this.applyState();
  }

  toggleBeforeVisible(): void {
    this.setBeforeVisible(!this.state.beforeVisible);
  }

  getState(): DiffOverlayState {
    return { ...this.state };
  }

  destroy(): void {
    this.listeners.clear();
  }

  private applyState(): void {
    this.host.classList.toggle('tp-diff-enabled', this.state.diffEnabled);
    this.host.classList.toggle('tp-before-visible', this.state.beforeVisible);
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }
}
