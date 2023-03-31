export type PrototypeKey = string | symbol;

export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface ClassDecorator {
  <C extends Class>(target: C): C | void;
}

export interface InstancePropertyDecorator {
  <P extends {}>(target: P, name: keyof P): void;
}

export interface StaticPropertyDecorator {
  <C extends Class>(target: C, name: keyof C): void;
}

export interface StaticMethodDecorator {
  <T extends Function, R extends Class>(
    target: R,
    name: keyof R,
    pd: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void;
}

export interface InstanceMethodDecorator {
  <F extends Function, P extends object = {}>(
    target: P,
    name: keyof P,
    pd: TypedPropertyDescriptor<F>,
  ): TypedPropertyDescriptor<F> | void;
}

export interface InstanceMethodParamDecorator {
  <K extends keyof P, P extends object = {}>(target: P, name: K, pd: number): void;
}

export interface StaticMethodParamDecorator {
  <C extends Class>(target: C, name: keyof C, pd: number): void;
}

export interface ConstructorParamDecorator {
  <C extends Class>(target: C, name: unknown, pd: number): void;
}

export interface PropertyDecorator extends StaticPropertyDecorator, InstancePropertyDecorator {}

export interface MethodDecorator extends StaticMethodDecorator, InstanceMethodDecorator {}

export interface MethodParamDecorator extends InstanceMethodParamDecorator, StaticMethodParamDecorator {}

export interface ParamDecorator extends MethodParamDecorator, ConstructorParamDecorator {}

export interface Decorator extends ClassDecorator, MethodDecorator, PropertyDecorator, ParamDecorator {}

function noop() {}

type NarrowTo<T> = Decorator extends T ? T : unknown;

export class DecoratorBuilder {
  constructor(private decoratorName: string, strictChecking = true) {
    if (!strictChecking) {
      this.#applyToConstructorParam = noop;
      this.#applyToStaticMethodParam = noop;
      this.#applyToInstanceMethodParam = noop;
      this.#applyToInstanceProperty = noop;
      this.#applyToStaticProperty = noop;
      this.#applyToInstanceMethod = noop;
      this.#applyToStaticMethod = noop;
      this.#applyToClass = noop;
    }
  }

  whenApplyToConstructor(fn: ClassDecorator): this {
    this.#applyToClass = fn;
    return this;
  }

  whenApplyToInstanceProperty(fn: InstancePropertyDecorator): this {
    this.#applyToInstanceProperty = fn;
    return this;
  }

  whenApplyToStaticProperty(fn: StaticPropertyDecorator): this {
    this.#applyToStaticProperty = fn;
    return this;
  }

  whenApplyToInstanceMethod(fn: InstanceMethodDecorator): this {
    this.#applyToInstanceMethod = fn;
    return this;
  }

  whenApplyToStaticMethod(fn: StaticMethodDecorator): this {
    this.#applyToStaticMethod = fn;
    return this;
  }

  whenApplyToConstructorParam(fn: <T extends Class>(ctr: T, index: number) => T | void): this {
    this.#applyToConstructorParam = <T extends Class>(ctr: T, name: any, index: number) => fn(ctr, index);
    return this;
  }

  whenApplyToStaticMethodParam(fn: StaticMethodParamDecorator): this {
    this.#applyToStaticMethodParam = fn;
    return this;
  }

  whenApplyToInstanceMethodParam(fn: InstanceMethodParamDecorator): this {
    this.#applyToInstanceMethodParam = fn;
    return this;
  }

  build<T = Decorator>(): NarrowTo<T> {
    const result = <F extends Function, R extends PrototypeKey>(
      target: R | Class<R>,
      name?: keyof (R | Class<R>),
      descriptor?: number | TypedPropertyDescriptor<F>,
    ): void | TypedPropertyDescriptor<F> | Class<R> => {
      if (typeof target === 'function') {
        if (typeof name === 'undefined') {
          return this.applyConstructorDecorator(target, descriptor);
        }
        return this.applyStaticDecorator(target, name, descriptor);
      } else if (typeof name !== 'undefined') {
        return this.applyInstanceDecorator(target, name, descriptor);
      }
      return this.#applyToWrongPlace();
    };
    return result as NarrowTo<T>;
  }

  #applyToClass: ClassDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to class`);
  };

  #applyToInstanceProperty: InstancePropertyDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to property`);
  };

  #applyToStaticProperty: StaticPropertyDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static property`);
  };

  #applyToInstanceMethod: InstanceMethodDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to method`);
  };

  #applyToStaticMethod: StaticMethodDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static method`);
  };

  #applyToConstructorParam: <T extends Class>(ctr: T, name: any, index: number) => void | T = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class constructor`);
  };

  #applyToStaticMethodParam: StaticMethodParamDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class static method`);
  };

  #applyToInstanceMethodParam: InstanceMethodParamDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class instance method`);
  };

  #applyToWrongPlace: () => void = () => {
    throw new Error(`@${this.decoratorName} cannot be applied here`);
  };

  private applyConstructorDecorator<C extends Class>(target: object | C, descriptor: unknown) {
    if (typeof target === 'function') {
      if (typeof descriptor === 'number') {
        return this.#applyToConstructorParam(target, undefined, descriptor);
      } else if (typeof descriptor === 'undefined') {
        return this.#applyToClass(target);
      }
    }
    return this.#applyToWrongPlace();
  }

  private applyInstanceDecorator<F extends Function, P extends {}, K extends keyof P>(
    target: P,
    name: K,
    descriptor?: number | TypedPropertyDescriptor<F>,
  ) {
    if (typeof descriptor === 'number') {
      return this.#applyToInstanceMethodParam(target, name as keyof P, descriptor);
    } else if (typeof descriptor === 'object') {
      return this.#applyToInstanceMethod(target, name, descriptor);
    } else {
      return this.#applyToInstanceProperty(target, name);
    }
  }

  private applyStaticDecorator<F extends Function, C extends Class>(
    target: C,
    name: keyof C,
    descriptor?: number | TypedPropertyDescriptor<F>,
  ) {
    if (typeof descriptor === 'number') {
      return this.#applyToStaticMethodParam(target, name, descriptor);
    } else if (typeof descriptor === 'object') {
      return this.#applyToStaticMethod(target, name, descriptor);
    } else {
      return this.#applyToStaticProperty(target, name);
    }
  }
}
