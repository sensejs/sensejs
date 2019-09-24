
Simple IoC Framework for Typescript
===========

This framework aims to provide an enterprise Typescript framework, based on 
[inversify-js] to provide the ability of Dependency Injection, providing common components
for web application development like HTTP support while keep extensibility
to make end-user fit their own need.


Hello world
-------

```typescript
import {Application, HttpModule, Controller} from '@thynson/framework'

@Controller()
class WebController
{
  @GET('/')
  handleGet() { 
    return "hello world";
  }
}

@HttpModule({components: [WebController]})
class Web { }

new Application(Web).start();
```







TODO:
-------

- Logger
- Complete HTTP Module
    - Routing
    - Request mapping
    - Content type
    - Error handling
    - Cookie and header
    - Websocket
- Kafka Module
    - Consumer
    - Producer
- Integrate TypeORM 
- Redis



[inversify-js]: http://inversify.io
