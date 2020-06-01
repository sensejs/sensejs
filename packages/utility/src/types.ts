export type PrototypeKey = string | symbol;

export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface Constructor<T extends {} = {}> extends Class<T> {
  new(...args: any[]): T;
}

export interface Transformer<Input = any, Output = Input> {
  (input: Input): Output;
}
