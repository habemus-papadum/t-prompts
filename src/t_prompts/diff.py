"""Diff utilities for StructuredPrompt trees and rendered outputs."""

from __future__ import annotations

import io
import math
import re
from dataclasses import dataclass, field
from html import escape
from itertools import zip_longest
from typing import Any, Iterable, Literal, Optional

from .element import Element, ImageInterpolation, ListInterpolation, Static, TextInterpolation
from .ir import ImageChunk, TextChunk
from .structured_prompt import StructuredPrompt

try:  # pragma: no cover - rich is part of the dev environment, but keep graceful degradation
    from rich.console import Console
    from rich.table import Table
    from rich.text import Text
    from rich.tree import Tree

    _HAS_RICH = True
except Exception:  # pragma: no cover - fall back when Rich is unavailable
    Console = None  # type: ignore[assignment]
    Table = None  # type: ignore[assignment]
    Text = None  # type: ignore[assignment]
    Tree = None  # type: ignore[assignment]
    _HAS_RICH = False


DiffStatus = Literal["equal", "modified", "inserted", "deleted", "moved"]
ChunkOp = Literal["equal", "insert", "delete", "replace"]

_DIFF_STYLE = """
<style>
.tp-diff-view {
  font-family: var(--tp-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans',
    Helvetica, Arial, sans-serif);
  font-size: 14px;
  color: var(--tp-color-fg, #24292e);
  background: var(--tp-color-bg, #ffffff);
  border: 1px solid var(--tp-color-border, #e1e4e8);
  border-radius: 6px;
  margin: calc(var(--tp-spacing, 8px) * 2) 0;
  overflow: hidden;
}

.tp-diff-header {
  padding: calc(var(--tp-spacing, 8px) * 1.5);
  border-bottom: 1px solid var(--tp-color-border, #e1e4e8);
  background: var(--tp-color-bg, #ffffff);
  font-weight: 600;
}

.tp-diff-summary {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--tp-spacing, 8px));
  padding: calc(var(--tp-spacing, 8px) * 1.5);
  background: rgba(3, 102, 214, 0.05);
}

.tp-diff-pill {
  border-radius: 999px;
  padding: 4px 12px;
  background: rgba(3, 102, 214, 0.08);
  color: var(--tp-color-fg, #24292e);
  font-size: 12px;
  border: 1px solid rgba(3, 102, 214, 0.18);
}

.tp-diff-body {
  padding: calc(var(--tp-spacing, 8px) * 1.5);
}

.tp-diff-tree,
.tp-diff-chunks {
  list-style: none;
  margin: 0;
  padding-left: calc(var(--tp-spacing, 8px) * 2);
}

.tp-diff-node {
  margin-bottom: calc(var(--tp-spacing, 8px));
  border-left: 3px solid rgba(3, 102, 214, 0.18);
  padding-left: calc(var(--tp-spacing, 8px));
}

.tp-diff-node[data-status="inserted"] {
  border-left-color: #2ea043;
}

.tp-diff-node[data-status="deleted"] {
  border-left-color: #d73a49;
}

.tp-diff-node[data-status="modified"] {
  border-left-color: #fb8c00;
}

.tp-diff-node[data-status="moved"] {
  border-left-style: dashed;
}

.tp-diff-node-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.tp-diff-node-meta {
  font-size: 12px;
  color: var(--tp-color-muted, #6a737d);
  margin-bottom: 4px;
}

.tp-diff-text {
  display: inline-block;
  font-family: var(--tp-font-mono, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas,
    'Courier New', monospace);
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(36, 41, 46, 0.05);
}

.tp-diff-ins {
  color: #2ea043;
}

.tp-diff-del {
  color: #d73a49;
}

.tp-diff-chunk[data-op="insert"] {
  border-left: 3px solid #2ea043;
}

.tp-diff-chunk[data-op="delete"] {
  border-left: 3px solid #d73a49;
}

.tp-diff-chunk[data-op="replace"] {
  border-left: 3px solid #fb8c00;
}

.tp-diff-chunk[data-op="equal"] {
  border-left: 3px solid rgba(3, 102, 214, 0.18);
  background: rgba(3, 102, 214, 0.04);
}

.tp-diff-chunk[data-op="equal"] .tp-diff-chunk-text {
  color: var(--tp-color-muted, #6a737d);
}

.tp-diff-chunk-text {
  white-space: pre-wrap;
  font-family: var(--tp-font-mono, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas,
    'Courier New', monospace);
  font-size: 12px;
}

.tp-diff-legend {
  display: flex;
  gap: calc(var(--tp-spacing, 8px));
  font-size: 11px;
  color: var(--tp-color-muted, #6a737d);
  margin-bottom: calc(var(--tp-spacing, 8px));
}

.tp-diff-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tp-diff-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
}

.tp-diff-dot.insert { background: #2ea043; }
.tp-diff-dot.delete { background: #d73a49; }
.tp-diff-dot.modify { background: #fb8c00; }
</style>
"""


