import 'reflect-metadata';
import {invokeMethod, ParamBinding, ParamBindingError, ParamBindingResolvingError} from '../src/param-binding';
import {Container, inject, injectable} from 'inversify';
import {Component} from '../src/component';

describe('@ParamBinding', () => {

    test('param binding', () => {

        class Foo {
            bar(@ParamBinding(String) param: String, @ParamBinding(Number, {transform: (x) => x + 1 }) number) {
                return param.repeat(number);
            }
        }

        let container = new Container();
        const constValue = 'deadbeef';
        container.bind(String).toConstantValue(constValue);
        container.bind(Number).toConstantValue(2);
        expect(invokeMethod(container, new Foo(), Foo.prototype.bar)).toBe(constValue.repeat(3));
    });

    test('Duplicated param binding', () => {
        expect(() => {
            class Foo {
                bar(@ParamBinding(String) @ParamBinding(Number) foo) {
                }
            }
        }).toThrow(ParamBindingError);
    });

    test('Missing @ParamBinding', () => {

        class Foo {
            bar(param: String) {
                return param;
            }
        }

        let container = new Container();
        container.bind(String).toConstantValue('deadbeef');
        expect(()=> invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
    });

    test('Missing @ParamBinding', () => {

        class Foo {
            bar(param: String) {
                return param;
            }
        }

        let container = new Container();
        container.bind(String).toConstantValue('deadbeef');
        expect(()=> invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);
    });

    test('Inconsistent param binding', () => {
        class Foo {
            bar(undecorated: String, param: String) {
                return param;
            }
        }

        let container = new Container();

        container.bind(String).toConstantValue('deadbeef');
        expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

        ParamBinding(String)(Foo.prototype, 'bar', 1);
        expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

        ParamBinding(String)(Foo.prototype, 'bar', 2);
        expect(() => invokeMethod(container, new Foo(), Foo.prototype.bar)).toThrow(ParamBindingResolvingError);

    });

    test('Performance test', ()=> {

        @Component()
        class Test {

        }

        const container = new Container();
        container.bind(String).toConstantValue('deadbeef');
        container.bind(Number).toConstantValue(2);
        let constructor;
        for (let i = 0; i < 10000; i++) {
            if (i % 100) {
                container.bind(Symbol()).toConstantValue(i);
                continue;
            }
            if (constructor) {

                @injectable()
                class X {
                    constructor(@inject(constructor) private empty) {}
                }
                container.bind(X).to(X);
                constructor = X;
            } else {
                @injectable()
                class X {
                    constructor() {}
                }
                container.bind(X).to(X);
                constructor = X;

            }
        }
        @Component()
        class Foo {
            bar(@ParamBinding(String, {transform: (x: string)=>x.repeat(2)}) param: String,
                @ParamBinding(Number, {transform: (x: number)=> x*x}) number,
                @ParamBinding(Test) test,
                @ParamBinding(constructor) x) {
                return param.repeat(number);
            }
        }
        container.bind(Foo).toSelf();

        let N = 10000;
        // 10000 method invoking should be done within 30s
        while(N--) {
            let childContainer = container.createChild();
            for (let i = 0; i < 1000; i++) {
                childContainer.bind(Symbol()).toConstantValue(i);
            }
            childContainer.bind(Test).toConstantValue(new Test());
            invokeMethod(childContainer, childContainer.get(Foo), Foo.prototype.bar);
        }
    }, 60000)
});
