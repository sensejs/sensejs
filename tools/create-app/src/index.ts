import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import HttpModule from './http';
import {defaultLoggerBuilder} from '@sensejs/logger';

@EntryPoint({logger: defaultLoggerBuilder.build()})
class App extends Module({requires: [HttpModule]}) {}
