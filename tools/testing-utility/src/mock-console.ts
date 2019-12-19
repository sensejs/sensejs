beforeEach(() => {
  jest.spyOn(global.console, 'error').mockImplementation(jest.fn());
  jest.spyOn(global.console, 'warn').mockImplementation(jest.fn());
  jest.spyOn(global.console, 'info').mockImplementation(jest.fn());
  jest.spyOn(global.console, 'log').mockImplementation(jest.fn());
  jest.spyOn(global.console, 'debug').mockImplementation(jest.fn());
  jest.spyOn(global.console, 'trace').mockImplementation(jest.fn());
});