@dataclass(slots=True)
class TextEdit:
    """Atomic text edit for leaf comparisons."""

    op: Literal["equal", "insert", "delete", "replace"]
    before: str
    after: str

    def added_chars(self) -> int:
        return len(self.after) if self.op in {"insert", "replace"} else 0

    def removed_chars(self) -> int:
        return len(self.before) if self.op in {"delete", "replace"} else 0

    def to_html(self) -> str:
        if self.op == "equal":
            return f'<span class="tp-diff-text">{escape(self.after)}</span>'
        if self.op == "insert":
            return f'<span class="tp-diff-text tp-diff-ins">+ {escape(self.after)}</span>'
        if self.op == "delete":
            return f'<span class="tp-diff-text tp-diff-del">- {escape(self.before)}</span>'
        return (
            '<span class="tp-diff-text">'
            f'<span class="tp-diff-del">- {escape(self.before)}</span> '
            f'<span class="tp-diff-ins">+ {escape(self.after)}</span>'
            "</span>"
        )


@dataclass(slots=True)
class NodeDelta:
    """Diff result for a single Element node."""

    status: DiffStatus
    element_type: str
    key: Any
    before_id: Optional[str]
    after_id: Optional[str]
    before_index: Optional[int]
    after_index: Optional[int]
    attr_changes: dict[str, tuple[Any, Any]] = field(default_factory=dict)
    text_edits: list[TextEdit] = field(default_factory=list)
    children: list["NodeDelta"] = field(default_factory=list)

    def summarize(self) -> dict[str, int]:
        stats = {"added": 0, "removed": 0, "modified": 0, "moved": 0}
        self._accumulate(stats)
        return stats

    def _accumulate(self, stats: dict[str, int]) -> None:
        if self.status == "inserted":
            stats["added"] += 1
        elif self.status == "deleted":
            stats["removed"] += 1
        elif self.status == "modified":
            stats["modified"] += 1
        elif self.status == "moved":
            stats["moved"] += 1
        for child in self.children:
            child._accumulate(stats)

    def to_rich_tree(self, label: Optional[str] = None) -> "Tree":
        if not _HAS_RICH:  # pragma: no cover - executed when Rich is unavailable
            raise RuntimeError("Rich is not installed")

        status = self.status
        title = label or f"{self.element_type} ({self.key!r})"
        status_text = Text(f"[{status}]", style=_status_style(status))
        node_text = Text.assemble(Text(title, style="bold"), Text(" "), status_text)

        tree = Tree(node_text)
        if self.attr_changes:
            table = Table.grid(padding=(0, 1))
            table.add_column("Field")
            table.add_column("Before")
            table.add_column("After")
            for field_name, (before, after) in sorted(self.attr_changes.items()):
                table.add_row(field_name, repr(before), repr(after))
            tree.add(table)

        if self.text_edits:
            for edit in self.text_edits:
                tree.add(Text(f"{edit.op}: {edit.before!r} -> {edit.after!r}"))

        for child in self.children:
            tree.add(child.to_rich_tree())
        return tree

    def to_html(self) -> str:
        meta = []
        if self.before_index is not None or self.after_index is not None:
            meta.append(
                f"idx: {'' if self.before_index is None else self.before_index}"
                f" → {'' if self.after_index is None else self.after_index}"
            )
        if self.attr_changes:
            fields = ", ".join(f"{escape(field)}" for field in sorted(self.attr_changes))
            meta.append(f"fields: {fields}")

        text_html = "".join(edit.to_html() for edit in self.text_edits)
        child_html = "".join(child.to_html() for child in self.children)

        parts = [
            f'<li class="tp-diff-node" data-status="{self.status}">',
            f'<div class="tp-diff-node-title">{escape(self.element_type)} · {escape(str(self.key))}</div>',
        ]

        if meta:
            parts.append(f'<div class="tp-diff-node-meta">{" · ".join(meta)}</div>')
        if text_html:
            parts.append(f"<div>{text_html}</div>")
        if child_html:
            parts.append(f'<ul class="tp-diff-tree">{child_html}</ul>')
        parts.append("</li>")
        return "".join(parts)


