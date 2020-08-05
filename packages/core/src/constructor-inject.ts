import {Transformer} from '@sensejs/utility';
import {Class, Constructor} from './interfaces';
import {copyMetadata} from './utils/copy-metadata';

const CONSTRUCTOR_INJECT_KEY = Symbol('CONSTRUCTOR_INJECT_KEY');

export interface ConstructorInjectMetadata {
  transformers: (Transformer | undefined)[];
}

export function getConstructorInjectMetadata(target: Class): ConstructorInjectMetadata | undefined {
  return Reflect.getMetadata(CONSTRUCTOR_INJECT_KEY, target);
}

export function ensureConstructorInjectMetadata(target: Class): ConstructorInjectMetadata {
  let metadata = getConstructorInjectMetadata(target);
  if (!metadata) {
    metadata = {
      transformers: [],
    };
    Reflect.defineMetadata(CONSTRUCTOR_INJECT_KEY, metadata, target);
  }
  return metadata;
}

export function decorateInjectedConstructorParam(target: Class, index: number, transformer?: Transformer): void {
  const metadata = ensureConstructorInjectMetadata(target);
  metadata.transformers[index] = transformer;
}

export function createConstructorArgumentTransformerProxy<T>(
  target: Constructor<T>,
  metadata?: ConstructorInjectMetadata,
): Constructor<T> {
  if (!metadata) {
    return target;
  }
  const untransformed = (x: unknown) => x;
  const argumentMapper = (arg: unknown, index: number) => {
    const transformer = metadata.transformers[index] ?? untransformed;
    return transformer(arg);
  };

  const proxy = new Proxy<Constructor<T>>(target, {
    construct: (target: Constructor, args: unknown[], self: object) => {
      return Reflect.construct(target, args.map(argumentMapper), self);
    },
  });
  copyMetadata(proxy, target);
  return proxy;
}
