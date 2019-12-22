import {createKafkaProducerModule} from '@sensejs/kafka';

export default createKafkaProducerModule({
  injectOptionFrom: 'config.kafka',
});
