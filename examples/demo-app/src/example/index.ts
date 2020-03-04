import {PublishingFacade} from './publishing-facade.component';
import {InjectLogger, Logger, ModuleClass, OnModuleDestroy, OnModuleCreate} from '@sensejs/core';
import {SenseLogModule} from '@sensejs/logger';

@ModuleClass({
  requires: [SenseLogModule],
  components: [PublishingFacade]
})
export default class PublishingModule {
}
