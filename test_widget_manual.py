#!/usr/bin/env python3
"""Manual test script to verify widget rendering."""

from t_prompts import prompt

# Test 1: Simple prompt
print("=" * 80)
print("Test 1: Simple prompt")
print("=" * 80)
task = "translate"
p1 = prompt(t"Task: {task:t}")
html1 = p1._repr_html_()
print(f"HTML length: {len(html1):,} bytes")
print(f"Contains bundle: {'tp-widget-bundle' in html1}")
print(f"Contains widget container: {'tp-widget-root' in html1}")
print(f"Contains JSON data: {'tp-widget-data' in html1}")
print()

# Test 2: Second prompt (should not re-inject bundle)
print("=" * 80)
print("Test 2: Second prompt (singleton pattern)")
print("=" * 80)
instruction = "Be concise"
p2 = prompt(t"Instruction: {instruction:i}")
html2 = p2._repr_html_()
print(f"HTML length: {len(html2):,} bytes")
print(f"Contains bundle: {'tp-widget-bundle' in html2}")
print(f"Contains widget container: {'tp-widget-root' in html2}")
print(f"Size reduction: {len(html1) - len(html2):,} bytes")
print()

# Test 3: Nested prompt
print("=" * 80)
print("Test 3: Nested prompt")
print("=" * 80)
inner = prompt(t"Inner text")
outer = prompt(t"Outer: {inner:i}")
html3 = outer._repr_html_()
print(f"HTML length: {len(html3):,} bytes")
print(f"Contains nested_prompt in JSON: {'nested_prompt' in html3}")
print()

# Test 4: IntermediateRepresentation
print("=" * 80)
print("Test 4: IntermediateRepresentation")
print("=" * 80)
name = "Alice"
p4 = prompt(t"Name: {name:n}")
ir = p4.render()
html4 = ir._repr_html_()
print(f"HTML length: {len(html4):,} bytes")
print(f"Contains ir_id: {'ir_id' in html4}")
print(f"Contains chunks: {'chunks' in html4}")
print(f"Contains source_map: {'source_map' in html4}")
print()

print("✓ All manual tests completed successfully!")
print()
print("To test in Jupyter, run:")
print("  uv run jupyter notebook docs/demos/widget-test.ipynb")
