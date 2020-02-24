import {ModuleClass} from '@sensejs/core';
import {PasswordHashService} from './user';

@ModuleClass({
  components: [PasswordHashService],
})
export class DomainLayerModule {

}
