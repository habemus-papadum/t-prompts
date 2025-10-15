# Widget Styling: Design Philosophy

This document describes the design thinking and technical architecture behind the widget's semantic color system.

## Design Philosophy: Elegant Semantic Color

### Core Principles

**1. Color as Information Architecture**

Color serves a functional purpose: each element type gets a distinct hue family that helps users understand the structure of their prompts at a glance. The combination of foreground and background colors creates visual "zones" that establish hierarchy without overwhelming the content.

**2. The "Whisper" Aesthetic**

The styling follows a principle of subtlety:
- Low saturation, low alpha
- Sufficient to distinguish element types, not enough to dominate the content
- Like looking through colored glass, not at colored paint
- Text remains the primary focus, colors provide secondary structure

**3. Semantic Color Mapping**

Element types are mapped to colors based on their **conceptual function**, aligned with decades of code editor conventions:

| Element Type | Hue Family | Rationale |
|--------------|------------|-----------|
| **Static** | Gray/Neutral | Foundation, unchanging text, the "canvas" |
| **Interpolation** | Blue | Dynamic data (universal convention: variables = blue) |
| **Nested Prompt** | Purple/Indigo | Compositional structure, hierarchy, depth |
| **List** | Green/Teal | Collections, enumeration, growth |
| **Image** | Orange/Amber | Media, visual content, "warm" data |
| **Unknown** | Red/Warning | Edge cases that need attention |

This color language is immediately familiar to developers and aligns with cognitive associations (blue = data, green = collections, purple = nesting).

**4. Contrast Strategy for Readability**

Different contrast approaches for each mode:

**Light Mode:**
- Darker foreground (Lightness: 25-35%)
- Lighter background (Lightness: 95-98% with alpha 0.08-0.12)
- Lower alpha because light backgrounds show through easily

**Dark Mode:**
- Lighter foreground (Lightness: 70-85%)
- Darker background (Lightness: 20-30% with alpha 0.15-0.25)
- Higher alpha because darker backgrounds need more opacity to be visible

**5. Visual Weight**

