"use strict";var TPromptsWidgets=(()=>{var h=Object.defineProperty;var H=Object.getOwnPropertyDescriptor;var D=Object.getOwnPropertyNames;var N=Object.prototype.hasOwnProperty;var $=(t,n)=>{for(var o in n)h(t,o,{get:n[o],enumerable:!0})},P=(t,n,o,r)=>{if(n&&typeof n=="object"||typeof n=="function")for(let e of D(n))!N.call(t,e)&&e!==o&&h(t,e,{get:()=>n[e],enumerable:!(r=H(n,e))||r.enumerable});return t};var A=t=>P(h({},"__esModule",{value:!0}),t);var U={};$(U,{VERSION:()=>W,initRuntime:()=>u,initWidget:()=>c,injectStyles:()=>f});function O(t,n){if(!t)return null;let o=n.endsWith("/")?n:n+"/";return t.startsWith(o)?t.substring(o.length):t===n?".":t}function b(t,n){if(!t||!t.filename)return null;let o=t.filepath||t.filename,r=O(o,n)||o;return t.line!==null&&t.line!==void 0?`${r}:${t.line}`:r}function R(t,n){let o={};if(!t)return o;function r(e){for(let a of e){let i=b(a.source_location,n),s=b(a.creation_location,n);i&&s&&i!==s?o[a.id]=`${i} (created: ${s})`:i?o[a.id]=i:s&&(o[a.id]=s),a.children&&r(a.children)}}return r(t.children),o}function z(t){let n={};if(!t)return n;function o(r){for(let e of r)n[e.id]=e.type,e.children&&o(e.children)}return o(t.children),n}function w(t){let n=t.config?.sourcePrefix||"";return{elementTypeMap:z(t.source_prompt||null),elementLocationMap:R(t.source_prompt||null,n)}}function V(t){return t.getAttribute("data-chunk-id")}function v(t,n){let o=V(t);o&&n.setAttribute("data-chunk-id",o)}function m(t,n,o){let r=o.get(t);r?r.push(n):o.set(t,[n])}function x(t,n,o){let r=o.get(t);if(r){let e=r.indexOf(n);e!==-1&&r.splice(e,1),r.length===0&&o.delete(t)}}function y(t){let{element:n,chunks:o,data:r}=t;if(!r.ir?.chunks)return t;for(let e of r.ir.chunks){let a;if(e.type==="TextChunk"&&e.text!==void 0){let i=document.createElement("span");i.setAttribute("data-chunk-id",e.id),i.textContent=e.text,a=i}else if(e.type==="ImageChunk"&&e.image){let i=e.image,s=i.format||"PNG",p=`data:image/${s.toLowerCase()};base64,${i.base64_data}`,d=`![${s} ${i.width}x${i.height}](${p})`,l=document.createElement("span");l.setAttribute("data-chunk-id",e.id),l.textContent=d,l._imageData=i,a=l}else{let i=document.createElement("span");i.setAttribute("data-chunk-id",e.id),a=i}m(e.id,a,o),n.appendChild(a)}return t}function k(t){let{chunks:n,data:o,metadata:r}=t;if(!o.ir?.chunks)return t;for(let e of o.ir.chunks){let a=n.get(e.id);if(a)for(let i of a){let s=r.elementTypeMap[e.element_id]||"unknown";i.className=`tp-chunk-${s}`;let p=r.elementLocationMap[e.element_id];p&&(i.title=p)}}return t}function T(t){let{chunks:n}=t;for(let[,o]of n){let r=o._imageData;if(!r)continue;let a=`![${r.format||"PNG"} ${r.width}x${r.height}](...)`;o.textContent=a,o.removeAttribute("title")}return t}function E(t){let{chunks:n}=t;for(let[o,r]of Array.from(n.entries()))for(let e of r){let a=e._imageData;if(!a)continue;let i=a.format||"PNG",s=`data:image/${i.toLowerCase()};base64,${a.base64_data}`,p=document.createElement("span");p.className="tp-chunk-image-container",v(e,p),e.className&&(p.className+=` ${e.className}`);let d=document.createElement("span");d.className="tp-chunk-image",d.textContent=e.textContent;let l=document.createElement("img");l.className="tp-chunk-image-preview",l.src=s,l.alt=`${i} ${a.width}x${a.height}`,p.appendChild(d),p.appendChild(l),e.parentNode&&e.parentNode.replaceChild(p,e),x(o,e,n),m(o,p,n)}return t}function M(t){let{chunks:n,data:o,metadata:r}=t;if(!o.compiled_ir?.subtree_map)return t;for(let[e,a]of Object.entries(o.compiled_ir.subtree_map)){if(a.length===0)continue;let i=r.elementTypeMap[e]||"unknown",s=a[0],p=n.get(s);if(p)for(let g of p)g.classList.add(`tp-first-${i}`);let d=a[a.length-1],l=n.get(d);if(l)for(let g of l)g.classList.add(`tp-last-${i}`)}return t}function S(t,n){let o=document.createElement("div");o.className="tp-output-container wrap";let r=new Map,e={element:o,chunks:r,data:t,metadata:n};return e=y(e),e=k(e),e=T(e),e=E(e),e=M(e),{element:e.element,chunks:e.chunks,hide(a){a.forEach(i=>{let s=r.get(i);s&&s.forEach(p=>p.style.display="none")})},show(a){a.forEach(i=>{let s=r.get(i);s&&s.forEach(p=>p.style.display="")})},destroy(){o.remove(),r.clear()}}}function C(t,n){let o=document.createElement("div");o.className="tp-widget-output";let r=S(t,n);o.appendChild(r.element);let e=[r];return{element:o,views:e,toolbar:void 0,hide(a){e.forEach(i=>i.hide(a))},show(a){e.forEach(i=>i.show(a))},destroy(){e.forEach(a=>a.destroy()),o.remove()},addView(a){e.push(a),o.appendChild(a.element)},removeView(a){let i=e.indexOf(a);i!==-1&&(e.splice(i,1),a.element.remove())}}}function c(t){try{let n=t.querySelector('script[data-role="tp-widget-data"]');if(!n||!n.textContent){t.innerHTML='<div class="tp-error">No widget data found</div>';return}let o=JSON.parse(n.textContent);if(!o.ir||!o.ir.chunks){t.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let r=w(o),e=C(o,r),a=t.querySelector(".tp-widget-mount");a?(a.innerHTML="",a.appendChild(e.element)):(t.innerHTML="",t.appendChild(e.element)),t._widgetComponent=e}catch(n){console.error("Widget initialization error:",n),t.innerHTML=`<div class="tp-error">Failed to initialize widget: ${n instanceof Error?n.message:String(n)}</div>`}}var L=`/* T-Prompts Widget Styles */

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
  overflow: visible !important; /* Override overflow: hidden from tp-chunk-image class */
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
`;var I="1db616d5";var W="0.9.0-alpha";function f(){let t=`tp-widget-styles-${I}`;if(document.querySelector(`#${t}`))return;document.querySelectorAll('[id^="tp-widget-styles"]').forEach(r=>r.remove());let o=document.createElement("style");o.id=t,o.textContent=L,document.head.appendChild(o),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function u(){window.__TPWidget||(window.__TPWidget={version:W,initWidget:c,stylesInjected:!1})}function _(){u(),f(),document.querySelectorAll("[data-tp-widget]").forEach(n=>{n instanceof HTMLElement&&!n.dataset.tpInitialized&&(c(n),n.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",_):_();typeof MutationObserver<"u"&&new MutationObserver(n=>{n.forEach(o=>{o.addedNodes.forEach(r=>{r instanceof HTMLElement&&(r.matches("[data-tp-widget]")&&!r.dataset.tpInitialized&&(u(),f(),c(r),r.dataset.tpInitialized="true"),r.querySelectorAll("[data-tp-widget]").forEach(a=>{a instanceof HTMLElement&&!a.dataset.tpInitialized&&(u(),f(),c(a),a.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return A(U);})();
//# sourceMappingURL=index.js.map
