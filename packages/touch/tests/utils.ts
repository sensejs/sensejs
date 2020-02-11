// @ts-nocheck
import KoaRouter from 'koa-router';
import Koa from 'koa';
import bodyparser from 'koa-bodyparser';
import {AbstractTouchAdaptor, IRequestMetadata} from '../src';
import {Constructor} from '@sensejs/utility';

interface ITestResponse {
  method: string;
  params: object;
  path: string;
  query: object;
  body: object;
  headers: object;
}

export function adaptorTester(adaptorConstructor: Constructor<AbstractTouchAdaptor>) {
  const app = new Koa();
  const router = new KoaRouter();
  router.all('/:methodName', (ctx) => {
    ctx.body = {
      method: ctx.method,
      params: ctx.params,
      path: ctx.url,
      query: ctx.query,
      body: ctx.request.body,
      headers: ctx.headers,
    };
  });

  app.use(bodyparser());
  app.use(router.middleware());
  return Object.getOwnPropertyNames(adaptorConstructor.prototype)
    .filter((a) => !['constructor'].includes(a))
    .forEach((methodName) => {
      test(`${adaptorConstructor.name}: ${methodName}`, (done) => {
        const server = app.listen(3001, () => {
          const adaptor = new adaptorConstructor();
          const requestUrl = 'http://localhost:3001/' + methodName;
          const metadata: IRequestMetadata = {
            body: {body: 'body'},
            query: {query: 'query'},
            headers: {headers: 'headers'},
          };
          adaptor[methodName as keyof AbstractTouchAdaptor](requestUrl, metadata)
            .then((res: ITestResponse) => {
              if (methodName === 'head') {
                return done();
              }
              expect(res.method.toLowerCase()).toEqual(methodName);
              expect(res.path).toContain(methodName);
              expect(res.params).toEqual({methodName});
              if (['post', 'patch', 'put', 'delete'].includes(methodName)) {
                expect(res.body).toEqual(metadata.body);
              }
              expect(res.query).toEqual(metadata.query);
              expect(res.headers).toEqual(expect.objectContaining(metadata.headers));
              done();
            })
            .catch((e) => done(e))
            .finally(() => {
              server.close();
            });
        });
      });
    });
}
