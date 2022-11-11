import {createModule, Inject, ModuleClass, EntryModule} from '@sensejs/core';
import config from 'config';
import {createPooledProducerModule, createSimpleProducerModule} from '../src/index.js';
import {MessageProducerProvider} from '@sensejs/kafkajs-standalone';
import {randomUUID} from 'crypto';

test('createSimpleProducerModule', async () => {
  const txId = randomUUID();
  @ModuleClass({
    requires: [
      createSimpleProducerModule({
        requires: [
          createModule({
            constants: [{provide: 'config', value: config.get('kafka')}],
          }),
        ],
        injectOptionFrom: 'config',
      }),
    ],
  })
  class TestCase {
    async main(@Inject(MessageProducerProvider) provider: MessageProducerProvider) {
      const p = await provider.create();
      await p.release();

      const t = await provider.createTransactional(txId);
      await t.release();
    }
  }

  await EntryModule.run(TestCase, 'main');
});

test('createPooledProducerModule', async () => {
  const txId = randomUUID();
  @ModuleClass({
    requires: [
      createPooledProducerModule({
        requires: [
          createModule({
            constants: [{provide: 'config', value: config.get('kafka')}],
          }),
        ],
        kafkaProducerOption: {
          poolOption: {max: 1, min: 0, idleTimeoutMillis: 1000},
        },
        injectOptionFrom: 'config',
      }),
    ],
  })
  class TestCase {
    async main(@Inject(MessageProducerProvider) provider: MessageProducerProvider) {
      const p = await provider.create();
      await p.release();

      const t1 = await provider.createTransactional(txId);
      await t1.release();
      const t2 = await provider.createTransactional(txId);
      await t2.release();

      await p.release();
    }
  }

  await EntryModule.run(TestCase, 'main');
}, 20000);
