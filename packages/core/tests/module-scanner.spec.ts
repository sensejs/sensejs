import {createModule, getModuleMetadata, ModuleRoot} from '../src';
import {ModuleScanner} from '../src/module-scanner';

test('ModuleScanner', () => {

  const X = createModule();
  const Y = createModule({requires: [X]});
  const Z = createModule({requires: [X, Y]});
  const moduleRoot = new ModuleScanner(Z);
  const spy = jest.fn();
  moduleRoot.scanModule(spy);
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(X));
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(Y));
  expect(spy).toHaveBeenCalledWith(getModuleMetadata(Z));
  expect(spy).toHaveBeenCalledTimes(3);
});
