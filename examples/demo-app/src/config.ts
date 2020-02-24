import {createConfigModule} from '@sensejs/config';
import config from 'config';

export const configModule = createConfigModule({prefix: 'config', config});
