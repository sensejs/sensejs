import {Body, Controller, GET, Path, POST, Query} from '@sensejs/http-common';
import {Inject, InjectLogger, Logger} from '@sensejs/core';
import {validateCreateAuthorForm, validateCreateBookForm} from './http-validation.js';
import {PublishingFacade} from '../example/publishing-facade.component.js';

@Controller('/example')
export class ExampleController {
  constructor(
    @Inject(PublishingFacade) private writingFacade: PublishingFacade,
    @InjectLogger(ExampleController) private logger: Logger,
  ) {
    this.logger.info('Exmaple created');
  }

  @GET('/')
  handleGetRequest(@Query() query: object) {
    return {
      query,
      timestamp: Date.now(),
    };
  }

  @POST('/author')
  async createAuthor(@Body() body: unknown) {
    return this.writingFacade.createAuthor(validateCreateAuthorForm(body).name);
  }

  @POST('/author/:id/book')
  async createBook(@Body() body: unknown, @Path('id') id: string) {
    return this.writingFacade.createBook(id, validateCreateBookForm(body).name);
  }
}
