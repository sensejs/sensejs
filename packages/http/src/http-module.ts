import {Container} from 'inversify';
import * as http from 'http';
import {getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {AbstractHttpInterceptor, HttpAdaptor} from './http-abstract';
import { Constructor, ModuleOption, ServiceIdentifier, Component, ComponentScope, ModuleLifecycle, setModuleMetadata, Module, ModuleConstructor } from '@sensejs/core';


export interface HttpConfig {
    listenAddress: string;
    listenPort: number,
}

const defaultHttpConfig = {
    listenAddress: '0.0.0.0',
    listenPort: 3000,
};

export interface BaseHttpModuleOption extends ModuleOption {
    httpAdaptorFactory?: (container: Container)=> HttpAdaptor
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
 * @param option
 * @constructor
 */
export function HttpModule(option: HttpModuleOption = {
    type: 'static',
    staticHttpConfig: defaultHttpConfig,
}): ModuleConstructor {

    const httpAdaptorFactory = option.httpAdaptorFactory
        || ((container: Container) => new KoaHttpApplicationBuilder(container));
    const componentList = option.components || [];

    return class extends Module(option) {

        private httpServer?: http.Server;
        // private httpAdaptor?: HttpAdaptor;
        // constructor(container: Container) {
        //     super(container);
        // }
        async onCreate(container: Container) {
            await super.onCreate(container);
            const httpAdaptor = httpAdaptorFactory(container);
            const httpConfig = option.type === 'static'
                ? option.staticHttpConfig
                : container.get(option.injectHttpConfig) as HttpConfig;

            for (const inspector of option.inspectors || []) {
                httpAdaptor.addGlobalInspector(inspector);
            }
            componentList.forEach((component) => {
                const httpControllerMetadata = getHttpControllerMetadata(component);
                if (httpControllerMetadata) {
                    httpAdaptor.addControllerMapping(httpControllerMetadata);
                }
                // TODO: Implement other HTTP stuffs, like middleware and interceptor
            });

            this.httpServer = await this.createHttpServer(httpConfig, httpAdaptor);
        }


        createHttpServer(httpConfig: HttpConfig, httpAdaptor: HttpAdaptor) {
            return new Promise<http.Server>((resolve, reject) => {
                const httpServer = http.createServer(httpAdaptor.build());
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
    };
}
