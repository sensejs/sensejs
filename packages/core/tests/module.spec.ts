import 'reflect-metadata';
import {Container} from 'inversify';
import {getModuleMetadata, Module} from '../src/module';
import {Component} from '../src/component';

describe('Module', () => {

    test('@Module', async () => {

        @Component()
        class TestComponent {
        }

        @Module({components: [TestComponent]})
        class TestModule {

        }

        const metadata = getModuleMetadata(TestModule);
        const container = new Container();
        await metadata.moduleLifecycleFactory(container).onCreate(metadata.components);
        expect(container.get(TestComponent)).toBeInstanceOf(TestComponent);

    });

    test('getModuleMetadata', () => {
        class NonModule {
        }

        expect(() => getModuleMetadata(NonModule)).toThrow();
    });

});
