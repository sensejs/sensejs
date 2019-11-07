import 'reflect-metadata';
import {Controller, GET, HttpContext, HttpInterceptor, HttpModule, Query} from '@sensejs/http';
import {ApplicationFactory, Component, ParamBinding} from '@sensejs/core';

@Component()
class Interceptor extends HttpInterceptor {
  timestamp?: number;
  async beforeRequest(context: HttpContext): Promise<void> {
    const date = new Date();
    context.bindContextValue(Date, date);
    this.timestamp = date.getTime();
    return undefined;
  }

  async afterRequest(context: HttpContext, e?: Error): Promise<void> {
    (context.responseValue as any).duration = Date.now() - this.timestamp!;
  }
}

@Controller('/example', {interceptors: [Interceptor]})
class ExampleHttpController {
  @GET('/')
  async handleGetRequest(@Query() query: object, @ParamBinding(Date) date: Date) {
    await new Promise((done) => setTimeout(done, 1));
    const timestamp = new Date();
    const result = {
      query,
    };
    return result;
  }
}

const httpModule = HttpModule({
  type: 'static',
  staticHttpConfig: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  components: [ExampleHttpController, Interceptor],
});

new ApplicationFactory(httpModule).start();
