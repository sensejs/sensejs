import 'reflect-metadata';
import {Client} from 'elasticsearch';
import {Controller} from '@sensejs/http';
import {Container, inject} from 'inversify';
import {ModuleRoot, Module} from '@sensejs/core';
import {ElasticSearchModule, InjectElasticSearch} from '../src';

describe('ElasticSearchModule', () => {
  test('elastic-search', async () => {
    @Controller('/example')
    class ExampleHttpController {
      constructor(@InjectElasticSearch() private esClient: Client) {}

      async count() {
        return this.esClient.count({});
      }
    }

    const esModule = ElasticSearchModule({
      options: {
        hosts: ['172.20.31.7:9200', '172.20.31.8:9200', '172.20.31.11:9200'],
        apiVersion: '7.2',
      },
    });

    const spy = jest.fn();

    class FooModule extends Module({components: [ExampleHttpController], requires: [esModule]}) {
      constructor(@inject(Container) private container: Container) {
        super();
      }

      async onCreate() {
        const controller = this.container.get(ExampleHttpController);
        const result = await controller.count();
        expect(result).toHaveProperty('count', expect.any(Number));
        expect(result).toHaveProperty('_shards.total', expect.any(Number));
        expect(result).toHaveProperty('_shards.failed', expect.any(Number));
        expect(result).toHaveProperty('_shards.successful', expect.any(Number));
        spy();
      }

      async onDestroy() {}
    }

    const app = new ModuleRoot(FooModule);
    await app.start();
    await app.stop();
    expect(spy).toBeCalled();
  });
});
