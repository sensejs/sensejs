import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import {AbstractTouchAdaptor, IRequestMetadata, ITouchAdaptorBuilder} from './interface';
import {Component} from '@sensejs/core';
import {ITouchClientOptions} from '../interface';

const axiosDataUnwrapper: <T>(data: AxiosResponse) => T = (data) => data.data;

@Component()
export class AxiosTouchAdaptorBuilder implements ITouchAdaptorBuilder {
  build(options?: ITouchClientOptions) {
    return new AxiosAdaptor(
      Object.assign<AxiosRequestConfig, any>({baseURL: options?.baseUrl}, options?.adaptorOptions),
    );
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
  async options(path: string, {query, headers}: IRequestMetadata) {
    return this._axiosInstance
      .request({
        method: 'options',
        url: path,
        params: query,
        headers,
      })
      .then(axiosDataUnwrapper);
  }
  async patch(path: string, {query, headers, body}: IRequestMetadata) {
    return this._axiosInstance
      .request({
        method: 'patch',
        url: path,
        params: query,
        headers,
        data: body,
      })
      .then(axiosDataUnwrapper);
  }
}
