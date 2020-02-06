import {Class, ServiceIdentifier, RequestInterceptor} from '@sensejs/core';

export interface ITouchClientOptions {
  baseUrl?: string;
  adaptorOptions?: unknown;
  retry?: number;
  injectOptionFrom?: ServiceIdentifier;
  interceptors?: Class<RequestInterceptor>[];
}

export interface ITouchModuleOptions extends ITouchClientOptions {
  clients: Class | Class[];
}
