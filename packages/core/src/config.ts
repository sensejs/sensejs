import {Inject, InjectionDecorator, InjectOption} from './decorators';
import {Injectable} from '@sensejs/container';

@Injectable()
export abstract class ConfigProvider {
  abstract get(name: string): unknown;
}

export function InjectConfig(name: string, option: InjectOption<unknown, unknown> = {}): InjectionDecorator {
  return Inject(ConfigProvider, {
    transform: (provider) => {
      const result = provider.get(name);
      if (option.transform) {
        return option.transform(result);
      }
      return result;
    },
  });
}
