import 'reflect-metadata';
import {Container} from 'inversify';
import {Component, getModuleMetadata, Module, ModuleClass} from '../src';

describe('Module', () => {

    test('@Module', async () => {

        @Component()
        class TestComponent {
        }

        const TestModule = Module({components: [TestComponent]});

        getModuleMetadata(TestModule);
        const container = new Container();
        await new TestModule().onCreate(container);
        expect(container.get(TestComponent)).toBeInstanceOf(TestComponent);

    });

    test('getModuleMetadata', () => {
        class NonModule extends ModuleClass {
            async onCreate(container: Container): Promise<void> {
            }

            async onDestroy(container: Container): Promise<void> {
            }
        }

        expect(() => getModuleMetadata(NonModule)).toThrow();
    });

});
