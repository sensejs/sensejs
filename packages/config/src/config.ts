import {Inject, Injectable, Scope} from '@sensejs/container';
import _ from 'lodash';
import {createModule, Component} from '@sensejs/core';

@Injectable()
export abstract class ConfigProvider {
  abstract get(configKey: string): unknown;
}

export interface InjectConfigOption {
  transform?: (x: unknown) => unknown;
  optional?: boolean;
}

export class MissingConfigError extends Error {
  constructor(readonly configKey: string) {
    super();
    Error.captureStackTrace(this, MissingConfigError);
  }
}

export function Config(configKey: string, options: InjectConfigOption = {}) {
  const {transform = (x) => x, optional = false} = options;

  return Inject(ConfigProvider, {
    transform: (x: ConfigProvider) => {
      const result = x.get(configKey);
      if (typeof result === 'undefined' && !optional) {
        throw new MissingConfigError(configKey);
      }
      return transform(result);
    },
  });
}

export function createStaticConfigModule(config: object) {
  @Component()
  @Scope(Scope.SINGLETON)
  class StaticConfigProvider extends ConfigProvider {
    get(configKey: string): unknown {
      return _.get(config, configKey);
    }
  }

  return createModule({components: [StaticConfigProvider]});
}
