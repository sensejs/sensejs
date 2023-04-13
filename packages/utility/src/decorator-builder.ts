export type PrototypeKey = string | symbol;

export type KeyOf<T> = keyof T & PrototypeKey;

export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface ClassDecorator {
  <C extends Class>(target: C): C | void;
}

export interface InstancePropertyDecorator {
  <P extends {}>(target: P, name: KeyOf<P>): void;
}

export interface StaticPropertyDecorator {
  <C extends Class>(target: C, name: KeyOf<C>): void;
}

export interface StaticMethodDecorator {
  <T extends Function, R extends Class>(
    target: R,
    name: KeyOf<R>,
    pd: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void;
}

export interface InstanceMethodDecorator {
  <F extends Function, P extends object = {}>(
    target: P,
    name: KeyOf<P>,
    pd: TypedPropertyDescriptor<F>,
  ): TypedPropertyDescriptor<F> | void;
}

export interface InstanceMethodParamDecorator {
  <K extends KeyOf<P>, P extends object = {}>(target: P, name: K, pd: number): void;
}

export interface StaticMethodParamDecorator {
  <C extends Class>(target: C, name: KeyOf<C>, pd: number): void;
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
      this.applyToConstructorParam = noop;
      this.applyToStaticMethodParam = noop;
      this.applyToInstanceMethodParam = noop;
      this.applyToInstanceProperty = noop;
      this.applyToStaticProperty = noop;
      this.applyToInstanceMethod = noop;
      this.applyToStaticMethod = noop;
      this.applyToClass = noop;
    }
  }

  whenApplyToConstructor(fn: ClassDecorator): this {
    this.applyToClass = fn;
    return this;
  }

  whenApplyToInstanceProperty(fn: InstancePropertyDecorator): this {
    this.applyToInstanceProperty = fn;
    return this;
  }

  whenApplyToStaticProperty(fn: StaticPropertyDecorator): this {
    this.applyToStaticProperty = fn;
    return this;
  }

  whenApplyToInstanceMethod(fn: InstanceMethodDecorator): this {
    this.applyToInstanceMethod = fn;
    return this;
  }

  whenApplyToStaticMethod(fn: StaticMethodDecorator): this {
    this.applyToStaticMethod = fn;
    return this;
  }

  whenApplyToConstructorParam(fn: <T extends Class>(ctr: T, index: number) => T | void): this {
    this.applyToConstructorParam = <T extends Class>(ctr: T, name: any, index: number) => fn(ctr, index);
    return this;
  }

  whenApplyToStaticMethodParam(fn: StaticMethodParamDecorator): this {
    this.applyToStaticMethodParam = fn;
    return this;
  }

  whenApplyToInstanceMethodParam(fn: InstanceMethodParamDecorator): this {
    this.applyToInstanceMethodParam = fn;
    return this;
  }

  build<T = Decorator>(): NarrowTo<T> {
    const result = <F extends Function, R extends PrototypeKey>(
      target: R | Class<R>,
      name?: KeyOf<R> | KeyOf<Class<R>>,
      descriptor?: number | TypedPropertyDescriptor<F>,
    ): void | TypedPropertyDescriptor<F> | Class<R> => {
      if (typeof target === 'function') {
        if (typeof name === 'undefined') {
          return this.applyConstructorDecorator(target, descriptor);
        }
        return this.applyStaticDecorator(target, name as KeyOf<Class<R>>, descriptor);
      } else if (typeof name !== 'undefined') {
        return this.applyInstanceDecorator(target, name as KeyOf<R>, descriptor);
      }
      return this.applyToWrongPlace();
    };
    return result as NarrowTo<T>;
  }

  private applyToClass: ClassDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to class`);
  };

  private applyToInstanceProperty: InstancePropertyDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to property`);
  };

  private applyToStaticProperty: StaticPropertyDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static property`);
  };

  private applyToInstanceMethod: InstanceMethodDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to method`);
  };

  private applyToStaticMethod: StaticMethodDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static method`);
  };

  private applyToConstructorParam: <T extends Class>(ctr: T, name: any, index: number) => void | T = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class constructor`);
  };

  private applyToStaticMethodParam: StaticMethodParamDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class static method`);
  };

  private applyToInstanceMethodParam: InstanceMethodParamDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class instance method`);
  };

  private applyToWrongPlace: () => void = () => {
    throw new Error(`@${this.decoratorName} cannot be applied here`);
  };

  private applyConstructorDecorator<C extends Class>(target: object | C, descriptor: unknown) {
    const {applyToClass, applyToConstructorParam} = this;
    if (typeof target === 'function') {
      if (typeof descriptor === 'number') {
        return applyToConstructorParam(target, undefined, descriptor);
      } else if (typeof descriptor === 'undefined') {
        return applyToClass(target);
      }
    }
    return this.applyToWrongPlace();
  }

  private applyInstanceDecorator<F extends Function, P extends {}, K extends KeyOf<P>>(
    target: P,
    name: K,
    descriptor?: number | TypedPropertyDescriptor<F>,
  ) {
    const {applyToInstanceMethodParam, applyToInstanceProperty, applyToInstanceMethod} = this;

    if (typeof descriptor === 'number') {
      return applyToInstanceMethodParam(target, name, descriptor);
    } else if (typeof descriptor === 'object') {
      return applyToInstanceMethod(target, name, descriptor);
    } else {
      return applyToInstanceProperty(target, name);
    }
  }

  private applyStaticDecorator<F extends Function, C extends Class>(
    target: C,
    name: KeyOf<C>,
    descriptor?: number | TypedPropertyDescriptor<F>,
  ) {
    const {applyToStaticMethodParam, applyToStaticProperty, applyToStaticMethod} = this;
    if (typeof descriptor === 'number') {
      return applyToStaticMethodParam(target, name, descriptor);
    } else if (typeof descriptor === 'object') {
      return applyToStaticMethod(target, name, descriptor);
    } else {
      return applyToStaticProperty(target, name);
    }
  }
}
