import {KafkaProducerModule} from '@sensejs/kafka';

export default KafkaProducerModule({
  injectOptionFrom: 'config.kafka',
});
