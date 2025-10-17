"""Diff utilities for StructuredPrompt trees and rendered output."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterator, Optional, Sequence, Union

from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from .element import Element, ImageInterpolation, ListInterpolation, Static, TextInterpolation
from .ir import ImageChunk, IntermediateRepresentation, TextChunk
from .structured_prompt import StructuredPrompt


class NodeChange(str, Enum):
    """Possible change types for a node in the structured diff."""

    EQUAL = "equal"
    INSERT = "insert"
    DELETE = "delete"
    REPLACE = "replace"


class Movement(str, Enum):
    """Movement information for keyed nodes."""

    NONE = "none"
    MOVED = "moved"


@dataclass(slots=True)
class SequenceDiffOp:
    """Single operation in a text diff."""

    op: str
    before: str
    after: str


@dataclass(slots=True)
class SequenceDiff:
    """Container for Myers-style text diff operations."""

    operations: list[SequenceDiffOp]

    def has_changes(self) -> bool:
        """Return True when the diff contains any non-equal operation."""

        return any(op.op != "equal" for op in self.operations)


@dataclass(slots=True)
class NodeDelta:
    """Diff information for a single element in the prompt tree."""

    change_type: NodeChange
    element_type: str
    key: Union[str, int, None]
    before_id: Optional[str]
    after_id: Optional[str]
    before_path: tuple[Union[str, int], ...]
    after_path: tuple[Union[str, int], ...]
    attr_changes: dict[str, tuple[Any, Any]] = field(default_factory=dict)
    text_diff: Optional[SequenceDiff] = None
    children: list["NodeDelta"] = field(default_factory=list)
    movement: Movement = Movement.NONE
    children_reordered: bool = False

    def iter_descendants(self) -> Iterator["NodeDelta"]:
        """Yield this delta and all nested deltas."""

        yield self
        for child in self.children:
            yield from child.iter_descendants()

    # Rich integration -------------------------------------------------
    def _rich_label(self) -> str:
        label = f"{self.element_type}"
        if self.key is not None:
            label += f"[{self.key!r}]"
        if self.change_type != NodeChange.EQUAL:
            label += f" · {self.change_type.value.upper()}"
        if self.movement is Movement.MOVED:
            label += " · MOVED"
        if self.children_reordered:
            label += " · CHILDREN REORDERED"
        return label

    def _rich_node(self) -> Tree:
        style_map = {
            NodeChange.EQUAL: "white",
            NodeChange.INSERT: "green",
            NodeChange.DELETE: "red",
            NodeChange.REPLACE: "yellow",
        }
        tree = Tree(self._rich_label(), guide_style=style_map[self.change_type])
        if self.attr_changes:
            for name, (before, after) in self.attr_changes.items():
                tree.add(f"{name}: {before!r} → {after!r}")
        if self.text_diff and self.text_diff.has_changes():
            diff_tree = tree.add("text diff")
            for op in self.text_diff.operations:
                if op.op == "equal":
                    diff_tree.add(f"EQUAL {op.before!r}")
                elif op.op == "insert":
                    diff_tree.add(f"INSERT {op.after!r}", style="green")
                elif op.op == "delete":
                    diff_tree.add(f"DELETE {op.before!r}", style="red")
                else:
                    diff_tree.add(f"REPLACE {op.before!r} → {op.after!r}", style="yellow")
        for child in self.children:
            tree.add(child._rich_node())
        return tree

    def __rich__(self) -> Tree:
        return self._rich_node()


@dataclass(slots=True)
class DiffStats:
    """Aggregated statistics for a structured diff."""

    total_nodes: int
    changed_nodes: int
    insertions: int
    deletions: int
    replacements: int
    moves: int
    text_changes: int
    total_text_delta: int


@dataclass(slots=True)
class PromptDiff:
    """Diff result for two StructuredPrompt trees."""

    before: StructuredPrompt
    after: StructuredPrompt
    root: NodeDelta
    index: dict[str, NodeDelta]
    stats: DiffStats

    # Display helpers -------------------------------------------------
    def _rich_tree(self) -> Tree:
        return self.root._rich_node()

    def __rich__(self) -> Tree:
        return self._rich_tree()

    def __str__(self) -> str:
        console = Console(width=100)
        with console.capture() as capture:
            console.print(self._rich_tree())
        return capture.get()

    # HTML representation ---------------------------------------------
    def _repr_html_(self) -> str:
        from html import escape

        def render_node(delta: NodeDelta) -> str:
            classes = ["tp-diff-node", f"tp-diff-node--{delta.change_type.value}"]
            if delta.movement is Movement.MOVED:
                classes.append("tp-diff-node--moved")
            if delta.children_reordered:
                classes.append("tp-diff-node--reordered")

            attrs_html = ""
            if delta.attr_changes:
                change_items = "".join(
                    f"<li><code>{escape(name)}</code>: <span class=\"tp-diff-before\">{escape(repr(before))}</span>"
                    f" → <span class=\"tp-diff-after\">{escape(repr(after))}</span></li>"
                    for name, (before, after) in delta.attr_changes.items()
                )
                attrs_html = f"<ul class=\"tp-diff-attrs\">{change_items}</ul>"

            text_html = ""
            if delta.text_diff and delta.text_diff.has_changes():
                op_items = []
                for op in delta.text_diff.operations:
                    if op.op == "equal":
                        op_items.append(f"<li class=\"tp-diff-text-equal\">{escape(op.before)}</li>")
                    elif op.op == "insert":
                        op_items.append(
                            f"<li class=\"tp-diff-text-insert\"><span>+ {escape(op.after)}</span></li>"
                        )
                    elif op.op == "delete":
                        op_items.append(
                            f"<li class=\"tp-diff-text-delete\"><span>− {escape(op.before)}</span></li>"
                        )
                    else:
                        op_items.append(
                            f"<li class=\"tp-diff-text-replace\">{escape(op.before)} → {escape(op.after)}</li>"
                        )
                text_html = f"<ul class=\"tp-diff-text\">{''.join(op_items)}</ul>"

            children_html = "".join(render_node(child) for child in delta.children)

            key_display = escape(repr(delta.key)) if delta.key is not None else "∅"
            title = f"{escape(delta.element_type)} <span class=\"tp-diff-key\">{key_display}</span>"
            if delta.change_type != NodeChange.EQUAL:
                title += (
                    " <span class=\"tp-diff-chip tp-diff-chip--"
                    f"{delta.change_type.value}\">{delta.change_type.value}</span>"
                )
            if delta.movement is Movement.MOVED:
                title += " <span class=\"tp-diff-chip tp-diff-chip--moved\">moved</span>"
            if delta.children_reordered:
                title += " <span class=\"tp-diff-chip tp-diff-chip--reordered\">reordered</span>"

            return (
                f"<li class=\"{' '.join(classes)}\" data-change=\"{delta.change_type.value}\""
                f" data-element-type=\"{escape(delta.element_type)}\">"
                f"<div class=\"tp-diff-node-header\">{title}</div>"
                f"{attrs_html}{text_html}"
                f"<ul class=\"tp-diff-children\">{children_html}</ul>"
                "</li>"
            )

        body = render_node(self.root)
        style = _DIFF_STYLE
        return f"<div class=\"tp-diff\"><style>{style}</style><ul class=\"tp-diff-tree\">{body}</ul></div>"

    # Convenience API -------------------------------------------------
    def get(self, element_id: str) -> Optional[NodeDelta]:
        """Lookup a node delta by either before or after element ID."""

        return self.index.get(element_id)


@dataclass(slots=True)
class ChunkDelta:
    """Diff operation for rendered chunks."""

    op: str
    before: Optional[Union[TextChunk, ImageChunk]]
    after: Optional[Union[TextChunk, ImageChunk]]


@dataclass(slots=True)
class ElementRenderDelta:
    """Aggregated changes for a given element across all chunks."""

    element_id: str
    operations: dict[str, int] = field(default_factory=lambda: {"equal": 0, "insert": 0, "delete": 0, "replace": 0})
    before_text: str = ""
    after_text: str = ""

    def register(
        self,
        op: str,
        before: Optional[Union[TextChunk, ImageChunk]],
        after: Optional[Union[TextChunk, ImageChunk]],
    ) -> None:
        self.operations[op] = self.operations.get(op, 0) + 1
        if before is not None:
            self.before_text += getattr(before, "text", "")
        if after is not None:
            self.after_text += getattr(after, "text", "")

    @property
    def text_delta(self) -> int:
        return abs(len(self.after_text) - len(self.before_text))


@dataclass(slots=True)
class RenderDiff:
    """Diff result for rendered IntermediateRepresentations."""

    before: IntermediateRepresentation
    after: IntermediateRepresentation
    operations: list[ChunkDelta]
    element_summaries: dict[str, ElementRenderDelta]

    def __rich__(self) -> Table:
        table = Table(title="Rendered diff", show_lines=False)
        table.add_column("op")
        table.add_column("element")
        table.add_column("before")
        table.add_column("after")
        for delta in self.operations:
            before_text = getattr(delta.before, "text", "") if delta.before else ""
            after_text = getattr(delta.after, "text", "") if delta.after else ""
            element_id = ""
            if delta.after is not None:
                element_id = delta.after.element_id
            elif delta.before is not None:
                element_id = delta.before.element_id
            table.add_row(delta.op, element_id, before_text, after_text)
        return table

    def __str__(self) -> str:
        console = Console(width=100)
        with console.capture() as capture:
            console.print(self.__rich__())
        return capture.get()

    def _repr_html_(self) -> str:
        from html import escape

        rows = []
        for delta in self.operations:
            before_text = escape(getattr(delta.before, "text", "") if delta.before else "")
            after_text = escape(getattr(delta.after, "text", "") if delta.after else "")
            element_id = (
                escape(delta.after.element_id if delta.after else delta.before.element_id)  # type: ignore[union-attr]
                if (delta.after or delta.before)
                else ""
            )
            rows.append(
                f"<tr class=\"tp-render-diff-row tp-render-diff-row--{delta.op}\">"
                f"<td>{delta.op}</td><td>{element_id}</td><td>{before_text}</td><td>{after_text}</td></tr>"
            )

        table_html = "".join(rows)
        style = _DIFF_STYLE
        return (
            "<div class=\"tp-render-diff\">"
            f"<style>{style}</style>"
            "<table class=\"tp-render-diff-table\">"
            "<thead><tr><th>op</th><th>element</th><th>before</th><th>after</th></tr></thead>"
            f"<tbody>{table_html}</tbody>"
            "</table>"
            "</div>"
        )


def diff_structured_prompts(before: StructuredPrompt, after: StructuredPrompt) -> PromptDiff:
    """Compute a hierarchical diff between two StructuredPrompts."""

    root = _align_nodes(before, after, (), ())
    index: dict[str, NodeDelta] = {}
    for delta in root.iter_descendants():
        if delta.before_id:
            index.setdefault(delta.before_id, delta)
        if delta.after_id:
            index.setdefault(delta.after_id, delta)
    stats = _summarize_stats(root)
    return PromptDiff(before=before, after=after, root=root, index=index, stats=stats)


def diff_rendered_prompts(before: StructuredPrompt, after: StructuredPrompt) -> RenderDiff:
    """Diff the rendered output of two prompts using their intermediate representations."""

    before_ir = before.ir()
    after_ir = after.ir()
    operations = _diff_chunks(before_ir.chunks, after_ir.chunks)
    summaries: dict[str, ElementRenderDelta] = {}
    for delta in operations:
        element_id = (
            delta.after.element_id
            if delta.after is not None
            else delta.before.element_id  # type: ignore[union-attr]
            if delta.before is not None
            else None
        )
        if element_id is None:
            continue
        summary = summaries.setdefault(element_id, ElementRenderDelta(element_id=element_id))
        summary.register(delta.op, delta.before, delta.after)
    return RenderDiff(before=before_ir, after=after_ir, operations=operations, element_summaries=summaries)


# ---------------------------------------------------------------------------
# Internal helpers


def _align_nodes(
    before: Optional[Element],
    after: Optional[Element],
    before_path: tuple[Union[str, int], ...],
    after_path: tuple[Union[str, int], ...],
) -> NodeDelta:
    if before is None and after is None:
        raise ValueError("_align_nodes requires at least one element")

    if before is None:
        delta = NodeDelta(
            change_type=NodeChange.INSERT,
            element_type=type(after).__name__,
            key=after.key,
            before_id=None,
            after_id=after.id,
            before_path=before_path,
            after_path=after_path,
        )
        delta.children = [
            _align_nodes(None, child, before_path, after_path + (child.key,))
            for child in _iter_children(after)
        ]
        return delta

    if after is None:
        delta = NodeDelta(
            change_type=NodeChange.DELETE,
            element_type=type(before).__name__,
            key=before.key,
            before_id=before.id,
            after_id=None,
            before_path=before_path,
            after_path=after_path,
        )
        delta.children = [
            _align_nodes(child, None, before_path + (child.key,), after_path)
            for child in _iter_children(before)
        ]
        return delta

    change = NodeChange.EQUAL
    if type(before) is not type(after):
        change = NodeChange.REPLACE

    delta = NodeDelta(
        change_type=change,
        element_type=type(after).__name__,
        key=after.key,
        before_id=before.id,
        after_id=after.id,
        before_path=before_path,
        after_path=after_path,
    )

    attr_changes = _compare_attributes(before, after)
    if attr_changes:
        delta.attr_changes = attr_changes
        delta.change_type = NodeChange.REPLACE

    text_diff = _text_diff_for_elements(before, after)
    if text_diff and text_diff.has_changes():
        delta.text_diff = text_diff
        delta.change_type = NodeChange.REPLACE

    child_pairs = _match_children(before, after)
    for before_child, after_child, movement in child_pairs:
        child_before_path = (
            before_path + ((before_child.key,) if before_child.key is not None else ())
            if before_child is not None
            else before_path
        )
        child_after_path = (
            after_path + ((after_child.key,) if after_child.key is not None else ())
            if after_child is not None
            else after_path
        )
        child_delta = _align_nodes(before_child, after_child, child_before_path, child_after_path)
        if movement is Movement.MOVED and child_delta.change_type is NodeChange.EQUAL:
            child_delta.change_type = NodeChange.REPLACE
        child_delta.movement = movement
        delta.children.append(child_delta)

    if any(child.movement is Movement.MOVED for child in delta.children):
        delta.children_reordered = True

    if delta.change_type is NodeChange.EQUAL:
        if any(child.change_type is not NodeChange.EQUAL for child in delta.children):
            delta.change_type = NodeChange.REPLACE

    return delta


def _iter_children(element: Element) -> list[Element]:
    if isinstance(element, StructuredPrompt):
        return list(element.children)
    if isinstance(element, ListInterpolation):
        return list(element.item_elements)
    return []


def _compare_attributes(before: Element, after: Element) -> dict[str, tuple[Any, Any]]:
    relevant = ["expression", "conversion", "format_spec", "render_hints"]
    if isinstance(before, ListInterpolation) and isinstance(after, ListInterpolation):
        relevant.append("separator")
    if isinstance(before, ImageInterpolation) and isinstance(after, ImageInterpolation):
        relevant.append("image")

    changes: dict[str, tuple[Any, Any]] = {}
    for attr in relevant:
        before_val = getattr(before, attr, None)
        after_val = getattr(after, attr, None)
        if before_val != after_val:
            changes[attr] = (before_val, after_val)
    return changes


def _text_diff_for_elements(before: Element, after: Element) -> Optional[SequenceDiff]:
    before_text = _text_payload(before)
    after_text = _text_payload(after)
    if before_text is None and after_text is None:
        return None
    if before_text == after_text:
        return SequenceDiff([SequenceDiffOp("equal", before_text or "", after_text or "")])
    return _diff_text(before_text or "", after_text or "")


def _text_payload(element: Element) -> Optional[str]:
    if isinstance(element, (Static, TextInterpolation)):
        return element.value
    return None


def _diff_text(before: str, after: str) -> SequenceDiff:
    import difflib

    matcher = difflib.SequenceMatcher(a=before, b=after)
    ops: list[SequenceDiffOp] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        ops.append(SequenceDiffOp(tag, before[i1:i2], after[j1:j2]))
    return SequenceDiff(ops)


def _match_children(before: Element, after: Element) -> list[tuple[Optional[Element], Optional[Element], Movement]]:
    before_children = _iter_children(before)
    after_children = _iter_children(after)
    before_positions = {child.id: idx for idx, child in enumerate(before_children)}
    matches: list[tuple[Optional[Element], Optional[Element], Movement]] = []
    unmatched_before = before_children.copy()

    for after_child in after_children:
        match_index = None
        for idx, candidate in enumerate(unmatched_before):
            if candidate is None:
                continue
            if _keys_match(candidate, after_child) and type(candidate) is type(after_child):
                match_index = idx
                break
        if match_index is None:
            matches.append((None, after_child, Movement.NONE))
        else:
            before_child = unmatched_before.pop(match_index)
            movement = Movement.NONE
            if (
                isinstance(before_child.key, str)
                and before_child.id in before_positions
            ):
                old_pos = before_positions[before_child.id]
                new_pos = len(matches)
                if old_pos != new_pos:
                    movement = Movement.MOVED
            matches.append((before_child, after_child, movement))

    for remaining in unmatched_before:
        matches.append((remaining, None, Movement.NONE))

    return matches


def _keys_match(before: Element, after: Element) -> bool:
    if before.key is None or after.key is None:
        return False
    return before.key == after.key


def _summarize_stats(root: NodeDelta) -> DiffStats:
    total_nodes = 0
    changed_nodes = 0
    insertions = 0
    deletions = 0
    replacements = 0
    moves = 0
    text_changes = 0
    total_text_delta = 0

    for delta in root.iter_descendants():
        total_nodes += 1
        if delta.change_type != NodeChange.EQUAL:
            changed_nodes += 1
        if delta.change_type is NodeChange.INSERT:
            insertions += 1
        elif delta.change_type is NodeChange.DELETE:
            deletions += 1
        elif delta.change_type is NodeChange.REPLACE:
            replacements += 1
        if delta.movement is Movement.MOVED:
            moves += 1
        if delta.text_diff and delta.text_diff.has_changes():
            text_changes += 1
            total_text_delta += sum(
                len(op.after) + len(op.before)
                for op in delta.text_diff.operations
                if op.op != "equal"
            )

    return DiffStats(
        total_nodes=total_nodes,
        changed_nodes=changed_nodes,
        insertions=insertions,
        deletions=deletions,
        replacements=replacements,
        moves=moves,
        text_changes=text_changes,
        total_text_delta=total_text_delta,
    )


def _diff_chunks(
    before: Sequence[Union[TextChunk, ImageChunk]], after: Sequence[Union[TextChunk, ImageChunk]]
) -> list[ChunkDelta]:
    import difflib

    before_tokens = [(chunk.element_id, getattr(chunk, "text", "")) for chunk in before]
    after_tokens = [(chunk.element_id, getattr(chunk, "text", "")) for chunk in after]
    matcher = difflib.SequenceMatcher(a=before_tokens, b=after_tokens)
    deltas: list[ChunkDelta] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                deltas.append(ChunkDelta("equal", before[i1 + offset], after[j1 + offset]))
        elif tag == "delete":
            for offset in range(i2 - i1):
                deltas.append(ChunkDelta("delete", before[i1 + offset], None))
        elif tag == "insert":
            for offset in range(j2 - j1):
                deltas.append(ChunkDelta("insert", None, after[j1 + offset]))
        else:  # replace
            length = min(i2 - i1, j2 - j1)
            for offset in range(length):
                deltas.append(ChunkDelta("replace", before[i1 + offset], after[j1 + offset]))
            # Handle extra deletes or inserts if lengths differ
            for offset in range(length, i2 - i1):
                deltas.append(ChunkDelta("delete", before[i1 + offset], None))
            for offset in range(length, j2 - j1):
                deltas.append(ChunkDelta("insert", None, after[j1 + offset]))

    return deltas


_DIFF_STYLE = """
:root {
  --tp-color-bg: #ffffff;
  --tp-color-border: #d0d7de;
  --tp-color-fg: #24292e;
  --tp-color-muted: #57606a;
  --tp-color-insert: #116329;
  --tp-color-delete: #cf222e;
  --tp-color-replace: #9a6700;
  --tp-surface: #f6f8fa;
  --tp-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --tp-font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.tp-diff, .tp-render-diff {
  font-family: var(--tp-font-family);
  font-size: 14px;
  color: var(--tp-color-fg);
  background: var(--tp-surface);
  border: 1px solid var(--tp-color-border);
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
}

.tp-diff-tree {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.tp-diff-node {
  border-left: 3px solid transparent;
  padding-left: 8px;
  margin-bottom: 8px;
}

.tp-diff-node:last-child {
  margin-bottom: 0;
}

.tp-diff-node--insert {
  border-color: var(--tp-color-insert);
}

.tp-diff-node--delete {
  border-color: var(--tp-color-delete);
}

.tp-diff-node--replace {
  border-color: var(--tp-color-replace);
}

.tp-diff-node-header {
  font-weight: 600;
  margin-bottom: 4px;
}

.tp-diff-chip {
  display: inline-block;
  padding: 0 6px;
  font-size: 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  margin-left: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tp-diff-chip--insert {
  background: rgba(17, 99, 41, 0.12);
  color: var(--tp-color-insert);
}

.tp-diff-chip--delete {
  background: rgba(207, 34, 46, 0.12);
  color: var(--tp-color-delete);
}

.tp-diff-chip--replace {
  background: rgba(154, 103, 0, 0.12);
  color: var(--tp-color-replace);
}

.tp-diff-chip--moved,
.tp-diff-chip--reordered {
  background: rgba(45, 51, 59, 0.12);
  color: var(--tp-color-muted);
}

.tp-diff-attrs,
.tp-diff-text,
.tp-diff-children {
  list-style: none;
  padding-left: 16px;
  margin: 4px 0;
}

.tp-diff-text-insert span {
  color: var(--tp-color-insert);
}

.tp-diff-text-delete span {
  color: var(--tp-color-delete);
}

.tp-render-diff-table {
  width: 100%;
  border-collapse: collapse;
}

.tp-render-diff-table th,
.tp-render-diff-table td {
  border: 1px solid var(--tp-color-border);
  padding: 4px 8px;
  text-align: left;
}

.tp-render-diff-row--insert td {
  background: rgba(17, 99, 41, 0.08);
}

.tp-render-diff-row--delete td {
  background: rgba(207, 34, 46, 0.08);
}

.tp-render-diff-row--replace td {
  background: rgba(154, 103, 0, 0.08);
}
"""

