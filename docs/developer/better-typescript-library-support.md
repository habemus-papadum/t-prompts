# T-Prompts Widgets Library Architecture Report

## Executive Summary

This report analyzes the current widget library architecture and provides recommendations for supporting third-party usage via npm, multiple widget container types, and flexible cache-busting strategies.

**Key Findings:**
- Current build produces IIFE bundle suitable for browser `<script>` tags only
- Cache-busting is tightly coupled to build process via `generated.ts`
- No TypeScript declarations are currently generated
- Side effects in index.ts prevent clean tree-shaking
- Package structure needs updates for npm publishing

**Recommendations:**
- Multi-format builds (ESM, CJS, IIFE)
- Separate entry points for auto-init vs manual usage
- Runtime cache-busting for bundler users
- Proper package.json exports configuration

---

## Part 1: Current State Analysis

### 1.1 Build System

**Build Tool:** esbuild (via `build.js`)

**Build Process:**
1. Bundle KaTeX CSS with embedded fonts (data URLs)
2. Concatenate widget styles + KaTeX bundle
3. Generate `src/generated.ts` with:
   - `STYLES_HASH`: SHA-256 hash of CSS (first 8 chars)
   - `WIDGET_STYLES`: Full CSS as inlined string
4. Bundle TypeScript to JavaScript (IIFE format)
5. Copy artifacts to Python package directory

**Build Configuration:**
```javascript
// build.js (lines 81-94)
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',           // ← Problem: Only IIFE, not ESM/CJS
  globalName: 'TPromptsWidgets',
  platform: 'browser',
  // ...
});
```

**Issues for npm publishing:**
- ❌ Only IIFE format (not importable by bundlers)
- ❌ No TypeScript declarations generated (tsconfig has it, but not used)
- ❌ No source maps in dist/
- ❌ generated.ts required before build (coupling issue)

### 1.2 Current Package.json

**Relevant Fields:**
```json
{
  "name": "@t-prompts/widgets",
  "version": "0.14.0-alpha",
  "type": "module",
  "main": "dist/index.js",        // Points to IIFE bundle
  "types": "dist/index.d.ts",     // Doesn't exist yet
  "dependencies": {
    "@mdit/plugin-katex": "^0.23.2",
    "katex": "^0.16.9",
    "markdown-it": "^14.0.0"
  }
}
```

**Missing for npm publishing:**
- ❌ No `"module"` field (ESM entry point)
- ❌ No `"exports"` field (modern conditional exports)
- ❌ No `"files"` field (what to include in package)
- ❌ No `"repository"`, `"license"`, `"author"` fields
- ❌ No `"keywords"` for discoverability
- ❌ Dependencies should likely be `peerDependencies`

### 1.3 Entry Point & Auto-Initialization

**Current index.ts:**
```typescript
// Side effects execute on import:
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// MutationObserver watches for new widgets
const observer = new MutationObserver(...);
observer.observe(document.body, ...);

// Exports for manual usage
export { initWidget, injectStyles, initRuntime };
```

**Issues:**
- ❌ Side effects on import (auto-initialization)
- ❌ Can't tree-shake unused code
- ❌ Not suitable for SSR or non-browser environments
- ❌ Pollutes global scope (`window.__TPWidget`)

### 1.4 Cache-Busting Mechanism

**How it works:**

1. **Build time:**
   ```javascript
   // build.js generates src/generated.ts:
   const hash = crypto.createHash('sha256')
     .update(stylesContent)
     .digest('hex')
     .substring(0, 8);

   // Writes: export const STYLES_HASH = 'e6fd9ec7';
   ```

