"use strict";(self.webpackChunk_sensejs_sensejs_doc=self.webpackChunk_sensejs_sensejs_doc||[]).push([[392],{9172:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>i,contentTitle:()=>l,default:()=>h,frontMatter:()=>t,metadata:()=>o,toc:()=>c});var s=r(5250),d=r(7766);const t={id:"hello-world",sidebar_position:2},l="\u793a\u4f8b",o={id:"introduction/hello-world",title:"\u793a\u4f8b",description:"\u672c\u6587\u5c06\u5c55\u793a\u4e24\u4e2a SenseJS \u5e94\u7528\u4f5c\u4e3a\u793a\u4f8b\u3002",source:"@site/i18n/zh-CN/docusaurus-plugin-content-docs/current/introduction/examples.md",sourceDirName:"introduction",slug:"/introduction/hello-world",permalink:"/zh-CN/docs/introduction/hello-world",draft:!1,unlisted:!1,editUrl:"https://github.com/sensejs/sensejs/edit/master/website/docs/introduction/examples.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{id:"hello-world",sidebar_position:2},sidebar:"tutorialSidebar",previous:{title:"\u5b89\u88c5",permalink:"/zh-CN/docs/introduction/installation"},next:{title:"\u4f9d\u8d56\u6ce8\u5165",permalink:"/zh-CN/docs/injection/"}},i={},c=[{value:"\u914d\u7f6e",id:"\u914d\u7f6e",level:2},{value:"Hello world",id:"hello-world",level:2},{value:"\u4f9d\u8d56\u6ce8\u5165\u793a\u4f8b",id:"\u4f9d\u8d56\u6ce8\u5165\u793a\u4f8b",level:2},{value:"RandomNumberModule",id:"randomnumbermodule",level:3},{value:"HttpModules",id:"httpmodules",level:3},{value:"\u5165\u53e3\u70b9",id:"\u5165\u53e3\u70b9",level:3},{value:"\u8fd0\u884c",id:"\u8fd0\u884c",level:3}];function a(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",ul:"ul",...(0,d.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.h1,{id:"\u793a\u4f8b",children:"\u793a\u4f8b"}),"\n",(0,s.jsx)(n.p,{children:"\u672c\u6587\u5c06\u5c55\u793a\u4e24\u4e2a SenseJS \u5e94\u7528\u4f5c\u4e3a\u793a\u4f8b\u3002"}),"\n",(0,s.jsxs)(n.p,{children:["\u8fd9\u4e9b\u793a\u4f8b\u7684\u4ee3\u7801\u53ef\u4ee5\u4ece ",(0,s.jsx)(n.a,{href:"https://github.com/sensejs/sensejs",children:"SenseJS \u4ee3\u7801\u4ed3\u5e93"})," \u4e2d\u7684 ",(0,s.jsx)(n.a,{href:"https://github.com/sensejs/sensejs/tree/master/examples/",children:"examples"}),"\n\u627e\u5230\u3002"]}),"\n",(0,s.jsx)(n.h2,{id:"\u914d\u7f6e",children:"\u914d\u7f6e"}),"\n",(0,s.jsx)(n.p,{children:"\u8981\u76f4\u63a5\u8fd0\u884c\u4ee3\u7801\u4ed3\u5e93\u4e2d\u7684\u793a\u4f8b\uff0c\u4f60\u9700\u8981\u9996\u5148\u5b89\u88c5\u6240\u6709\u7684\u4f9d\u8d56\u3002"}),"\n",(0,s.jsxs)(n.p,{children:["SenseJS \u7684\u4ee3\u7801\u4ed3\u5e93\u4f7f\u7528 ",(0,s.jsx)(n.a,{href:"https://pnpm.io/",children:"pnpm"})," \u5305\u7ba1\u7406\u5668\uff0c\u6240\u4ee5\u4f60\u5e94\u5f53\u4f7f\u7528\u4e0b\u9762\u7684\u547d\u4ee4"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"pnpm i -r\n"})}),"\n",(0,s.jsx)(n.p,{children:"\u6765\u5b89\u88c5\u4f9d\u8d56\u3002"}),"\n",(0,s.jsx)(n.p,{children:"\u5f53\u7136\uff0c\u5982\u679c\u4f60\u60f3\u8981\u81ea\u5df1\u4ece\u5934\u7f16\u5199\u793a\u4f8b\u4ee3\u7801\uff0c\u4f60\u9700\u8981\u914d\u7f6e\u4e00\u4e2a Node.js \u9879\u76ee\u5e76\u5b89\u88c5\u5982\u4e0b\u4f9d\u8d56\uff1a"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"reflect-metadata"}),", ",(0,s.jsx)(n.code,{children:"@sensejs/http"}),", ",(0,s.jsx)(n.code,{children:"@sensejs/core"}),"\u3002\u8fd9\u662f\u793a\u4f8b\u8fd0\u884c\u6240\u9700\u8981\u7684\u4f9d\u8d56\uff1b"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"typescript"}),". \u5e94\u5f53\u5c06\u5176\u4f5c\u4e3a\u5f00\u53d1\u4f9d\u8d56\u5b89\u88c5\u5230\u4f60\u7684\u793a\u4f8b\u9879\u76ee\u4e2d\uff0c\u9664\u975e\u4f60\u5c06\u5176\u5b89\u88c5\u5230\u4e86\u5168\u5c40\uff1b"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"ts-node"}),"\uff08\u53ef\u9009\uff09\uff0c\u672c\u6587\u4e2d\u4f1a\u901a\u8fc7 ",(0,s.jsx)(n.code,{children:"ts-node"})," \u6765\u8fd0\u884c\u793a\u4f8b\u4ee3\u7801\uff0c\u4f60\u4e5f\u4ee5\u5c06\u4ee3\u7801\u7f16\u8bd1\u540e\u8fd0\u884c\u7f16\u8bd1\u4ea7\u51fa\u7684\u6587\u4ef6\u3002"]}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.p,{children:["\u540c\u65f6\u4f60\u9700\u8981\u53c2\u8003",(0,s.jsx)(n.a,{href:"/zh-CN/docs/introduction/installation",children:"\u524d\u6587"}),"\u4e2d\u7684\u6b65\u9aa4\u6765\u914d\u7f6e ",(0,s.jsx)(n.code,{children:"tsconfig.json"}),"\u3002"]}),"\n",(0,s.jsx)(n.h2,{id:"hello-world",children:"Hello world"}),"\n",(0,s.jsxs)(n.p,{children:["\u8fd9\u4e2a\u793a\u4f8b\u53ea\u6709\u4e00\u4e2a\u540d\u4e3a ",(0,s.jsx)(n.code,{children:"main.ts"})," \u7684\u6587\u4ef6\uff0c\u5185\u5bb9\u5982\u4e0b\uff1a"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"import 'reflect-metadata';\nimport {createKoaHttpModule, Controller, GET} from '@sensejs/http';\nimport {ApplicationRunner, ModuleClass, OnModuleCreate} from '@sensejs/core';\n\n@Controller('/')\nclass HelloWorldController {\n\n  @GET('/')\n  helloWorld() {\n    return 'hello world';\n  }\n\n}\n\n@ModuleClass({\n  requires: [\n    createKoaHttpModule({\n      components: [HelloWorldController],\n      httpOption: {\n        listenAddress: 'localhost',\n        listenPort: 8080,\n      }\n    })\n  ]\n})\nclass HelloWorldApp {\n\n  @OnModuleStart()\n  onModuleCreate() {\n    console.log('service started');\n  }\n}\n\nApplicationRunner.instance.start(HelloWorldApp);\n"})}),"\n",(0,s.jsx)(n.p,{children:"\u53ef\u4ee5\u901a\u8fc7\u5982\u4e0b\u547d\u4ee4\u8fd0\u884c\u8fd9\u4e2a\u793a\u4f8b"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"ts-node main.ts\n"})}),"\n",(0,s.jsxs)(n.p,{children:["\u4e0a\u9762\u7684\u4ee3\u7801\u662f\u521b\u5efa\u4e86\u4e00\u4e2a\u7b80\u5355\u7684 HTTP \u670d\u52a1\uff0c\u76d1\u542c ",(0,s.jsx)(n.code,{children:"localhost:8080"}),"\u3002"]}),"\n",(0,s.jsxs)(n.p,{children:["\u542f\u52a8\u4e4b\u540e\uff0c\u4f60\u53ef\u4ee5\u901a\u8fc7 HTTP \u5ba2\u6237\u7aef\uff0c\u5982 curl\uff0c\u8bbf\u95ee ",(0,s.jsx)(n.code,{children:"http://localhost:8080/"})," \u5e76\u89c2\u5bdf\u5176\u8f93\u51fa\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ curl localhost:8080\nhello world\n"})}),"\n",(0,s.jsxs)(n.p,{children:["\u6bcf\u6b21\u6211\u4eec\u53d1\u8d77\u5230 ",(0,s.jsx)(n.code,{children:"http://localhost:8080/"})," \u7684 HTTP \u8bf7\u6c42\u65f6\uff0c",(0,s.jsx)(n.code,{children:"HelloWorldController"})," \u90fd\u4f1a\u88ab\u5b9e\u4f8b\u5316\u4e00\u6b21\uff0c\u4e14\u5176 ",(0,s.jsx)(n.code,{children:"helloWorld"}),"\n\u65b9\u6cd5\u5c06\u4f1a\u88ab\u8c03\u7528\uff0c\u5e76\u4e14\u5176\u8fd4\u56de\u503c\u5c06\u4f5c\u4e3a\u54cd\u5e94\u7684\u5185\u5bb9\u8fd4\u56de\u7ed9 HTTP \u5ba2\u6237\u7aef\u3002"]}),"\n",(0,s.jsx)(n.h2,{id:"\u4f9d\u8d56\u6ce8\u5165\u793a\u4f8b",children:"\u4f9d\u8d56\u6ce8\u5165\u793a\u4f8b"}),"\n",(0,s.jsx)(n.p,{children:"\u5728\u8fd9\u4e2a\u793a\u4f8b\u4e2d\uff0c\u6211\u4eec\u5c06\u5c55\u793aSenseJS\u6846\u67b6\u4e0b\u4f9d\u8d56\u6ce8\u5165\u662f\u600e\u6837\u8fdb\u884c\u7684\u3002"}),"\n",(0,s.jsx)(n.p,{children:"\u8fd9\u4e2a\u793a\u4f8b\u7684\u4ee3\u7801\u53ef\u4ee5\u5206\u4e3a\u4e09\u90e8\u5206\uff1a"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"random-number.ts"}),"\uff1a\u5305\u542b\u4e00\u4e2a\u7b80\u5355\u7684\u7ec4\u4ef6 ",(0,s.jsx)(n.code,{children:"RandomNumberGenerator"})," \u548c\u4e00\u4e2a HTTP \u63a7\u5236\u5668 ",(0,s.jsx)(n.code,{children:"RandomNumberController"}),"\n\u7528\u6765\u67e5\u8be2\u6216\u6539\u53d8\u524d\u8005\u7684\u72b6\u6001\uff0c\u5b83\u4eec\u5c06\u4f1a\u901a\u8fc7 ",(0,s.jsx)(n.code,{children:"RandomNumberModule"})," \u5411\u5916\u5bfc\u51fa\u3002"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"http.module.ts"}),"\uff1a\u5305\u542b\u4e86\u914d\u7f6e\u4e00\u4e2a HTTP \u670d\u52a1\uff0c\u53ca\u5176\u6240\u9700\u7684\u4e2d\u95f4\u4ef6\u7684\u4ee3\u7801"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"index.ts"}),"\uff1a\u8fd9\u4e2a\u793a\u4f8b\u7684\u5165\u53e3\u70b9\u3002"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.h3,{id:"randomnumbermodule",children:"RandomNumberModule"}),"\n",(0,s.jsxs)(n.p,{children:["\u8fd9\u4e00\u5c0f\u8282\u91cd\u70b9\u5173\u6ce8 ",(0,s.jsx)(n.code,{children:"random-number.module.ts"})]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"@Component()\n@Scope(Scope.SINGLETON)\nclass RandomNumberGenerator {\n\n  private state: number = Date.now() >>> 0; // Truncate the value of Date.now() into a 32-bit integer\n\n  reseed(seed: number) {\n    this.state = seed >>>= 0;\n    return this.state;\n  }\n\n  query() {\n    return this.state;\n  }\n\n  next() {\n    this.state = (this.state * 64829 + 0x5555) >>> 0;\n    return this.state;\n  }\n}\n"})}),"\n",(0,s.jsxs)(n.p,{children:["\u5982\u4f60\u6240\u89c1\uff0c",(0,s.jsx)(n.code,{children:"RandomNumberGenerator"})," \u88ab\u88c5\u9970\u5668 ",(0,s.jsx)(n.code,{children:"@Component()"})," \u88c5\u9970\uff0c\u4f7f\u5176\u6210\u4e3a\u4e00\u4e2a\u7ec4\u4ef6\u5e76\u53ef\u6ce8\u5165\u5230\u6240\u9700\u7684\u5bf9\u8c61\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"\n@Controller('/')\nclass RandomNumberController {\n\n  constructor(@Inject(RandomNumberGenerator) private generator: RandomNumberGenerator,\n              @InjectLogger() private logger: Logger) {}\n\n  @GET('state')\n  async get() {\n    const state = this.generator.query();\n    return {state};\n  }\n\n  @POST('next')\n  async nextRandom() {\n    const value = this.generator.next();\n    this.logger.info('Generated random number: ', value);\n    return {value};\n  }\n\n  @POST('reseed')\n  async reseed(@Body() body: any) {\n    const seed = Number(body?.seed);\n    if (!Number.isInteger(seed)) {\n      this.logger.warn('Invalid seed %s, ignored', seed);\n    } else {\n      this.generator.reseed(seed);\n    }\n    return {state: this.generator.query()};\n  }\n}\n\n"})}),"\n",(0,s.jsxs)(n.p,{children:["\u4e0a\u9762\u7684\u7c7b\u63d0\u4f9b\u4e86\u4e00\u4e2a HTTP \u63a7\u5236\u5668\uff0c\u7528\u6765\u67e5\u8be2\u6216\u8005\u6539\u53d8 ",(0,s.jsx)(n.code,{children:"RandomNumberGenerator"})," \u7684\u72b6\u6001\uff0c\u5b83\u7684\u6784\u9020\u51fd\u6570\u5305\u542b\u4e86\u4e24\u4e2a\u53c2\u6570\u3002"]}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\u7b2c\u4e00\u4e2a\u53c2\u6570\u8981\u6c42\u4f20\u5165\u524d\u9762\u5b9a\u4e49\u7684 ",(0,s.jsx)(n.code,{children:"RandomNumberGenerator"})," \u7c7b\u578b\u7684\u5bf9\u8c61"]}),"\n",(0,s.jsxs)(n.li,{children:["\u7b2c\u4e8c\u4e2a\u53c2\u6570\u8981\u6c42\u4f20\u5165 ",(0,s.jsx)(n.code,{children:"Logger"})," \u7c7b\u578b\u7684\u5bf9\u8c61\u3002"]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"\u5728\u6846\u67b6\u5b9e\u4f8b\u5316\u8fd9\u4e2a\u63a7\u5236\u5668\u7684\u65f6\u5019\uff0c\u8fd9\u4e9b\u53c2\u6570\u4e5f\u4f1a\u81ea\u52a8\u5730\u88ab\u5b9e\u4f8b\u5316\u5e76\u4ece\u6784\u9020\u51fd\u6570\u53c2\u6570\u6ce8\u5165\u3002"}),"\n",(0,s.jsxs)(n.p,{children:["\u5f53\u6536\u5230\u8bf7\u6c42\u65f6\uff0c\u6846\u67b6\u4f1a\u5b9e\u4f8b\u5316 ",(0,s.jsx)(n.code,{children:"RandomNumberController"}),"\uff0c\u5e76\u8c03\u7528\u67d0\u4e2a\u9002\u7528\u7684\u65b9\u6cd5\uff1b\u5982\u679c\u8fd9\u4e2a\u65b9\u6cd5\u9700\u8981\u53c2\u6570\uff0c\u540c\u6837\u5730\uff0c\u6846\u67b6\u4e5f\u4f1a\u6839\u636e\u6bcf\u4e2a\u53c2\u6570\u5bf9\u5e94\u7684\u88c5\u9970\u5668\u6240\u63d0\u4f9b\u7684\u4fe1\u606f\uff0c\u6ce8\u5165\u8fd9\u4e9b\u53c2\u6570\u3002"]}),"\n",(0,s.jsxs)(n.p,{children:["\u6bd4\u5982\uff0c\u5728\u5904\u7406 ",(0,s.jsx)(n.code,{children:"POST /reseed"})," \u8bf7\u6c42\u65f6\uff0c\u8bf7\u6c42\u4f53\u5c06\u4f5c\u4e3a ",(0,s.jsx)(n.code,{children:"reseed"})," \u65b9\u6cd5\u7684\u53c2\u6570\u88ab\u6ce8\u5165\u3002"]}),"\n",(0,s.jsxs)(n.p,{children:["\u8fd9\u4e2a\u6587\u4ef6\u7684\u6700\u540e, ",(0,s.jsx)(n.code,{children:"RandomNumberGenerator"})," \u548c ",(0,s.jsx)(n.code,{children:"RandomNumberController"})," \u88ab\u6253\u5305\u6210\u4e00\u4e2a\u6a21\u5757 ",(0,s.jsx)(n.code,{children:"RandomNumberModule"}),"\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"\nexport const RandomNumberModule = createModule({\n  components: [RandomNumberGenerator, RandomNumberController]\n});\n"})}),"\n",(0,s.jsx)(n.h3,{id:"httpmodules",children:"HttpModules"}),"\n",(0,s.jsxs)(n.p,{children:["\u8fd9\u4e00\u5c0f\u8282\u6211\u4eec\u5c06\u5173\u6ce8\u53e6\u5916\u4e00\u4e2a\u6587\u4ef6 ",(0,s.jsx)(n.code,{children:"./src/http.module.ts"}),"\u3002"]}),"\n",(0,s.jsx)(n.p,{children:"\u6211\u4eec\u4f1a\u4ece\u540e\u5f80\u524d\uff0c\u89e3\u91ca\u8fd9\u4e2a\u6587\u4ef6\u7684\u5185\u5bb9\u3002"}),"\n",(0,s.jsxs)(n.p,{children:["\u6587\u4ef6\u7684\u6700\u540e\uff0c\u521b\u5efa\u4e86\u4e00\u4e2a ",(0,s.jsx)(n.code,{children:"createKoaHttpModule"})," \u521b\u5efa\u4e86\u4e00\u4e2a\u6a21\u5757\uff0c\u548c Hello World \u793a\u4f8b\u7c7b\u4f3c\uff0c\u4f46\u989d\u5916\u6dfb\u52a0\u4e86\u4e24\u4e2a\u4e2d\u95f4\u4ef6\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"export const HttpModule = createKoaHttpModule({\n  // We need to list RandomNumberModule here so that RandomNumberController can be discovered\n  requires: [SenseLogModule, RandomNumberModule],\n\n  // The order must not be changed, since REQUEST_ID is not defined before RequestIdMiddleware\n  middlewares: [\n    RequestIdMiddleware,\n    ContextualLoggingMiddleware\n  ],\n\n  httpOption: {\n    listenAddress: 'localhost',\n    listenPort: 8080,\n  },\n});\n\n"})}),"\n",(0,s.jsx)(n.p,{children:"\u8fd9\u4e24\u4e2a\u4e2d\u95f4\u4ef6\u8fd9\u4e2a\u6587\u4ef6\u7684\u524d\u9762\u5b9a\u4e49\u7684\u3002"}),"\n",(0,s.jsxs)(n.p,{children:["\u7b2c\u4e00\u4e2a\u4e2d\u95f4\u4ef6\uff0c",(0,s.jsx)(n.code,{children:"RequestIdMiddleware"})," \u4e3a\u6bcf\u4e2a\u8bf7\u6c42\u5206\u914d\u4e00\u4e2a\u8bf7\u6c42 ID\uff0c\u5e76\u5c06\u5176\u7ed1\u5b9a\u5230\u4e00\u4e2a symbol \u7c7b\u578b\u7684\u5e38\u91cf ",(0,s.jsx)(n.code,{children:"REQUEST_ID"}),"\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"import {randomUUID} from 'crypto';\n\nconst REQUEST_ID = Symbol('REQUEST_ID');\n\n@Middleware({\n  provides: [REQUEST_ID]\n})\nclass RequestIdMiddleware {\n\n  async intercept(next: (requestId: string) => Promise<void>) {\n    const requestId = randomUUID();\n    // The parameter passed to next() will be bound to REQUEST_ID\n    await next(requestId);\n  }\n}\n"})}),"\n",(0,s.jsxs)(n.p,{children:["\u7b2c\u4e8c\u4e2a\u4e2d\u95f4\u4ef6\uff0c",(0,s.jsx)(n.code,{children:"ContextualLoggingMiddleware"})," \u4ece\u524d\u4e00\u4e2a\u4e2d\u95f4\u4ef6\u4e2d\u6ce8\u5165\u4e86\u8bf7\u6c42 ID\uff0c\u5e76\u5c06\u5176\u5173\u8054\u5230\u4e00\u4e2a logger builder\n\u4e0a\uff0c\u5b9e\u9645\u4e0a\u5728\u672c\u6b21\u8bf7\u6c42\u4e2d\uff0c\u5b83\u8986\u76d6\u4e86\u5168\u5c40\u7684 logger builder\uff0c\u6240\u4ee5\u672c\u6b21\u8bf7\u6c42\u4e2d\u521b\u5efa\u7684\u6240\u6709 logger \u90fd\u4f1a\u5171\u4eab\u540c\u4e00\u4e2a\u8bf7\u6c42\nID\uff0c\u800c\u5b83\u4eec\u8f93\u51fa\u7684\u65e5\u5fd7\u4e5f\u53ef\u4ee5\u5f88\u5bb9\u6613\u5730\u6839\u636e\u8bf7\u6c42 ID \u8fdb\u884c\u533a\u5206\u3002\u8fd9\u5728\u4f60\u60f3\u8981\u533a\u5206\u4e0d\u540c\u5e76\u53d1\u8bf7\u6c42\u7684\u4ea7\u751f\u65e5\u5fd7\u65f6\u975e\u5e38\u6709\u7528\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"\n@Middleware({\n  provides: [LoggerBuilder]\n})\nclass ContextualLoggingMiddleware {\n\n  constructor(\n    // It'll be injected with a value provided by the previous interceptor\n    @Inject(REQUEST_ID) private requestId: string,\n    // It'll be injected with the LoggerBuilder defined in the global\n    @InjectLogger() private logger: Logger\n  ) {}\n\n  async intercept(next: (lb: LoggerBuilder) => Promise<void>) {\n    this.logger.debug('Associate LoggerBuilder with requestId=%s', this.requestId);\n    const slb = defaultLoggerBuilder.setTraceId(this.requestId);\n    // The parameter passed to next() will be bound to LoggerBuilder\n    await next(slb);\n  }\n\n}\n\n"})}),"\n",(0,s.jsx)(n.h3,{id:"\u5165\u53e3\u70b9",children:"\u5165\u53e3\u70b9"}),"\n",(0,s.jsxs)(n.p,{children:["\u5728\u7a0b\u5e8f\u7684\u5165\u53e3\u6587\u4ef6\uff0c\u6211\u4eec\u9996\u5148\u8981\u5bfc\u5165 ",(0,s.jsx)(n.code,{children:'"reflect-metadata"'}),"\uff0c\u7136\u540e\u521b\u5efa\u4e00\u4e2a\u6a21\u5757\u5e76\u6807\u8bb0\u5b83\u4e3a\u5165\u53e3\u70b9\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-typescript",children:"import 'reflect-metadata';\nimport {EntryPoint, ModuleClass} from '@sensejs/core';\nimport {HttpModule} from './http.js';\n\n@EntryPoint()\n@ModuleClass({\n  requires: [\n    HttpModule\n  ],\n})\nclass App {\n}\n\n"})}),"\n",(0,s.jsx)(n.p,{children:"\u4ee5\u4e0a\u3002"}),"\n",(0,s.jsx)(n.h3,{id:"\u8fd0\u884c",children:"\u8fd0\u884c"}),"\n",(0,s.jsxs)(n.p,{children:["\u4f60\u53ef\u4ee5\u8fd0\u884c\u8fd9\u4e2a\u793a\u4f8b\uff0c\u5e76\u901a\u8fc7 ",(0,s.jsx)(n.code,{children:"curl"})," \u547d\u4ee4\u6765\u8bbf\u95ee\u5b83\uff0c\u4f60\u4f1a\u770b\u5230\u7c7b\u4f3c\u4e0b\u9762\u7684\u8f93\u51fa\u3002"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:'% curl http://localhost:8080/state\n{"state":4005820056}\n\n% curl http://localhost:8080/next -XPOST\n{"value":2405846925}\n\n% curl http://localhost:8080/next -XPOST\n{"value":1207935726}\n\n% curl http://localhost:8080/reseed -d \'seed=1111\'\n{"state":1111}\n\n% curl http://localhost:8080/reseed -d \'seed=invalid\'\n{"state":1111}\n\ncurl http://localhost:8080/next -XPOST\n{"value":72046864}\n\n'})}),"\n",(0,s.jsx)(n.p,{children:"\u800c\u5e94\u7528\u65e5\u5fd7\u5219\u4f1a\u8f93\u51fa\u7c7b\u4f3c\u4e0b\u9762\u7684\u5185\u5bb9\u3002"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"+ 16:51:05.494 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=25c469ea-2c9f-4ade-9d1f-a2603e509402\n+ 16:51:09.609 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=19ad7258-08b6-4fec-8d0b-042067fa5bf8\n+ 16:51:09.609 RandomNumberController 19ad7258-08b6-4fec-8d0b-042067fa5bf8 | Generated random number:  2405846925\n+ 16:51:11.922 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=9b9c909b-ba79-48f2-8fa4-febd39dc781f\n+ 16:51:11.923 RandomNumberController 9b9c909b-ba79-48f2-8fa4-febd39dc781f | Generated random number:  1207935726\n+ 16:51:16.972 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=fa3c6df8-ccca-48d4-85ba-88520ca98986\n+ 16:51:20.076 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=7d840e09-f95d-48e2-b398-e60cf192e801\n+ 16:51:20.077 RandomNumberController 7d840e09-f95d-48e2-b398-e60cf192e801 | Invalid seed NaN, ignored\n+ 16:51:22.194 ContextualLoggingMiddleware - | Associate LoggerBuilder with requestId=67ce037b-5d64-4a16-a57d-fba78ceed8f8\n+ 16:51:22.194 RandomNumberController 67ce037b-5d64-4a16-a57d-fba78ceed8f8 | Generated random number:  72046864\n"})})]})}function h(e={}){const{wrapper:n}={...(0,d.a)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(a,{...e})}):a(e)}},7766:(e,n,r)=>{r.d(n,{Z:()=>o,a:()=>l});var s=r(79);const d={},t=s.createContext(d);function l(e){const n=s.useContext(t);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(d):e.components||d:l(e.components),s.createElement(t.Provider,{value:n},e.children)}}}]);