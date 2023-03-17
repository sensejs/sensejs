import 'reflect-metadata';
import {EntryPoint, ModuleClass} from '@sensejs/core';
import {HttpModule} from './http.js';

@EntryPoint()
@ModuleClass({
  requires: [HttpModule],
})
class App {}
