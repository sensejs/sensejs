import 'reflect-metadata';
import {createKoaHttpModule, Controller, GET} from '@sensejs/http-koa-platform';
import {EntryPoint, ModuleClass, OnModuleCreate} from '@sensejs/core';

@Controller('/')
class HelloWorldController {
  @GET('/')
  helloWorld() {
    return 'hello world';
  }
}

@EntryPoint()
@ModuleClass({
  requires: [
    createKoaHttpModule({
      components: [HelloWorldController],
      httpOption: {
        listenAddress: 'localhost',
        listenPort: 8080,
      },
    }),
  ],
})
class HelloWorldApp {
  @OnModuleCreate()
  onModuleCreate() {
    console.log('service started');
  }
}