@dataclass(slots=True)
class DiffStats:
    """Aggregate statistics for a StructuredPrompt diff."""

    nodes_added: int = 0
    nodes_removed: int = 0
    nodes_modified: int = 0
    nodes_moved: int = 0
    text_added: int = 0
    text_removed: int = 0


@dataclass(slots=True)
class StructuredPromptDiff:
    """Result of comparing two StructuredPrompt instances."""

    before: StructuredPrompt
    after: StructuredPrompt
    root: NodeDelta
    stats: DiffStats

    def to_widget_data(self) -> dict[str, Any]:
        """
        Convert diff to widget data for TypeScript rendering.

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary with diff data.
        """
        return {
            "diff_type": "structured",
            "root": _serialize_node_delta(self.root),
            "stats": {
                "nodes_added": self.stats.nodes_added,
                "nodes_removed": self.stats.nodes_removed,
                "nodes_modified": self.stats.nodes_modified,
                "nodes_moved": self.stats.nodes_moved,
                "text_added": self.stats.text_added,
                "text_removed": self.stats.text_removed,
            },
            "metrics": self.metrics(),
        }

    def metrics(self) -> dict[str, float]:
        """Compute quantitative metrics describing diff magnitude."""

        before_elements = _gather_elements(self.before)
        after_elements = _gather_elements(self.after)
        edit_count, span_chars = _structured_edit_volume(self.root, before_elements, after_elements)
        total_chars = _total_rendered_chars(self.before)
        char_ratio = (span_chars / total_chars) if total_chars else 0.0
        inversions, pairs = _collect_order_inversions(self.root)
        order_score = (inversions / pairs) if pairs else 0.0
        composite = 0.4 * edit_count + 0.4 * math.log1p(span_chars) + 0.2 * order_score
        return {
            "struct_edit_count": edit_count,
            "struct_span_chars": span_chars,
            "struct_char_ratio": char_ratio,
            "struct_order_score": order_score,
            "struct_composite": composite,
        }

    def to_rich(self, width: int = 120) -> str:
        if not _HAS_RICH:  # pragma: no cover - executed when Rich is unavailable
            return self._fallback_string()

        console = Console(width=width, record=True, file=io.StringIO())
        tree = self.root.to_rich_tree("StructuredPrompt")
        console.print(tree)
        summary = (
            f"added={self.stats.nodes_added}, removed={self.stats.nodes_removed}, "
            f"modified={self.stats.nodes_modified}, moved={self.stats.nodes_moved}, "
            f"+chars={self.stats.text_added}, -chars={self.stats.text_removed}"
        )
        console.print(summary)
        return console.export_text(clear=False)

    def __str__(self) -> str:
        return self.to_rich()

    def _repr_html_(self) -> str:
        """Return HTML representation for Jupyter notebook display."""
        from .widgets import _render_widget_html

        data = self.to_widget_data()
        html = _render_widget_html(data, "tp-sp-diff-mount")

        # Include CSS for now (will migrate to TypeScript styles later)
        return _DIFF_STYLE + html

    def _fallback_string(self) -> str:
        parts = ["StructuredPromptDiff:"]
        parts.append(
            f"  added={self.stats.nodes_added}, removed={self.stats.nodes_removed}, "
            f"modified={self.stats.nodes_modified}, moved={self.stats.nodes_moved}"
        )
        parts.append(f"  +chars={self.stats.text_added}, -chars={self.stats.text_removed}")
        return "\n".join(parts)


