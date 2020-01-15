import {Class, ServiceIdentifier} from '@sensejs/core';

export interface ITouchClientOptions {
  baseUrl?: string;
  adaptorOptions?: unknown;
  retry?: number;
  injectOptionFrom?: ServiceIdentifier;
}

export interface ITouchModuleOptions extends ITouchClientOptions {
  clients: Class | Class[];
}
