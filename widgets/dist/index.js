"use strict";var TPromptsWidgets=(()=>{var h=Object.defineProperty;var T=Object.getOwnPropertyDescriptor;var E=Object.getOwnPropertyNames;var I=Object.prototype.hasOwnProperty;var S=(e,t)=>{for(var r in t)h(e,r,{get:t[r],enumerable:!0})},M=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of E(t))!I.call(e,i)&&i!==r&&h(e,i,{get:()=>t[i],enumerable:!(a=T(t,i))||a.enumerable});return e};var _=e=>M(h({},"__esModule",{value:!0}),e);var N={};S(N,{VERSION:()=>x,initRuntime:()=>u,initWidget:()=>c,injectStyles:()=>g});function m(e){return`id-${e}`}function C(e){let t={};if(!e)return t;function r(a){for(let i of a)t[i.id]=i.type,i.children&&r(i.children)}return r(e.children),t}function R(e,t){let r=document.createElement("div");r.className="tp-output-container wrap";let a="",i=[],s={};for(let n of e){let o=document.createElement("span");o.id=m(n.id);let l="";if(n.type==="TextChunk"&&n.text!==void 0){l=n.text,o.textContent=l;let p=t[n.element_id]||"unknown";o.className=`tp-chunk-${p}`}else if(n.type==="ImageChunk"&&n.image){let p=n.image,f=p.format||"PNG",y=`data:image/${f.toLowerCase()};base64,${p.base64_data}`;l=`![${f} ${p.width}x${p.height}](${y})`,o.textContent=l,o.className="tp-chunk-image",o.title=`Image: ${f} ${p.width}x${p.height}`}let d=a.length,b=d+l.length;a+=l;for(let p=d;p<b;p++)i.push(n.id);s[n.id]={start:d,end:b},r.appendChild(o)}return{container:r,textMapping:{fullText:a,offsetToChunkId:i,chunkIdToOffsets:s}}}function D(e,t,r){if(!(!t||!t.subtree_map))for(let[a,i]of Object.entries(t.subtree_map)){if(i.length===0)continue;let s=r[a]||"unknown",n=i[0],o=e.querySelector(`[id="${m(n)}"]`);o&&o.classList.add(`tp-first-${s}`);let l=i[i.length-1],d=e.querySelector(`[id="${m(l)}"]`);d&&d.classList.add(`tp-last-${s}`)}}function c(e){try{let t=e.querySelector('script[data-role="tp-widget-data"]');if(!t||!t.textContent){e.innerHTML='<div class="tp-error">No widget data found</div>';return}let r=JSON.parse(t.textContent);if(!r.ir||!r.ir.chunks){e.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let a=C(r.source_prompt||null),{container:i,textMapping:s}=R(r.ir.chunks,a);D(i,r.compiled_ir||null,a),i._textMapping=s;let n=document.createElement("div");n.className="tp-widget-output",n.appendChild(i);let o=e.querySelector(".tp-widget-mount");o?(o.innerHTML="",o.appendChild(n)):(e.innerHTML="",e.appendChild(n))}catch(t){console.error("Widget initialization error:",t),e.innerHTML=`<div class="tp-error">Failed to initialize widget: ${t instanceof Error?t.message:String(t)}</div>`}}var w=`/* T-Prompts Widget Styles */

/* =============================================================================
   CSS VARIABLES FOR THEMING
   ============================================================================= */

/* Base UI Variables */
:root {
  --tp-color-bg: #ffffff;
  --tp-color-fg: #24292e;
  --tp-color-border: #e1e4e8;
  --tp-color-accent: #0366d6;
  --tp-color-muted: #6a737d;
  --tp-color-error: #d73a49;
  --tp-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  --tp-font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  --tp-spacing: 8px;

  /* ==========================================================================
     TIER 1: PALETTE PRIMITIVES - Hue values for each element type
     ========================================================================== */
  --tp-hue-static: 220;         /* Neutral blue-gray */
  --tp-hue-interpolation: 212;  /* Blue - dynamic data */
  --tp-hue-nested: 270;         /* Purple - compositional structure */
  --tp-hue-list: 160;           /* Teal - collections */
  --tp-hue-image: 30;           /* Orange - media */
  --tp-hue-unknown: 0;          /* Red - warning/edge case */

  /* ==========================================================================
     TIER 2: SEMANTIC TOKENS - Light Mode
     Saturation, lightness, and alpha values for foregrounds and backgrounds
     ========================================================================== */

  /* Static text - minimal styling (baseline) */
  --tp-static-fg-s: 15%;
  --tp-static-fg-l: 30%;
  --tp-static-bg-alpha: 0.04;

  /* Interpolations - blue, medium visibility */
  --tp-interp-fg-s: 80%;
  --tp-interp-fg-l: 35%;
  --tp-interp-bg-alpha: 0.10;

  /* Nested prompts - purple, slightly stronger */
  --tp-nested-fg-s: 75%;
  --tp-nested-fg-l: 38%;
  --tp-nested-bg-alpha: 0.12;

  /* Lists - teal, medium tint (increased visibility) */
  --tp-list-fg-s: 80%;
  --tp-list-fg-l: 32%;
  --tp-list-bg-alpha: 0.14;

  /* Images - orange, distinct */
  --tp-image-fg-s: 85%;
  --tp-image-fg-l: 40%;
  --tp-image-bg-alpha: 0.10;

  /* Unknown - red, warning signal */
  --tp-unknown-fg-s: 80%;
  --tp-unknown-fg-l: 45%;
  --tp-unknown-bg-alpha: 0.12;
}

/* Dark Mode Overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --tp-color-bg: #0d1117;
    --tp-color-fg: #c9d1d9;
    --tp-color-border: #30363d;
    --tp-color-accent: #58a6ff;
    --tp-color-muted: #8b949e;
    --tp-color-error: #f85149;

    /* ==========================================================================
       TIER 2: SEMANTIC TOKENS - Dark Mode Overrides
       Higher lightness for foregrounds, higher alpha for backgrounds
       ========================================================================== */

    /* Static text */
    --tp-static-fg-l: 75%;
    --tp-static-bg-alpha: 0.08;

    /* Interpolations */
    --tp-interp-fg-l: 75%;
    --tp-interp-bg-alpha: 0.18;

    /* Nested prompts */
    --tp-nested-fg-l: 78%;
    --tp-nested-bg-alpha: 0.22;

    /* Lists */
    --tp-list-fg-l: 72%;
    --tp-list-bg-alpha: 0.24;

    /* Images */
    --tp-image-fg-l: 80%;
    --tp-image-bg-alpha: 0.18;

    /* Unknown */
    --tp-unknown-fg-l: 75%;
    --tp-unknown-bg-alpha: 0.22;
  }
}

/* Main widget container - three-pane grid layout */
.tp-widget-container {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--tp-spacing);
  font-family: var(--tp-font-family);
  font-size: 14px;
  color: var(--tp-color-fg);
  background: var(--tp-color-bg);
  border: 1px solid var(--tp-color-border);
  border-radius: 6px;
  padding: var(--tp-spacing);
  margin: calc(var(--tp-spacing) * 2) 0;
  max-width: 100%;
  overflow: hidden;
}

/* Individual pane base styles */
.tp-pane {
  border: 1px solid var(--tp-color-border);
  border-radius: 4px;
  padding: var(--tp-spacing);
  overflow: auto;
  max-height: 600px;
  background: var(--tp-color-bg);
}

.tp-pane h4 {
  margin: 0 0 var(--tp-spacing) 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--tp-color-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Pane content containers */
.tp-tree {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  color: var(--tp-color-fg);
}

.tp-code {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--tp-color-fg);
}

.tp-preview {
  font-family: var(--tp-font-family);
  font-size: 14px;
  line-height: 1.6;
  color: var(--tp-color-fg);
}

/* Output container for chunks */
.tp-output-container {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--tp-color-fg);
  max-width: 100ch;
  word-break: break-all;
}

/* Wrapping mode (default) */
.tp-output-container.wrap {
  white-space: pre-wrap;
}

/* Scrolling mode (horizontal scroll, no wrapping) */
.tp-output-container.scroll {
  white-space: pre;
  overflow-x: auto;
}

/* =============================================================================
   TIER 3: APPLIED STYLES - Chunk Element Types
   Semantic colors applied using the three-tier variable system
   ============================================================================= */

/* Static text - neutral baseline */
.tp-chunk-static {
  white-space: pre-wrap;
  color: hsl(
    var(--tp-hue-static),
    var(--tp-static-fg-s),
    var(--tp-static-fg-l)
  );
  background: hsla(
    var(--tp-hue-static),
    20%,
    60%,
    var(--tp-static-bg-alpha)
  );
}

/* Interpolations - blue for dynamic data */
.tp-chunk-interpolation {
  white-space: pre-wrap;
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

/* Nested prompts - purple for composition */
.tp-chunk-nested_prompt {
  white-space: pre-wrap;
  color: hsl(
    var(--tp-hue-nested),
    var(--tp-nested-fg-s),
    var(--tp-nested-fg-l)
  );
  background: hsla(
    var(--tp-hue-nested),
    75%,
    65%,
    var(--tp-nested-bg-alpha)
  );
}

/* Lists - teal for collections */
.tp-chunk-list {
  white-space: pre-wrap;
  color: hsl(
    var(--tp-hue-list),
    var(--tp-list-fg-s),
    var(--tp-list-fg-l)
  );
  background: hsla(
    var(--tp-hue-list),
    70%,
    60%,
    var(--tp-list-bg-alpha)
  );
}

/* Images - orange for media, with text elision */
.tp-chunk-image {
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;
  color: hsl(
    var(--tp-hue-image),
    var(--tp-image-fg-s),
    var(--tp-image-fg-l)
  );
  background: hsla(
    var(--tp-hue-image),
    85%,
    65%,
    var(--tp-image-bg-alpha)
  );
}

/* Unknown types - red warning */
.tp-chunk-unknown {
  white-space: pre-wrap;
  color: hsl(
    var(--tp-hue-unknown),
    var(--tp-unknown-fg-s),
    var(--tp-unknown-fg-l)
  );
  background: hsla(
    var(--tp-hue-unknown),
    80%,
    60%,
    var(--tp-unknown-bg-alpha)
  );
}

/* Element boundary markers - type-specific borders */
/* Borders use each element type's semantic hue for visual consistency */

/* No borders for static elements (baseline) */
.tp-first-static,
.tp-last-static {
  /* Static elements have no boundary borders */
}

/* 2px borders for interpolation (blue, hue 212) */
.tp-first-interpolation {
  border-left: 2px solid hsl(212, 90%, 45%);
  padding-left: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

.tp-last-interpolation {
  border-right: 2px solid hsl(212, 90%, 55%);
  padding-right: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

/* 2px borders for image (orange, hue 30) */
.tp-first-image {
  border-left: 2px solid hsl(30, 90%, 50%);
  padding-left: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

.tp-last-image {
  border-right: 2px solid hsl(30, 90%, 60%);
  padding-right: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

/* 3px borders for list (teal, hue 160) - higher priority, placed last */
.tp-first-list {
  border-left: 3px solid hsl(160, 80%, 40%);
  padding-left: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

.tp-last-list {
  border-right: 3px solid hsl(160, 80%, 50%);
  padding-right: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

/* 3px borders for nested_prompt (purple, hue 270) - higher priority, placed last */
.tp-first-nested_prompt {
  border-left: 3px solid hsl(270, 85%, 50%);
  padding-left: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

.tp-last-nested_prompt {
  border-right: 3px solid hsl(270, 85%, 60%);
  padding-right: 2px;
  box-decoration-break: slice;
  -webkit-box-decoration-break: slice;
}

/* Dark mode adjustments for boundaries - lighter colors for better visibility */
@media (prefers-color-scheme: dark) {
  .tp-first-interpolation {
    border-left-color: hsl(212, 90%, 60%);
  }

  .tp-last-interpolation {
    border-right-color: hsl(212, 90%, 70%);
  }

  .tp-first-image {
    border-left-color: hsl(30, 90%, 65%);
  }

  .tp-last-image {
    border-right-color: hsl(30, 90%, 75%);
  }

  .tp-first-list {
    border-left-color: hsl(160, 80%, 55%);
  }

  .tp-last-list {
    border-right-color: hsl(160, 80%, 65%);
  }

  .tp-first-nested_prompt {
    border-left-color: hsl(270, 85%, 65%);
  }

  .tp-last-nested_prompt {
    border-right-color: hsl(270, 85%, 75%);
  }
}

/* Error display */
.tp-error {
  color: var(--tp-color-error);
  font-family: var(--tp-font-mono);
  font-size: 12px;
  padding: var(--tp-spacing);
  background: rgba(248, 81, 73, 0.1);
  border: 1px solid var(--tp-color-error);
  border-radius: 4px;
  margin: var(--tp-spacing) 0;
}

/* Responsive layout */
@media (max-width: 1200px) {
  .tp-widget-container {
    grid-template-columns: 1fr;
  }

  .tp-pane {
    max-height: 400px;
  }
}

@media (min-width: 1201px) and (max-width: 1600px) {
  .tp-widget-container {
    grid-template-columns: 1fr 1fr;
  }
}
`;var k="c1d9a4e3";var x="0.9.0-alpha";function g(){let e=`tp-widget-styles-${k}`;if(document.querySelector(`#${e}`))return;document.querySelectorAll('[id^="tp-widget-styles"]').forEach(a=>a.remove());let r=document.createElement("style");r.id=e,r.textContent=w,document.head.appendChild(r),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function u(){window.__TPWidget||(window.__TPWidget={version:x,initWidget:c,stylesInjected:!1})}function v(){u(),g(),document.querySelectorAll("[data-tp-widget]").forEach(t=>{t instanceof HTMLElement&&!t.dataset.tpInitialized&&(c(t),t.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",v):v();typeof MutationObserver<"u"&&new MutationObserver(t=>{t.forEach(r=>{r.addedNodes.forEach(a=>{a instanceof HTMLElement&&(a.matches("[data-tp-widget]")&&!a.dataset.tpInitialized&&(u(),g(),c(a),a.dataset.tpInitialized="true"),a.querySelectorAll("[data-tp-widget]").forEach(s=>{s instanceof HTMLElement&&!s.dataset.tpInitialized&&(u(),g(),c(s),s.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return _(N);})();
//# sourceMappingURL=index.js.map