@dataclass(slots=True)
class ChunkDelta:
    """Chunk-level diff entry for rendered prompts."""

    op: ChunkOp
    before: TextChunk | ImageChunk | None
    after: TextChunk | ImageChunk | None

    def text_delta(self) -> tuple[int, int]:
        added = len(self.after.text) if self.after is not None else 0
        removed = len(self.before.text) if self.before is not None else 0
        return added if self.op in {"insert", "replace"} else 0, removed if self.op in {"delete", "replace"} else 0

    def to_html(self) -> str:
        before_text = "" if self.before is None else escape(self.before.text)
        after_text = "" if self.after is None else escape(self.after.text)
        content = ""
        if self.op == "equal":
            content = after_text
        elif self.op == "insert":
            content = f"+ {after_text}"
        elif self.op == "delete":
            content = f"- {before_text}"
        else:
            content = f"- {before_text}\n+ {after_text}"
        return f'<li class="tp-diff-chunk" data-op="{self.op}"><div class="tp-diff-chunk-text">{content}</div></li>'


@dataclass(slots=True)
class ElementRenderChange:
    """Aggregated chunk operations for a single element."""

    element_id: str
    inserts: int = 0
    deletes: int = 0
    replaces: int = 0
    equals: int = 0
    text_added: int = 0
    text_removed: int = 0


@dataclass(slots=True)
class RenderedPromptDiff:
    """Diff between two rendered prompt intermediate representations."""

    before: StructuredPrompt
    after: StructuredPrompt
    chunk_deltas: list[ChunkDelta]
    per_element: dict[str, ElementRenderChange]

    def to_widget_data(self) -> dict[str, Any]:
        """
        Convert diff to widget data for TypeScript rendering.

        Returns
        -------
        dict[str, Any]
            JSON-serializable dictionary with diff data.
        """
        return {
            "diff_type": "rendered",
            "chunk_deltas": [
                {
                    "op": delta.op,
                    "before": (
                        {"text": delta.before.text, "element_id": delta.before.element_id}
                        if delta.before
                        else None
                    ),
                    "after": (
                        {"text": delta.after.text, "element_id": delta.after.element_id}
                        if delta.after
                        else None
                    ),
                }
                for delta in self.chunk_deltas
            ],
            "stats": self.stats(),
            "metrics": self.metrics(),
        }

    def stats(self) -> dict[str, int]:
        inserts = sum(1 for delta in self.chunk_deltas if delta.op == "insert")
        deletes = sum(1 for delta in self.chunk_deltas if delta.op == "delete")
        replaces = sum(1 for delta in self.chunk_deltas if delta.op == "replace")
        equals = sum(1 for delta in self.chunk_deltas if delta.op == "equal")
        return {
            "insert": inserts,
            "delete": deletes,
            "replace": replaces,
            "equal": equals,
        }

    def metrics(self) -> dict[str, float]:
        """Compute quantitative metrics for rendered diffs."""

        token_delta = 0
        non_ws_delta = 0
        ws_delta = 0
        for delta in self.chunk_deltas:
            if delta.op == "equal":
                continue
            if delta.op in {"delete", "replace"} and delta.before is not None:
                if isinstance(delta.before, TextChunk):
                    tokens = _tokenize(delta.before.text)
                    token_delta += len(tokens)
                    non_ws_delta += len(tokens)
                    ws_delta += _count_whitespace(delta.before.text)
                else:
                    token_delta += 1
                    non_ws_delta += 1
            if delta.op in {"insert", "replace"} and delta.after is not None:
                if isinstance(delta.after, TextChunk):
                    tokens = _tokenize(delta.after.text)
                    token_delta += len(tokens)
                    non_ws_delta += len(tokens)
                    ws_delta += _count_whitespace(delta.after.text)
                else:
                    token_delta += 1
                    non_ws_delta += 1

        before_signatures = _build_chunk_signature_set(self.before)
        after_signatures = _build_chunk_signature_set(self.after)
        union = before_signatures | after_signatures
        if union:
            intersection = before_signatures & after_signatures
            chunk_drift = 1.0 - (len(intersection) / len(union))
        else:
            chunk_drift = 0.0

        composite = 0.5 * non_ws_delta + 0.3 * ws_delta + 0.2 * chunk_drift
        return {
            "render_token_delta": token_delta,
            "render_non_ws_delta": non_ws_delta,
            "render_ws_delta": ws_delta,
            "render_chunk_drift": chunk_drift,
            "render_composite": composite,
        }

    def to_rich(self, width: int = 120) -> str:
        if not _HAS_RICH:  # pragma: no cover - executed when Rich is unavailable
            return self._fallback_string()

        console = Console(width=width, record=True, file=io.StringIO())
        table = Table("Operation", "Element", "Preview")
        for delta in self.chunk_deltas:
            if delta.op == "equal":
                continue
            element_id = _chunk_element(delta)
            preview = delta.after.text if delta.after else (delta.before.text if delta.before else "")
            table.add_row(delta.op, element_id or "", preview)
        console.print(table)
        totals = self.stats()
        console.print(
            f"insert={totals['insert']}, delete={totals['delete']}, "
            f"replace={totals['replace']}, equal={totals['equal']}"
        )
        return console.export_text(clear=False)

    def __str__(self) -> str:
        return self.to_rich()

    def _repr_html_(self) -> str:
        """Return HTML representation for Jupyter notebook display."""
        from .widgets import _render_widget_html

        data = self.to_widget_data()
        html = _render_widget_html(data, "tp-rendered-diff-mount")

        # Include CSS for now (will migrate to TypeScript styles later)
        return _DIFF_STYLE + html

    def _fallback_string(self) -> str:
        totals = self.stats()
        return (
            "RenderedPromptDiff: "
            f"insert={totals['insert']} delete={totals['delete']} replace={totals['replace']} equal={totals['equal']}"
        )


