import {Constructor} from '../interfaces';

export interface ConstructorDecorator {
  <T>(target: Constructor<T>): Constructor<T> | void;
}

type PropertyName = string | symbol;

export interface InstancePropertyDecorator {
  (target: Function, name: PropertyName): void;
}

export interface StaticPropertyDecorator {
  (target: object, name: PropertyName): void;
}

export interface StaticMethodDecorator {
  <T extends Function, R>(
    target: T,
    name: PropertyName,
    pd: TypedPropertyDescriptor<R>,
  ): TypedPropertyDescriptor<R> | void;
}

export interface InstanceMethodDecorator {
  <T>(target: object, name: PropertyName, pd: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void;
}

export interface InstanceMethodParamDecorator {
  (target: Function, name: PropertyName, pd: number): void;
}

export interface StaticMethodParamDecorator {
  (target: object, name: PropertyName, pd: number): void;
}

export interface ConstructorParamDecorator {
  (target: Function, name: any, pd: number): void;
}

export interface PropertyDecorator extends StaticPropertyDecorator, InstancePropertyDecorator {}

export interface MethodDecorator extends StaticMethodDecorator, InstanceMethodDecorator {}

export interface MethodParamDecorator extends InstanceMethodParamDecorator, StaticMethodParamDecorator {}

export interface ParamDecorator extends MethodParamDecorator, ConstructorParamDecorator {}

export interface Decorator extends ConstructorDecorator, MethodDecorator, PropertyDecorator, ParamDecorator {}

type WhenApplyToConstructorParam = <T extends Function>(target: T, index: number) => void;
type WhenApplyToStaticMethodParam = <T extends Function>(target: T, name: string | symbol, index: number) => void;
type WhenApplyToInstanceMethodParam = (target: object, name: string | symbol, index: number) => void;
type WhenApplyToStaticMethod = <T extends Function>(
  target: Function,
  name: string | symbol,
  pd: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;
type WhenApplyToInstanceMethod = <T extends Function>(
  target: {},
  name: string | symbol,
  pd: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;
type WhenApplyToStaticProperty = (target: Function, name: string | symbol) => void;
type WhenApplyToInstanceProperty = (target: object, name: string | symbol) => void;

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
      this.applyToConstructor = noop;
    }
  }

  whenApplyToConstructor(fn: ConstructorDecorator) {
    this.applyToConstructor = fn;
    return this;
  }

  whenApplyToInstanceProperty(fn: WhenApplyToInstanceProperty) {
    this.applyToInstanceProperty = fn;
    return this;
  }

  whenApplyToStaticProperty(fn: WhenApplyToStaticProperty) {
    this.applyToStaticProperty = fn;
    return this;
  }

  whenApplyToInstanceMethod(fn: WhenApplyToInstanceMethod) {
    this.applyToInstanceMethod = fn;
    return this;
  }

  whenApplyToStaticMethod(fn: WhenApplyToStaticMethod) {
    this.applyToStaticMethod = fn;
    return this;
  }

  whenApplyToConstructorParam(fn: WhenApplyToConstructorParam) {
    this.applyToConstructorParam = fn;
    return this;
  }

  whenApplyToStaticMethodParam(fn: WhenApplyToStaticMethodParam) {
    this.applyToStaticMethodParam = fn;
    return this;
  }

  whenApplyToInstanceMethodParam(fn: WhenApplyToInstanceMethodParam) {
    this.applyToInstanceMethodParam = fn;
    return this;
  }

  build<T = Decorator>(): NarrowTo<T> {
    const {
      applyToConstructorParam,
      applyToStaticMethodParam,
      applyToInstanceMethodParam,
      applyToInstanceMethod,
      applyToStaticMethod,
      applyToInstanceProperty,
      applyToStaticProperty,
      applyToConstructor,
      applyToWrongPlace,
    } = this;

    const result = <T extends Function, R>(
      target: object | Constructor<R>,
      method?: undefined | symbol | string,
      descriptor?: number | TypedPropertyDescriptor<T>,
    ): void | TypedPropertyDescriptor<T> | Constructor<R> => {
      if (typeof descriptor === 'number') {
        // parameter decoration
        if (typeof target === 'function') {
          if (typeof method === 'undefined') {
            return applyToConstructorParam(target, descriptor);
          } else {
            return applyToStaticMethodParam(target, method, descriptor);
          }
        } else if (typeof target === 'object' && typeof method !== 'undefined') {
          return applyToInstanceMethodParam(target, method, descriptor);
        }
      } else if (typeof descriptor === 'object' && typeof method !== 'undefined') {
        // method decoration
        if (typeof target === 'function') {
          return applyToStaticMethod(target, method, descriptor);
        } else {
          return applyToInstanceMethod(target, method, descriptor);
        }
      } else if (typeof descriptor === 'undefined') {
        if (typeof target === 'function') {
          if (typeof method === 'undefined') {
            return applyToConstructor(target as Constructor<R>);
          } else {
            return applyToStaticProperty(target, method);
          }
        } else if (typeof target === 'object' && typeof method !== 'undefined') {
          return applyToInstanceProperty(target, method);
        }
      }
      return applyToWrongPlace();
    };
    return result as NarrowTo<T>;
  }

  private applyToConstructor: ConstructorDecorator = () => {
    throw new Error(`@${this.decoratorName} cannot apply to class`);
  };

  private applyToInstanceProperty: WhenApplyToInstanceProperty = () => {
    throw new Error(`@${this.decoratorName} cannot apply to property`);
  };

  private applyToStaticProperty: WhenApplyToStaticProperty = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static property`);
  };

  private applyToInstanceMethod: WhenApplyToInstanceMethod = () => {
    throw new Error(`@${this.decoratorName} cannot apply to method`);
  };

  private applyToStaticMethod: WhenApplyToStaticMethod = () => {
    throw new Error(`@${this.decoratorName} cannot apply to static method`);
  };

  private applyToConstructorParam: WhenApplyToConstructorParam = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class constructor`);
  };

  private applyToStaticMethodParam: WhenApplyToStaticMethodParam = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class static method`);
  };

  private applyToInstanceMethodParam: WhenApplyToInstanceMethodParam = () => {
    throw new Error(`@${this.decoratorName} cannot apply to param of class instance method`);
  };

  private applyToWrongPlace: () => void = () => {
    throw new Error(`@${this.decoratorName} cannot be applied here`);
  };
}
