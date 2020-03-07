import {Class} from './types';

export interface ClassDecorator<Constraint = Class> {
  <T extends Constraint>(target: T): T | void;
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
    pd: TypedPropertyDescriptor<T>,
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

    const result = <T extends Function, R>(
      target: object | Class<R>,
      name?: undefined | symbol | string,
      descriptor?: number | TypedPropertyDescriptor<T>,
    ): void | TypedPropertyDescriptor<T> | Class<R> => {
      if (typeof target === 'function') {
        if (typeof name === 'undefined') {
          return this.applyConstructorDecorator(target, descriptor);
        }
        return this.applyStaticDecorator(target, name, descriptor);
      } else if (typeof name !== 'undefined') {
        return this.applyInstanceDecorator(target, name, descriptor);
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

  private applyConstructorDecorator<T extends Function, R extends {}>(
    target: object | Class<R>,
    descriptor?: number | TypedPropertyDescriptor<T>,
  ) {
    const {
      applyToClass,
      applyToConstructorParam,
    } = this;
    if (typeof target === 'function') {
      if (typeof descriptor === 'number') {
        return applyToConstructorParam(target, undefined, descriptor);
      } else if (typeof descriptor === 'undefined') {
        return applyToClass(target);
      }
    }
    return this.applyToWrongPlace();
  }

  private applyInstanceDecorator<T extends Function, R extends {}>(
    target: R,
    name: symbol | string,
    descriptor?: number | TypedPropertyDescriptor<T>,
  ) {
    const {
      applyToInstanceMethodParam,
      applyToInstanceProperty,
      applyToInstanceMethod,
    } = this;

    if (typeof descriptor === 'number') {
      return applyToInstanceMethodParam(target, name, descriptor);
    } else if (typeof descriptor === 'object') {
      return applyToInstanceMethod(target, name, descriptor);
    } else {
      return applyToInstanceProperty(target, name);
    }
  }

  private applyStaticDecorator<T extends Function, R extends {}>(
    target: Class<R>,
    name: symbol | string,
    descriptor?: number | TypedPropertyDescriptor<T>,
  ) {
    const {
      applyToStaticMethodParam,
      applyToStaticProperty,
      applyToStaticMethod,
    } = this;
    if (typeof descriptor === 'number') {
      return applyToStaticMethodParam(target, name, descriptor);
    } else if (typeof descriptor === 'object') {
      return applyToStaticMethod(target, name, descriptor);
    } else {
      return applyToStaticProperty(target, name);
    }
  }

}
