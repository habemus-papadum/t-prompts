"use strict";var TPromptsWidgets=(()=>{var c=Object.defineProperty;var m=Object.getOwnPropertyDescriptor;var f=Object.getOwnPropertyNames;var u=Object.prototype.hasOwnProperty;var v=(e,t)=>{for(var o in t)c(e,o,{get:t[o],enumerable:!0})},w=(e,t,o,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of f(t))!u.call(e,i)&&i!==o&&c(e,i,{get:()=>t[i],enumerable:!(r=m(t,i))||r.enumerable});return e};var h=e=>w(c({},"__esModule",{value:!0}),e);var k={};v(k,{VERSION:()=>g,initRuntime:()=>d,initWidget:()=>n,injectStyles:()=>p});function b(e){if(!e||e.length===0)return'<div class="tp-empty">No content</div>';let t="";for(let o of e)if(o.type==="TextChunk"&&o.text!==void 0){let r=y(o.text);t+=r}else if(o.type==="ImageChunk"&&o.image){let r=o.image;if(r.base64_data){let a=`data:image/${(r.format||"png").toLowerCase()};base64,${r.base64_data}`;t+=`
<img src="${a}" alt="Image ${r.width}x${r.height}" style="max-width: 100%; height: auto; display: block; margin: 8px 0;" />
`}}return t}function y(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}function n(e){try{let t=e.querySelector('script[data-role="tp-widget-data"]');if(!t||!t.textContent){e.innerHTML='<div class="tp-error">No widget data found</div>';return}let o=JSON.parse(t.textContent);if(!o.ir||!o.ir.chunks){e.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let i=`
      <div class="tp-widget-output">
        <pre style="white-space: pre-wrap; font-family: monospace; margin: 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">${b(o.ir.chunks)}</pre>
      </div>
    `,a=e.querySelector(".tp-widget-mount");a?a.innerHTML=i:e.innerHTML=i}catch(t){console.error("Widget initialization error:",t),e.innerHTML=`<div class="tp-error">Failed to initialize widget: ${t instanceof Error?t.message:String(t)}</div>`}}var s=`/* T-Prompts Widget Styles - Phase 1 */

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
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --tp-color-bg: #0d1117;
    --tp-color-fg: #c9d1d9;
    --tp-color-border: #30363d;
    --tp-color-accent: #58a6ff;
    --tp-color-muted: #8b949e;
    --tp-color-error: #f85149;
  }
}

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

/* Tree Pane */
.tp-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tp-tree ul {
  list-style: none;
  padding-left: calc(var(--tp-spacing) * 2);
  margin: calc(var(--tp-spacing) / 2) 0;
}

.tp-tree li {
  padding: calc(var(--tp-spacing) / 4) 0;
}

.tp-tree-label {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  color: var(--tp-color-fg);
}

.tp-tree-prompt > .tp-tree-label {
  font-weight: 600;
  color: var(--tp-color-accent);
}

.tp-tree-interpolation > .tp-tree-label {
  color: var(--tp-color-accent);
}

.tp-tree-nested_prompt > .tp-tree-label {
  color: #6f42c1;
  font-weight: 500;
}

.tp-tree-list > .tp-tree-label {
  color: #d73a49;
  font-weight: 500;
}

.tp-tree-static > .tp-tree-label {
  color: var(--tp-color-muted);
}

/* Code Pane */
.tp-code {
  font-family: var(--tp-font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--tp-color-fg);
  overflow-x: auto;
}

.tp-code-text {
  white-space: pre-wrap;
}

.tp-code-interp {
  color: var(--tp-color-accent);
  font-weight: 500;
  cursor: help;
}

.tp-code-nested-start,
.tp-code-nested-end {
  color: #6f42c1;
  font-weight: 600;
}

.tp-code-list-start,
.tp-code-list-end {
  color: #d73a49;
  font-weight: 600;
}

.tp-code-separator {
  color: var(--tp-color-muted);
  font-style: italic;
}

.tp-code-image {
  color: #22863a;
  font-weight: 500;
  cursor: help;
}

/* Preview Pane */
.tp-preview {
  font-family: var(--tp-font-family);
  font-size: 14px;
  line-height: 1.6;
  color: var(--tp-color-fg);
}

.tp-preview h1,
.tp-preview h2,
.tp-preview h3,
.tp-preview h4,
.tp-preview h5,
.tp-preview h6 {
  margin-top: calc(var(--tp-spacing) * 2);
  margin-bottom: var(--tp-spacing);
  font-weight: 600;
  line-height: 1.25;
}

.tp-preview h1 { font-size: 2em; border-bottom: 1px solid var(--tp-color-border); padding-bottom: 0.3em; }
.tp-preview h2 { font-size: 1.5em; border-bottom: 1px solid var(--tp-color-border); padding-bottom: 0.3em; }
.tp-preview h3 { font-size: 1.25em; }
.tp-preview h4 { font-size: 1em; }
.tp-preview h5 { font-size: 0.875em; }
.tp-preview h6 { font-size: 0.85em; color: var(--tp-color-muted); }

.tp-preview p {
  margin-top: 0;
  margin-bottom: calc(var(--tp-spacing) * 2);
}

.tp-preview code {
  font-family: var(--tp-font-mono);
  font-size: 85%;
  background: var(--tp-color-border);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.tp-preview pre {
  font-family: var(--tp-font-mono);
  font-size: 85%;
  background: var(--tp-color-border);
  padding: calc(var(--tp-spacing) * 2);
  border-radius: 6px;
  overflow: auto;
  line-height: 1.45;
}

.tp-preview pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
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
`;var g="0.9.0-alpha";function p(){if(window.__TPWidget?.stylesInjected)return;let e="tp-widget-styles";if(document.getElementById(e))return;let t=document.createElement("style");t.id=e,t.textContent=s,document.head.appendChild(t),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function d(){window.__TPWidget||(window.__TPWidget={version:g,initWidget:n,stylesInjected:!1})}function l(){d(),p(),document.querySelectorAll("[data-tp-widget]").forEach(t=>{t instanceof HTMLElement&&!t.dataset.tpInitialized&&(n(t),t.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l();typeof MutationObserver<"u"&&new MutationObserver(t=>{t.forEach(o=>{o.addedNodes.forEach(r=>{r instanceof HTMLElement&&(r.matches("[data-tp-widget]")&&!r.dataset.tpInitialized&&(d(),p(),n(r),r.dataset.tpInitialized="true"),r.querySelectorAll("[data-tp-widget]").forEach(a=>{a instanceof HTMLElement&&!a.dataset.tpInitialized&&(d(),p(),n(a),a.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return h(k);})();
//# sourceMappingURL=index.js.map
