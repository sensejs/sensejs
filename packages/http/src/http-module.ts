import {Container} from 'inversify';
import * as http from 'http';
import {ControllerMetadata, getHttpControllerMetadata} from './http-decorators';
import {promisify} from 'util';
import {KoaHttpApplicationBuilder} from './http-koa-integration';
import {AbstractHttpInterceptor, HttpAdaptor} from './http-abstract';
import { Constructor, ModuleOption, ServiceIdentifier, Component, ComponentScope, ModuleLifecycle, setModuleMetadata, Module } from '@sensejs/core';


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
}) {

    const httpAdaptorFactory = option.httpAdaptorFactory
        || ((container: Container) => new KoaHttpApplicationBuilder(container));

    class HttpModuleLifecycle extends ModuleLifecycle {

        private httpServer?: http.Server;
        private httpAdaptor: HttpAdaptor;

        constructor(container: Container) {
            super(container);
            this.httpAdaptor = httpAdaptorFactory(container);
        }

        async onCreate(componentList: Constructor<unknown>[]) {
            await super.onCreate(componentList);
            const httpConfig = option.type === 'static'
                ? option.staticHttpConfig
                : this.container.get(option.injectHttpConfig) as HttpConfig;

            for (const inspector of option.inspectors || []) {
                this.httpAdaptor.addGlobalInspector(inspector);
            }
            componentList.forEach((component) => {
                const httpControllerMetadata = getHttpControllerMetadata(component);
                if (httpControllerMetadata) {
                    this.httpAdaptor.addControllerMapping(httpControllerMetadata);
                }
                // TODO: Implement other HTTP stuffs, like middleware and interceptor
            });


            this.httpServer = await this.createHttpServer(httpConfig);
        }


        createHttpServer(httpConfig: HttpConfig) {
            return new Promise<http.Server>((resolve, reject) => {
                const httpServer = http.createServer(this.httpAdaptor.build());
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

    return function <T>(target: Constructor<T>) {
        setModuleMetadata(target, {
            requires: (option.requires || []),
            components: option.components || [],
            moduleLifecycleFactory: container => new HttpModuleLifecycle(container)
        });

    };

}
