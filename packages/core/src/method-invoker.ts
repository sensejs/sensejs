import {InvokeResult, ResolveSession} from '@sensejs/container';
import {Constructor} from './interfaces.js';

/**
 * Invoke method with arguments from container
 */
export function invokeMethod<T extends {}, K extends keyof T>(
  resolveContext: ResolveSession,
  constructor: Constructor<T>,
  methodKey: keyof T,
): InvokeResult<T, K> {
  return resolveContext.invoke(constructor, methodKey);
}
