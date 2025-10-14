# Widget Proposal: Structured Prompt Visualization

## Goals
- Provide `_repr_html_` implementations for intermediate representations (IRs) and structured prompts.
- Enable an embeddable three-pane visualization (tree, code, preview) that works offline in static HTML contexts (Jupyter, VS Code, Marimo, MkDocs).
- Minimize duplicated JavaScript/CSS while remaining self-contained.
- Support Markdown preview with KaTeX for LaTeX rendering and offer JSON provenance embedding for richer interactions later.

## Phase 0 – Asset Packaging & Duplication Strategy

### Requirements
- `_repr_html_` must return a standalone HTML string with embedded CSS/JS (no external network access).
- Multiple widget instances may appear in the same document; duplicated assets should not cause conflicts or excessive payload size.

### Options for Minimizing Duplication
1. **Inline Self-Contained Bundle (Baseline)**
   - Embed CSS/JS directly in the HTML string for each widget.
   - Use IIFE-scoped JavaScript (e.g., `(function(){ ... })();`) to prevent global name collisions.
   - Simple to implement, guaranteed to work offline.
   - Cost: JS duplicated per widget; acceptable for initial versions.
2. **Shared Asset Registry (Progressive Enhancement)**
   - Include a bootstrap script that checks for a global sentinel (e.g., `window.__tprompt_widget__`).
   - If assets already loaded, skip reinjection; otherwise append `<style>`/`<script>` to `document.head`.
   - Keeps `_repr_html_` self-contained while avoiding multiple insertions when the document supports DOM mutation.
   - Works in live notebook environments; fallback to per-instance bundling if DOM manipulation disallowed (static export).
3. **Static Asset Extraction (Future Exploration)**
   - Publish assets as standalone files (via `nbextensions`, MkDocs static files, etc.) and reference them via relative URLs.
   - Requires build pipeline and configuration per host environment; defer until Phase 2 if needed.

### Deliverables
- Decision: start with option 1 (baseline) plus optional sentinel guard from option 2 to limit duplication without extra tooling.
- Draft template snippet demonstrating sentinel pattern and namespacing for CSS classes/IDs (e.g., prefix `tprompt-`).
- Identify third-party libraries to embed:
  - **Markdown**: Use a lightweight renderer such as [marked](https://github.com/markedjs/marked) or [markdown-it]; evaluate minified bundle size.
  - **KaTeX**: Use official KaTeX CSS/JS (minified); consider tree-shaking or deferred loading if size is prohibitive.
  - **Tree View**: Consider vanilla implementation or minimal dependency like `@vanilla-tree-view`; prefer custom to limit bundle size.
- Document JSON embedding approach (e.g., `<script type="application/json" id="tprompt-data-...">`).

## Phase 1 – Minimal End-to-End Renderer

### Objectives
- Produce `_repr_html_` output that renders IR/structured prompt with basic styling and Markdown + KaTeX support.
- Single component handles rendering; no advanced interactivity beyond static display and basic expand/collapse placeholders.

### Tasks
1. **Data Preparation**
   - Define serialization helpers to emit JSON describing tree structure, Markdown body, and metadata.
   - Ensure IR and structured prompt share a common export shape for reuse.
2. **HTML Template**
   - Build string template embedding:
     - Container `<div class="tprompt-widget" data-widget-id="...">`.
     - Inline `<style>` block for layout (flexbox for three panels).
     - Inline `<script>` block containing JS bundle.
     - `<script type="application/json" data-role="payload">` with serialized data.
3. **JavaScript Bootstrap**
   - Parse JSON payload, render Markdown (with KaTeX pass), and populate tree/code/preview panels.
   - Provide basic fold toggles (non-persistent, simple show/hide) to validate architecture.
   - Keep code view plain text with `<pre><code>` using syntax-aware class for future enhancement.
4. **Testing**
   - Manual smoke tests in Jupyter Notebook and MkDocs build to confirm offline compatibility.
   - Snapshot tests (e.g., pytest + BeautifulSoup) to ensure `_repr_html_` contains expected structure.

### Deliverables
- Minimal functioning `_repr_html_` for IR and structured prompt classes.
- Documentation of expected JSON schema (reference existing docs in `docs/` for alignment).
- Basic developer notes on how to iterate in Phase 2 (e.g., where JS/CSS lives, how to rebuild).

## Phase 2 – Rich Interactive Widget (High-Level Outline)

### Goals
- Enhance UI/UX with responsive layout, synchronized highlighting, folding, and navigation.
- Modularize code for maintainability and testing.

### Preliminary Architecture
- **Core Modules**
  - `data.ts`: Types and parsers for widget payload.
  - `render.ts`: DOM rendering utilities for panels.
  - `interactions.ts`: Event wiring (synchronization, folding, selection, scrolling).
  - `markdown.ts`: Markdown + KaTeX integration, potentially lazy-loaded.
- **Styling**
  - Use CSS variables for theming (light/dark support, inheriting notebook theme where possible).
  - Provide BEM-style class names (`tprompt-widget__tree`, etc.).
- **Build Tooling**
  - Use esbuild/rollup to produce minified bundle embedded into Python via string literal or resource loader.
  - Provide script to update embedded assets (`python -m scripts.bundle_widget`).
- **Testing Strategy**
  - Unit tests for serialization (Python) and rendering logic (JS via Vitest).
  - Visual regression snapshots (optional) using Playwright for deterministic HTML.

### Future Enhancements
- Keyboard navigation, search, pinned panes.
- Persisted folding state via local storage or data attributes.
- Integration with IPyWidgets for live updates when available.

## Open Questions & Risks
- KaTeX bundle size may be large; consider dynamic loading or subset builds in later phases.
- Handling large prompts may require virtualization or lazy rendering for performance.
- Need to ensure `_repr_html_` works in static exports where JS execution may be limited (e.g., PDF conversion); consider graceful degradation (static HTML fallback) in Phase 2.

## Next Steps
1. Prototype sentinel-based asset injection (Phase 0 deliverable).
2. Draft minimal `_repr_html_` template using inline assets (Phase 1 kickoff).
3. Align JSON export schema with existing documentation in `docs/` (e.g., provenance specs) before building full widget.
