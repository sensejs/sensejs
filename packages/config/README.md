# @sensejs/redis

redis module for `sensejs`

The underlying of `RedisModule` uses `ioredis`

## API

### `RedisModule: (options: RedisModuleOptions|RedisModuleOptions[]) => ModuleConstructor`

create a redis module with options

#### `option: RedisModuleOptions`
redis module option

##### uri: String
redis connection str
##### name: String|Symbol
named redis for get specific redis
##### options: ioredis.Redis
ioredis option

### `InjectRedis: (name?: string | symbol) => ParameterDecorator`

inject redis decorator

#### `name: string | symbol` 

redis name


## Usage

- single redis

```ts
import {Controller} from '@sensejs/http';
import {RedisModule, InjectRedis} from '@sensejs/redis';
import Redis from 'ioredis';

const redisModule = RedisModule({uri: 'localhost'});

@Controller('/example')
class FooController {
  constructor(@InjectRedis() private redis: Redis.redis) {}

  exmaple() {
    return this.redis.get('key');
  }
}
```

- multi redis

```ts
import {Controller} from '@sensejs/http';
import {RedisModule, InjectRedis} from '@sensejs/redis';
import Redis from 'ioredis';

const redisOption1 = {uri: 'localhost/1', name: 'redis1'};
const redisOption2 = {uri: 'localhost/2', name: 'redis2'};
const redisModule = RedisModule([redisOption1, redisOption2]);

@Controller('/example')
class FooController {
  constructor(
     @InjectRedis(redisOption1.name) private redis1: Redis.redis,
     @InjectRedis(redisOption2.name) private redis2: Redis.redis,
  ) {}

  async exmaple() {
    const redisValue1 = await this.redis1.get('key');
    const redisValue2 = await this.redis2.get('key');
  }
}
```

## Tips

- named redis should use named inject

```ts
import {Controller} from '@sensejs/http';
import {RedisModule, InjectRedis} from '@sensejs/redis';
import Redis from 'ioredis';

const redisModule = RedisModule({uri: 'localhost', name: 'named'});

@Controller('/example')
class FooController {
  constructor(
    // this works
    @InjectRedis('named') private redis1: Redis.redis,
    // this will error
    @InjectRedis() private redis2: Redis.redis,
  ) {}

  exmaple() {
    return this.redis.get('key');
  }
}
```
