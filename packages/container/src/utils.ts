import {Binding, BindingType, ParamInjectionMetadata, ServiceId} from './types';
import {BindingNotFoundError, CircularDependencyError} from './errors';
import {Instruction, InstructionCode} from './instructions';
import {ensureValidatedParamInjectMetadata} from './metadata';

export function serviceIdToString(id: ServiceId): string {
  if (typeof id === 'string' || typeof id === 'symbol') {
    return id.toString();
  }
  return id.constructor.name;
}

/**
 * Find cyclic and unmet dependencies through DFS
 */
export function internalValidateDependencies(
  binding: Binding<unknown>,
  bindingMap: Map<ServiceId, Binding<any>>,
  visitPath: ServiceId[],
  validatedSet: Set<ServiceId>,
): void {
  const {id} = binding;
  if (validatedSet.has(binding.id)) {
    return;
  }
  switch (binding.type) {
    case BindingType.CONSTANT:
      return;
    case BindingType.FACTORY:
    case BindingType.INSTANCE:
      {
        for (const m of binding.paramInjectionMetadata) {
          const index = visitPath.indexOf(m.id);
          if (index >= 0) {
            throw new CircularDependencyError(m.id, visitPath.slice(index));
          }

          const binding = bindingMap.get(m.id);
          if (typeof binding === 'undefined') {
            if (!m.optional) {
              throw new BindingNotFoundError(
                m.id,
                `Binding not found for parameters[${m.index}] of "${serviceIdToString(id)}"`,
              );
            }
            break;
          }
          internalValidateDependencies(binding, bindingMap, [...visitPath, m.id], validatedSet);
        }
      }
      break;
    case BindingType.ALIAS: {
      const index = visitPath.indexOf(binding.canonicalId);
      if (index >= 0) {
        throw new CircularDependencyError(binding.canonicalId, visitPath.slice(index));
      }
      const aliased = bindingMap.get(binding.canonicalId);
      if (!aliased) {
        throw new BindingNotFoundError(binding.canonicalId);
      }
      internalValidateDependencies(aliased, bindingMap, [...visitPath, binding.canonicalId], validatedSet);
    }
  }
  validatedSet.add(binding.id);
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
