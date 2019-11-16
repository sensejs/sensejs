import traverse from 'traverse';
import {Module, ServiceIdentifier} from '@sensejs/core';

interface ConfigModuleOption {
  config: object;
  prefix: string;
}

function escape(x: string) {
  return x.replace('\\', '\\\\').replace('.', '.');
}

function buildConfigMap(option: ConfigModuleOption): {provide: ServiceIdentifier<unknown>; value: unknown}[] {
  return traverse(option.config).reduce(function provideConstant(this: traverse.TraverseContext, acc, value) {
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

export function ConfigModule(option: ConfigModuleOption) {
  const constants = buildConfigMap(option);
  return Module({constants});
}
