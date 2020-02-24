import 'reflect-metadata';
import {EntryPoint, ModuleClass} from '@sensejs/core';
import HttpModule from './infrastructure/http';
import {defaultLoggerBuilder, SenseLogModule} from '@sensejs/logger';
import {configModule} from './config';
import DatabaseModule from './infrastructure/database';

@EntryPoint({logger: defaultLoggerBuilder.build()})
@ModuleClass({requires: [SenseLogModule, configModule, DatabaseModule, HttpModule]})
class App {}
