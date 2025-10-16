"use strict";var TPromptsWidgets=(()=>{var x=Object.defineProperty;var _=Object.getOwnPropertyDescriptor;var W=Object.getOwnPropertyNames;var $=Object.prototype.hasOwnProperty;var H=(t,n)=>{for(var r in n)x(t,r,{get:n[r],enumerable:!0})},N=(t,n,r,i)=>{if(n&&typeof n=="object"||typeof n=="function")for(let e of W(n))!$.call(t,e)&&e!==r&&x(t,e,{get:()=>n[e],enumerable:!(i=_(n,e))||i.enumerable});return t};var D=t=>N(x({},"__esModule",{value:!0}),t);var z={};H(z,{VERSION:()=>L,initRuntime:()=>h,initWidget:()=>u,injectStyles:()=>f});function P(t,n){if(!t)return null;let r=n.endsWith("/")?n:n+"/";return t.startsWith(r)?t.substring(r.length):t===n?".":t}function b(t,n){if(!t||!t.filename)return null;let r=t.filepath||t.filename,i=P(r,n)||r;return t.line!==null&&t.line!==void 0?`${i}:${t.line}`:i}function R(t,n){let r={};if(!t)return r;function i(e){for(let o of e){let a=b(o.source_location,n),s=b(o.creation_location,n);a&&s&&a!==s?r[o.id]=`${a} (created: ${s})`:a?r[o.id]=a:s&&(r[o.id]=s),o.children&&i(o.children)}}return i(t.children),r}function A(t){let n={};if(!t)return n;function r(i){for(let e of i)n[e.id]=e.type,e.children&&r(e.children)}return r(t.children),n}function w(t){let n=t.config?.sourcePrefix||"";return{elementTypeMap:A(t.source_prompt||null),elementLocationMap:R(t.source_prompt||null,n)}}function d(t){return`id-${t}`}function v(t){let{element:n,chunks:r,data:i}=t;if(!i.ir?.chunks)return t;for(let e of i.ir.chunks){let o;if(e.type==="TextChunk"&&e.text!==void 0){let a=document.createElement("span");a.id=d(e.id),a.textContent=e.text,o=a}else if(e.type==="ImageChunk"&&e.image){let a=e.image,s=a.format||"PNG",l=`data:image/${s.toLowerCase()};base64,${a.base64_data}`,c=`![${s} ${a.width}x${a.height}](${l})`,p=document.createElement("span");p.className="tp-chunk-image-container",p.id=d(e.id);let m=document.createElement("span");m.className="tp-chunk-image",m.textContent=c;let g=document.createElement("img");g.className="tp-chunk-image-preview",g.src=l,g.alt=`${s} ${a.width}x${a.height}`,p.appendChild(m),p.appendChild(g),o=p}else{let a=document.createElement("span");a.id=d(e.id),o=a}r.set(e.id,o),n.appendChild(o)}return t}function y(t){let{chunks:n,data:r,metadata:i}=t;if(!r.ir?.chunks)return t;for(let e of r.ir.chunks){let o=n.get(e.id);if(!o)continue;let a=i.elementTypeMap[e.element_id]||"unknown";if(e.type==="ImageChunk"){let s=o.querySelector(".tp-chunk-image");if(s){let l=i.elementLocationMap[e.element_id];l&&s.setAttribute("title",l)}}else{o.className=`tp-chunk-${a}`;let s=i.elementLocationMap[e.element_id];s&&(o.title=s)}}return t}function k(t){let{element:n,data:r,metadata:i}=t;if(!r.compiled_ir?.subtree_map)return t;for(let[e,o]of Object.entries(r.compiled_ir.subtree_map)){if(o.length===0)continue;let a=i.elementTypeMap[e]||"unknown",s=o[0],l=n.querySelector(`[id="${d(s)}"]`);l&&l.classList.add(`tp-first-${a}`);let c=o[o.length-1],p=n.querySelector(`[id="${d(c)}"]`);p&&p.classList.add(`tp-last-${a}`)}return t}function T(t){let{data:n}=t;if(!n.ir?.chunks)return t;let r="",i=[],e={};for(let a of n.ir.chunks){let s="";if(a.type==="TextChunk"&&a.text!==void 0)s=a.text;else if(a.type==="ImageChunk"&&a.image){let p=a.image,m=p.format||"PNG",g=`data:image/${m.toLowerCase()};base64,${p.base64_data}`;s=`![${m} ${p.width}x${p.height}](${g})`}let l=r.length,c=l+s.length;r+=s;for(let p=l;p<c;p++)i.push(a.id);e[a.id]={start:l,end:c}}return{...t,textMapping:{fullText:r,offsetToChunkId:i,chunkIdToOffsets:e}}}function S(t,n){let r=document.createElement("div");r.className="tp-output-container wrap";let i=new Map,e={element:r,chunks:i,data:t,metadata:n};return e=v(e),e=y(e),e=T(e),e=k(e),{element:e.element,textMapping:e.textMapping||null,chunks:e.chunks,hide(o){o.forEach(a=>{let s=i.get(a);s&&(s.style.display="none")})},show(o){o.forEach(a=>{let s=i.get(a);s&&(s.style.display="")})},destroy(){r.remove(),i.clear()},highlightRange(o,a){console.log(`Highlight range: ${o}-${a}`)},clearHighlight(){console.log("Clear highlight")}}}function M(t,n){let r=document.createElement("div");r.className="tp-widget-output";let i=S(t,n);r.appendChild(i.element);let e=[i];return{element:r,views:e,toolbar:void 0,hide(o){e.forEach(a=>a.hide(o))},show(o){e.forEach(a=>a.show(o))},destroy(){e.forEach(o=>o.destroy()),r.remove()},addView(o){e.push(o),r.appendChild(o.element)},removeView(o){let a=e.indexOf(o);a!==-1&&(e.splice(a,1),o.element.remove())}}}function u(t){try{let n=t.querySelector('script[data-role="tp-widget-data"]');if(!n||!n.textContent){t.innerHTML='<div class="tp-error">No widget data found</div>';return}let r=JSON.parse(n.textContent);if(!r.ir||!r.ir.chunks){t.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let i=w(r),e=M(r,i),o=t.querySelector(".tp-widget-mount");o?(o.innerHTML="",o.appendChild(e.element)):(t.innerHTML="",t.appendChild(e.element)),t._widgetComponent=e}catch(n){console.error("Widget initialization error:",n),t.innerHTML=`<div class="tp-error">Failed to initialize widget: ${n instanceof Error?n.message:String(n)}</div>`}}var E=`/* T-Prompts Widget Styles */

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
`;var C="c2093c0b";var L="0.9.0-alpha";function f(){let t=`tp-widget-styles-${C}`;if(document.querySelector(`#${t}`))return;document.querySelectorAll('[id^="tp-widget-styles"]').forEach(i=>i.remove());let r=document.createElement("style");r.id=t,r.textContent=E,document.head.appendChild(r),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function h(){window.__TPWidget||(window.__TPWidget={version:L,initWidget:u,stylesInjected:!1})}function I(){h(),f(),document.querySelectorAll("[data-tp-widget]").forEach(n=>{n instanceof HTMLElement&&!n.dataset.tpInitialized&&(u(n),n.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",I):I();typeof MutationObserver<"u"&&new MutationObserver(n=>{n.forEach(r=>{r.addedNodes.forEach(i=>{i instanceof HTMLElement&&(i.matches("[data-tp-widget]")&&!i.dataset.tpInitialized&&(h(),f(),u(i),i.dataset.tpInitialized="true"),i.querySelectorAll("[data-tp-widget]").forEach(o=>{o instanceof HTMLElement&&!o.dataset.tpInitialized&&(h(),f(),u(o),o.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return D(z);})();
//# sourceMappingURL=index.js.map
