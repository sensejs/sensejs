import {ModuleClass} from '@sensejs/core';
import {NotificationModule} from './notification';
import {RegistrationService} from './registration/registration';
import {DomainLayerModule} from '../domains';

@ModuleClass({
  requires: [DomainLayerModule, NotificationModule],
  components: [RegistrationService],
})
export class ApplicationLayerModule {

}
