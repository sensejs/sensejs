
export interface Class<T extends {} = {}> extends Function {
  prototype: T;
}

export interface Constructor<T extends {} = {}> extends Class<T> {
  new(...args: any[]): T;
}
