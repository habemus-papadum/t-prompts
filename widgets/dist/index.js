"use strict";var TPromptsWidgets=(()=>{var r=Object.defineProperty;var n=Object.getOwnPropertyDescriptor;var a=Object.getOwnPropertyNames;var s=Object.prototype.hasOwnProperty;var d=(o,e)=>{for(var t in e)r(o,t,{get:e[t],enumerable:!0})},l=(o,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let p of a(e))!s.call(o,p)&&p!==t&&r(o,p,{get:()=>e[p],enumerable:!(i=n(e,p))||i.enumerable});return o};var c=o=>l(r({},"__esModule",{value:!0}),o);var h={};d(h,{VERSION:()=>u,renderPrompt:()=>m});function m(o,e,t={}){let i=document.createElement("div");i.className="t-prompts-widget",i.innerHTML=`
    <div style="border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
      <h4>t-prompts Visualization (placeholder)</h4>
      <pre>${JSON.stringify(e,null,2)}</pre>
      <p>Options: ${JSON.stringify(t)}</p>
    </div>
  `,o.appendChild(i)}var u="0.9.0-alpha";return c(h);})();
//# sourceMappingURL=index.js.map
