import traverse from 'traverse';
import {ConstantProvider, createLegacyModule, createModule} from '@sensejs/core';

export interface ConfigModuleOption {
  config: object;
  prefix: string;
}

function escape(x: string) {
  return x.replace('\\', '\\\\').replace('.', '\\.');
}

function buildConfigMap(option: ConfigModuleOption): ConstantProvider<unknown>[] {
  return traverse(option.config).reduce(function OptionsReducer(
    this: traverse.TraverseContext,
    acc: ConstantProvider<unknown>[],
    value: unknown,
  ) {
    if (this.circular) {
      throw new Error('circular detected');
    }
    acc.push({
      provide: [option.prefix]
        .concat(this.path)
        .map(escape)
        .join('.'),
      value,
    });
    return acc;
  }, []);
}

export function createConfigModule(option: ConfigModuleOption) {
  const constants = buildConfigMap(option);
  return createModule({constants});
}

export const ConfigModule = createLegacyModule(
  createConfigModule,
  'Base class style ConfigModule is decprecated, use createConfigModule instead',
);
