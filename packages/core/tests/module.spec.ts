import 'reflect-metadata';
import {Container} from 'inversify';
import {getModuleMetadata, Module, ModuleClass} from '../src/module';
import {Component} from '../src/component';

describe('Module', () => {

    test('@Module', async () => {

        @Component()
        class TestComponent {
        }

        const TestModule = Module({components: [TestComponent]});

        const metadata = getModuleMetadata(TestModule);
        const container = new Container();
        await new TestModule().onCreate(container);
        expect(container.get(TestComponent)).toBeInstanceOf(TestComponent);

    });

    test('getModuleMetadata', () => {
        class NonModule implements ModuleClass {
            async onCreate(container: Container): Promise<void> {
            }

            async onDestroy(container: Container): Promise<void> {
            }
        }

        expect(() => getModuleMetadata(NonModule)).toThrow();
    });

});
