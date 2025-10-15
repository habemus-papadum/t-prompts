# Use Cases

`t-prompts` is designed for building robust LLM applications where understanding and controlling prompt structure matters. Here are the key use cases where it excels.

## Traceability

**Problem**: In complex LLM applications, it's hard to know which variable produced which part of the final prompt, especially when debugging unexpected behavior.

**Solution**: `t-prompts` preserves the original expression text for every interpolation, giving you complete traceability.

```python
from t_prompts import prompt

# Build a complex prompt
user_name = "Alice"
user_role = "admin"
task = "review access logs"

p = prompt(t"""
User: {user_name:name}
Role: {user_role:role}
Task: {task:t}
""", dedent=True)

# Later, when debugging, you can trace back
print(p['name'].expression)  # "user_name"
print(p['name'].value)       # "Alice"
print(p['role'].expression)  # "user_role"
print(p['t'].expression)     # "task"

# Export complete structure for logging
data = p.toJSON()
# Contains expression, value, format_spec, and source location for each element
```

**Real-world scenario**: When an LLM produces unexpected output, you can inspect the metadata to see exactly which variables were interpolated and their values, making debugging much faster.

## Structured Access

**Problem**: Prompt templates often need to be inspected, validated, or modified programmatically, but f-strings become opaque strings immediately.

**Solution**: `t-prompts` provides dict-like access to all interpolations, letting you navigate and inspect prompt structure.

```python
from t_prompts import prompt

# Build a conversation
system_msg = "You are a helpful assistant."
user_msg = "What is Python?"

conversation = prompt(t"""
{system_msg:system}

User: {user_msg:user}
""", dedent=True)

# Access specific parts programmatically
assert conversation['system'].value == "You are a helpful assistant."
assert conversation['user'].value == "What is Python?"

# Validate that required keys are present
required_keys = ['system', 'user']
for key in required_keys:
    assert key in conversation, f"Missing required key: {key}"

# Inspect all keys
print(list(conversation.keys()))  # ['system', 'user']
```

**Real-world scenario**: Building a prompt template validator that ensures all required placeholders are filled before sending to an LLM.

## Composability

**Problem**: Large prompts are hard to maintain as monolithic strings. You want to build them from smaller, reusable components.

**Solution**: `t-prompts` lets you compose prompts from other prompts, creating a tree structure that can be navigated and inspected.

```python
from t_prompts import prompt

# Define reusable components
def create_system_prompt(role):
    return prompt(t"You are a {role:role}.")

def create_user_message(task):
    return prompt(t"Task: {task:t}")

def create_context(facts):
    # facts is a list of strings
    fact_prompts = [prompt(t"- {fact:f}") for fact in facts]
    return prompt(t"Context:\n{fact_prompts:facts}")

# Compose into a complete prompt
system = create_system_prompt("Python expert")
user = create_user_message("Explain decorators")
context = create_context(["Decorators modify functions", "Use @ syntax"])

full_prompt = prompt(t"""
{system:sys}

{context:ctx}

{user:usr}
""", dedent=True)

# Navigate the nested structure
print(full_prompt['sys']['role'].value)  # "Python expert"
print(full_prompt['usr']['t'].value)     # "Explain decorators"
print(len(full_prompt['ctx']['facts']))  # 2 (list of facts)
```

**Real-world scenario**: Building a library of prompt templates that can be mixed and matched for different LLM tasks, with each component maintainable independently.

## Auditability

**Problem**: For compliance, security, or debugging, you need complete records of what prompts were sent to LLMs, including where each part came from.

**Solution**: `t-prompts` provides `toJSON()` for full audit trails and optional source location tracking.

