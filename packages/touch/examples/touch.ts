import 'reflect-metadata';
import {TouchClient} from '../src/';
import {RequestMapping, Path, Body, POST} from '@sensejs/http-common';

@RequestMapping('https://city-api.sensoro.com/')
@TouchClient()
class FeignService {
  @POST('/sessions/{uid}')
  async test(@Path('uid') uid: string, @Body() body: any) {}
}

// tslint:disable-next-line: no-console
new FeignService().test('', {a: 1}).then((d) => console.log(d));
