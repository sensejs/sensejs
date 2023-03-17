import {PublishingFacade} from './publishing-facade.component.js';
import {ModuleClass} from '@sensejs/core';
import {SenseLogModule} from '@sensejs/logger';
import {EXPORT_ENTITY} from '../constants.js';
import {AuthorEntity} from './author.entity.js';
import {BookEntity} from './book.entity.js';

@ModuleClass({
  requires: [SenseLogModule],
  components: [PublishingFacade],
  properties: {
    [EXPORT_ENTITY]: [BookEntity, AuthorEntity],
  },
})
export default class PublishingModule {}