2. **Runtime:**
   ```typescript
   // index.ts uses hash for <style> element ID
   const styleId = `tp-widget-styles-${STYLES_HASH}`;

   // Inject or skip if already present
   if (!document.querySelector(`#${styleId}`)) {
     const styleElement = document.createElement('style');
     styleElement.id = styleId;
     styleElement.textContent = WIDGET_STYLES;
     document.head.appendChild(styleElement);
   }
   ```

**Advantages:**
- ✅ Prevents duplicate style injection
- ✅ Automatically removes old versions
- ✅ Works in Jupyter (dynamic cell rendering)

**Limitations:**
- ❌ Requires build step to generate `generated.ts`
- ❌ Can't be used with unbundled development (must build first)
- ❌ Tightly couples styles to bundle (no external CSS option)

### 1.5 Component Architecture

**Available Components:**
```
src/
├── index.ts              (Auto-init entry point)
├── renderer.ts           (initWidget function)
├── metadata.ts           (Metadata computation)
├── types.ts              (TypeScript types)
├── components/
│   ├── WidgetContainer.ts    (Main container)
│   ├── CodeView.ts           (Code view component)
│   ├── MarkdownView.ts       (Markdown view component)
│   ├── TreeView.ts           (Tree view component)
│   ├── VisibilityMeter.ts    (Visibility meter component)
│   ├── Toolbar.ts            (Toolbar component)
│   └── base.ts               (Base component interface)
├── folding/
│   ├── controller.ts         (Folding state manager)
│   └── types.ts              (Folding types)
└── generated.ts          (Auto-generated, git-ignored)
```

**Current Exports:**
- `VERSION`
- `initWidget`
- `injectStyles`
- `initRuntime`

**Not Exported (but could be useful):**
- Individual components (CodeView, MarkdownView, etc.)
- Helper functions (computeWidgetMetadata, etc.)
- TypeScript types (WidgetData, WidgetMetadata, etc.)
- Folding controller

---

## Part 2: Answering Your Questions

### Q1: How would we publish to npm as a JavaScript library?

**Current Blockers:**
1. ❌ IIFE format not suitable for npm (need ESM/CJS)
2. ❌ No TypeScript declarations in dist/
3. ❌ Missing package.json fields
4. ❌ Side effects prevent clean imports

**Required Changes:**

**A. Update package.json:**
```json
{
  "name": "@t-prompts/widgets",
  "version": "0.14.0-alpha",
  "type": "module",
  "main": "./dist/index.cjs",           // CJS entry
  "module": "./dist/index.js",          // ESM entry
  "types": "./dist/index.d.ts",         // TypeScript declarations
  "exports": {
    ".": {
      "import": "./dist/index.js",      // ESM
      "require": "./dist/index.cjs",    // CJS
      "types": "./dist/index.d.ts"
    },
    "./auto": {
      "import": "./dist/auto.js",       // Auto-init version
      "require": "./dist/auto.cjs"
    },
    "./components": {
      "import": "./dist/components/index.js",
      "types": "./dist/components/index.d.ts"
    },
    "./styles.css": "./dist/styles.css" // External CSS option
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "sideEffects": [
    "./dist/auto.js",
    "./dist/auto.cjs"
  ],
  "peerDependencies": {
    "katex": "^0.16.9",
    "markdown-it": "^14.0.0"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/..."
  },
  "keywords": ["jupyter", "widgets", "prompts", "visualization"]
}
```

**B. Update build system to generate multiple formats:**
```javascript
// Build ESM, CJS, and IIFE
await Promise.all([
  // ESM build
  esbuild.build({
    entryPoints: ['src/index.ts'],
    format: 'esm',
    outfile: 'dist/index.js',
    // ...
  }),
  // CJS build
  esbuild.build({
    entryPoints: ['src/index.ts'],
    format: 'cjs',
    outfile: 'dist/index.cjs',
    // ...
  }),
  // IIFE build (for <script> tags)
  esbuild.build({
    entryPoints: ['src/index.ts'],
    format: 'iife',
    globalName: 'TPromptsWidgets',
    outfile: 'dist/browser.js',
    // ...
  })
]);

// Generate TypeScript declarations
await exec('tsc --emitDeclarationOnly');
```

### Q2: What would TypeScript usage look like?

**With Recommended Changes:**

```typescript
// Option 1: Auto-initialization (has side effects)
import '@t-prompts/widgets/auto';
// Automatically finds and initializes [data-tp-widget] elements

// Option 2: Manual initialization (tree-shakeable)
import { initWidget, injectStyles } from '@t-prompts/widgets';

const container = document.getElementById('my-widget');
injectStyles(); // Inject CSS once
initWidget(container);

// Option 3: Use individual components (advanced)
import { buildCodeView } from '@t-prompts/widgets/components';
import type { WidgetData } from '@t-prompts/widgets';

const data: WidgetData = /* ... */;
const codeView = buildCodeView(data, metadata, foldingController);
document.body.appendChild(codeView.element);

// Option 4: Custom widget container
import {
  computeWidgetMetadata,
  buildToolbar,
  buildCodeView
} from '@t-prompts/widgets';
import type { WidgetData, WidgetMetadata } from '@t-prompts/widgets';

function buildCustomWidget(data: WidgetData) {
  const metadata = computeWidgetMetadata(data);
  const toolbar = buildToolbar(/* ... */);
  const codeView = buildCodeView(data, metadata, /* ... */);

  // Custom assembly
  const container = document.createElement('div');
  container.append(toolbar.element, codeView.element);
  return container;
}
```

**TypeScript Features:**
- ✅ Full type inference
- ✅ IntelliSense for all APIs
- ✅ Type safety for WidgetData structure
- ✅ Generic types for components

### Q3: What would JavaScript (plain JS) usage look like?

**With Recommended Changes:**

```javascript
// Option 1: Via npm + bundler (Vite, Webpack, etc.)
import { initWidget, injectStyles } from '@t-prompts/widgets';

injectStyles();
initWidget(document.getElementById('my-widget'));

// Option 2: Via CDN (no build step)
<script type="module">
  import { initWidget, injectStyles } from 'https://esm.sh/@t-prompts/widgets';
  injectStyles();
  initWidget(document.getElementById('my-widget'));
</script>

// Option 3: Via <script> tag (IIFE, global variable)
<script src="https://unpkg.com/@t-prompts/widgets/dist/browser.js"></script>
<script>
  // Available as global: TPromptsWidgets
  TPromptsWidgets.injectStyles();
  TPromptsWidgets.initWidget(document.getElementById('my-widget'));
</script>

// Option 4: Auto-init via CDN
<script type="module" src="https://esm.sh/@t-prompts/widgets/auto"></script>
<!-- Automatically finds [data-tp-widget] elements -->

// Option 5: CommonJS (Node.js)
const { initWidget } = require('@t-prompts/widgets');
```

**JavaScript Features:**
- ✅ Works with any bundler
- ✅ Works without bundler (CDN)
- ✅ Works in legacy environments (IIFE)
- ✅ Works in Node.js (CJS)

### Q4: Are there issues with current build/bundle for third-party use?

**Yes, several critical issues:**

**Issue 1: IIFE-only format**
- **Problem:** Current build is `format: 'iife'` which creates a global variable
- **Impact:** Cannot be imported by bundlers (Webpack, Vite, Rollup)
- **Fix:** Build ESM and CJS formats alongside IIFE

**Issue 2: No TypeScript declarations**
- **Problem:** tsconfig has `declaration: true` but esbuild doesn't generate .d.ts
- **Impact:** No IntelliSense or type safety for TypeScript users
- **Fix:** Run `tsc --emitDeclarationOnly` after esbuild

**Issue 3: Side effects on import**
- **Problem:** index.ts runs auto-init code on import
- **Impact:** Can't tree-shake, causes issues in SSR, unwanted in manual mode
- **Fix:** Split into `index.ts` (no side effects) and `auto.ts` (auto-init)

**Issue 4: generated.ts dependency**
- **Problem:** Build requires `generated.ts` to exist, which is git-ignored
- **Impact:** Can't build from fresh clone without running build first (chicken-egg)
- **Fix:** Generate it as first build step (already works) or provide fallback

**Issue 5: Bundled dependencies**
- **Problem:** KaTeX and markdown-it are bundled into output
- **Impact:** Users can't dedupe dependencies, larger bundle size
- **Fix:** Make them `peerDependencies` and `external` in build config

**Issue 6: Missing package.json metadata**
- **Problem:** No license, repository, exports fields
- **Impact:** Poor npm discoverability, unclear licensing, incorrect imports
- **Fix:** Add all required fields

### Q5: How to support multiple widget container types?

**Current State:**
- Only `WidgetContainer` is exported via `initWidget()`
- All components are internal

**Recommended Architecture:**

**A. Export individual components:**
```typescript
// src/components/index.ts (new file)
export { buildCodeView } from './CodeView';
export { buildMarkdownView } from './MarkdownView';
export { buildTreeView } from './TreeView';
export { buildToolbar } from './Toolbar';
export { buildWidgetContainer } from './WidgetContainer';
export { createVisibilityMeter } from './VisibilityMeter';
export type { Component } from './base';
```

**B. Export builders and utilities:**
```typescript
// src/index.ts (updated)
export { initWidget, injectStyles, initRuntime } from './renderer';
export { computeWidgetMetadata } from './metadata';
export { createFoldingController } from './folding/controller';

// Re-export types
export type {
  WidgetData,
  WidgetMetadata,
  ViewMode,
  ElementData,
  ChunkData,
} from './types';

export type { FoldingController, FoldingEvent } from './folding/types';
```

**C. Usage - Custom container:**
```typescript
import {
  computeWidgetMetadata,
  createFoldingController,
  buildToolbar,
  buildCodeView,
  injectStyles
} from '@t-prompts/widgets';
import type { WidgetData } from '@t-prompts/widgets';

function buildMinimalWidget(data: WidgetData) {
  // 1. Setup
  injectStyles();
  const metadata = computeWidgetMetadata(data);
  const foldingController = createFoldingController(data);

  // 2. Build only what you need
  const codeView = buildCodeView(data, metadata, foldingController);

  // 3. Custom layout
  const container = document.createElement('div');
  container.className = 'my-custom-widget';
  container.appendChild(codeView.element);

  return container;
}

function buildExpandedWidget(data: WidgetData) {
  const metadata = computeWidgetMetadata(data);
  const foldingController = createFoldingController(data);

  // Use multiple views
  const toolbar = buildToolbar(/* ... */);
  const treeView = buildTreeView(data, metadata, foldingController);
  const codeView = buildCodeView(data, metadata, foldingController);
  const markdownView = buildMarkdownView(data, metadata, foldingController);

  // Custom assembly with your own layout
  const container = document.createElement('div');
  // ... custom layout logic

  return container;
}
```

**D. Package.json exports for components:**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./components": "./dist/components/index.js",
    "./components/CodeView": "./dist/components/CodeView.js",
    "./components/MarkdownView": "./dist/components/MarkdownView.js",
    "./components/TreeView": "./dist/components/TreeView.js",
    "./folding": "./dist/folding/index.js",
    "./types": "./dist/types.js"
  }
}
```

### Q6: Cache-busting with bundlers vs browser usage

**Problem:**
Current cache-busting requires build-time `generated.ts` which:
- ❌ Couples to build process
- ❌ Can't work with unbundled source
- ❌ Requires rebuild for style changes

**Solution 1: Runtime hash generation (for bundler users)**

```typescript
// src/styles.ts (new file)
import rawStyles from './styles.css?raw'; // Vite/Webpack raw import
import katexStyles from './katex-bundle.css?raw';

const WIDGET_STYLES = rawStyles + '\n\n' + katexStyles;

// Generate hash at runtime
function generateHash(content: string): string {
  // Simple hash (or use crypto.subtle in browser)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

export const STYLES_HASH = generateHash(WIDGET_STYLES);
export { WIDGET_STYLES };
```

**Solution 2: External CSS (optional, for bundler users)**

```typescript
// User's bundler imports CSS separately
import '@t-prompts/widgets/styles.css';
import { initWidget } from '@t-prompts/widgets';

// Widget doesn't inject styles
initWidget(container, { injectStyles: false });
```

**Solution 3: Hybrid approach (recommended)**

```typescript
// src/styles.ts
let STYLES_HASH: string;
let WIDGET_STYLES: string;

if (import.meta.env?.MODE === 'development') {
  // Development: Import CSS as raw text (runtime hash)
  const styles = await import('./styles.css?raw');
  WIDGET_STYLES = styles.default;
  STYLES_HASH = generateHash(WIDGET_STYLES);
} else {
  // Production: Use build-time generated module
  const generated = await import('./generated.js');
  STYLES_HASH = generated.STYLES_HASH;
  WIDGET_STYLES = generated.WIDGET_STYLES;
}

export { STYLES_HASH, WIDGET_STYLES };
```

**Solution 4: Version-based cache-busting (simplest)**

```typescript
// No hash needed - use package version
import { VERSION } from './version'; // Auto-generated from package.json

const styleId = `tp-widget-styles-v${VERSION}`;

// Simpler, but doesn't catch style-only changes
```

**Comparison:**

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| Build-time hash (current) | ✅ Accurate<br>✅ Fast runtime | ❌ Requires build<br>❌ Coupling | Production builds |
| Runtime hash | ✅ No build needed<br>✅ Flexible | ❌ Slower<br>❌ Hash algorithm needed | Development |
| External CSS | ✅ Tree-shakeable<br>✅ Standard | ❌ Extra import<br>❌ Manual setup | Advanced users |
| Version-based | ✅ Simple<br>✅ No hash | ❌ Less granular | Simple libraries |
| Hybrid | ✅ Best of both | ❌ Complex | Large libraries |

**Recommendation:** Use **hybrid approach** (Solution 3):
- Development: Runtime hash from raw CSS imports
- Production: Build-time hash from `generated.ts`
- Best of both worlds

---

## Part 3: Recommendations

### 3.1 Reorganize Entry Points

**Current:**
```
widgets/
└── src/
    └── index.ts (auto-init + manual exports)
```

**Recommended:**
```
widgets/
└── src/
    ├── index.ts          (Manual usage, no side effects)
    ├── auto.ts           (Auto-init with side effects)
    ├── components/
    │   └── index.ts      (Export all components)
    ├── folding/
    │   └── index.ts      (Export folding utilities)
    └── styles/
        ├── index.ts      (Export style constants)
        └── inject.ts     (Style injection logic)
```

**index.ts (main entry, no side effects):**
```typescript
// Core API
export { initWidget } from './renderer';
export { injectStyles, initRuntime } from './runtime';
export { computeWidgetMetadata } from './metadata';

// Re-export components
export * from './components';

// Re-export types
export type * from './types';
export type * from './folding/types';

// Version
export { VERSION } from './version';
```

**auto.ts (auto-init entry, has side effects):**
```typescript
// This file has side effects - runs on import
import { initRuntime, injectStyles } from './runtime';
import { initWidget } from './renderer';

// Auto-initialize on DOM ready
function autoInit() {
  initRuntime();
  injectStyles();

  const containers = document.querySelectorAll('[data-tp-widget]');
  containers.forEach((container) => {
    if (container instanceof HTMLElement && !container.dataset.tpInitialized) {
      initWidget(container);
      container.dataset.tpInitialized = 'true';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Watch for new widgets
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    // ... (same as current index.ts)
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
```

### 3.2 Update Build System

**New build.js structure:**

```javascript
import esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function build() {
  // Step 1: Generate version.ts from package.json
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  fs.writeFileSync(
    'src/version.ts',
    `export const VERSION = '${pkg.version}';\n`
  );

  // Step 2: Bundle CSS and generate hash
  await bundleStyles();

  // Step 3: Build multiple formats in parallel
  await Promise.all([
    // ESM build (for bundlers)
    buildFormat({
      format: 'esm',
      outfile: 'dist/index.js',
      entryPoints: ['src/index.ts'],
    }),

    // CJS build (for Node.js)
    buildFormat({
      format: 'cjs',
      outfile: 'dist/index.cjs',
      entryPoints: ['src/index.ts'],
    }),

    // Auto-init ESM
    buildFormat({
      format: 'esm',
      outfile: 'dist/auto.js',
      entryPoints: ['src/auto.ts'],
    }),

    // IIFE build (for <script> tags)
    buildFormat({
      format: 'iife',
      globalName: 'TPromptsWidgets',
      outfile: 'dist/browser.js',
      entryPoints: ['src/auto.ts'], // Auto-init version for browser
    }),
  ]);

  // Step 4: Generate TypeScript declarations
  console.log('Generating TypeScript declarations...');
  execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' });

  // Step 5: Copy standalone CSS (optional, for external usage)
  fs.copyFileSync('dist/styles.css', 'dist/styles.css');

  console.log('✅ Build completed successfully');
}

async function buildFormat(options) {
  await esbuild.build({
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    platform: 'browser',
    external: ['katex', 'markdown-it', '@mdit/plugin-katex'], // Peer deps
    ...options,
  });
}

async function bundleStyles() {
  // Same as current: bundle KaTeX, generate hash, create generated.ts
  // ... (keep existing logic)
}

build();
```

### 3.3 Update package.json

**Complete package.json:**

```json
{
  "name": "@t-prompts/widgets",
  "version": "0.14.0-alpha",
  "description": "Interactive visualization widgets for structured prompts",
  "type": "module",

  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "browser": "./dist/browser.js",

  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./auto": {
      "import": "./dist/auto.js",
      "require": "./dist/auto.cjs"
    },
    "./components": {
      "import": "./dist/components/index.js",
      "types": "./dist/components/index.d.ts"
    },
    "./folding": {
      "import": "./dist/folding/index.js",
      "types": "./dist/folding/index.d.ts"
    },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },

  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],

  "sideEffects": [
    "./dist/auto.js",
    "./dist/auto.cjs",
    "./dist/browser.js"
  ],

  "scripts": {
    "build": "node build.js",
    "pretest": "node build.js",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm test"
  },

  "peerDependencies": {
    "@mdit/plugin-katex": "^0.23.0",
    "katex": "^0.16.0",
    "markdown-it": "^14.0.0"
  },

  "peerDependenciesMeta": {
    "@mdit/plugin-katex": { "optional": true },
    "katex": { "optional": true },
    "markdown-it": { "optional": true }
  },

  "devDependencies": {
    "@mdit/plugin-katex": "^0.23.2",
    "@types/katex": "^0.16.7",
    "@types/markdown-it": "^13.0.7",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vitest/coverage-v8": "^1.4.0",
    "esbuild": "^0.20.0",
    "eslint": "^9.0.0",
    "jsdom": "^24.0.0",
    "katex": "^0.16.9",
    "markdown-it": "^14.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  },

  "engines": {
    "node": ">=18.0.0"
  },

  "license": "MIT",
  "author": "Your Name",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/t-prompts.git",
    "directory": "widgets"
  },
  "bugs": "https://github.com/yourusername/t-prompts/issues",
  "homepage": "https://t-prompts.dev",
  "keywords": [
    "jupyter",
    "widgets",
    "prompts",
    "visualization",
    "llm",
    "typescript"
  ]
}
```

### 3.4 Usage Examples

**Example 1: Auto-init (easiest)**
```html
<!-- Via CDN -->
<script type="module" src="https://esm.sh/@t-prompts/widgets/auto"></script>

<div data-tp-widget>
  <script data-role="tp-widget-data" type="application/json">
    {"ir": {...}, "source_prompt": {...}}
  </script>
</div>
```

**Example 2: Manual init (TypeScript + bundler)**
```typescript
import { initWidget, injectStyles } from '@t-prompts/widgets';
import type { WidgetData } from '@t-prompts/widgets';

// Inject styles once
injectStyles();

// Initialize specific widgets
const data: WidgetData = await fetch('/api/widget-data').then(r => r.json());
const container = document.getElementById('widget');
if (container) {
  initWidget(container);
}
```

**Example 3: Custom widget (advanced)**
```typescript
import {
  computeWidgetMetadata,
  buildCodeView,
  buildMarkdownView,
  createFoldingController,
  injectStyles
} from '@t-prompts/widgets';
import type { WidgetData } from '@t-prompts/widgets';

function buildSplitView(data: WidgetData) {
  injectStyles();

  const metadata = computeWidgetMetadata(data);
  const foldingController = createFoldingController(data);

  const codeView = buildCodeView(data, metadata, foldingController);
  const markdownView = buildMarkdownView(data, metadata, foldingController);

  const container = document.createElement('div');
  container.className = 'split-view';
  container.append(codeView.element, markdownView.element);

  return container;
}
```

**Example 4: External CSS (bundler optimization)**
```typescript
// Import CSS via bundler
import '@t-prompts/widgets/styles.css';
import { initWidget } from '@t-prompts/widgets';

// Widget won't inject styles (already loaded via CSS import)
initWidget(container, { injectStyles: false });
```

### 3.5 Migration Path

**Phase 1: Backward Compatibility (Current → Improved)**
1. Keep current `dist/index.js` as IIFE for Python package
2. Add new builds alongside (ESM, CJS)
3. Add type declarations
4. Update package.json exports

**Phase 2: Reorganization (Improved → Optimal)**
1. Split index.ts into index.ts + auto.ts
2. Export individual components
3. Add component entry points
4. Update documentation

**Phase 3: Optimization (Optimal → Advanced)**
1. Implement hybrid cache-busting
2. Add external CSS option
3. Optimize bundle sizes
4. Add tree-shaking tests

### 3.6 Summary of Recommendations

**High Priority (Do First):**
1. ✅ Build ESM and CJS formats alongside IIFE
2. ✅ Generate TypeScript declarations (run tsc)
3. ✅ Update package.json with exports, files, peerDependencies
4. ✅ Split index.ts (no side effects) from auto.ts (auto-init)

**Medium Priority (Do Soon):**
5. ✅ Export individual components via `@t-prompts/widgets/components`
6. ✅ Make dependencies peer dependencies
7. ✅ Add proper npm metadata (license, repo, keywords)
8. ✅ Add prepublishOnly script

**Low Priority (Nice to Have):**
9. ✅ Hybrid cache-busting (dev vs prod)
10. ✅ External CSS option
11. ✅ Separate entry points for each component
12. ✅ Bundle size optimization

---

## Part 4: Implementation Checklist

### Immediate Actions (Required for npm publishing)

- [ ] Update build.js to generate multiple formats (ESM, CJS, IIFE)
- [ ] Add `tsc --emitDeclarationOnly` to build script
- [ ] Create src/auto.ts (move auto-init code from index.ts)
- [ ] Update src/index.ts (remove side effects)
- [ ] Update package.json (add exports, files, peerDependencies)
- [ ] Add LICENSE file
- [ ] Add/update README.md with usage examples
- [ ] Test builds: `npm pack` and verify contents

### Follow-up Actions (Better library experience)

- [ ] Create src/components/index.ts (export all components)
- [ ] Create src/folding/index.ts (export folding utilities)
- [ ] Add version.ts generation from package.json
- [ ] Make katex, markdown-it, @mdit/plugin-katex peer dependencies
- [ ] Update build to externalize peer dependencies
- [ ] Add prepublishOnly script
- [ ] Write usage documentation for all entry points

### Advanced Actions (Optimal developer experience)

- [ ] Implement hybrid cache-busting (dev vs prod)
- [ ] Add external CSS option
- [ ] Create separate entry points for each component
- [ ] Add bundle size monitoring
- [ ] Add tree-shaking tests
- [ ] Create integration examples (Vite, Webpack, etc.)

---

## Conclusion

The current widget library is well-structured but optimized for a single use case (browser IIFE). With the recommended changes, it can support:

✅ **npm publishing** with proper package metadata
✅ **TypeScript apps** with full type inference
✅ **JavaScript apps** with or without bundlers
✅ **Multiple widget types** via exported components
✅ **Flexible cache-busting** for different environments
✅ **Tree-shaking** for smaller bundle sizes
✅ **SSR compatibility** via side-effect-free imports

The migration path is incremental - each phase builds on the previous without breaking existing functionality.

## Codex Response

- The checklist assumes we can ship CJS and ESM outputs without clarifying how KaTeX CSS bundling adapts to each format. We should capture whether the CSS stays inlined, moves to sidecar files, or relies on bundler CSS pipelines; otherwise we risk breaking the Python package that expects the inlined stylesheet.
- Splitting `index.ts` and introducing new entry points affects the Python packaging flow (which copies `dist/`). The plan does not spell out how Hatch/uv builds consume the new artifacts or how we keep the Python bundle in sync; documenting that handshake (e.g., which dist files get copied, how cache hashes are derived per format) would reduce integration risk.
- Moving dependencies to `peerDependencies` is sensible for npm, but we need a compatibility story for the Python-driven widget runtime that currently bundles them. The plan should call out whether the IIFE bundle will continue to include KaTeX/markdown-it or if we expect downstream users to install them separately.  OWNER's note: Python usage should still assume IIFE with bundled assets, but handshaing protocol needs to support mulitple ebtriy points (e,g, top-level containers)
- There is no testing strategy tied to the new packaging matrix. Before refactoring, outline CI additions (e.g., smoke tests importing each build format, Playwright run against the auto-init bundle) so we can detect regressions introduced by the new build outputs.
- Cache-busting proposals mention "hybrid" approaches but don't define the triggering conditions or fallback behaviour. Without a concrete algorithm, we could end up with stale widgets during SSR or inconsistent hashes between Python and npm builds.
