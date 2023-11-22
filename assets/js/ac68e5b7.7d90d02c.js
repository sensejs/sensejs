"use strict";(self.webpackChunk_sensejs_sensejs_doc=self.webpackChunk_sensejs_sensejs_doc||[]).push([[881],{2373:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>r,contentTitle:()=>a,default:()=>h,frontMatter:()=>i,metadata:()=>c,toc:()=>l});var s=t(5250),o=t(7766);const i={id:"installation",sidebar_position:1},a="Installation",c={id:"introduction/installation",title:"Installation",description:"SenseJS is a collection of packages that can be used independently, the following packages are the minimum ones you",source:"@site/docs/introduction/installation.md",sourceDirName:"introduction",slug:"/introduction/installation",permalink:"/docs/introduction/installation",draft:!1,unlisted:!1,editUrl:"https://github.com/sensejs/sensejs/edit/master/website/docs/introduction/installation.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{id:"installation",sidebar_position:1},sidebar:"tutorialSidebar",previous:{title:"Introduction",permalink:"/docs/introduction/"},next:{title:"Examples",permalink:"/docs/introduction/hello-world"}},r={},l=[{value:"tsconfig configuration",id:"tsconfig-configuration",level:2},{value:"Compatability",id:"compatability",level:2},{value:"ESM support",id:"esm-support",level:2}];function d(e){const n={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,o.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.h1,{id:"installation",children:"Installation"}),"\n",(0,s.jsx)(n.p,{children:"SenseJS is a collection of packages that can be used independently, the following packages are the minimum ones you\nneed to use SenseJS:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"reflect-metadata"}),", based on which the SenseJS framework accesses the decorator metadata."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"@sensejs/container"}),", the dependency injection implementation of SenseJS."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"@sensejs/core"}),", the module system and core functionality of the framework."]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"In addition to the above packages, you may also need to install the following packages:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"@sensejs/http-common"})," and ",(0,s.jsx)(n.code,{children:"@sensejs/http-koa-platform"}),", the former provides decorators that describe the HTTP\nsemantics, the latter is the implementation based on koa ecosystem."]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"@sensejs/kafkajs-standalone"})," and ",(0,s.jsx)(n.code,{children:"@sensejs/kafkajs"}),", the former is a high-level encapsulation of ",(0,s.jsx)(n.code,{children:"kafkajs"}),",\nthe latter integrates it into the SenseJS framework."]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"@sensejs/config"}),", integrates ",(0,s.jsx)(n.code,{children:"config"})," to SenseJS."]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"tsconfig-configuration",children:"tsconfig configuration"}),"\n",(0,s.jsxs)(n.p,{children:["To use SenseJS, you need to enable ",(0,s.jsx)(n.code,{children:"experimentalDecorators"})," and ",(0,s.jsx)(n.code,{children:"emitDecoratorMetadata"})," in ",(0,s.jsx)(n.code,{children:"tsconfig.json"}),"."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json5",children:'\n{\n  "compileOptions": {\n    //...\n    "experimentalDecorators": true,\n    "emitDecoratorMetadata": true,\n    //...\n  }\n}\n\n'})}),"\n",(0,s.jsx)(n.h2,{id:"compatability",children:"Compatability"}),"\n",(0,s.jsx)(n.p,{children:"SenseJS 0.10.x supports Node.js 14 and above, and it's suggested to use the latest Typescript version.\nThe upcoming SenseJS 0.11.x will drop support for Node.js 14 and below."}),"\n",(0,s.jsx)(n.h2,{id:"esm-support",children:"ESM support"}),"\n",(0,s.jsx)(n.p,{children:"All packages of SenseJS are dual-mode packages, which means they can be used in both CommonJS and ESM environments."})]})}function h(e={}){const{wrapper:n}={...(0,o.a)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(d,{...e})}):d(e)}},7766:(e,n,t)=>{t.d(n,{Z:()=>c,a:()=>a});var s=t(79);const o={},i=s.createContext(o);function a(e){const n=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:a(e.components),s.createElement(i.Provider,{value:n},e.children)}}}]);