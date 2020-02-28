import axios from 'axios';
import {RequestParam, Response, TouchAdaptor} from '../touch2';

export class AxiosTouchAdaptor implements TouchAdaptor {
  readonly name: string = 'axios';

  async request<T>(requestParam: RequestParam): Promise<Response<T>> {

    const {method, url, headers: requestHeaders, body} = requestParam;

    const {data, headers, status, statusText} = await axios({method, url, headers: requestHeaders, data: body});

    return {
      data,
      headers,
      status,
      statusText,
    };
  }
}
