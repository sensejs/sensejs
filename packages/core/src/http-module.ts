import {Component, ComponentScope} from './component';
import {Container} from 'inversify';
import {Constructor, ServiceIdentifier} from './interfaces';
import {Module, ModuleLifecycle, ModuleOption, setModuleMetadata} from './module';
import * as http from 'http';
import {ControllerMetadata, getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {AbstractHttpInterceptor, HttpApplicationBuilder} from './http-abstract';


export interface HttpConfig {
    listenAddress: string;
    listenPort: number,
}

const defaultHttpConfig = {
    listenAddress: '0.0.0.0',
    listenPort: 3000,
};

export interface BaseHttpModuleOption extends ModuleOption {
    httpApplicationBuilder: Constructor<HttpApplicationBuilder>
    inspectors?: Constructor<AbstractHttpInterceptor>[],
}

export interface StaticHttpModuleOption extends BaseHttpModuleOption {
    type: 'static'
    staticHttpConfig: HttpConfig;
}

export interface DynamicHttpModuleOption extends BaseHttpModuleOption {
    type: 'injected'
    injectHttpConfig: ServiceIdentifier<unknown>;
}

export type HttpModuleOption = StaticHttpModuleOption | DynamicHttpModuleOption;

/**
 *
 * @param spec
 * @constructor
 */
export function HttpModule(spec: HttpModuleOption = {
    type: 'static',
    staticHttpConfig: defaultHttpConfig,
    httpApplicationBuilder: KoaHttpApplicationBuilder
}) {


    /**
     * Each HttpModule carry an internal dependencies that held the information
     */

    @Component({scope: ComponentScope.SINGLETON})
    class HttpRegistry {

        controllers: ControllerMetadata[] = [];

        constructor() {
        }

        build(container: Container) {
            const httpApplicationBuilder = new spec.httpApplicationBuilder(container);
            for (const inspector of spec.inspectors || []) {
                httpApplicationBuilder.addGlobalInspector(inspector);
            }
            for (const controllerMetadata of this.controllers) {
                if (!controllerMetadata.target) {
                    throw new Error('Controller metadata target is undefined, likely a bug here');
                }
                httpApplicationBuilder.addControllerMapping(controllerMetadata);
            }
            return httpApplicationBuilder.build();
        }

        addController(controllerMetadata: ControllerMetadata) {
            this.controllers.push(controllerMetadata);
        }

    }

    class HttpModuleLifecycle extends ModuleLifecycle {

        private httpServer?: http.Server;

        constructor(container: Container, private readonly httpRegistry: HttpRegistry) {
            super(container);

        }

        async onCreate(componentList: Constructor<unknown>[]) {
            await super.onCreate(componentList);
            const httpConfig = spec.type === 'static'
                ? spec.staticHttpConfig
                : this.container.get(spec.injectHttpConfig) as HttpConfig;
            componentList.forEach((component) => {
                const httpControllerMetadata = getHttpControllerMetadata(component);
                if (httpControllerMetadata) {
                    this.httpRegistry.addController(httpControllerMetadata);
                }
                // TODO: Implement other HTTP stuffs, like middleware and interceptor
            });


            this.httpServer = await this.createHttpServer(httpConfig);
        }


        createHttpServer(httpConfig: HttpConfig) {
            return new Promise<http.Server>((resolve, reject) => {
                const httpServer = http.createServer(this.httpRegistry.build(this.container));
                httpServer.once('error', reject);
                httpServer.listen(httpConfig.listenPort, httpConfig.listenAddress, () => {
                    httpServer.removeListener('error', reject);
                    resolve(httpServer);
                });
            });
        }

        async onDestroy() {
            return promisify((done: (e?: Error) => void) => {
                if (!this.httpServer) {
                    return done();
                }
                return this.httpServer.close(done);
            })();
        }
    }

    @Module({
        components: [HttpRegistry]
    })
    class HttpRegistryModule {

    }


    return function <T>(target: Constructor<T>) {
        setModuleMetadata(target, {
            requires: (spec.requires || []).concat(HttpRegistryModule),
            components: spec.components || [],
            moduleLifecycleFactory: container => new HttpModuleLifecycle(container, container.get(HttpRegistry))
        });

    };

}
