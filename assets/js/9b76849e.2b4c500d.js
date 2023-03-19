"use strict";(self.webpackChunksensejs_doc=self.webpackChunksensejs_doc||[]).push([[681],{4852:(e,n,t)=>{t.d(n,{Zo:()=>d,kt:()=>y});var o=t(9231);function a(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function r(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function l(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?r(Object(t),!0).forEach((function(n){a(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):r(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function i(e,n){if(null==e)return{};var t,o,a=function(e,n){if(null==e)return{};var t,o,a={},r=Object.keys(e);for(o=0;o<r.length;o++)t=r[o],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(o=0;o<r.length;o++)t=r[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var s=o.createContext({}),p=function(e){var n=o.useContext(s),t=n;return e&&(t="function"==typeof e?e(n):l(l({},n),e)),t},d=function(e){var n=p(e.components);return o.createElement(s.Provider,{value:n},e.children)},c="mdxType",u={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},m=o.forwardRef((function(e,n){var t=e.components,a=e.mdxType,r=e.originalType,s=e.parentName,d=i(e,["components","mdxType","originalType","parentName"]),c=p(t),m=a,y=c["".concat(s,".").concat(m)]||c[m]||u[m]||r;return t?o.createElement(y,l(l({ref:n},d),{},{components:t})):o.createElement(y,l({ref:n},d))}));function y(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var r=t.length,l=new Array(r);l[0]=m;var i={};for(var s in n)hasOwnProperty.call(n,s)&&(i[s]=n[s]);i.originalType=e,i[c]="string"==typeof e?e:a,l[1]=i;for(var p=2;p<r;p++)l[p]=t[p];return o.createElement.apply(null,l)}return o.createElement.apply(null,t)}m.displayName="MDXCreateElement"},9572:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>s,contentTitle:()=>l,default:()=>u,frontMatter:()=>r,metadata:()=>i,toc:()=>p});var o=t(5675),a=(t(9231),t(4852));const r={id:"module",sidebar_position:4},l="Module",i={unversionedId:"overview/module",id:"overview/module",title:"Module",description:"In this article, we'll discuss more details about SenseJS modules.",source:"@site/docs/overview/module.md",sourceDirName:"overview",slug:"/overview/module",permalink:"/docs/overview/module",draft:!1,editUrl:"https://github.com/sensejs/sensejs/edit/master/website/docs/overview/module.md",tags:[],version:"current",sidebarPosition:4,frontMatter:{id:"module",sidebar_position:4},sidebar:"tutorialSidebar",previous:{title:"Injection",permalink:"/docs/overview/injection"}},s={},p=[{value:"Creating a module",id:"creating-a-module",level:2},{value:"Lifecycle hooks",id:"lifecycle-hooks",level:2},{value:"Inter-Module dependencies",id:"inter-module-dependencies",level:2},{value:"Entry point modules",id:"entry-point-modules",level:2},{value:"Conclusion",id:"conclusion",level:2}],d={toc:p},c="wrapper";function u(e){let{components:n,...t}=e;return(0,a.kt)(c,(0,o.Z)({},d,t,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"module"},"Module"),(0,a.kt)("p",null,"In this article, we'll discuss more details about SenseJS modules."),(0,a.kt)("p",null,"In the previous article, you've learned to export injectables through modules. You might note that to start an HTTP\nserver, ",(0,a.kt)("inlineCode",{parentName:"p"},"createHttpModule")," is called, which manages HTTP traffics for you. You might also note that the application\nentry point is also a module."),(0,a.kt)("p",null,"The concept of the module takes an important roles in SenseJS. It's designed to do the following job for your\napplication:"),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Provide entry points for your application.")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Export injectables for other modules and components to use.")),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},"Initialize and de-initialize components and I/O resources, such as creating database connections and establishing\nHTTP listeners."))),(0,a.kt)("h2",{id:"creating-a-module"},"Creating a module"),(0,a.kt)("p",null,"You can create a module by decorating a class with ",(0,a.kt)("inlineCode",{parentName:"p"},"@ModuleClass"),"."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"@ModuleClass({\n    requires: [],   // Other modules that required by this module\n    components: [], // Component injectable provided by this module\n    factories: [],  // Dynamic injectable provided by this module\n    constants: [],  // Constant injectables provided by this module\n})\nclass MyModule {\n\n    constructor(@Inject(Loggable) loggable: Loggable) {\n        loggable.log('Hello from MyModule');\n    }\n\n    @OnModuleCreated()\n    onModuleCreated() {} // perform initialization here\n\n    @OnModuleCreated()\n    onModuleDestroy() {} // perform de-initialization here\n}\n")),(0,a.kt)("p",null,"A module can have a constructor, and its parameters are automatically injected by the framework."),(0,a.kt)("p",null,"In case that neither constructor nor lifecycle hooks is needed, you can also create a module in a simpler way:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"const MyModule = createModule({\n    requires: [],\n    components: [],\n    factories: [],\n    constants: [],\n});\n")),(0,a.kt)("h2",{id:"lifecycle-hooks"},"Lifecycle hooks"),(0,a.kt)("p",null,"SenseJS defined four lifecycle hooks for modules. Just like module constructor, parameters of these lifecycle hooks\nare automatically injected by the framework."),(0,a.kt)("ul",null,(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleCreated"),"/",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleStop"),": called when the module is created/destroyed, respectively."),(0,a.kt)("p",{parentName:"li"},"  When your components need to be initialized and de-initialized, it shall be done in the\n",(0,a.kt)("inlineCode",{parentName:"p"},"@OnModuleCreate")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"@OnModuleDestroy")," hooks of a module."),(0,a.kt)("pre",{parentName:"li"},(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"\n@Component({scope: ComponentScope.SINGLETON})\nclass DatabaseConnection {\n    async connect() { }\n    async disconnect() { }\n    async query() { }\n}\n\n@ModuleClass({components: [DatabaseConnection]})\nclass DatabaseModule {\n\n    @OnModuleCreated()\n    async onCreated(@Inject(DatabaseConnection) conn) {\n        await conn.connect();\n    }\n\n    @OnModuleDestroy()\n    async onDestroyed(@Inject(DatabaseConnection) conn) {\n        await conn.disconnect();\n    }\n}\n"))),(0,a.kt)("li",{parentName:"ul"},(0,a.kt)("p",{parentName:"li"},(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleStart"),"/",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleStop"),": only when you start your app via ",(0,a.kt)("inlineCode",{parentName:"p"},"ApplicationRunner.start"),"(see ",(0,a.kt)("a",{parentName:"p",href:"#entry-point-modules"},"EntryPointModules"),")"),(0,a.kt)("p",{parentName:"li"},"  When a module is designed to handle requests, it needs",(0,a.kt)("inlineCode",{parentName:"p"},"@OnModuleStart")," and ",(0,a.kt)("inlineCode",{parentName:"p"},"@OnModuleStop")," hooks."),(0,a.kt)("pre",{parentName:"li"},(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"@ModuleClass()\nclass TcpEchoServerModule {\n    tcpServer?: net.Server;\n\n    @OnModuleStart()\n    async onCreated() {\n        this.tcpServer = net.createServer((conn)=> conn.pipe(conn)).listen(3000);\n    }\n\n    @OnModuleStop()\n    async onDestroyed() {\n        if (this.tcpServer) {\n            this.tcpServer.close();\n        }\n    }\n}\n")),(0,a.kt)("p",{parentName:"li"},"  ",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleCreate")," hooks are ensured be invoked after all ",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleCreated")," hooks finished, while ",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleDestroy"),"\nhooks are ensured to be invoked before any ",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleDestroy")," hooks. This is how SenseJS gracefully startup and\nshutdown your app."))),(0,a.kt)("h2",{id:"inter-module-dependencies"},"Inter-Module dependencies"),(0,a.kt)("p",null,"To control the initialization and de-initialization order, you need to specify which one depends on the other ones."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"\n@Controller()\nclass MyController {\n\n    @GET('/')\n    async query(@Inject(DatabaseConnection) conn) {\n        return conn.query();\n    }\n}\n\n\nconst BusinessLogicModule = createModule({\n    requires: [DatabaseModule],\n    components: [MyController],\n});\n")),(0,a.kt)("p",null,"Note that once a module is initialized, anything provided by it will be injectable to others, even components from the\nother modules that do not list it as a dependency. In other words, the inter-module dependency graph only affects the\norder of initialization and de-initialization but does not restrict you from injecting anything from any other module.\nHowever, it is still a good practice to carefully consider the relationship between modules."),(0,a.kt)("h2",{id:"entry-point-modules"},"Entry point modules"),(0,a.kt)("p",null,"There ought to be an entry point for an app. In SenseJS, your app can be started through:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"@ModuleClass({ requires: [OtherModules] })\nclass MyApp {\n    main() {\n    }\n}\n\nApplicationRunner.instance.run(MyApp, 'main');\n")),(0,a.kt)("p",null,"And your app will exit when it returns from ",(0,a.kt)("inlineCode",{parentName:"p"},"main"),"."),(0,a.kt)("p",null,"Some app may not have any explicit entry function, but establish a listener in ",(0,a.kt)("inlineCode",{parentName:"p"},"OnModuleStart")," hooks and then\nwait for requests. In this case, you can use ",(0,a.kt)("inlineCode",{parentName:"p"},"ApplicationRunner.instance.start")," to start your app."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-typescript"},"@ModuleClass({ requires: [OtherModules] })\nclass MyApp {\n    @OnModuleStart()\n    onModuleStart() {\n        // start listening for requests\n    }\n    @OnModuleStop()\n    onModuleStop() {\n        // stop listening for requests\n    }\n}\nApplicationRunner.instance.start(MyApp);\n")),(0,a.kt)("p",null,"Such app will not exit until ",(0,a.kt)("inlineCode",{parentName:"p"},"ProcessManager.exit()")," is called or any exit signals are received. SenseJS also ensures\nall ",(0,a.kt)("inlineCode",{parentName:"p"},"@OnModuleStop")," hooks are invoked before the app exits."),(0,a.kt)("h2",{id:"conclusion"},"Conclusion"),(0,a.kt)("p",null,"From a global perspective, a typical SenseJS application is composed of modules. Some modules are organizing\ninjectables, while some modules are also managing I/O, and an entry module that depends on all the others.\nBased on the dependency graph of all the modules, SenseJS can gracefully start up and shut down your application."))}u.isMDXComponent=!0}}]);