def diff_structured_prompts(before: StructuredPrompt, after: StructuredPrompt) -> StructuredPromptDiff:
    """Compute a structural diff between two StructuredPrompt trees."""

    root = _align_nodes(before, after)
    stats = DiffStats()
    _collect_stats(root, stats)
    return StructuredPromptDiff(before=before, after=after, root=root, stats=stats)


def diff_rendered_prompts(before: StructuredPrompt, after: StructuredPrompt) -> RenderedPromptDiff:
    """Compute a diff of the rendered intermediate representations."""

    before_chunks = before.ir().chunks
    after_chunks = after.ir().chunks
    before_signatures = _build_element_signature_map(before)
    after_signatures = _build_element_signature_map(after)
    deltas = _diff_chunks(before_chunks, after_chunks, before_signatures, after_signatures)
    per_element: dict[str, ElementRenderChange] = {}
    for delta in deltas:
        element_id = _chunk_element(delta)
        if not element_id:
            continue
        summary = per_element.setdefault(element_id, ElementRenderChange(element_id))
        if delta.op == "equal":
            summary.equals += 1
        elif delta.op == "insert":
            summary.inserts += 1
        elif delta.op == "delete":
            summary.deletes += 1
        elif delta.op == "replace":
            summary.replaces += 1
        added, removed = delta.text_delta()
        summary.text_added += added
        summary.text_removed += removed
    return RenderedPromptDiff(before=before, after=after, chunk_deltas=deltas, per_element=per_element)


# Internal helpers ------------------------------------------------------------------


def _status_style(status: DiffStatus) -> str:
    return {
        "equal": "green",
        "modified": "yellow",
        "inserted": "green",
        "deleted": "red",
        "moved": "cyan",
    }.get(status, "white")


def _collect_stats(delta: NodeDelta, stats: DiffStats) -> None:
    if delta.status == "inserted":
        stats.nodes_added += 1
    elif delta.status == "deleted":
        stats.nodes_removed += 1
    elif delta.status == "modified":
        stats.nodes_modified += 1
    elif delta.status == "moved":
        stats.nodes_moved += 1

    for edit in delta.text_edits:
        stats.text_added += edit.added_chars()
        stats.text_removed += edit.removed_chars()

    for child in delta.children:
        _collect_stats(child, stats)


