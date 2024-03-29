import {jest} from '@jest/globals';
import {createModule, getModuleMetadata, ModuleMetadataLoader, ModuleScanner} from '../src/index.js';

test('ModuleScanner', () => {
  const X = createModule();
  const Y = createModule({requires: [X]});
  const Z = createModule({requires: [X, Y]});
  const moduleScanner = new ModuleScanner(Z, new ModuleMetadataLoader());
  const spy = jest.fn();
  moduleScanner.scanModule(spy);
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(X));
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(Y));
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(Z));
  expect(spy).toHaveBeenCalledTimes(3);
});
