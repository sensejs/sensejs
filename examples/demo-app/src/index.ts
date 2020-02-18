import 'reflect-metadata';
import {EntryPoint, ModuleClass} from '@sensejs/core';
import HttpModule from './infrastructure/http';
import {defaultLoggerBuilder, SenseLogModule} from '@sensejs/logger';
import ConfigModule from './config';
import DatabaseModule from './infrastructure/database';

@EntryPoint({logger: defaultLoggerBuilder.build()})
@ModuleClass({requires: [SenseLogModule, ConfigModule, DatabaseModule, HttpModule]})
class App {}
