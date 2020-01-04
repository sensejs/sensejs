import 'reflect-metadata';
import {FeignClient} from '.';
import {RequestMapping, Path, Body, POST} from '@sensejs/http-common';

@RequestMapping('https://city-api.sensoro.com/')
@FeignClient({
  loggerFactory: (f: FeignService) => f.logger as any,
  errorHandler: (e: any) => e.response.data,
})
class FeignService {
  logger: Console = console;

  @POST('/sessions/{uid}')
  async test(@Path('uid') uid: string, @Body() body: any) {}
}

// tslint:disable-next-line: no-console
new FeignService().test('', {a: 1}).then((d) => console.log(d));
