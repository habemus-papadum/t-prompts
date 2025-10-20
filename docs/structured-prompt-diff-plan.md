# Structured Prompt Diff Overlay Plan

## Goals
- Extend the existing Structured Prompt widget so it can optionally display diff context (before prompt, structured diff, rendered diff) alongside the compiled IR of the "after" prompt.
- Preserve current behavior when diff inputs are missing.
- Provide intuitive controls for toggling diff visualization without overwhelming the core prompt exploration workflows.

## Assumptions
- Widget already receives compiled IR for the active ("after") prompt.
- New inputs are delivered as JSON payloads alongside the compiled IR: `prior_prompt_ir`, `structured_diff`, `rendered_diff`.
- Diff data is internally consistent (node IDs, chunk IDs, ranges) and matches the schema used by `StructuredPromptDiff` / `RenderedPromptDiff`.
- When data is missing, the widget must hide all diff UI affordances and operate exactly as today.

## High-Level UX Concept
1. **Diff Toggle Bar**
   - Add a compact toolbar in the widget header with a toggle switch labeled “Show diff”.
   - Toggle is disabled (hidden) when diff payloads are absent.
   - When enabled, diff overlays activate across the widget views; when disabled, the widget reverts to the existing pure “after” prompt view.

2. **Tree View Enhancements**
   - Overlay status icons (e.g., `+`, `−`, `↷`) using pill badges next to node labels to indicate added, removed, and moved nodes.
   - Highlight background/border of affected nodes using color-coded left ribbons (green for additions, red for deletions, purple for moves).
   - Introduce ghost nodes for deletions: collapsible sections rendered in a faded style at the bottom of the tree or grouped under a “Removed” parent. These nodes show the prior hierarchy with strikethrough text.
   - Provide metrics summary (additions/deletions/moves) in the tree header when diff mode is active.

3. **Chunk / Code View Enhancements**
   - Continue showing the sequence of chunks for the compiled IR.
   - For each chunk, display addition/deletion overlays:
     - Added text: green left border plus subtle background tint; optional leading `▎` glyph to avoid conflicting with current borders.
     - Deleted text: render as inline callouts below the corresponding chunk with red outlines and strikethrough, using the rendered diff spans to position them. If no anchor chunk exists (pure deletion), render as separate ghost chunk in chronological order based on diff metadata.
   - Show inline markers within chunks (similar to IDE gutter markers) for changed lines; hover reveals tooltip with diff summary from rendered diff (e.g., `− old text`, `+ new text`).

4. **Markdown Rendering**
   - Leverage rendered diff: show Markdown preview with change callouts using `<ins>` / `<del>` styling. Convert diff spans to highlight tokens while respecting Markdown semantics. For block-level deletions without anchors, add collapsible “Removed content” panels below the relevant section.

5. **Details Sidebar (Optional)**
   - Add a secondary panel (collapsed by default) listing diff metadata: counts, top-level moved sections, rendered diff summary. Useful for power users; accessible via an info icon in the header.

## Data Flow and Model Changes
- **Front-end**
  - Update TypeScript types in `widgets/src/diff-types.ts` to include optional `before_prompt_ir`, `structured_diff`, `rendered_diff` fields in the payload consumed by the Structured Prompt widget renderer.
  - Normalize incoming JSON to internal diff structures (reuse existing `StructuredPromptDiffData` types for node deltas, text edits).
  - Extend widget state machine to store `diffEnabled` boolean and diff payload caches.
- **Python Back-end**
  - Extend serialization helpers (e.g., `src/t_prompts/widgets/export.py`) to package the prior prompt IR and diff JSON when available.
  - Ensure `_repr_html_` / preview helpers pass diff context through the widget view model.

## Component-Level Work
1. **Renderer / Entry Point**
   - Modify `widgets/src/renderer.ts` so the default Structured Prompt widget builder can interpret combined prompt + diff payloads. Introduce a discriminated union type or configuration object specifying `mode: 'prompt' | 'prompt-with-diff'`.
   - Ensure fallback to existing builder when diff data is absent.

