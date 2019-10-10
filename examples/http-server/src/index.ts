import 'reflect-metadata';
import {Controller, GET, HttpModule, Query} from '@sensejs/http';
import {ApplicationFactory} from '@sensejs/core';

@Controller('/example')
class ExampleHttpController {

    @GET('/')
    handleGetRequest(@Query() query: object) {
        return {
            query,
            timestamp: Date.now()
        };
    }

}

const httpModule = HttpModule({
    type: 'static',
    staticHttpConfig: {
        listenPort: 3000,
        listenAddress: '0.0.0.0'
    },
    components: [ExampleHttpController]
});


new ApplicationFactory(httpModule).start();
