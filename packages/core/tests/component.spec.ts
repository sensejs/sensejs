import 'reflect-metadata';
import {Component, ComponentFactory, getComponentMetadata} from '../src/component';
import {Container, injectable, ContainerModule} from 'inversify';
import {ComponentMetadata} from '../src/interfaces';

function mockBind<T>(metadata: ComponentMetadata<T>) {
    let container = new Container();
    const bindSpy = jest.spyOn(container, 'bind');
    container.load(new ContainerModule((bind, unbind, isBound, rebind)=> {
        metadata.onBind(bind, unbind, isBound, rebind);
    }));
    return bindSpy;

}


describe('Component', () => {


    test('getComponent', () => {
        @Component()
        class MyComponent {
        }

        const metadata = getComponentMetadata(MyComponent);
        const bindSpy = mockBind(metadata);
        expect(bindSpy).toHaveBeenCalledWith(MyComponent);

        class NonComponent {
        }

        expect(() => getComponentMetadata(NonComponent)).toThrow();


    });

    test('Component using string as id', () => {
        const id = Date.now().toString();

        @Component({id})
        class MyComponent {
        }
        const metadata = getComponentMetadata(MyComponent);
        const bindSpy = mockBind(metadata);
        expect(bindSpy).toHaveBeenCalledWith(id);

    });

    test('Component using symbol as id', () => {
        const id = Symbol();

        @Component({id})
        class MyComponent {
        }

        const metadata = getComponentMetadata(MyComponent);
        const bindSpy = mockBind(metadata);
        expect(bindSpy).toHaveBeenCalledWith(id);
    });

    test('Component using symbol as id', () => {
        abstract class BaseClass {

        }

        @Component({id: BaseClass})
        class MyComponent extends BaseClass {
        }
        const metadata = getComponentMetadata(MyComponent);
        const bindSpy = mockBind(metadata);
        expect(bindSpy).toHaveBeenCalledWith(BaseClass);

    });
    test('Component explicit using self as component id', () => {
        @Component({id: MyComponent})
        class MyComponent {
        }
        const metadata = getComponentMetadata(MyComponent);
        const bindSpy = mockBind(metadata);
        expect(bindSpy).toHaveBeenCalledWith(MyComponent);

    });

    test('Component cannot using non-base class as component id', () => {
        expect(() => {
            abstract class BaseClass {

            }

            @Component({id: BaseClass})
            class MyComponent {
            }

        }).toThrow();
    });
});

describe('Component.Factory', () => {
    test('Factory', () => {

        @injectable()
        class MyComponent {}

        @Component.Factory({provide: MyComponent})
        class Factory extends ComponentFactory<MyComponent> {

            build(context): MyComponent {
                return new MyComponent();
            }
        }

        const metadata = getComponentMetadata(Factory);
        const bindSpy = mockBind(metadata);

        expect(bindSpy).toHaveBeenCalledWith(Factory);
        expect(bindSpy).toHaveBeenCalledWith(MyComponent);
    });

});
