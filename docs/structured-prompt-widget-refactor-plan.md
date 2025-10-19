# Structured Prompt Diff Widget Refactor Plan

## Context and Goals
- Preserve the current Structured Prompt widget layout while improving the internal code structure to reduce coupling between base prompt views and diff overlays.
- De-risk future work on richer diff overlays (ghost nodes, badges, metrics) by clarifying data contracts and separating responsibilities for data normalization, state, and rendering.
- Avoid regressions in non-diff usage, the dominant path, by keeping the default rendering pipeline unchanged unless diff payloads are explicitly provided.

## Current Architecture Summary
- `WidgetContainer` orchestrates the tree, optional before view, main code view, and markdown view, toggling diff behavior by attaching the `tp-diff-enabled` class and instantiating a second folding controller when diff payloads exist. 【F:widgets/src/components/WidgetContainer.ts†L45-L140】
- `WidgetData` mixes core prompt fields and diff payloads (`before_prompt_ir`, `structured_diff`, `rendered_diff`) without a concrete schema tying the diff data back to the tree or chunk metadata consumed by the views. 【F:widgets/src/types.ts†L10-L55】
- Diff-specific components (e.g., `StructuredPromptDiffView`) render standalone widgets that are not integrated into the Structured Prompt rendering pipeline. 【F:widgets/src/components/StructuredPromptDiffView.ts†L1-L120】
- Python serialization mirrors the flat `WidgetData` contract, so any changes must remain backward compatible for existing notebooks and docs.

## Key Pain Points
1. **Ambiguous Diff Data Contract** – Views expect `WidgetData` and `WidgetMetadata`, but there is no canonical mapping between diff node IDs and the tree/chunk structures used by the base widget, complicating overlays and ghost-node rendering.
2. **State Coupling in `WidgetContainer`** – Diff toggling is driven by CSS classes and implicit component behavior; adding richer overlays will require more explicit state management and lifecycle coordination.
3. **Transform Pipeline Blind to Diffs** – Code/markdown transforms (chunk typing, wrapping, folding) operate on the after prompt only; injecting diff spans later risks DOM drift and brittle selectors.
4. **Duplication Risk for Split Widgets** – Creating a stand-alone diff widget would duplicate tree/chunk rendering logic unless we carve out shareable primitives first.

## Proposed Architecture
### 1. Formalize Data Interfaces
- Introduce a `DiffBundle` type embedded in `WidgetData`, e.g. `diff?: { before: IRData; structured: StructuredPromptDiffData; rendered: RenderedPromptDiffData; }`, and keep the old flat fields as deprecated aliases during migration.
- Add `DiffIndex` metadata computed when diff data is present:
  - `nodeDeltaByAfterId`, `nodeDeltaByBeforeId` maps for quick lookup.
  - `chunkDeltaByAfterId/beforeId` to align rendered diff spans with chunk metadata.
  - Persist these structures in `WidgetMetadata` so all views can reuse them.
- Python side: extend serialization helpers to emit the nested `diff` object while still populating legacy keys when notebooks are using older JS bundles; add unit tests verifying both shapes deserialize.

### 2. Establish a Presentation Shell with Feature Modules
- Extract a `StructuredPromptShell` component responsible only for layout (toolbar, panel arrangement, resizers). `WidgetContainer` becomes a thin wrapper wiring data + metadata into the shell.
- Define feature modules:
  - `PromptViewModule` – builds the existing tree/code/markdown experiences.
  - `DiffOverlayModule` – optional plug-in that augments the prompt module with before-panel wiring, badge decorators, and CSS hooks.
  - `StandaloneDiffModule` – reuses shared primitives to render the current diff-only widgets.
- Modules register lifecycle hooks (`init`, `onToggle`, `destroy`) against the shell so diff features can be enabled/disabled without rebuilding the entire DOM.

