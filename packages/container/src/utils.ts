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
  target: ServiceId,
  bindingMap: Map<ServiceId, Binding<any>>,
  visitPath: ServiceId[],
  validatedSet: Set<ServiceId>,
): void {
  if (validatedSet.has(target)) {
    return;
  }
  let binding = bindingMap.get(target);
  if (!binding) {
    throw new BindingNotFoundError(target);
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

          binding = bindingMap.get(m.id);
          if (typeof binding === 'undefined') {
            if (!m.optional) {
              throw new BindingNotFoundError(
                m.id,
                `Binding not found for parameters[${m.index}] of "${serviceIdToString(target)}"`,
              );
            }
            break;
          }
          internalValidateDependencies(binding.id, bindingMap, [...visitPath, m.id], validatedSet);
        }
      }
      break;
    case BindingType.ALIAS: {
      const index = visitPath.indexOf(binding.canonicalId);
      if (index >= 0) {
        throw new CircularDependencyError(binding.canonicalId, visitPath.slice(index));
      }
      internalValidateDependencies(binding.canonicalId, bindingMap, [...visitPath, binding.canonicalId], validatedSet);
    }
  }
  validatedSet.add(target);
}

export function validateBindings(bindingMap: Map<ServiceId, Binding<any>>): void {
  const set = new Set<ServiceId>();
  bindingMap.forEach((binding, id) => internalValidateDependencies(id, bindingMap, [], set));
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
