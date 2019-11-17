import 'reflect-metadata';
import {EntryPoint, Module} from '@sensejs/core';
import DatabaseModule from './database';
import HttpModule from './http';

@EntryPoint()
class App extends Module({requires: [HttpModule]}) {}
