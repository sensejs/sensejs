import {ServiceIdentifier} from './interfaces';
import {inject, optional, Transformer} from '@sensejs/container';
import {
  ConstructorParamDecorator,
  DecoratorBuilder,
  InstanceMethodParamDecorator,
  MethodParamDecorator,
  ParamDecorator,
} from '@sensejs/utility';
import {decorateInjectedConstructorParam} from './constructor-inject';

export interface InjectionDecorator extends ConstructorParamDecorator, InstanceMethodParamDecorator {}

export interface InjectOption<T, R> {
  /**
   * Transform the injected target
   */
  transform?: Transformer<T, R>;
}

export function Inject<T>(target: ServiceIdentifier<T>, option?: InjectOption<T, any>): InjectionDecorator {
  if (typeof target == 'undefined') {
    throw new TypeError('Invalid service identifier "undefined". This may be caused by cyclic dependencies!');
  }
  const name = typeof target === 'function' ? target.name : target.toString();
  return new DecoratorBuilder(`Inject(${name})`)
    .whenApplyToInstanceMethodParam((prototype, name, index) => {
      return inject(target, option?.transform)(prototype, name, index);
    })
    .whenApplyToConstructorParam((constructor, index) => {
      decorateInjectedConstructorParam(constructor, index, option?.transform);
      return inject(target, option?.transform)(constructor, undefined, index);
    })
    .build<ParamDecorator>();
}

export function Optional(): InjectionDecorator {
  const decorator = optional() as ConstructorParamDecorator;
  return new DecoratorBuilder('Optional')
    .whenApplyToInstanceMethodParam(<K extends keyof P, P extends {}>(prototype: P, name: K, index: number) => {
      return optional()(prototype, name, index);
    })
    .whenApplyToConstructorParam((constructor, index) => {
      return decorator(constructor, undefined, index);
    })
    .build<ParamDecorator>();
}

export interface InjectionConstraintDecorator extends ConstructorParamDecorator, MethodParamDecorator {}

export function Tagged(key: string | number | symbol, value: unknown): InjectionDecorator {
  return new DecoratorBuilder(`Tagged(key=${String(key)}, value=${String(value)})`)
    .whenApplyToInstanceMethodParam(<K extends keyof P, P extends {}>(prototype: P, name: K, index: number) => {})
    .whenApplyToConstructorParam((constructor, index) => {})
    .build<InjectionConstraintDecorator>();
}

export function Named(name: string | symbol): InjectionDecorator {
  return new DecoratorBuilder(`Named(name="${name.toString()}")`)
    .whenApplyToInstanceMethodParam(<K extends keyof P, P extends {}>(prototype: P, name: K, index: number) => {})
    .whenApplyToConstructorParam((constructor, index) => {})
    .build<InjectionConstraintDecorator>();
}
