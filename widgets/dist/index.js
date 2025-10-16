"use strict";var TPromptsWidgets=(()=>{var v=Object.defineProperty;var _=Object.getOwnPropertyDescriptor;var L=Object.getOwnPropertyNames;var C=Object.prototype.hasOwnProperty;var D=(t,e)=>{for(var n in e)v(t,n,{get:e[n],enumerable:!0})},R=(t,e,n,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of L(e))!C.call(t,r)&&r!==n&&v(t,r,{get:()=>e[r],enumerable:!(i=_(e,r))||i.enumerable});return t};var N=t=>R(v({},"__esModule",{value:!0}),t);var q={};D(q,{VERSION:()=>I,initRuntime:()=>x,initWidget:()=>c,injectStyles:()=>w});function f(t){return`id-${t}`}function W(t,e){if(!t)return null;let n=e.endsWith("/")?e:e+"/";return t.startsWith(n)?t.substring(n.length):t===e?".":t}function E(t,e){if(!t||!t.filename)return null;let n=t.filepath||t.filename,i=W(n,e)||n;return t.line!==null&&t.line!==void 0?`${i}:${t.line}`:i}function H(t,e){let n={};if(!t)return n;function i(r){for(let o of r){let a=E(o.source_location,e),s=E(o.creation_location,e);a&&s&&a!==s?n[o.id]=`${a} (created: ${s})`:a?n[o.id]=a:s&&(n[o.id]=s),o.children&&i(o.children)}}return i(t.children),n}function P(t){let e={};if(!t)return e;function n(i){for(let r of i)e[r.id]=r.type,r.children&&n(r.children)}return n(t.children),e}function $(t){let e=t.config?.sourcePrefix||"";return{elementTypeMap:P(t.source_prompt||null),elementLocationMap:H(t.source_prompt||null,e)}}function O(t,e){let n=document.createElement("div");n.className="tp-output-container wrap";let i="",r=[],o={};for(let a of t){let s="",l;if(a.type==="TextChunk"&&a.text!==void 0){s=a.text;let p=document.createElement("span");p.id=f(a.id),p.textContent=s;let g=e.elementTypeMap[a.element_id]||"unknown";p.className=`tp-chunk-${g}`;let u=e.elementLocationMap[a.element_id];u&&(p.title=u),l=p}else if(a.type==="ImageChunk"&&a.image){let p=a.image,g=p.format||"PNG",u=`data:image/${g.toLowerCase()};base64,${p.base64_data}`;s=`![${g} ${p.width}x${p.height}](${u})`;let m=document.createElement("span");m.className="tp-chunk-image-container",m.id=f(a.id);let h=document.createElement("span");h.className="tp-chunk-image",h.textContent=s;let y=e.elementLocationMap[a.element_id];y&&(h.title=y);let b=document.createElement("img");b.className="tp-chunk-image-preview",b.src=u,b.alt=`${g} ${p.width}x${p.height}`,m.appendChild(h),m.appendChild(b),l=m}else{let p=document.createElement("span");p.id=f(a.id),l=p}let d=i.length,k=d+s.length;i+=s;for(let p=d;p<k;p++)r.push(a.id);o[a.id]={start:d,end:k},n.appendChild(l)}return{container:n,textMapping:{fullText:i,offsetToChunkId:r,chunkIdToOffsets:o}}}function z(t,e,n){if(!(!e||!e.subtree_map))for(let[i,r]of Object.entries(e.subtree_map)){if(r.length===0)continue;let o=n.elementTypeMap[i]||"unknown",a=r[0],s=t.querySelector(`[id="${f(a)}"]`);s&&s.classList.add(`tp-first-${o}`);let l=r[r.length-1],d=t.querySelector(`[id="${f(l)}"]`);d&&d.classList.add(`tp-last-${o}`)}}function c(t){try{let e=t.querySelector('script[data-role="tp-widget-data"]');if(!e||!e.textContent){t.innerHTML='<div class="tp-error">No widget data found</div>';return}let n=JSON.parse(e.textContent);if(!n.ir||!n.ir.chunks){t.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let i=$(n),{container:r,textMapping:o}=O(n.ir.chunks,i);z(r,n.compiled_ir||null,i),r._textMapping=o;let a=document.createElement("div");a.className="tp-widget-output",a.appendChild(r);let s=t.querySelector(".tp-widget-mount");s?(s.innerHTML="",s.appendChild(a)):(t.innerHTML="",t.appendChild(a))}catch(e){console.error("Widget initialization error:",e),t.innerHTML=`<div class="tp-error">Failed to initialize widget: ${e instanceof Error?e.message:String(e)}</div>`}}var T=`/* T-Prompts Widget Styles */

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

/* Output container for chunks */
.tp-output-container {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--tp-color-fg);
  max-width: 100ch;
  word-break: break-all;
  position: relative;
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

/* Image container for hover preview */
.tp-chunk-image-container {
  position: relative;
  display: inline-block;
}

/* Hidden image preview - shown on hover */
.tp-chunk-image-preview {
  display: none;
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 8px;
  z-index: 1000;
  max-width: 400px;
  max-height: 400px;
  border: 2px solid var(--tp-color-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  background: var(--tp-color-bg);
}

/* Show preview on hover */
.tp-chunk-image-container:hover .tp-chunk-image-preview {
  display: block;
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

/* 1px borders for interpolation (blue, hue 212) */
.tp-first-interpolation {
  box-shadow: inset 1px 0 0 0 hsl(212, 90%, 45%);
  padding-left: 1px;
}

.tp-last-interpolation {
  box-shadow: inset -1px 0 0 0 hsl(212, 90%, 55%);
  padding-right: 1px;
}

/* 1px borders for image (orange, hue 30) */
.tp-first-image {
  box-shadow: inset 1px 0 0 0 hsl(30, 90%, 50%);
  padding-left: 1px;
}

.tp-last-image {
  box-shadow: inset -1px 0 0 0 hsl(30, 90%, 60%);
  padding-right: 1px;
}


/* 1px borders for nested_prompt (purple, hue 270) */
.tp-first-nested_prompt {
  box-shadow: inset 1px 0 0 0 hsl(270, 85%, 50%);
  padding-left: 1px;
}

.tp-last-nested_prompt {
  box-shadow: inset -1px 0 0 0 hsl(270, 85%, 60%);
  padding-right: 1px;
}

/* 1px borders for list (teal, hue 160) - higher priority, placed last */
.tp-first-list {
  box-shadow: inset 1px 0 0 0 hsl(160, 80%, 40%);
  padding-left: 1px;
}

.tp-last-list {
  box-shadow: inset -1px 0 0 0 hsl(160, 80%, 50%);
  padding-right: 1px;
}


/* Dark mode adjustments for boundaries - lighter colors for better visibility */
@media (prefers-color-scheme: dark) {
  .tp-first-interpolation {
    box-shadow: inset 1px 0 0 0 hsl(212, 90%, 60%);
  }

  .tp-last-interpolation {
    box-shadow: inset -1px 0 0 0 hsl(212, 90%, 70%);
  }

  .tp-first-image {
    box-shadow: inset 1px 0 0 0 hsl(30, 90%, 65%);
  }

  .tp-last-image {
    box-shadow: inset -1px 0 0 0 hsl(30, 90%, 75%);
  }

  .tp-first-nested_prompt {
    box-shadow: inset 1px 0 0 0 hsl(270, 85%, 65%);
  }

  .tp-last-nested_prompt {
    box-shadow: inset -1px 0 0 0 hsl(270, 85%, 75%);
  }

  .tp-first-list {
    box-shadow: inset 1px 0 0 0 hsl(160, 80%, 55%);
  }

  .tp-last-list {
    box-shadow: inset -1px 0 0 0 hsl(160, 80%, 65%);
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
`;var S="c2093c0b";var I="0.9.0-alpha";function w(){let t=`tp-widget-styles-${S}`;if(document.querySelector(`#${t}`))return;document.querySelectorAll('[id^="tp-widget-styles"]').forEach(i=>i.remove());let n=document.createElement("style");n.id=t,n.textContent=T,document.head.appendChild(n),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function x(){window.__TPWidget||(window.__TPWidget={version:I,initWidget:c,stylesInjected:!1})}function M(){x(),w(),document.querySelectorAll("[data-tp-widget]").forEach(e=>{e instanceof HTMLElement&&!e.dataset.tpInitialized&&(c(e),e.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",M):M();typeof MutationObserver<"u"&&new MutationObserver(e=>{e.forEach(n=>{n.addedNodes.forEach(i=>{i instanceof HTMLElement&&(i.matches("[data-tp-widget]")&&!i.dataset.tpInitialized&&(x(),w(),c(i),i.dataset.tpInitialized="true"),i.querySelectorAll("[data-tp-widget]").forEach(o=>{o instanceof HTMLElement&&!o.dataset.tpInitialized&&(x(),w(),c(o),o.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return N(q);})();
//# sourceMappingURL=index.js.map
