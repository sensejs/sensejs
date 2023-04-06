"use strict";(self.webpackChunksensejs_doc=self.webpackChunksensejs_doc||[]).push([[295],{4852:(e,n,t)=>{t.d(n,{Zo:()=>c,kt:()=>h});var r=t(9231);function a(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function o(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);n&&(r=r.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,r)}return t}function i(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?o(Object(t),!0).forEach((function(n){a(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):o(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,r,a=function(e,n){if(null==e)return{};var t,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)t=o[r],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var s=r.createContext({}),d=function(e){var n=r.useContext(s),t=n;return e&&(t="function"==typeof e?e(n):i(i({},n),e)),t},c=function(e){var n=d(e.components);return r.createElement(s.Provider,{value:n},e.children)},p="mdxType",u={inlineCode:"code",wrapper:function(e){var n=e.children;return r.createElement(r.Fragment,{},n)}},m=r.forwardRef((function(e,n){var t=e.components,a=e.mdxType,o=e.originalType,s=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),p=d(t),m=a,h=p["".concat(s,".").concat(m)]||p[m]||u[m]||o;return t?r.createElement(h,i(i({ref:n},c),{},{components:t})):r.createElement(h,i({ref:n},c))}));function h(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var o=t.length,i=new Array(o);i[0]=m;var l={};for(var s in n)hasOwnProperty.call(n,s)&&(l[s]=n[s]);l.originalType=e,l[p]="string"==typeof e?e:a,i[1]=l;for(var d=2;d<o;d++)i[d]=t[d];return r.createElement.apply(null,i)}return r.createElement.apply(null,t)}m.displayName="MDXCreateElement"},113:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>s,contentTitle:()=>i,default:()=>u,frontMatter:()=>o,metadata:()=>l,toc:()=>d});var r=t(5675),a=(t(9231),t(4852));const o={id:"injection",sidebar_position:3},i="Injection",l={unversionedId:"overview/injection",id:"overview/injection",title:"Injection",description:"SenseJS framework provides an advanced injection framework, which features",source:"@site/docs/overview/injection.md",sourceDirName:"overview",slug:"/overview/injection",permalink:"/docs/overview/injection",draft:!1,editUrl:"https://github.com/sensejs/sensejs/edit/master/website/docs/overview/injection.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{id:"injection",sidebar_position:3},sidebar:"tutorialSidebar",previous:{title:"Hello world",permalink:"/docs/overview/hello-world"},next:{title:"Module",permalink:"/docs/overview/module"}},s={},d=[{value:"Example",id:"example",level:2},{value:"<code>RandomNumberModule</code>",id:"randomnumbermodule",level:3},{value:"Handling and intercepting an HTTP request",id:"handling-and-intercepting-an-http-request",level:3},{value:"Entrypoint",id:"entrypoint",level:3},{value:"Running",id:"running",level:2},{value:"More ways to define injectable",id:"more-ways-to-define-injectable",level:2},{value:"Constants",id:"constants",level:3},{value:"Factories",id:"factories",level:3}],c={toc:d},p="wrapper";function u(e){let{components:n,...t}=e;return(0,a.kt)(p,(0,r.Z)({},c,t,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"injection"},"Injection"),(0,a.kt)("p",null,"SenseJS framework provides an advanced injection framework, which features"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Constructor parameters injection, which is exactly what your expected for a common IoC framework")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Interceptors provided injectable support, which is the most powerful and elegant part of SenseJs. In this article,\nwe'll show you that it's very useful when combining with a traceable logger.")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Method parameters injection, based on which the ",(0,a.kt)("inlineCode",{parentName:"p"},"@sensejs/http")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"@sensejs/kafka")," handle requests and messages,\nand such ability can also be useful when you're integrating some protocol other than HTTP and Kafka."))),(0,a.kt)("h2",{id:"example"},"Example"),(0,a.kt)("p",null,"We'll show you all the powerful features in an example."),(0,a.kt)("p",null,"The code of ths example can be found at the directory ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/sensejs/sensejs/tree/master/examples/injection"},"./examples/injection")," in the ","[SenseJs repository]","."),(0,a.kt)("p",null,"This example we separate the code into three parts."),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},(0,a.kt)("inlineCode",{parentName:"p"},"random-number.ts"),": contains a simple component ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberGenerator")," and a controller ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberController")," for querying or mutating the state\nof ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberGenerator"),", and exporting it as a module ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberModule"),".")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},(0,a.kt)("inlineCode",{parentName:"p"},"http.ts"),": containing the code for setting up an HTTP server, including all interceptors."))),(0,a.kt)("h3",{id:"randomnumbermodule"},(0,a.kt)("inlineCode",{parentName:"h3"},"RandomNumberModule")),(0,a.kt)("p",null,"This section we focused on file ",(0,a.kt)("inlineCode",{parentName:"p"},"random-number.module.ts")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"@Component()\n@Scope(Scope.SINGLETON)\nclass RandomNumberGenerator {\n\n  private state: number = Date.now() >>> 0; // Truncate the value of Date.now() into a 32-bit integer\n\n  reseed(seed: number) {\n    this.state = seed >>>= 0;\n    return this.state;\n  }\n\n  query() {\n    return this.state;\n  }\n\n  next() {\n    this.state = (this.state * 64829 + 0x5555) >>> 0;\n    return this.state;\n  }\n}\n")),(0,a.kt)("p",null,"In addition to ",(0,a.kt)("inlineCode",{parentName:"p"},"@Component()"),", it's also decorated with ",(0,a.kt)("inlineCode",{parentName:"p"},"@Scope(Scope.SINGLETON)")," as we want to ensure that there is\nonly one instance of ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberGenerator")," exists."),(0,a.kt)("p",null,"In addition to the ",(0,a.kt)("inlineCode",{parentName:"p"},"SINGLETON")," scope, a component can also be marked as",(0,a.kt)("inlineCode",{parentName:"p"},"REQUEST")," scope or ",(0,a.kt)("inlineCode",{parentName:"p"},"TRANSIENT")," scope (which is\nthe default). The differences between them are explained below:"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"SINGLETON"),": Only instantiated once during the application lifetime."),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"REQUEST"),": Only instantiated once each time when the IoC Container is requested to instantiate it or its dependents."),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("inlineCode",{parentName:"li"},"TRANSIENT"),":  Create instances each time for each param that needs such a component.")),(0,a.kt)("p",null,"Then we define the controller ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberController")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"\n@Controller('/')\nclass RandomNumberController {\n\n  constructor(@Inject(RandomNumberGenerator) private generator: RandomNumberGenerator,\n              @InjectLogger() private logger: Logger) {}\n\n  @GET('/')\n  async get() {\n    const state = this.generator.query();\n    return {state};\n  }\n\n  @POST('/next')\n  async next() {\n    const value = this.generator.query();\n    return {value};\n  }\n\n  @POST('/seed')\n  async seed(@Body('seed') seed: any) {\n    const state = Number(seed);\n    if (!Number.isInteger(state)) {\n      this.logger.warn('Invalid seed %s', seed);\n    }\n    this.generator.reseed(state);\n     return {state}\n  }\n}\n\n")),(0,a.kt)("p",null,"The above code provides an HTTP interface to query or mutate the state of ",(0,a.kt)("inlineCode",{parentName:"p"},"RandomNumberGenerator"),"."),(0,a.kt)("p",null,"When handling ",(0,a.kt)("inlineCode",{parentName:"p"},"POST /seed"),", the ",(0,a.kt)("inlineCode",{parentName:"p"},"seed")," field in post body is injected as the parameter, and you can inject any valid\ninjectable to method parameters just like constructor parameter injection. They acts differently only when the\ncontroller is declared in singleton scope, while method parameter injection always happens on request scope."),(0,a.kt)("p",null,"Also note that ",(0,a.kt)("inlineCode",{parentName:"p"},"@InjectLogger()")," is actually injecting a ",(0,a.kt)("inlineCode",{parentName:"p"},"LoggerBuilder")," and transformed to a logger. We'll later\noverride ",(0,a.kt)("inlineCode",{parentName:"p"},"LoggerBuilder")," in an interceptor in this example"),(0,a.kt)("p",null,"Finally, we package them into a module and export it."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"\nexport const RandomNumberModule = createModule({\n  components: [RandomNumberGenerator, RandomNumberController]\n});\n")),(0,a.kt)("h3",{id:"handling-and-intercepting-an-http-request"},"Handling and intercepting an HTTP request"),(0,a.kt)("p",null,"In this section we focused on another file ",(0,a.kt)("inlineCode",{parentName:"p"},"./src/http.ts"),"."),(0,a.kt)("p",null,"As mentioned above, we'll show you how interceptors works in this example."),(0,a.kt)("p",null,"First we intercept all requests and assign each of them with a request id"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"import {randomUUID} from 'crypto';\n\nconst REQUEST_ID = Symbol('REQUEST_ID');\n\n@MiddlewareClass(REQUEST_ID)\nclass RequestIdProviderInterceptor {\n\n  async intercept(next: (requestId: string) => Promise<void>) {\n    const requestId = randomUUID();\n    await next(requestId);\n  }\n}\n")),(0,a.kt)("p",null,"And then we'll attach the request id to a traceable logger,"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"\n@MiddlewareClass(LoggerBuilder)\nclass ContextualLoggingInterceptProvider {\n\n  constructor(\n    // It'll be injected with value provided by previous interceptor\n    @Inject(REQUEST_ID) private requestId: string,\n    // It'll be injected with globally defined LoggerBuilder\n    @InjectLogger() private logger: Logger\n  ) {}\n\n  async intercept(next: (lb: LoggerBuilder) => Promise<void>) {\n    this.logger.debug('Associate LoggerBuilder with requestId=%s', this.requestId);\n    const slb = defaultLoggerBuilder.setTraceId(this.requestId);\n    await next(slb);\n  }\n\n}\n\n")),(0,a.kt)("p",null,"And finally we combine the dependencies and the above interceptors to create an HTTP module and export it."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"export const HttpModule = createKoaHttpModule({\n  // We need list RandomNumberModule here, so that RandomNumberController can be discovered\n  requires: [SenseLogModule, RandomNumberModule],\n\n  // The order must not be changed, since REQUEST_ID is not a valid injetable before RequestIdProviderInterceptor\n  globalInterceptProviders: [\n    RequestIdProviderInterceptor,\n    ContextualLoggingInterceptProvider\n  ],\n\n  httpOption: {\n    listenAddress: 'localhost',\n    listenPort: 8080,\n  },\n});\n\n")),(0,a.kt)("h3",{id:"entrypoint"},"Entrypoint"),(0,a.kt)("p",null,"Before create a module and mark it as entry point, we need to import ",(0,a.kt)("inlineCode",{parentName:"p"},'"reflect-metadat"')," at first place."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"import 'reflect-metadata';\nimport {EntryPoint, ModuleClass} from '@sensejs/core';\nimport {HttpModule} from './http.js';\n\n@EntryPoint()\n@ModuleClass({\n  requires: [\n    HttpModule\n  ],\n})\nclass App {\n}\n\n")),(0,a.kt)("h2",{id:"running"},"Running"),(0,a.kt)("p",null,"You can run this app and send request with curl, you'll see output like this"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},'% curl http://localhost:8080/state\n{"state":4005820056}\n\n% curl http://localhost:8080/next -XPOST\n{"value":2405846925}\n\n% curl http://localhost:8080/next -XPOST\n{"value":1207935726}\n\n% curl http://localhost:8080/reseed -d \'seed=1111\'\n{"state":1111}\n\n% curl http://localhost:8080/reseed -d \'seed=invalid\'\n{"state":1111}\n\ncurl http://localhost:8080/next -XPOST\n{"value":72046864}\n\n')),(0,a.kt)("p",null,"On the application log, you'll see something like"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre"},"+ 16:51:05.494 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=25c469ea-2c9f-4ade-9d1f-a2603e509402\n+ 16:51:09.609 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=19ad7258-08b6-4fec-8d0b-042067fa5bf8\n+ 16:51:09.609 RandomNumberController 19ad7258-08b6-4fec-8d0b-042067fa5bf8 | Generated random number:  2405846925\n+ 16:51:11.922 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=9b9c909b-ba79-48f2-8fa4-febd39dc781f\n+ 16:51:11.923 RandomNumberController 9b9c909b-ba79-48f2-8fa4-febd39dc781f | Generated random number:  1207935726\n+ 16:51:16.972 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=fa3c6df8-ccca-48d4-85ba-88520ca98986\n+ 16:51:20.076 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=7d840e09-f95d-48e2-b398-e60cf192e801\n+ 16:51:20.077 RandomNumberController 7d840e09-f95d-48e2-b398-e60cf192e801 | Invalid seed NaN, ignored\n+ 16:51:22.194 ContextualLoggingInterceptor - | Associate LoggerBuilder with requestId=67ce037b-5d64-4a16-a57d-fba78ceed8f8\n+ 16:51:22.194 RandomNumberController 67ce037b-5d64-4a16-a57d-fba78ceed8f8 | Generated random number:  72046864\n")),(0,a.kt)("p",null,"The above log is contains the request id in the log, which is very useful when logs from concurrent requests\ninterleaves together."),(0,a.kt)("h2",{id:"more-ways-to-define-injectable"},"More ways to define injectable"),(0,a.kt)("p",null,"In addition to adding decorated constructor to a module, you can also declare constants or value produced by a factory\nas injectable."),(0,a.kt)("h3",{id:"constants"},"Constants"),(0,a.kt)("p",null,"The following example archives almost the same goal by providing ",(0,a.kt)("inlineCode",{parentName:"p"},"Timer")," as a constant, except that the ",(0,a.kt)("inlineCode",{parentName:"p"},"Timer"),"\ninstance will be created immediately when the source file is loaded. Also note that constant injectables are always\nin ",(0,a.kt)("inlineCode",{parentName:"p"},"SINGLETON")," scope."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"const TimerModule = createModule({\n    constants: [{\n        // This can also be a string or a symbol, but you need to change corresponding param to `Inject` decorator\n        provide: Timer,\n        value: new Timer()\n    }]\n});\n")),(0,a.kt)("h3",{id:"factories"},"Factories"),(0,a.kt)("p",null,"You can also define injectable through factories. The following example will archive same goal by providing ",(0,a.kt)("inlineCode",{parentName:"p"},"Timer"),"\ninstance through a factory."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"class TimerFactory extends ComponentFactory<Timer> {\n    build() {\n        return new Timer();\n    }\n}\n\n\nconst TimerModule = createModule({\n    factories: [{\n        provide: Timer,\n        scope: ComponentScope.SINGLETON,\n        factory: TimerFactory\n    }]\n});\n")))}u.isMDXComponent=!0}}]);