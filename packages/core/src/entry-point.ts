import {ApplicationRunner, RunnerOption} from './application-runner.js';
import {Constructor} from '@sensejs/container';

export function EntryPoint(runOption: Partial<RunnerOption> = {}) {
  return (moduleConstructor: Constructor): void => {
    ApplicationRunner.instance.runModule(moduleConstructor, runOption);
  };
}
