# Structured Prompt Diff Widget Refactor Plan

## Objective
Deliver a refactor of the Structured Prompt widget code that preserves today\'s behavior and styling while setting up a clean separation between the "plain" prompt experience and the diff overlays introduced in PR #33. The refactor should minimize duplicated logic between the before/after displays, clarify how diff payloads flow through the system, and reduce the risk of subtle regressions as we iterate on tree overlays and rendered diff polish.

## Current Pain Points
- **Implicit data contract** – `WidgetContainer` checks `WidgetData.before_prompt_ir`, `structured_diff`, and `rendered_diff` directly, but the schema that Python emits is only implied by loose optional fields in `widgets/src/types.ts`. The tree renderer and metadata helpers continue to consume only the "after" prompt IR, so diff-only nodes never surface.
- **Mixed responsibilities in the container** – `WidgetContainer` now controls layout, diff enablement (`tp-diff-enabled` class), multi-pane sizing, folding controllers for both prompts, and toolbar state injection. This makes it difficult to reason about diff state, or to mount an alternative diff-only widget, without touching core layout logic.
- **Tree/code view coupling to prompt-only assumptions** – `TreeView` and `CodeView` assume data comes entirely from `WidgetData.ir` / `source_prompt`. Diff-specific information (node deltas, ghost nodes, rendered diff spans) has no defined entry point, forcing future enhancements to interleave overlay logic directly into the prompt traversal code.
- **Duplicated view plumbing** – `BeforeCodeView` effectively copies the code view pipeline with a second `FoldingController`, but with subtle differences (panel visibility toggle, metrics wiring). Without shared abstractions, additions to chunk transforms or toolbar controls must be patched in both paths.

## Proposed Architecture
### 1. Explicit Diff Context Model
- Introduce a `DiffContext` interface in `widgets/src/types.ts` that groups `beforePrompt`, `structured`, and `rendered` payloads plus derived helpers (e.g., node/element lookup tables). Replace `hasDiffData` with a type guard that returns a structured object instead of ad-hoc truthiness checks.
- Update `WidgetData` to hold `diff?: DiffContextPayload` while keeping legacy optional fields for backward compatibility (Python can populate both during migration). `metadata.ts` should export builders that consume the combined payload and produce diff-aware maps used by all views.
- On the Python side, extend the serializer to emit `diff_context` with explicit keys that match the TypeScript interface. Keep existing fields populated (to avoid breaking older front-ends) until the new container is fully rolled out.  the data test generation tool at widgets/generate_test_data.py will need to be run at the correct point to regenerate data for unit tests, and unit tests will need to be updated to reflect the new data layout.  Similarly the python unit tests will need updating.

### 2. Presentation Layer Separation
- Extract a `StructuredPromptShell` component responsible only for layout (tree gutter, main split, panel resizing) and toolbar composition. It accepts render callbacks for `before`, `after`, and `markdown` regions plus an optional diff controller object.
- Build a `DiffOverlayController` module that encapsulates diff enablement state, metrics computation, and CSS class toggling (`tp-diff-enabled`). This controller can be injected into the shell when diff context exists, or omitted to render the prompt-only experience.
- Relocate diff toggle UI logic out of `WidgetContainer` into a toolbar plugin (`ToolbarSectionDiff`), allowing the same toolbar to be reused by a future dedicated diff widget without reimplementing container sizing.

### 3. Tree View Integration Hooks
- Define a `TreeDataSource` interface that supplies node descriptors and child lookup independent of diff logic. The existing prompt traversal becomes the default implementation (`PromptTreeDataSource`).
- Add a `DiffTreeOverlay` module that consumes `DiffContext.structured` and exposes decorators (e.g., status badges, ghost node descriptors). The tree view receives both the base data source and optional overlays, composing them when rendering rows. This avoids threading diff-specific logic through every recursive traversal.
- Generate explicit ID maps (`beforeIdToNode`, `afterIdToNode`) during diff context construction to support overlay placement, ghost node grouping, and whitespace-aware filters.

