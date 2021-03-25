import {Body, Controller, GET, Path, POST, Query} from '@sensejs/http';
import {PublishingFacade} from '../example/publishing-facade.component';
import {Inject, InjectLogger, Logger} from '@sensejs/core';
import {
  CreateAuthorFormTransformer,
  CreateAuthorFormType,
  CreateBookFormTransformer,
  CreateBookFormType,
} from './http-validation';

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
  async createAuthor(@Body(CreateAuthorFormTransformer) body: CreateAuthorFormType) {
    return this.writingFacade.createAuthor(body.name);
  }

  @POST('/author/:id/book')
  async createBook(@Body(CreateBookFormTransformer) body: CreateBookFormType, @Path('id') id: string) {
    return this.writingFacade.createBook(id, body.name);
  }
}
