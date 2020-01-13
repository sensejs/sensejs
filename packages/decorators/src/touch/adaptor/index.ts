export interface IRequestMetadata {
  query?: any;
  body?: any;
  headers?: any;
}

export abstract class AbstractTouchAdaptor {
  abstract post(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract get(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract delete(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract put(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract head(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract options(path: string, metadata: IRequestMetadata): Promise<any>;
  abstract patch(path: string, metadata: IRequestMetadata): Promise<any>;
}

export interface ITouchAdaptorBuilder {
  build(): AbstractTouchAdaptor;
}
