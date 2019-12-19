import {Class} from '../interfaces';

export interface ClassDecorator {
  <T extends Class>(target: T): T | void;
}

type PropertyName = string | symbol;

export interface InstancePropertyDecorator {
  (target: object, name: PropertyName): void;
}

export interface StaticPropertyDecorator {
  <T extends Class>(target: T, name: PropertyName): void;
}

export interface StaticMethodDecorator {
  <T extends Function, R extends Class>(
    target: R,
    name: PropertyName,
    pd: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void;
}

export interface InstanceMethodDecorator {
  <T extends Function>(
    target: object,
    name: PropertyName,
    pd: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | void;
}

export interface InstanceMethodParamDecorator {
  (target: object, name: PropertyName, pd: number): void;
}

export interface StaticMethodParamDecorator {
  (target: Function, name: PropertyName, pd: number): void;
}

export interface ConstructorParamDecorator {
  (target: Function, name: any, pd: number): void;
}

export interface PropertyDecorator extends StaticPropertyDecorator, InstancePropertyDecorator {
}

export interface MethodDecorator extends StaticMethodDecorator, InstanceMethodDecorator {
}

export interface MethodParamDecorator extends InstanceMethodParamDecorator, StaticMethodParamDecorator {
}

export interface ParamDecorator extends MethodParamDecorator, ConstructorParamDecorator {
}

export interface Decorator extends ClassDecorator, MethodDecorator, PropertyDecorator, ParamDecorator {
}

function noop() {
}

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

  whenApplyToConstructor(fn: ClassDecorator) {
    this.applyToClass = fn;
    return this;
  }

  whenApplyToInstanceProperty(fn: InstancePropertyDecorator) {
    this.applyToInstanceProperty = fn;
    return this;
  }

  whenApplyToStaticProperty(fn: StaticPropertyDecorator) {
    this.applyToStaticProperty = fn;
    return this;
  }

  whenApplyToInstanceMethod(fn: InstanceMethodDecorator) {
    this.applyToInstanceMethod = fn;
    return this;
  }

  whenApplyToStaticMethod(fn: StaticMethodDecorator) {
    this.applyToStaticMethod = fn;
    return this;
  }

  whenApplyToConstructorParam(fn: <T extends Class>(ctr: T, index: number) => T | void) {
    this.applyToConstructorParam = <T extends Class>(ctr: T, name: any, index: number) => fn(ctr, index);
    return this;
  }

  whenApplyToStaticMethodParam(fn: StaticMethodParamDecorator) {
    this.applyToStaticMethodParam = fn;
    return this;
  }

  whenApplyToInstanceMethodParam(fn: InstanceMethodParamDecorator) {
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
      applyToClass,
      applyToWrongPlace,
    } = this;

    const result = <T extends Function, R>(
      target: object | Class<R>,
      method?: undefined | symbol | string,
      descriptor?: number | TypedPropertyDescriptor<T>,
    ): void | TypedPropertyDescriptor<T> | Class<R> => {
      if (typeof descriptor === 'number') {
        // parameter decoration
        if (typeof target === 'function') {
          if (typeof method === 'undefined') {
            return applyToConstructorParam(target as Class<R>, method, descriptor);
          } else {
            return applyToStaticMethodParam(target, method, descriptor);
          }
        }
        if (typeof target === 'object' && typeof method !== 'undefined') {
          return applyToInstanceMethodParam(target, method, descriptor);
        }
      }
      if (typeof descriptor === 'object' && typeof method !== 'undefined') {
        // method decoration
        if (typeof target === 'object') {
          return applyToInstanceMethod(target, method, descriptor);
        } else {
          return applyToStaticMethod(target, method, descriptor);
        }
      }
      if (typeof descriptor === 'undefined') {
        if (typeof target === 'function') {
          if (typeof method === 'undefined') {
            return applyToClass(target as Class<R>);
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

  private applyToConstructorParam: <T>(ctr: Class<T>, name: any, index: number) => void | Class<T> = () => {
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
}
