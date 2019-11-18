import 'reflect-metadata';
import {Component, EntryPoint, ParamBinding} from '@sensejs/core';
import {Controller, GET, HttpConfigType, HttpContext, HttpInterceptor, HttpModule, Query} from '@sensejs/http';

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

@EntryPoint()
class App extends HttpModule({
  httpOption: {
    listenPort: 3000,
    listenAddress: '0.0.0.0',
  },
  components: [ExampleHttpController, Interceptor],
}) {}
