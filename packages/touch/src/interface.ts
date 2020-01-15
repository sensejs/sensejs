import {Class} from '@sensejs/core';

export interface ITouchClientOptions {
  baseUrl?: string;
  adaptorOptions?: unknown;
  retry?: number;
}

export interface ITouchModuleOptions extends ITouchClientOptions {
  client: Class;
}
