import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import {HttpModule} from './http.js';

@EntryPoint()
@Module({
  requires: [HttpModule],
})
class App {}