def _align_nodes(before: Optional[Element], after: Optional[Element]) -> NodeDelta:
    if before is None and after is None:  # pragma: no cover - defensive guard
        raise ValueError("Cannot diff two empty nodes")

    if before is None:
        return NodeDelta(
            status="inserted",
            element_type=type(after).__name__,
            key=after.key,
            before_id=None,
            after_id=after.id,
            before_index=None,
            after_index=after.index,
        )

    if after is None:
        return NodeDelta(
            status="deleted",
            element_type=type(before).__name__,
            key=before.key,
            before_id=before.id,
            after_id=None,
            before_index=before.index,
            after_index=None,
        )

    if type(before) is not type(after):
        return NodeDelta(
            status="modified",
            element_type=f"{type(before).__name__}→{type(after).__name__}",
            key=after.key,
            before_id=before.id,
            after_id=after.id,
            before_index=before.index,
            after_index=after.index,
        )

    attr_changes = _compare_attributes(before, after)
    text_edits = _diff_text(before, after)
    child_pairs = _match_children(_iter_children(before), _iter_children(after))
    child_deltas = [_align_nodes(b, a) for b, a in child_pairs]

    status: DiffStatus = "equal"
    moved = before.index != after.index
    if moved:
        status = "moved"
    if attr_changes or text_edits:
        status = "modified"
    if any(child.status != "equal" for child in child_deltas):
        status = "modified" if status == "equal" else status

    return NodeDelta(
        status=status,
        element_type=type(after).__name__,
        key=after.key,
        before_id=before.id,
        after_id=after.id,
        before_index=before.index,
        after_index=after.index,
        attr_changes=attr_changes,
        text_edits=text_edits,
        children=child_deltas,
    )


def _compare_attributes(before: Element, after: Element) -> dict[str, tuple[Any, Any]]:
    fields = {"expression", "conversion", "format_spec", "render_hints"}
    if isinstance(before, ListInterpolation) and isinstance(after, ListInterpolation):
        fields.add("separator")
    if isinstance(before, (Static, TextInterpolation)) and isinstance(after, (Static, TextInterpolation)):
        # value handled separately for text diff
        pass
    elif isinstance(before, ImageInterpolation) and isinstance(after, ImageInterpolation):
        fields.add("value")

    changes: dict[str, tuple[Any, Any]] = {}
    for field_name in fields:
        before_value = getattr(before, field_name, None)
        after_value = getattr(after, field_name, None)
        if before_value != after_value:
            changes[field_name] = (before_value, after_value)
    return changes


def _diff_text(before: Element, after: Element) -> list[TextEdit]:
    if isinstance(before, Static) and isinstance(after, Static):
        return _diff_strings(before.value, after.value)
    if isinstance(before, TextInterpolation) and isinstance(after, TextInterpolation):
        return _diff_strings(before.value, after.value)
    return []


def _diff_strings(before: str, after: str) -> list[TextEdit]:
    if before == after:
        return []

    # Simple character-level diff using SequenceMatcher to keep implementation lightweight
    from difflib import SequenceMatcher

    matcher = SequenceMatcher(a=before, b=after, autojunk=False)
    edits: list[TextEdit] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        edits.append(TextEdit(tag, before[i1:i2], after[j1:j2]))
    return edits


def _iter_children(element: Element) -> Iterable[Element]:
    if isinstance(element, StructuredPrompt):
        return element.children
    if isinstance(element, ListInterpolation):
        return element.item_elements
    return ()


