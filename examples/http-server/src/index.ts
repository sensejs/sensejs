import {ApplicationFactory, Component, ParamBinding} from '@sensejs/core';
import {Controller, GET, HttpContext, HttpInterceptor, HttpModule, Query, HttpConfigType} from '@sensejs/http';
import 'reflect-metadata';

@Component()
class Interceptor extends HttpInterceptor {
  timestamp?: number;

  async intercept(context: HttpContext, next: () => Promise<void>): Promise<void> {
    const date = new Date();
    context.bindContextValue(Date, date);
    this.timestamp = date.getTime();
    await next();
    (context.responseValue as any).duration = Date.now() - this.timestamp!;
  }

  async afterRequest(context: HttpContext, e?: Error): Promise<void> {}
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
  type: HttpConfigType.static,
  staticHttpConfig: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  components: [ExampleHttpController, Interceptor],
});

new ApplicationFactory(httpModule).start();
