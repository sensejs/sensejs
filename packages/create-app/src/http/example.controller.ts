import {Controller, GET, Query, POST, Body, Path} from '@sensejs/http';
import {PublishingFacade} from '../example/publishing-facade.component';
import {inject} from 'inversify';

@Controller('/example')
export class ExampleController {
  constructor(@inject(PublishingFacade) private writingFacade: PublishingFacade) {}

  @GET('/')
  handleGetRequest(@Query() query: object) {
    return {
      query,
      timestamp: Date.now(),
    };
  }

  @POST('/author')
  async createAuthor(@Body() body: {name: string}) {
    return this.writingFacade.createAuthor(body.name);
  }

  @POST('/author/:id/book')
  async createBook(@Body() body: {name: string}, @Path('id') id: string) {
    return this.writingFacade.createBook(id, body.name);
  }
}