def _match_children(
    before_children: Iterable[Element], after_children: Iterable[Element]
) -> list[tuple[Optional[Element], Optional[Element]]]:
    before_list = list(before_children)
    after_list = list(after_children)

    lookup: dict[tuple[Any, type], list[tuple[int, Element]]] = {}
    for idx, child in enumerate(after_list):
        lookup.setdefault((child.key, type(child)), []).append((idx, child))

    used_after: set[int] = set()
    pairs: list[tuple[Optional[Element], Optional[Element]]] = []

    for before_child in before_list:
        bucket = lookup.get((before_child.key, type(before_child)))
        if bucket:
            idx, match = bucket.pop(0)
            used_after.add(idx)
            pairs.append((before_child, match))
        else:
            pairs.append((before_child, None))

    for idx, child in enumerate(after_list):
        if idx not in used_after:
            pairs.append((None, child))

    return pairs


def _diff_chunks(
    before: Iterable[TextChunk | ImageChunk],
    after: Iterable[TextChunk | ImageChunk],
    before_signatures: dict[str, tuple[str, ...]],
    after_signatures: dict[str, tuple[str, ...]],
) -> list[ChunkDelta]:
    from difflib import SequenceMatcher

    before_list = list(before)
    after_list = list(after)
    before_keys = [_chunk_signature(chunk, before_signatures) for chunk in before_list]
    after_keys = [_chunk_signature(chunk, after_signatures) for chunk in after_list]
    matcher = SequenceMatcher(a=before_keys, b=after_keys, autojunk=False)
    deltas: list[ChunkDelta] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            # Chunks matched by structure, but verify text equality
            for before_chunk, after_chunk in zip(before_list[i1:i2], after_list[j1:j2]):
                if before_chunk.text == after_chunk.text:
                    deltas.append(ChunkDelta("equal", before_chunk, after_chunk))
                else:
                    # Same structure, different text -> replace
                    deltas.append(ChunkDelta("replace", before_chunk, after_chunk))
            continue

        if tag == "replace":
            before_slice = before_list[i1:i2]
            after_slice = after_list[j1:j2]
            for before_chunk, after_chunk in zip_longest(before_slice, after_slice):
                if before_chunk is None:
                    deltas.append(ChunkDelta("insert", None, after_chunk))
                elif after_chunk is None:
                    deltas.append(ChunkDelta("delete", before_chunk, None))
                elif before_chunk.text == after_chunk.text:
                    # Different structure but same text -> still equal
                    deltas.append(ChunkDelta("equal", before_chunk, after_chunk))
                else:
                    deltas.append(ChunkDelta("replace", before_chunk, after_chunk))
            continue

        if tag == "delete":
            for chunk in before_list[i1:i2]:
                deltas.append(ChunkDelta("delete", chunk, None))
            continue

        if tag == "insert":
            for chunk in after_list[j1:j2]:
                deltas.append(ChunkDelta("insert", None, chunk))

    return deltas


def _chunk_element(delta: ChunkDelta) -> Optional[str]:
    if delta.after is not None:
        return delta.after.element_id
    if delta.before is not None:
        return delta.before.element_id
    return None


def _build_element_signature_map(prompt: StructuredPrompt) -> dict[str, tuple[str, ...]]:
    """
    Build a stable signature map for elements within a prompt.

    Chunk IDs change on clone, so we rely on structural paths composed of element type,
    key, and index to align identical content between prompts.
    """

    signatures: dict[str, tuple[str, ...]] = {}

    def visit(element: Element, path: tuple[str, ...]) -> None:
        key_repr = "<root>" if element.key is None else str(element.key)
        segment = f"{type(element).__name__}:{key_repr}:{element.index}"
        current_path = path + (segment,)
        signatures[element.id] = current_path
        for child in _iter_children(element):
            visit(child, current_path)

    visit(prompt, ())
    return signatures


def _chunk_signature(chunk: TextChunk | ImageChunk, signatures: dict[str, tuple[str, ...]]) -> tuple[Any, ...]:
    """
    Generate a signature for chunk matching based on structural position only.

    Text content is intentionally excluded so that chunks at the same structural
    position can be matched together, even if their text differs. Text equality
    is checked separately after matching.
    """
    path = signatures.get(chunk.element_id)
    return (type(chunk).__name__, path)


