import {ApplicationRunner, Constructor, ModuleMetadata, ModuleMetadataLoader} from '@sensejs/core';
import {EventEmitter} from 'events';

export class MockModuleMetadataLoader extends ModuleMetadataLoader {
  private mockedResult: Map<Constructor, ModuleMetadata> = new Map();

  mockModule(module: Constructor, fn: (m: ModuleMetadata) => ModuleMetadata) {
    this.mockedResult.set(module, fn(super.get(module)));
  }

  get(module: Constructor): ModuleMetadata {
    return this.mockedResult.get(module) ?? super.get(module);
  }
}

export class MockApplicationRunner extends ApplicationRunner {
  private readonly mockedProcess;
  private readonly mockedModuleLoader;

  constructor() {
    const mockedProcess = new EventEmitter();
    const mockedModuleLoader = new MockModuleMetadataLoader();
    super(mockedProcess, mockedModuleLoader);
    this.mockedProcess = mockedProcess;
    this.mockedModuleLoader = mockedModuleLoader;
  }

  emitSignal(signal: keyof NodeJS.Signals) {
    this.mockedProcess.emit(signal as string, signal);
  }

  loader(): MockModuleMetadataLoader {
    return this.mockedModuleLoader;
  }
}
