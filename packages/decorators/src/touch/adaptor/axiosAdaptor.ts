import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {AbstractTouchAdaptor, IRequestMetadata, ITouchAdaptorBuilder} from '.';
import {Component} from '@sensejs/core';

const axiosDataUnwrapper: <T>(data: AxiosResponse) => T = (data) => data.data;

@Component()
export class AxiosTouchBuilder implements ITouchAdaptorBuilder {
  build() {
    return new AxiosAdaptor();
  }
}

export class AxiosAdaptor extends AbstractTouchAdaptor {
  private _axiosInstance: AxiosInstance;
  constructor(options?: AxiosRequestConfig) {
    super();
    this._axiosInstance = axios.create(options);
  }
  async post(path: string, {query, body, headers}: IRequestMetadata) {
    return this._axiosInstance.post(path, body, {params: query, headers}).then(axiosDataUnwrapper);
  }
  async get(path: string, {query, headers}: IRequestMetadata) {
    return this._axiosInstance.get(path, {params: query, headers}).then(axiosDataUnwrapper);
  }
  async put(path: string, {body, headers}: IRequestMetadata) {
    return this._axiosInstance.put(path, body, {headers}).then(axiosDataUnwrapper);
  }
  async delete(path: string, {query, body, headers}: IRequestMetadata) {
    return this._axiosInstance.delete(path, {params: query, data: body, headers}).then(axiosDataUnwrapper);
  }
  async head(path: string, {query, headers}: IRequestMetadata) {
    return this._axiosInstance.head(path, {headers, params: query}).then(axiosDataUnwrapper);
  }
  async options() {}
  async patch(...args: any) {}
}
