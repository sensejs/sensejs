import {DecoratorDiscriminator, Decorator} from '../src/utils/decorator-discriminator';

function noop() {}

function defineCase(test: (d: Decorator) => void, factory: (d: DecoratorDiscriminator) => DecoratorDiscriminator) {
  return {
    test,
    factory,
  };
}

const allCases: {
  [name: string]: {
    test: (d: Decorator) => void;
    factory(d: DecoratorDiscriminator): DecoratorDiscriminator;
  };
} = {
  constructor: defineCase(
    (decorator: Decorator) => {
      @decorator
      class Foo {}
    },
    (d) => d.whenApplyToConstructor(noop),
  ),

  constructorParam: defineCase(
    (decorator: Decorator) => {
      class Foo1 {
        constructor(@decorator param: any) {}
      }

      class Bar {
        constructor(@decorator param: any, @decorator param2: any) {}
      }

      class Baz {
        constructor(@decorator param: any, param2: any) {}
      }
    },
    (d) => d.whenApplyToConstructorParam(noop),
  ),
  staticProperty: defineCase(
    (decorator: Decorator) => {
      class Foo {
        @decorator
        static staticProperty: any;
      }

      class Bar {
        @decorator
        static staticProperty: any;
        @decorator
        static staticProperty2: any;
      }

      class Baz {
        @decorator
        static staticProperty: any;
        static staticProperty2: any;
      }
    },
    (d) => d.whenApplyToStaticProperty(noop),
  ),

  property: defineCase(
    (decorator: Decorator) => {
      class Foo {
        @decorator
        staticMethod: any;
      }

      class Bar {
        @decorator
        staticMethod: any;
        @decorator
        staticMethod2: any;
      }

      class Baz {
        @decorator
        staticMethod: any;
        staticMethod2: any;
      }
    },
    (d) => d.whenApplyToInstanceProperty(noop),
  ),
  staticMethod: defineCase(
    (decorator: Decorator) => {
      class Foo {
        @decorator
        static staticMethod(): any {}
      }

      class Bar {
        @decorator
        static staticMethod(): any {}

        @decorator
        static staticMethod2(): any {}
      }

      class Baz {
        @decorator
        static staticMethod(): any {}

        static staticMethod2(): any {}
      }
    },
    (d) => d.whenApplyToStaticMethod(noop),
  ),
  staticMethodParam: defineCase(
    (decorator: Decorator) => {
      class Foo {
        static staticMethod(@decorator param: any): any {}

        static staticMethod2(@decorator param: any, @decorator param2: any): any {}

        static staticMethod3(@decorator param: any, param2: any): any {}
      }
    },
    (d) => d.whenApplyToStaticMethodParam(noop),
  ),

  method: defineCase(
    (decorator: Decorator) => {
      class Foo {
        @decorator
        method() {}
      }

      class Bar {
        @decorator
        method() {}

        @decorator
        method2() {}
      }

      class Baz {
        @decorator
        method() {}

        method2() {}
      }
    },
    (d) => d.whenApplyToInstanceMethod(noop),
  ),

  methodParam: defineCase(
    (decorator: Decorator) => {
      class Foo {
        methodParam(@decorator param: any) {}

        methodParam2(@decorator param: any, @decorator param2: any) {}

        methodParam3(@decorator param: any, param2: any) {}
      }
    },
    (d) => d.whenApplyToInstanceMethodParam(noop),
  ),
};

describe('ParameterDecoratorDiscriminator', () => {
  Object.entries(allCases).forEach(([caseName, spec]) => {
    test(`only apply to ${caseName}`, () => {
      spec.test(new DecoratorDiscriminator('foo', false).as());
      Object.entries(allCases).forEach(([failedCaseName, failedCaseSpec]) => {
        if (failedCaseName !== caseName) {
          expect(() => {
            failedCaseSpec.test(spec.factory(new DecoratorDiscriminator('foo')).as());
          }).toThrow();
        }
      });
    });
  });
});