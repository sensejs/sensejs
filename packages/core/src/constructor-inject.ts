import {Transformer} from '@sensejs/utility';
import {Class, Constructor} from './interfaces';

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
      transformers: []
    };
    Reflect.defineMetadata(CONSTRUCTOR_INJECT_KEY, metadata, target);
  }
  return metadata;
}


export function decorateInjectedConstructorParam(target: Class, index: number, transformer?: Transformer) {
  const metadata = ensureConstructorInjectMetadata(target);
  metadata.transformers[index] = transformer;
}