### 4. Chunk / Markdown Pipeline Extensions
- Introduce a transform slot API in the chunk rendering pipeline (`transforms/index.ts`) so overlays can register additional DOM augmentations without forking `CodeView`. The base transforms handle layout, folding markers, etc., while a `diffOverlayTransform` can annotate DOM nodes using rendered diff spans.
- Share chunk lookup helpers between `CodeView` and `BeforeCodeView` by extracting common logic into `chunkPipeline.ts`. Both before/after views should differ only by the chunk list and associated metadata, reducing duplication.
- For Markdown, wrap the existing renderer in a decorator that can inject `<ins>/<del>` spans when diff is enabled. Keep the default Markdown output untouched when diff overlays are disabled.

### 5. Container & Init Integration
- Refine the widget entry point (`renderer.ts`) so `initWidget` inspects the payload: if `diff_context` is provided, it instantiates `StructuredPromptShell` with `DiffOverlayController`; otherwise it builds the prompt-only configuration. The discriminant logic for standalone diff widgets remains unchanged.
- Store diff state (enabled/disabled, before panel visibility) in a lightweight event emitter managed by the controller. Persist preference keys (`tp-diff-enabled`, `tp-before-visible`) separately from tree collapse state to avoid cross-widget interference.

## Implementation Roadmap
1. **Data Contract Hardening**
   - Extend Python serializer and TypeScript types to emit/consume `diff_context` while preserving existing optional fields.
   - Add unit tests in both languages ensuring default payloads omit diff data without breaking rendering.
2. **Shell & Controller Extraction**
   - Refactor `WidgetContainer` into `StructuredPromptShell` + `DiffOverlayController` modules.
   - Update existing tests (`WidgetContainer.test.ts`, toolbar tests) to exercise both diff and non-diff configurations.
3. **Shared Chunk Pipeline**
   - Extract shared chunk rendering helpers, update `CodeView` and `BeforeCodeView` to use them, and confirm folding behavior remains unchanged via current tests.
4. **Tree Overlay Hooks**
   - Implement `TreeDataSource` abstraction and integrate `DiffTreeOverlay`. Re-run tree tests and add coverage for ghost node rendering and badge placement using fixture diff data.
5. **Transform Plug-in Points**
   - Introduce transform registration for code/markdown overlays. Write focused tests that ensure overlays do not mutate DOM when diff disabled.
6. **State Persistence & Toolbar Plugin**
   - Move diff toggle UI into toolbar plugin backed by the controller. Verify `tp-diff-enabled` class toggles correctly and before panel state persists independently.
7. **Regression Testing & Visual Audit**
   - Execute existing unit test suite, targeted visual checks (Playwright scripts) comparing before/after renders, and manual smoke test of prompt-only widget to confirm no visual drift.

Each phase should land behind feature flags or guarded branches so the widget remains functional after every merge.

## Testing Strategy
- **TypeScript unit tests** – Extend current suites (`TreeView.test.ts`, `CodeView.test.ts`, `WidgetContainer.test.ts`) with diff-context fixtures covering both enabled and disabled states.
- **Python snapshot tests** – Serialize widget payloads with and without diff context to ensure the contract stays backward compatible.
- **Visual sanity checks** – Use existing Playwright scripts (in `src/t_prompts/widgets/preview.py`) or new scratchpad notebooks to capture before/after renders, ensuring styling is unchanged.
- **Performance smoke tests** – Measure render timing in a large prompt scenario before and after the refactor to confirm overlays remain dormant when diff disabled.

## Risk Mitigation
- Stage the refactor so data contract changes merge before structural rewrites, allowing simple rollbacks.
- Keep mock payload fixtures synchronized between Python and TypeScript by generating them from shared JSON references.
- Introduce temporary logging/feature flags in the controller to trace diff enablement during QA, removable once confidence is high.
- Document migration steps in the PR description so downstream consumers understand when to remove legacy fields.