Background tinting creates a sense of "mass" that indicates structural complexity:
- Static text: Minimal background (nearly transparent)
- Interpolations: Subtle tint
- Nested prompts: Slightly stronger (they're containers)
- Lists: Medium tint (they're collections)

This creates a gentle visual "weight map" showing which parts of the prompt have more semantic structure.

---

## CSS Architecture: Three-Tier Variable System

The styling uses a hierarchical variable system that separates concerns and enables easy customization.

### Tier 1: Palette Primitives

Raw HSL hue values (0-360). We use HSL because it's semantic and intuitive:
- **H** (Hue): The color family
- **S** (Saturation): How vivid the color is
- **L** (Lightness): How bright the color is

```css
:root {
  --tp-hue-static: 220;         /* Neutral blue-gray */
  --tp-hue-interpolation: 212;  /* Blue */
  --tp-hue-nested: 270;         /* Purple */
  --tp-hue-list: 160;           /* Teal */
  --tp-hue-image: 30;           /* Orange */
  --tp-hue-unknown: 0;          /* Red */
}
```

**Why separate hue variables?** Changing a single hue value shifts all related colors (foreground, background, borders) in harmony.

### Tier 2: Semantic Tokens

Mode-aware, purpose-based variables for saturation, lightness, and alpha:

```css
:root {
  /* Light mode defaults */
  --tp-static-fg-s: 15%;
  --tp-static-fg-l: 30%;
  --tp-static-bg-alpha: 0.04;

  --tp-interp-fg-s: 80%;
  --tp-interp-fg-l: 35%;
  --tp-interp-bg-alpha: 0.10;

  /* ... etc for each element type */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode overrides */
    --tp-static-fg-l: 75%;
    --tp-static-bg-alpha: 0.08;

    --tp-interp-fg-l: 75%;
    --tp-interp-bg-alpha: 0.18;

    /* ... etc */
  }
}
```

**Why semantic tokens?** You can adjust brightness for all elements in light/dark mode without touching individual classes.

### Tier 3: Applied Styles

Classes that compose the tokens into actual CSS properties:

```css
.tp-chunk-interpolation {
  color: hsl(
    var(--tp-hue-interpolation),
    var(--tp-interp-fg-s),
    var(--tp-interp-fg-l)
  );
  background: hsla(
    var(--tp-hue-interpolation),
    80%,
    60%,
    var(--tp-interp-bg-alpha)
  );
}
```

**Why applied styles?** The actual visual properties stay in standard CSS classes, making debugging and overrides straightforward.

---

## Benefits of This Architecture

1. **Easy Experimentation**
   - Change `--tp-hue-interpolation: 212` to `210` and all blue elements shift together
   - Adjust `--tp-interp-bg-alpha` to make backgrounds more/less visible

2. **Mode Switching**
   - Just redefine lightness and alpha values in dark mode
   - Hues and relationships stay consistent

3. **Granular Control**
   - Can adjust saturation for all foregrounds globally
   - Or tweak just one element type
   - Or even just light mode vs dark mode

4. **Consistent Relationships**
   - Backgrounds always derive from foreground hue
   - Maintains color harmony automatically

5. **Developer-Friendly**
   - Clear naming convention
   - Organized by tier and purpose
   - Self-documenting variable names

---

## Customization Guide

Want to tweak the colors? Here's where to look:

### Change a Color Family
```css
--tp-hue-interpolation: 212;  /* Change to 200 for more cyan, 230 for more indigo */
```

### Make Foregrounds Bolder
```css
--tp-interp-fg-s: 80%;  /* Increase to 95% for more vivid colors */
```

### Make Backgrounds More Visible
```css
--tp-interp-bg-alpha: 0.10;  /* Increase to 0.15 or 0.20 */
```

### Adjust Light/Dark Balance
```css
@media (prefers-color-scheme: dark) {
  --tp-interp-fg-l: 75%;  /* Increase to 85% for brighter text */
}
```

### Add a New Element Type
1. Add a hue primitive: `--tp-hue-mynew: 150;`
2. Add semantic tokens: `--tp-mynew-fg-s`, `--tp-mynew-fg-l`, `--tp-mynew-bg-alpha`
3. Add dark mode overrides
4. Apply to class: `.tp-chunk-mynew { color: hsl(...); background: hsla(...); }`

---

## Design Rationale: Why These Specific Colors?

**Static (Gray-Blue, Hue 220)**
- Neutral, unobtrusive
- Slight blue tint keeps it from feeling "dead"
- Minimal background tint (it's the baseline)

**Interpolation (Blue, Hue 212)**
- Universal convention for variables and dynamic data
- High saturation for recognition
- Medium background tint to show "this came from code"

**Nested Prompt (Purple, Hue 270)**
- Associated with structure, hierarchy, composition
- Distinct from both static and dynamic
- Slightly stronger background to show "depth"

**List (Teal, Hue 160)**
- Green family suggests growth, collection
- Teal is softer than pure green, less "success/error" coded
- Medium tint shows "multiple items"

**Image (Orange, Hue 30)**
- Warm color for media content
- Distinct from all other categories
- Stands out without being alarming

**Unknown (Red, Hue 0)**
- Warning color
- Should rarely appear (indicates an edge case)
- Immediate visual flag for debugging

---

## Future Enhancements

Potential additions to the system:

1. **Hover States**: Slightly increase background alpha on hover for interactivity
2. **Selection States**: Stronger background when an element is selected
3. **Nesting Depth Indicators**: Vary intensity by nesting level
4. **Custom Theme Presets**: Predefined variable sets for different use cases
5. **Accessibility Overrides**: High-contrast mode with stronger colors

The three-tier system makes all of these additions straightforward to implement.
