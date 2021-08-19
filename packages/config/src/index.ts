import traverse from 'traverse';
import {createModule} from '@sensejs/core';
import {ConfigProvider} from '@sensejs/core';

export interface ConfigModuleOption {
  config: object;
  prefix: string;
}

function escape(x: string) {
  return x.replace('\\', '\\\\').replace('.', '\\.');
}

function buildConfigMap(option: ConfigModuleOption): [string, unknown][] {
  return traverse(option.config).reduce(function OptionsReducer(
    this: traverse.TraverseContext,
    acc: [string, unknown][],
    value: unknown,
  ) {
    if (this.circular) {
      throw new Error('circular detected');
    }
    acc.push([[option.prefix].concat(this.path).map(escape).join('.'), value]);
    return acc;
  },
  []);
}

/**
 * @deprecated
 * @param option
 */
export function createConfigModule(option: ConfigModuleOption) {
  const constants = buildConfigMap(option).map(([key, value]) => {
    return {provide: key, value};
  });
  return createModule({constants});
}

export function createSimpleConfigProviderModule(option: ConfigModuleOption) {
  const map = new Map<string, unknown>(buildConfigMap(option));
  const provider = new (class SimpleConfigProvider extends ConfigProvider {
    get(name: string): unknown {
      return map.get(name);
    }
  })();

  return createModule({
    constants: [
      {
        provide: ConfigProvider,
        value: provider,
      },
    ],
  });
}
