# @sensejs/touch

touch is a decorator for build http request service and inspired by `Feign`

# Usage

```ts
import {GET, POST, Path, Body} from '@sensejs/http-common'
import {TouchClient, createTouchModule} from '@sensejs/touch'

@TouchClient({
  retry: 10,
  baseUrl: 'http://host/'
})
class SomeRequestService {

  @GET('/user/{userId}')
  getUser(@Path() userId: string) {}

  @POST('/user')
  createUser(@Body() userData: object) {}
}

export const RequestModule = createTouchModule({clients: SomeRequestService})

```


# TODO

- [ ] support interceptor
- [ ] support tracing
- [ ] validator
