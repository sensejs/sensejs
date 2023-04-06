import 'reflect-metadata';
import {Controller, createKoaHttpModule, GET} from '@sensejs/http-koa-platform';
import {EntryPoint, Module, OnModuleCreate} from '@sensejs/core';

@Controller('/')
class HelloWorldController {
  @GET('/')
  helloWorld() {
    return 'hello world';
  }
}

@EntryPoint()
@Module({
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