### 3. Tree Overlay Integration
- Create a `TreeDiffProjector` utility that walks `data.source_prompt.children` while consulting `nodeDeltaByAfterId` to annotate nodes with status, metrics, and optional ghost children.
- Ghost nodes are synthesized from `nodeDeltaByBeforeId` where `after_id === null`; they reuse the existing `ElementData` shape with a `ghost: true` flag so tree rendering code can treat them uniformly with slight styling adjustments.
- Expose a lightweight decorator API (`decorateTreeNode(nodeElement, diffInfo)`) to keep `TreeView` agnostic of diff logic; the diff module applies decorators only when diff mode is active.

### 4. Transform Pipeline Hooks
- Extend the transform pipeline (`transforms/*.ts`) with an optional `DiffOverlayTransform` stage that operates after chunk creation but before folding/typing inject DOM. It receives the diff metadata to annotate chunk DOM nodes with data attributes (`data-diff-op`, `data-diff-span`).
- For the before panel, reuse the same pipeline but mark the controller as read-only and feed it the `before` chunk sequence.
- Markdown view receives preprocessed tokens enriched with diff spans computed from `rendered_diff`; expose a shared helper `applyRenderedDiffTokens(markdownAST, chunkDeltaByAfterId)` so both markdown and code views stay aligned.

### 5. Explicit Diff State Management
- Introduce a `DiffStateController` (simple event emitter) that stores `enabled`, `beforePanelVisible`, and `activeFilters` (future-proof). `WidgetContainer` registers listeners to toggle CSS classes and instruct submodules to update.
- Toolbar buttons dispatch events instead of directly mutating DOM, reducing duplication and making it easier to test toggle behavior.
- Persist diff preferences (per IR ID) in session storage similarly to tree width to avoid surprising users.

### 6. Shared Styling Primitives
- Consolidate diff-related CSS into a dedicated partial (e.g., `styles/diff.css`) imported by the bundle. Expose BEM-like class names for badges, ghost rows, and chunk overlays so both the shell and standalone diff widgets can reuse them without divergence.

## Implementation Plan
1. **Data Contract Prep**
   - Implement `DiffBundle` and metadata builders; add TypeScript type guards ensuring legacy payloads normalize into the new shape.
   - Update Python serializers and add regression tests.
2. **Shell Extraction**
   - Refactor `WidgetContainer` into `StructuredPromptShell` + modules without changing visual output; confirm tree/code/markdown flows stay intact by running existing widget tests.
3. **Diff State Controller & Toolbar Wiring**
   - Introduce the controller, migrate existing toolbar diff toggles to events, and ensure non-diff behavior is unchanged (diff disabled path).
4. **Tree Diff Projector Integration**
   - Implement decorators and ghost node synthesis; gate behind diff state to avoid performance hit when disabled.
5. **Transform Hooks for Code/Markdown**
   - Add diff transform stage with unit tests covering chunk annotations; ensure folding/scroll sync controllers consume the augmented metadata without regressions.
6. **Standalone Module Alignment**
   - Update existing diff-only widgets to import shared decorators/styles, reducing duplication and ensuring consistent look-and-feel.
7. **Cleanup & Migration Toggle**
   - Remove legacy diff fields once all entry points emit `DiffBundle`; keep type guards for a transition period if required.

Each step should leave the widget in a runnable state; run the widget unit tests (`pnpm --filter @t-prompts/widgets test`) and targeted Python snapshot tests after phases 2, 4, and 5 to detect regressions early.

## Testing and Validation Strategy
- **TypeScript**: Expand component/unit tests to cover diff toggling, tree ghost nodes, code overlay presence/absence, and transform output. Snapshot tests should assert DOM structure for both diff-enabled and disabled states.
- **Python**: Add integration tests ensuring serialized widget payloads normalize diff bundles and continue to render without JS errors when diff data absent.
- **Visual Regression (Optional but Recommended)**: Use Playwright screenshot scripts in `scratchpad/` to compare diff-enabled vs disabled renders after major phases.

## Risk Mitigation
- Maintain feature flags: keep diff overlays off by default until fully validated; fallback to current behavior if normalization fails.
- Incrementally land changes with thorough unit coverage; avoid sweeping renames that combine data contract changes with UI refactors in the same commit.
- Document new data types and module boundaries inside the repo to keep Python and TypeScript teams aligned.
