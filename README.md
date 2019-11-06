SENSE.JS
========

[![Maintainability](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/maintainability)](https://codeclimate.com/github/sensejs/workspace/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/6211de1ecc0f42993cf1/test_coverage)](https://codeclimate.com/github/sensejs/workspace/test_coverage)

SENSE.JS is a framework not only for web.

This framework aims to provide an enterprise Typescript framework, based on 
[inversify-js] to provide the ability of Dependency Injection, providing common components
for web application development like HTTP support while keep extensibility
to make end-user fit their own need.

WARNING: This project is still not stable yet.

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
