import {Component, createModule, Inject, InjectLogger, Logger, Scope} from '@sensejs/core';
import {Body, Controller, GET, POST} from '@sensejs/http-common';

@Component()
@Scope(Scope.SINGLETON)
class RandomNumberGenerator {
  private state: number = Date.now() >>> 0; // Truncate the value of Date.now() into a 32-bit integer

  reseed(seed: number) {
    this.state = seed >>>= 0;
    return this.state;
  }

  query() {
    return this.state;
  }

  next() {
    this.state = (this.state * 64829 + 0x5555) >>> 0;
    return this.state;
  }
}

@Controller('/')
class RandomNumberController {
  constructor(
    @Inject(RandomNumberGenerator) private generator: RandomNumberGenerator,
    @InjectLogger() private logger: Logger,
  ) {}

  @GET('state')
  async get() {
    const state = this.generator.query();
    return {state};
  }

  @POST('next')
  async nextRandom() {
    const value = this.generator.next();
    this.logger.info('Generated random number: ', value);
    return {value};
  }

  @POST('reseed')
  async reseed(@Body() body: any) {
    const seed = Number(body?.seed);
    if (!Number.isInteger(seed)) {
      this.logger.warn('Invalid seed %s, ignored', seed);
    } else {
      this.generator.reseed(seed);
    }
    return {state: this.generator.query()};
  }
}

export const RandomNumberModule = createModule({
  components: [RandomNumberGenerator, RandomNumberController],
});
