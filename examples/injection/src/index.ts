import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import {HttpModule} from './http.module.js';

@EntryPoint()
@Module({
  requires: [HttpModule],
})
class App {}