def _serialize_node_delta(delta: NodeDelta) -> dict[str, Any]:
    """Serialize NodeDelta to JSON-compatible dict."""
    return {
        "status": delta.status,
        "element_type": delta.element_type,
        "key": delta.key,
        "before_id": delta.before_id,
        "after_id": delta.after_id,
        "before_index": delta.before_index,
        "after_index": delta.after_index,
        "attr_changes": {k: list(v) for k, v in delta.attr_changes.items()},
        "text_edits": [
            {"op": edit.op, "before": edit.before, "after": edit.after} for edit in delta.text_edits
        ],
        "children": [_serialize_node_delta(child) for child in delta.children],
    }


def _gather_elements(prompt: StructuredPrompt) -> dict[str, Element]:
    elements: dict[str, Element] = {}
    stack: list[Element] = [prompt]
    while stack:
        element = stack.pop()
        elements[element.id] = element
        stack.extend(_iter_children(element))
    return elements


def _structured_edit_volume(
    node: NodeDelta,
    before_elements: dict[str, Element],
    after_elements: dict[str, Element],
) -> tuple[float, int]:
    total_weight = 0.0
    span_chars = 0

    def visit(current: NodeDelta, is_root: bool = False) -> None:
        nonlocal total_weight, span_chars
        if not is_root:
            total_weight += _node_edit_weight(current)
            span_chars += _node_span_chars(current, before_elements, after_elements)
        for child in current.children:
            visit(child)

    visit(node, True)
    return total_weight, span_chars


def _node_edit_weight(node: NodeDelta) -> float:
    if node.status in {"inserted", "deleted"}:
        return 1.0
    if node.status == "modified":
        attr_or_text = bool(node.attr_changes or node.text_edits)
        child_changes = any(child.status != "equal" for child in node.children)
        if attr_or_text:
            return 0.5 if not child_changes else 1.0
        return 0.0
    return 0.0


def _node_span_chars(
    node: NodeDelta,
    before_elements: dict[str, Element],
    after_elements: dict[str, Element],
) -> int:
    if node.status == "inserted" and node.after_id:
        return _element_text_payload(after_elements.get(node.after_id))
    if node.status == "deleted" and node.before_id:
        return _element_text_payload(before_elements.get(node.before_id))
    if node.status == "modified" and node.text_edits:
        return sum(
            max(len(edit.before), len(edit.after))
            for edit in node.text_edits
            if edit.op != "equal"
        )
    return 0


def _element_text_payload(element: Optional[Element]) -> int:
    if element is None:
        return 0
    if isinstance(element, Static):
        return len(element.value)
    if isinstance(element, TextInterpolation):
        return len(element.value)
    if isinstance(element, ListInterpolation) and element.separator:
        return len(element.separator) * max(len(element.item_elements) - 1, 0)
    return 0


def _total_rendered_chars(prompt: StructuredPrompt) -> int:
    ir = prompt.ir()
    return sum(len(chunk.text) for chunk in ir.chunks if isinstance(chunk, TextChunk))


def _collect_order_inversions(node: NodeDelta) -> tuple[int, int]:
    matched = [
        child
        for child in node.children
        if child.before_index is not None and child.after_index is not None
    ]
    inversions = 0
    pairs = 0
    if len(matched) > 1:
        ordered = sorted(matched, key=lambda child: child.before_index or 0)
        sequence = [child.after_index or 0 for child in ordered]
        inversions += _count_inversions(sequence)
        n = len(sequence)
        pairs += n * (n - 1) // 2
    for child in node.children:
        child_inversions, child_pairs = _collect_order_inversions(child)
        inversions += child_inversions
        pairs += child_pairs
    return inversions, pairs


def _count_inversions(sequence: list[int]) -> int:
    inversions = 0
    for idx, left in enumerate(sequence):
        for right in sequence[idx + 1 :]:
            if left > right:
                inversions += 1
    return inversions


_TOKEN_PATTERN = re.compile(r"\S+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_PATTERN.findall(text)


def _count_whitespace(text: str) -> int:
    return sum(1 for char in text if char.isspace())


def _build_chunk_signature_set(prompt: StructuredPrompt) -> set[tuple[Any, ...]]:
    signatures = _build_element_signature_map(prompt)
    ir = prompt.ir()
    return {_chunk_signature(chunk, signatures) for chunk in ir.chunks}
