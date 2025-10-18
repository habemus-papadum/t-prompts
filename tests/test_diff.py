"""Tests for diff utilities."""

from __future__ import annotations

import json

import pytest

from t_prompts import diff_rendered_prompts, diff_structured_prompts, prompt


def test_structured_prompt_diff_detects_text_changes():
    """Leaf edits should surface in stats and node deltas."""

    task = "translate"
    before = prompt(t"Task: {task:t}")
    after = prompt(t"Task: {task:t}!\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.text_added > 0
    assert diff.stats.nodes_modified >= 1

    static = next(
        (child for child in diff.root.children if child.element_type.startswith("Static") and child.status != "equal"),
        None,
    )
    assert static is not None
    assert static.status == "modified"
    assert any(edit.op in {"insert", "replace"} for edit in static.text_edits)

    html = diff._repr_html_()
    assert "tp-sp-diff-mount" in html
    assert "data-tp-widget" in html
    assert '"diff_type": "structured"' in html

    rich = diff.to_rich()
    assert "StructuredPrompt" in rich
    assert "added=" in rich


def test_structured_prompt_diff_detects_structure_changes():
    """Inserted nodes should be identified with appropriate status values."""

    intro = prompt(t"Overview")
    before = prompt(t"Intro: {intro:i}\n")

    intro = prompt(t"Overview")
    details = prompt(t"Details section")
    after = prompt(t"Intro: {intro:i}\nDetails: {details:d}\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.nodes_added >= 1
    statuses = {child.status for child in diff.root.children}
    assert "inserted" in statuses or "modified" in statuses


def test_structured_prompt_diff_handles_nested_prompts_and_lists():
    """Changes within nested prompts and list items are tracked."""

    intro = prompt(t"Overview")
    items = [prompt(t"- Step one"), prompt(t"- Step two")]
    before = prompt(t"Intro: {intro:i}\nItems:\n{items:list}\n")

    intro = prompt(t"Overview")
    items_updated = [prompt(t"- Step one"), prompt(t"- Step two"), prompt(t"- Bonus step")]
    after = prompt(t"Intro: {intro:i}\nItems:\n{items_updated:list}\n")

    diff = diff_structured_prompts(before, after)

    assert diff.stats.nodes_added >= 1
    assert any(node.status in {"inserted", "modified"} for node in diff.root.children)


def test_rendered_diff_tracks_chunk_operations():
    """Rendered diff should count chunk-level insertions and replacements."""

    name = "Ada"
    before = prompt(t"Hello {name:user}\n")
    after = prompt(t"Hello there {name:user}!\n")

    diff = diff_rendered_prompts(before, after)

    stats = diff.stats()
    assert stats["insert"] >= 1 or stats["replace"] >= 1
    assert diff.per_element

    html = diff._repr_html_()
    assert "tp-rendered-diff-mount" in html
    assert "data-tp-widget" in html
    assert '"diff_type": "rendered"' in html

    rich = diff.to_rich()
    assert "insert=" in rich


def test_diff_objects_are_json_serializable_roundtrip():
    """Stats payloads can be serialized for downstream analytics."""

    value = "alpha"
    before = prompt(t"Value: {value:v}")
    after = prompt(t"Value: {value:v}!\n")

    structured = diff_structured_prompts(before, after)
    rendered = diff_rendered_prompts(before, after)

    from dataclasses import asdict

    payload = {
        "structured": asdict(structured.stats),
        "rendered": {k: asdict(v) for k, v in rendered.per_element.items()},
    }
    json.dumps(payload)


def _case_simple_same():
    before = prompt(t"Simple text")
    after = prompt(t"Simple text")
    return before, after


def _case_prepend_newline():
    value = "x"
    before = prompt(t"Prelude {value:v}")
    value = "x"
    after = prompt(t"Prelude {value:v}\n")
    return before, after


def _case_nested_change():
    nested = prompt(t"Inner block")
    before = prompt(t"Header {nested:n}")
    nested = prompt(t"Inner block")
    after = prompt(t"Header {nested:n}!")
    return before, after


@pytest.mark.parametrize(
    "builder",
    [_case_simple_same, _case_prepend_newline, _case_nested_change],
)
def test_structured_prompt_diff_handles_various_sizes(builder):
    """Smoke test prompts of different complexity levels."""

    before, after = builder()

    diff = diff_structured_prompts(before, after)
    assert diff.root is not None
    assert isinstance(diff.stats.nodes_added, int)
