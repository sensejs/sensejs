import {PublishingFacade} from './publishing-facade.component';
import {ModuleClass} from '@sensejs/core';
import {SenseLogModule} from '@sensejs/logger';
import {EXPORT_ENTITY} from '../constants';
import {AuthorEntity} from './author.entity';
import {BookEntity} from './book.entity';

@ModuleClass({
  requires: [SenseLogModule],
  components: [PublishingFacade],
  properties: {
    [EXPORT_ENTITY]: [BookEntity, AuthorEntity],
  },
})
export default class PublishingModule {}
