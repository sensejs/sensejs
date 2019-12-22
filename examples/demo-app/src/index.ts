import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import HttpModule from './http';
import {defaultLoggerBuilder, SenseLogModule} from '@sensejs/logger';
import ConfigModule from './config';
import DatabaseModule from './database';

@EntryPoint({logger: defaultLoggerBuilder.build()})
class App extends Module({requires: [SenseLogModule, ConfigModule, DatabaseModule, HttpModule]}) {}
