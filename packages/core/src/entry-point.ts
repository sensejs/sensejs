import {ApplicationRunner, RunnerOption} from './application-runner.js';
import {Constructor} from '../../container/src/types.js';

export function EntryPoint(runOption: Partial<RunnerOption> = {}) {
  return (moduleConstructor: Constructor): void => {
    ApplicationRunner.instance.runModule(moduleConstructor, runOption);
  };
}
