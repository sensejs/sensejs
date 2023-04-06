import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import HttpModule from './http/index.js';
import {defaultLoggerBuilder, SenseLogModule} from '@sensejs/logger';
import ConfigModule from './config.js';
import {MikroOrmConnectionModule} from './database/index.js';

@EntryPoint({logger: defaultLoggerBuilder.build()})
@Module({requires: [SenseLogModule, ConfigModule, MikroOrmConnectionModule, HttpModule]})
class App {}
