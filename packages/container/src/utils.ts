import {Binding, BindingType, ParamInjectionMetadata, ServiceId} from './types';
import {BindingNotFoundError, CircularAliasError, CircularDependencyError} from './errors';
import {Instruction, InstructionCode} from './instructions';
import {ensureValidatedParamInjectMetadata} from './metadata';

/**
 * Find cyclic and unmet dependencies through DFS
 */
function internalValidateDependencies(
  binding: Binding<unknown>,
  bindingMap: Map<ServiceId, Binding<any>>,
  visitPath: ServiceId[],
  set: Set<ServiceId>,
) {
  if (set.has(binding.id)) {
    return;
  }
  switch (binding.type) {
    case BindingType.CONSTANT:
      return;
    case BindingType.ASYNC_FACTORY:
    case BindingType.FACTORY:
    case BindingType.INSTANCE:
      {
        for (const m of binding.paramInjectionMetadata) {
          if (visitPath.indexOf(m.id) >= 0) {
            throw new CircularDependencyError('Circular dependencies');
          }

          const binding = bindingMap.get(m.id);
          if (typeof binding === 'undefined') {
            if (!m.optional) {
              throw new BindingNotFoundError('Unmet dependencies: ' + m.id.toString());
            }
            break;
          }
          internalValidateDependencies(binding, bindingMap, [...visitPath, m.id], set);
        }
      }
      break;
    case BindingType.ALIAS: {
      if (visitPath.indexOf(binding.canonicalId) >= 0) {
        throw new CircularAliasError('Circular dependencies');
      }
      if (!bindingMap.has(binding.canonicalId)) {
        throw new BindingNotFoundError('Unmet dependencies: ' + binding.canonicalId.toString());
      }
      internalValidateDependencies(binding, bindingMap, [...visitPath, binding.canonicalId], set);
    }
  }
  set.add(binding.id);
}

export function validateBindings(bindingMap: Map<ServiceId, Binding<any>>): void {
  const set = new Set<ServiceId>();
  bindingMap.forEach((binding) => internalValidateDependencies(binding, bindingMap, [], set));
}

export function compileParamInjectInstruction(
  paramInjectionMetadata: ParamInjectionMetadata[],
  allowTemporary: boolean,
): Instruction[] {
  const sortedMetadata = ensureValidatedParamInjectMetadata(paramInjectionMetadata);
  return sortedMetadata.reduceRight((instructions, m): Instruction[] => {
    const {id, transform, optional} = m;
    if (typeof transform === 'function') {
      instructions.push({code: InstructionCode.TRANSFORM, transformer: transform});
    }
    instructions.push({code: InstructionCode.PLAN, target: id, optional, allowTemporary});
    return instructions;
  }, [] as Instruction[]);
}
