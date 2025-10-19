export interface DiffOverlayControllerOptions {
  root: HTMLElement;
  defaultEnabled: boolean;
  storageKeys: {
    diffEnabled: string;
    beforeVisible: string;
  };
  onDiffChange?: (enabled: boolean) => void;
  onBeforeChange?: (visible: boolean) => void;
}

type DiffListener = (enabled: boolean) => void;
type BeforeListener = (visible: boolean) => void;

export class DiffOverlayController {
  private diffEnabled: boolean;
  private beforeVisible: boolean;
  private readonly root: HTMLElement;
  private readonly storageKeys: DiffOverlayControllerOptions['storageKeys'];
  private readonly diffListeners = new Set<DiffListener>();
  private readonly beforeListeners = new Set<BeforeListener>();
  private readonly onDiffChange?: (enabled: boolean) => void;
  private readonly onBeforeChange?: (visible: boolean) => void;

  constructor(options: DiffOverlayControllerOptions) {
    this.root = options.root;
    this.storageKeys = options.storageKeys;
    this.onDiffChange = options.onDiffChange;
    this.onBeforeChange = options.onBeforeChange;

    this.diffEnabled = this.readBoolean(options.storageKeys.diffEnabled, options.defaultEnabled);
    this.beforeVisible = this.readBoolean(options.storageKeys.beforeVisible, false);

    this.applyDiffState(this.diffEnabled);
    this.applyBeforeState(this.beforeVisible);
  }

  isDiffEnabled(): boolean {
    return this.diffEnabled;
  }

  isBeforeVisible(): boolean {
    return this.beforeVisible;
  }

  setDiffEnabled(enabled: boolean): void {
    if (this.diffEnabled === enabled) {
      return;
    }
    this.diffEnabled = enabled;
    this.persistBoolean(this.storageKeys.diffEnabled, enabled);
    this.applyDiffState(enabled);
    this.onDiffChange?.(enabled);
    for (const listener of this.diffListeners) {
      listener(enabled);
    }
  }

  setBeforeVisible(visible: boolean): void {
    if (this.beforeVisible === visible) {
      return;
    }
    this.beforeVisible = visible;
    this.persistBoolean(this.storageKeys.beforeVisible, visible);
    this.applyBeforeState(visible);
    this.onBeforeChange?.(visible);
    for (const listener of this.beforeListeners) {
      listener(visible);
    }
  }

  onDiffEnabledChange(listener: DiffListener): () => void {
    this.diffListeners.add(listener);
    return () => {
      this.diffListeners.delete(listener);
    };
  }

  onBeforeVisibleChange(listener: BeforeListener): () => void {
    this.beforeListeners.add(listener);
    return () => {
      this.beforeListeners.delete(listener);
    };
  }

  private applyDiffState(enabled: boolean): void {
    this.root.classList.toggle('tp-diff-enabled', enabled);
  }

  private applyBeforeState(visible: boolean): void {
    this.root.classList.toggle('tp-before-visible', visible);
  }

  private readBoolean(key: string, fallback: boolean): boolean {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) {
        return fallback;
      }
      if (raw === '1') {
        return true;
      }
      if (raw === '0') {
        return false;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private persistBoolean(key: string, value: boolean): void {
    try {
      window.sessionStorage.setItem(key, value ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }
}
