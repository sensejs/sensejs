import {ApplicationRunner, Constructor, ModuleMetadata, ModuleMetadataLoader} from '@sensejs/core';
import {EventEmitter} from 'events';

export class MockModuleMetadataLoader extends ModuleMetadataLoader {
  #mockedResult: Map<Constructor, ModuleMetadata> = new Map();

  mockModule(module: Constructor, fn: (m: ModuleMetadata) => ModuleMetadata) {
    this.#mockedResult.set(module, fn(super.get(module)));
    return this;
  }

  get(module: Constructor): ModuleMetadata {
    return this.#mockedResult.get(module) ?? super.get(module);
  }
}

export class MockApplicationRunner extends ApplicationRunner {
  readonly #mockedProcess;
  readonly #mockedModuleLoader;

  constructor() {
    const mockedProcess = new EventEmitter();
    const mockedModuleLoader = new MockModuleMetadataLoader();
    super(mockedProcess, mockedModuleLoader);
    this.#mockedProcess = mockedProcess;
    this.#mockedModuleLoader = mockedModuleLoader;
  }

  emitSignal(signal: NodeJS.Signals) {
    this.#mockedProcess.emit(signal, signal);
  }

  loader(): MockModuleMetadataLoader {
    return this.#mockedModuleLoader;
  }
}
