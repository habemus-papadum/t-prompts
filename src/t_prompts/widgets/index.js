"use strict";var TPromptsWidgets=(()=>{var S=Object.defineProperty;var Z=Object.getOwnPropertyDescriptor;var ee=Object.getOwnPropertyNames;var te=Object.prototype.hasOwnProperty;var ne=(n,e)=>{for(var t in e)S(n,t,{get:e[t],enumerable:!0})},oe=(n,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let a of ee(e))!te.call(n,a)&&a!==t&&S(n,a,{get:()=>e[a],enumerable:!(i=Z(e,a))||i.enumerable});return n};var ae=n=>oe(S({},"__esModule",{value:!0}),n);var de={};ne(de,{VERSION:()=>Y,initRuntime:()=>T,initWidget:()=>w,injectStyles:()=>C});function ie(n,e){if(!n)return null;let t=e.endsWith("/")?e:e+"/";return n.startsWith(t)?n.substring(t.length):n===e?".":n}function H(n,e){if(!n||!n.filename)return null;let t=n.filepath||n.filename,i=ie(t,e)||t;return n.line!==null&&n.line!==void 0?`${i}:${n.line}`:i}function re(n,e){let t={};if(!n)return t;function i(a){for(let o of a){let r=H(o.source_location,e),s=H(o.creation_location,e);r&&s&&r!==s?t[o.id]=`${r} (created: ${s})`:r?t[o.id]=r:s&&(t[o.id]=s),o.children&&i(o.children)}}return i(n.children),t}function se(n){let e={};if(!n)return e;function t(i){for(let a of i)e[a.id]=a.type,a.children&&t(a.children)}return t(n.children),e}function _(n){let e=n.config?.sourcePrefix||"";return{elementTypeMap:se(n.source_prompt||null),elementLocationMap:re(n.source_prompt||null,e)}}function D(n){return n.getAttribute("data-chunk-id")}function N(n,e){let t=D(n);t&&e.setAttribute("data-chunk-id",t)}function k(n,e,t){let i=t.get(n);i?i.push(e):t.set(n,[e])}function W(n,e,t){let i=t.get(n);if(i){let a=i.indexOf(e);a!==-1&&i.splice(a,1),i.length===0&&t.delete(n)}}function A(n,e,t){let i=D(n);if(!i)return;let a=t.get(i);if(a){let o=a.indexOf(n);if(o!==-1){a[o]=e;return}}}function $(n){let{element:e,chunks:t,data:i}=n;if(!i.ir?.chunks)return n;for(let a of i.ir.chunks){let o;if(a.type==="TextChunk"&&a.text!==void 0){let r=document.createElement("span");r.setAttribute("data-chunk-id",a.id),r.textContent=a.text,o=r}else if(a.type==="ImageChunk"&&a.image){let r=a.image,s=r.format||"PNG",l=`data:image/${s.toLowerCase()};base64,${r.base64_data}`,d=`![${s} ${r.width}x${r.height}](${l})`,p=document.createElement("span");p.setAttribute("data-chunk-id",a.id),p.textContent=d,p._imageData=r,o=p}else{let r=document.createElement("span");r.setAttribute("data-chunk-id",a.id),o=r}k(a.id,o,t),e.appendChild(o)}return n}function R(n){let{chunks:e,data:t,metadata:i}=n;if(!t.ir?.chunks)return n;for(let a of t.ir.chunks){let o=e.get(a.id);if(o)for(let r of o){let s=i.elementTypeMap[a.element_id]||"unknown";r.className=`tp-chunk-${s}`;let l=i.elementLocationMap[a.element_id];l&&(r.title=l)}}return n}function P(n){let{chunks:e}=n;for(let[,t]of e){let i=t._imageData;if(!i)continue;let o=`![${i.format||"PNG"} ${i.width}x${i.height}](...)`;t.textContent=o,t.removeAttribute("title")}return n}var le=100;function M(n,e){for(let t in n.dataset)e.dataset[t]=n.dataset[t]}function I(n,e){n.className&&(e.className=n.className)}function q(n,e,t,i){let a=n.textContent||"",o=a.substring(0,e),r=a.substring(e),s=document.createElement("span");M(n,s),I(n,s),s.classList.add("tp-wrap-container");let l=document.createElement("span");M(n,l),I(n,l),l.textContent=o;let d=document.createElement("br");d.className="tp-wrap-newline";let p=document.createElement("span");if(M(n,p),I(n,p),p.textContent=r,r.length>t){let x=q(p,t,t,i);x.classList.add("tp-wrap-continuation"),s.appendChild(l),s.appendChild(d),s.appendChild(x)}else p.classList.add("tp-wrap-continuation"),s.appendChild(l),s.appendChild(d),s.appendChild(p);let m=n;return m._imageData&&(s._imageData=m._imageData),s}function pe(n,e,t,i){let o=(n.textContent||"").length;if(e+o>t){let r=t-e,s=r>0?r:t,l=q(n,s,t,i);n.parentNode&&n.parentNode.replaceChild(l,n),A(n,l,i);let d=l;for(;d.lastElementChild&&d.lastElementChild instanceof HTMLElement;){let m=d.lastElementChild;if(m.className==="tp-wrap-newline"){let x=m.previousElementSibling;if(x instanceof HTMLElement){d=x;break}break}d=m}let p=d.textContent||"";return{nextElement:d.nextElementSibling,newColumn:p.length}}return{nextElement:n.nextElementSibling,newColumn:e+o}}function F(n,e=le){let{element:t,chunks:i}=n,a=0,o=t.firstElementChild;for(;o;){if(o.tagName==="BR"){a=0,o=o.nextElementSibling;continue}if(!o.textContent){o=o.nextElementSibling;continue}let r=pe(o,a,e,i);a=r.newColumn,o=r.nextElement}return n}function O(n){let{chunks:e}=n;for(let[t,i]of Array.from(e.entries()))for(let a of i){let o=a._imageData;if(!o)continue;let r=o.format||"PNG",s=`data:image/${r.toLowerCase()};base64,${o.base64_data}`,l=document.createElement("span");l.className="tp-chunk-image-container",N(a,l),a.className&&(l.className+=` ${a.className}`);let d=document.createElement("span");d.className="tp-chunk-image",d.textContent=a.textContent;let p=document.createElement("img");p.className="tp-chunk-image-preview",p.src=s,p.alt=`${r} ${o.width}x${o.height}`,l.appendChild(d),l.appendChild(p),a.parentNode&&a.parentNode.replaceChild(l,a),W(t,a,e),k(t,l,e)}return n}function z(n){let{chunks:e,data:t,metadata:i}=n;if(!t.compiled_ir?.subtree_map)return n;for(let[a,o]of Object.entries(t.compiled_ir.subtree_map)){if(o.length===0)continue;let r=i.elementTypeMap[a]||"unknown",s=o[0],l=e.get(s);if(l)for(let m of l)m.classList.add(`tp-first-${r}`);let d=o[o.length-1],p=e.get(d);if(p)for(let m of p)m.classList.add(`tp-last-${r}`)}return n}function U(n,e,t){let i=document.createElement("div");i.className="tp-output-container wrap";let a=new Map,o={element:i,chunks:a,data:n,metadata:e};o=$(o),o=R(o),o=P(o),o=F(o),o=O(o),o=z(o);let r=null;function s(){r&&clearTimeout(r),r=setTimeout(()=>{let c=l();c.size>0&&(t.clearSelections(),t.selectByIds(c))},100)}function l(){let c=window.getSelection();if(!c||c.rangeCount===0||c.isCollapsed)return new Set;let f=c.getRangeAt(0);if(!i.contains(f.commonAncestorContainer))return new Set;let u=new Set;for(let[b,v]of a)for(let h of v)if(document.contains(h)&&d(h,f)){u.add(b);break}return u}function d(c,f){let u=document.createRange();return u.selectNodeContents(c),f.compareBoundaryPoints(Range.START_TO_END,u)>0&&f.compareBoundaryPoints(Range.END_TO_START,u)<0}function p(c){c.key===" "&&!c.shiftKey&&!c.ctrlKey&&!c.metaKey&&(c.preventDefault(),t.getSelections().length>0&&t.commitSelections())}i.tabIndex=0;let m={onStateChanged(c){switch(c.type){case"selections-changed":break;case"chunks-collapsed":x(c.collapsedIds);break;case"chunk-expanded":J(c.expandedId);break;case"state-reset":X();break}}};function x(c){for(let f=0;f<c.length;f++){let u=c[f],b=t.getCollapsedChunk(u);if(!b)continue;let v=0,h=null;for(let Q of b.children){let L=a.get(Q);if(L)for(let E of L)h||(h=E),v+=E.textContent?.length||0,E.style.display="none"}let g=document.createElement("span");g.setAttribute("data-chunk-id",u),g.className="tp-chunk-collapsed",g.textContent=`[${v} chars]`,g.title="Double-click to expand",g.addEventListener("dblclick",()=>{t.expandChunk(u)}),h&&h.parentNode&&h.parentNode.insertBefore(g,h),a.set(u,[g])}}function J(c){let f=t.getCollapsedChunk(c);if(!f)return;let u=a.get(c);if(!u||u.length===0)return;let b=u[0];for(let v of f.children){let h=a.get(v);if(h)for(let g of h)g.style.display=""}b.remove(),a.delete(c)}function X(){console.log("State reset")}return document.addEventListener("selectionchange",s),i.addEventListener("keydown",p),t.addClient(m),{element:o.element,chunkIdToTopElements:o.chunkIdToTopElements,destroy(){document.removeEventListener("selectionchange",s),i.removeEventListener("keydown",p),r&&clearTimeout(r),t.removeClient(m),i.remove(),a.clear()}}}function B(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{let e=Math.random()*16|0;return(n==="x"?e:e&3|8).toString(16)})}var y=class{constructor(e){this.state={visibleSequence:[...e],collapsedChunks:new Map,selections:[]},this.clients=new Set,this.indexMap=this.buildIndexMap()}addSelection(e,t){if(e<0||t>=this.state.visibleSequence.length)throw new Error(`Selection indices out of bounds: [${e}, ${t}] (sequence length: ${this.state.visibleSequence.length})`);if(e>t)throw new Error(`Invalid selection: start (${e}) must be <= end (${t})`);let i={start:e,end:t},a=this.mergeSelections([...this.state.selections,i]);this.state.selections=a,this.notifyClients({type:"selections-changed",selections:a})}clearSelections(){this.state.selections.length!==0&&(this.state.selections=[],this.notifyClients({type:"selections-changed",selections:[]}))}selectByIds(e){let t=new Set(e);if(t.size===0)return;let i=[];for(let s of t){let l=this.indexMap.get(s);l!==void 0?i.push(l):console.error(`selectByIds: Chunk ID "${s}" not found in visible sequence`)}if(i.length===0)return;i.sort((s,l)=>s-l);let a=[],o=i[0],r=i[0];for(let s=1;s<i.length;s++){let l=i[s];l===r+1||(a.push([o,r]),o=l),r=l}a.push([o,r]);for(let[s,l]of a)this.addSelection(s,l)}commitSelections(){if(this.state.selections.length===0)throw new Error("Cannot commit: no active selections");let e=this.state.selections.map((o,r)=>({sel:o,idx:r}));e.sort((o,r)=>r.sel.start-o.sel.start);let t=new Map;for(let{sel:o,idx:r}of e){let{start:s,end:l}=o,d=this.state.visibleSequence.slice(s,l+1),p=B(),m={id:p,children:d,type:"collapsed"};this.state.collapsedChunks.set(p,m),this.state.visibleSequence.splice(s,l-s+1,p),t.set(r,{id:p,range:[s,l]})}this.state.selections=[],this.indexMap=this.buildIndexMap();let i=[],a=[];for(let o=0;o<e.length;o++){let r=t.get(o);i.push(r.id),a.push(r.range)}return this.notifyClients({type:"chunks-collapsed",collapsedIds:i,affectedRanges:a}),i}expandChunk(e){let t=this.state.collapsedChunks.get(e);if(!t)throw new Error(`Collapsed chunk not found: ${e}`);let i=this.state.visibleSequence.indexOf(e);if(i===-1)throw new Error(`Collapsed chunk not in visible sequence: ${e}`);this.state.visibleSequence.splice(i,1,...t.children),this.indexMap=this.buildIndexMap(),this.notifyClients({type:"chunk-expanded",expandedId:e,insertIndex:i})}getVisibleSequence(){return[...this.state.visibleSequence]}getSelections(){return this.state.selections.map(e=>({...e}))}getCollapsedChunk(e){let t=this.state.collapsedChunks.get(e);return t?{...t,children:[...t.children]}:void 0}getState(){return{visibleSequence:[...this.state.visibleSequence],collapsedChunks:new Map(this.state.collapsedChunks),selections:this.state.selections.map(e=>({...e}))}}addClient(e){this.clients.add(e)}removeClient(e){this.clients.delete(e)}buildIndexMap(){let e=new Map;for(let t=0;t<this.state.visibleSequence.length;t++)e.set(this.state.visibleSequence[t],t);return e}mergeSelections(e){if(e.length===0)return[];let t=[...e].sort((o,r)=>o.start-r.start),i=[],a=t[0];for(let o=1;o<t.length;o++){let r=t[o];r.start<=a.end+1?a={start:a.start,end:Math.max(a.end,r.end)}:(i.push(a),a=r)}return i.push(a),i}notifyClients(e){let t=this.getState();for(let i of this.clients)i.onStateChanged(e,t)}};function V(n,e){let t=document.createElement("div");t.className="tp-widget-output";let i=n.ir?.chunks?.map(s=>s.id)||[],a=new y(i),o=U(n,e,a);t.appendChild(o.element);let r=[o];return{element:t,views:r,toolbar:void 0,foldingController:a,destroy(){r.forEach(s=>s.destroy()),t.remove()},addView(s){r.push(s),t.appendChild(s.element)},removeView(s){let l=r.indexOf(s);l!==-1&&(r.splice(l,1),s.element.remove())}}}function w(n){try{let e=n.querySelector('script[data-role="tp-widget-data"]');if(!e||!e.textContent){n.innerHTML='<div class="tp-error">No widget data found</div>';return}let t=JSON.parse(e.textContent);if(!t.ir||!t.ir.chunks){n.innerHTML='<div class="tp-error">No chunks found in widget data</div>';return}let i=_(t),a=V(t,i),o=n.querySelector(".tp-widget-mount");o?(o.innerHTML="",o.appendChild(a.element)):(n.innerHTML="",n.appendChild(a.element)),n._widgetComponent=a}catch(e){console.error("Widget initialization error:",e),n.innerHTML=`<div class="tp-error">Failed to initialize widget: ${e instanceof Error?e.message:String(e)}</div>`}}var K=`/* T-Prompts Widget Styles */

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
  max-width: 110ch;
  word-break: break-all;
  position: relative;
  outline: none; /* Remove focus outline for keyboard events */
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

/* =============================================================================
   LINE WRAPPING STYLES
   ============================================================================= */

/* Line break element created by wrapping transform */
.tp-wrap-newline {
  display: block;
  height: 0;
  line-height: 0;
}

/* Container created when an element is wrapped */
.tp-wrap-container {
  display: inline;
}

/* Continuation lines (after a wrap) - add gutter icon */
.tp-wrap-continuation::before {
  content: '\u21A9';
  position: absolute;
  left: -2ch;
  color: var(--tp-color-muted);
  font-size: 0.9em;
  opacity: 0.6;
  pointer-events: none;
}

/* Dark mode - slightly more visible gutter icon */
@media (prefers-color-scheme: dark) {
  .tp-wrap-continuation::before {
    opacity: 0.5;
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

/* =============================================================================
   COLLAPSED CHUNKS
   ============================================================================= */

/* Collapsed chunk styling */
.tp-chunk-collapsed {
  display: inline-block;
  padding: 2px 6px;
  margin: 0 2px;
  background-color: var(--tp-color-muted-bg, #e0e0e0);
  color: var(--tp-color-muted, #666);
  border-radius: 3px;
  font-size: 0.9em;
  cursor: pointer;
  user-select: none;
}

.tp-chunk-collapsed:hover {
  background-color: var(--tp-color-muted-bg-hover, #d0d0d0);
}

/* Dark mode for collapsed chunks */
@media (prefers-color-scheme: dark) {
  .tp-chunk-collapsed {
    background-color: var(--tp-color-muted-bg, #30363d);
    color: var(--tp-color-muted, #8b949e);
  }

  .tp-chunk-collapsed:hover {
    background-color: var(--tp-color-muted-bg-hover, #40464d);
  }
}
`;var j="47e5a1d5";var Y="0.9.0-alpha";function C(){let n=`tp-widget-styles-${j}`;if(document.querySelector(`#${n}`))return;document.querySelectorAll('[id^="tp-widget-styles"]').forEach(i=>i.remove());let t=document.createElement("style");t.id=n,t.textContent=K,document.head.appendChild(t),window.__TPWidget&&(window.__TPWidget.stylesInjected=!0)}function T(){window.__TPWidget||(window.__TPWidget={version:Y,initWidget:w,stylesInjected:!1})}function G(){T(),C(),document.querySelectorAll("[data-tp-widget]").forEach(e=>{e instanceof HTMLElement&&!e.dataset.tpInitialized&&(w(e),e.dataset.tpInitialized="true")})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",G):G();typeof MutationObserver<"u"&&new MutationObserver(e=>{e.forEach(t=>{t.addedNodes.forEach(i=>{i instanceof HTMLElement&&(i.matches("[data-tp-widget]")&&!i.dataset.tpInitialized&&(T(),C(),w(i),i.dataset.tpInitialized="true"),i.querySelectorAll("[data-tp-widget]").forEach(o=>{o instanceof HTMLElement&&!o.dataset.tpInitialized&&(T(),C(),w(o),o.dataset.tpInitialized="true")}))})})}).observe(document.body,{childList:!0,subtree:!0});return ae(de);})();
//# sourceMappingURL=index.js.map
