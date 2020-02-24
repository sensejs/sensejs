import {ModuleClass} from '@sensejs/core';
import {GlobalEventAnnounceService} from './global-event-announce.service';
import DatabaseModule from '../database';

@ModuleClass({
  requires: [DatabaseModule],
  components: [GlobalEventAnnounceService]
})
export class EventModule {

}
