import {validateBindings} from '../src/utils.js';
import {Binding, BindingType, InjectScope, ServiceId} from '../src/types.js';
import {InterceptProviderClass, BindingNotFoundError, CircularDependencyError} from '../src/index.js';
import {jest} from '@jest/globals';

describe('validateBinding', () => {
  class A {}

  class B {}

  test('validate dependencies', () => {
    const bindingMap = new Map<ServiceId, Binding<any>>();
    bindingMap.set('1', {type: BindingType.CONSTANT, id: '1', value: '1'});

    bindingMap.set(A, {
      type: BindingType.INSTANCE,
      constructor: A,
      paramInjectionMetadata: [
        {
          index: 0,
          id: B,
          optional: false,
        },
      ],
      scope: InjectScope.SINGLETON,
      id: A,
    });

    expect(() => validateBindings(bindingMap)).toThrow(BindingNotFoundError);

    bindingMap.set(B, {
      type: BindingType.INSTANCE,
      constructor: B,
      paramInjectionMetadata: [],
      scope: InjectScope.SINGLETON,
      id: B,
    });
    expect(() => validateBindings(bindingMap)).not.toThrow();
  });

  test('handle optional dependencies', () => {
    const bindingMap = new Map<ServiceId, Binding<any>>();

    bindingMap.set(A, {
      type: BindingType.INSTANCE,
      constructor: A,
      paramInjectionMetadata: [
        {
          index: 0,
          id: B,
          optional: true,
        },
      ],
      scope: InjectScope.SINGLETON,
      id: A,
    });

    expect(() => validateBindings(bindingMap)).not.toThrow();

    bindingMap.set(B, {
      type: BindingType.INSTANCE,
      constructor: B,
      paramInjectionMetadata: [],
      scope: InjectScope.SINGLETON,
      id: B,
    });
    expect(() => validateBindings(bindingMap)).not.toThrow();
  });

  test('detect circular alias', () => {
    const bindingMap = new Map<ServiceId, Binding<any>>();

    bindingMap.set('1', {
      type: BindingType.ALIAS,
      id: '1',
      canonicalId: '2',
    });

    expect(() => validateBindings(bindingMap)).toThrow(BindingNotFoundError);

    bindingMap.set('2', {
      type: BindingType.ALIAS,
      id: '2',
      canonicalId: '1',
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);

    bindingMap.clear();
    bindingMap.set('1', {
      type: BindingType.ALIAS,
      id: '1',
      canonicalId: '2',
    });
    bindingMap.set('2', {
      type: BindingType.ALIAS,
      id: '2',
      canonicalId: '3',
    });
    bindingMap.set('3', {
      type: BindingType.ALIAS,
      id: '3',
      canonicalId: '1',
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);
  });

  test('detect circular dependencies', () => {
    const bindingMap = new Map<ServiceId, Binding<any>>();

    bindingMap.set(A, {
      type: BindingType.INSTANCE,
      constructor: A,
      paramInjectionMetadata: [{index: 0, id: B, optional: true}],
      scope: InjectScope.SINGLETON,
      id: A,
    });
    bindingMap.set(B, {
      type: BindingType.INSTANCE,
      constructor: B,
      paramInjectionMetadata: [{index: 0, id: A, optional: true}],
      scope: InjectScope.SINGLETON,
      id: B,
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);

    bindingMap.set(A, {
      type: BindingType.INSTANCE,
      constructor: A,
      paramInjectionMetadata: [{index: 0, id: B, optional: false}],
      scope: InjectScope.SINGLETON,
      id: A,
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);
    bindingMap.set(B, {
      type: BindingType.INSTANCE,
      constructor: B,
      paramInjectionMetadata: [{index: 0, id: A, optional: false}],
      scope: InjectScope.SINGLETON,
      id: B,
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);
    bindingMap.set(A, {
      type: BindingType.INSTANCE,
      constructor: A,
      paramInjectionMetadata: [{index: 0, id: B, optional: true}],
      scope: InjectScope.SINGLETON,
      id: A,
    });
    expect(() => validateBindings(bindingMap)).toThrow(CircularDependencyError);
  });
});
