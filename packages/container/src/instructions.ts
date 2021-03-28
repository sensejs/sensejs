import {AsyncResolveInterceptor, Class, Constructor, Scope, ServiceId} from './types';

export enum InstructionCode {
  PLAN = 'PLAN',
  TRANSFORM = 'TRANSFORM',
  BUILD = 'BUILD',
  INVOKE = 'INVOKE',
  ASYNC_BUILD = 'ASYNC_BUILD',
  ASYNC_INTERCEPT = 'ASYNC_INTERCEPT',
}

export interface PlanInstruction {
  code: InstructionCode.PLAN;
  target: ServiceId;
  optional: boolean;
}

export interface InvokeInstruction {
  code: InstructionCode.INVOKE;
  target: ServiceId & Class;
  methodKey: keyof any;
}

export interface BuildInstruction {
  code: InstructionCode.BUILD;
  serviceId: ServiceId;
  factory: (...args: any[]) => any;
  paramCount: number;
  cacheScope: Scope;
}

export interface AsyncBuildInstruction {
  code: InstructionCode.ASYNC_BUILD;
  serviceId: ServiceId;
  factory: (...args: any[]) => any;
  paramCount: number;
  cacheScope: Scope.REQUEST | Scope.TRANSIENT;
}

export interface AsyncInterceptInstruction {
  code: InstructionCode.ASYNC_INTERCEPT;
  interceptorBuilder: (...args: any[]) => AsyncResolveInterceptor;
  paramCount: number;
}

export interface TransformInstruction {
  code: InstructionCode.TRANSFORM;
  transformer: (input: any) => any;
}

export type Instruction =
  | PlanInstruction
  | BuildInstruction
  | InvokeInstruction
  | TransformInstruction
  | AsyncBuildInstruction
  | AsyncInterceptInstruction;