```python
from t_prompts import prompt
import json

# Create a prompt with source location tracking (enabled by default)
sensitive_data = "Patient ID: 12345"
instruction = "Summarize medical records"

p = prompt(t"""
{instruction:inst}
{sensitive_data:data}
""", dedent=True)

# Export complete structure for audit log
audit_record = {
    "prompt_id": "req_789",
    "timestamp": "2024-10-14T12:00:00Z",
    "structure": p.toJSON()
}

# structure includes:
# - expression: original variable name
# - value: interpolated value
# - format_spec: any formatting applied
# - source_location: filename, line number where prompt was created
# - render_hints: any rendering transformations

with open("audit_log.json", "w") as f:
    json.dump(audit_record, f, indent=2)

# Later, reconstruct exactly what was sent and where it came from
structure = audit_record["structure"]
for child in structure["children"]:
    if child["type"] in ["interpolation", "text", "nested_prompt"]:
        loc = child.get("source_location", {})
        print(f"Variable '{child.get('expression', 'N/A')}' from {loc.get('filename', 'unknown')}:{loc.get('line', '?')}")
        print(f"  Value: {child.get('value', 'N/A')}")
```

**Real-world scenario**: Healthcare or financial applications where you need to log exactly what data was sent to an LLM for compliance audits.

## Type Safety

**Problem**: With f-strings, it's easy to accidentally interpolate objects that get stringified in unexpected ways (e.g., `str([1,2,3])` becomes `"[1, 2, 3]"`).

**Solution**: `t-prompts` only accepts strings, nested prompts, or lists of prompts. Anything else raises an error at prompt creation time.

```python
from t_prompts import prompt

# Safe: string values
name = "Alice"
p1 = prompt(t"Hello {name:n}")  # ✓ Works

# Safe: nested prompts
greeting = prompt(t"Hello {name:n}")
p2 = prompt(t"{greeting:g}, how are you?")  # ✓ Works

# Safe: lists of prompts
items = [prompt(t"{x:x}") for x in ["a", "b", "c"]]
p3 = prompt(t"Items: {items:items}")  # ✓ Works

# Unsafe: other types raise UnsupportedValueTypeError
user_obj = {"name": "Alice", "age": 30}
try:
    p4 = prompt(t"User: {user_obj:user}")  # ✗ Raises error
except Exception as e:
    print(f"Caught: {type(e).__name__}")  # UnsupportedValueTypeError
```

**Real-world scenario**: Preventing bugs where complex objects get stringified incorrectly, ensuring all prompt values are explicit strings or structured prompts.

## Optimization and Token Counting

**Problem**: LLM context limits require careful prompt management. You need to know which parts of your prompt are consuming tokens and selectively remove content.

**Solution**: Source mapping lets you identify and extract specific parts of the rendered prompt for token counting or removal.

```python
from t_prompts import prompt

# Build a prompt with optional sections
system = prompt(t"You are a helpful assistant.")
examples = [
    prompt(t"Q: {q:q}\nA: {a:a}")
    for q, a in [
        ("What is 2+2?", "4"),
        ("What is Python?", "A programming language"),
        ("What is AI?", "Artificial Intelligence")
    ]
]
task = prompt(t"Now answer: {query:query}")

full_prompt = prompt(t"""
{system:sys}

Examples:
{examples:ex}

{task:t}
""", dedent=True)

rendered = full_prompt.render()

# Count tokens for different parts (using a hypothetical tokenizer)
def count_tokens(text):
    return len(text.split())  # Simplified

# Get spans for examples
example_spans = rendered.get_spans_for_prompt(full_prompt['ex'])
example_text = "".join(rendered.text[s.start:s.end] for s in example_spans)
example_tokens = count_tokens(example_text)

print(f"Examples use {example_tokens} tokens")

# If over budget, remove some examples and rebuild
if example_tokens > 50:  # hypothetical limit
    reduced_examples = examples[:2]  # Keep only first 2
    full_prompt = prompt(t"""
{system:sys}

Examples:
{reduced_examples:ex}

{task:t}
""", dedent=True)
```

**Real-world scenario**: Building a prompt optimizer that fits within context limits by selectively removing examples or optional sections while preserving the core prompt structure.

## Next Steps

- [Features](features.md) - Detailed feature documentation
- [Quick Start](quick-start.md) - Learn the basics
- [Tutorials](demos/01-basic.ipynb) - Interactive guides