2. **Structured Prompt View Component**
   - Refactor existing view into a base component responsible for layout (header, tabs for tree/chunks/markdown) and slots for overlays.
   - Integrate the diff toggle into the header; propagate `diffEnabled` state to child components.

3. **Tree View**
   - Implement overlay layering: base tree representing the “after” prompt plus diff-specific decorators that read `structured_diff.node_deltas`.
   - Create helper functions to compute node status (added/removed/moved/modified) and to synthesize ghost nodes from deletions.
   - Ensure tree virtualization / expansion logic handles ghost nodes without breaking navigation.

4. **Chunk / Rendered Views**
   - Use `rendered_diff.text_edits` to annotate chunk DOM nodes. Map edit ranges to chunk IDs via metadata already present in compiled IR.
   - For ghost chunks, fabricate DOM nodes with class `tp-chunk--deleted` and attach diff metadata for tooltips.
   - Provide accessible color palette (WCAG contrast) and avoid conflicting with existing backgrounds.

5. **State Synchronization**
   - Centralize diff toggle state in a store (e.g., simple event emitter or context). Ensure switching views preserves toggle.
   - Allow programmatic toggling (future automation) by adding optional query parameter / data attribute.

6. **Testing**
   - Unit tests for TypeScript components covering: toggle visibility, diff overlay rendering, ghost nodes, fallback behavior.
   - Snapshot tests for chunk markup with diff overlays.
   - Python integration tests to verify widget HTML includes diff payload when provided and excludes when absent.

## Accessibility & UX Considerations
- Provide text equivalents for color-coded statuses (aria labels, screen reader descriptions).
- Ensure toggle is keyboard accessible and diff overlays do not disrupt existing focus order.
- Consider user preference persistence (localStorage) for diff toggle default.

## Documentation & Demo Updates
- Document diff overlay usage in `docs/features.md` (future work) and create a dedicated demo notebook showing before/after with diff toggle.
- Update `docs/demos` to include new screenshots or GIFs.

## Implementation Phases
1. **Data Plumbing** – Introduce optional diff payload wiring in both Python and JS layers; confirm backward compatibility.
2. **UI Toggle + Skeleton** – Add header toggle and placeholder overlays that visually indicate diff availability.
3. **Tree Overlay Implementation** – Render badges, ghost nodes, metrics, and ensure navigation works.
4. **Chunk & Markdown Overlays** – Apply rendered diff styling, ghost chunks, tooltips.
5. **Polish & Accessibility** – Refine styles, ensure contrast, add keyboard support.
6. **Docs & Demos** – Update documentation and add interactive/static demos.

## Risks & Mitigations
- **Complexity Explosion**: Keep overlays opt-in and modular to avoid performance hits when diff disabled.
- **Data Alignment Issues**: Add validation to ensure diff spans map cleanly to chunks; log warnings when they don’t.
- **Visual Noise**: Offer compact styling and collapse options for large deletion sets.

## Open Questions
- Should diff toggle default to on when diff data present? (Current assumption: on.).
ANSWER: YES
- Do we need granular filters (e.g., hide moves)? Possibly future enhancement.
ANSWER: Not now
- How should we handle conflicting diff spans? Consider fallback to inline text diff view.
ANSWER: TBD

Additional comments
When Diffs are available, consider provding the diff metrics for both as a subtool bar/narrow header ; these should be probably be made into reusable widgets -- they should be based on the metrics in the current StructuredDiff and RenderedDiff Widgets.

StructuredDiff and RenderedDiff Widgets are narrow debugging tools -- aside from the metrics, they are not good foundations / visual representations for this work -- this work seekd to weave diff information into the existinf display.

Visual feedback and observation is important during planning and at the end of various steps.
Consider using playwright based screen captures to observe the actual visual appearance. the
instructions for playwright are in the AGENTS.md.  You can create scratch scripts in /scratchpad.
Refer to src/t_prompts/widgets for examples of such script that create images.
