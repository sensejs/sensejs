import 'reflect-metadata';
import {EntryPoint, ModuleClass} from '@sensejs/core';
import HttpModule from './http';
import {defaultLoggerBuilder, SenseLogModule} from '@sensejs/logger';
import ConfigModule from './config';
import {MikroOrmConnectionModule} from './database';

@EntryPoint({logger: defaultLoggerBuilder.build()})
@ModuleClass({requires: [SenseLogModule, ConfigModule, MikroOrmConnectionModule, HttpModule]})
class App {}
