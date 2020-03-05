# Configuration support for SENSE.js

This package provide a way to configure application by injection.

Suppose the whole configuration is object, this module traverse
each node of it and bind the path of each node to the value of it.

For example, Here is a configuration object:
```json
{
  "http": {
      "listenAddress": "0.0.0.0",
      "port": 8080
  }
}
```
Suppose we use `config` as prefix, this module will bind
`config.http.port` to `8080`, bind `config.http.listenAddress` to
`"0.0.0.0"`, and also bind `config.http` to that object. So you can
access them via injection like the following code:

```typescript
@Component
class MyComponent {
  constructor(
    @Inject('config.http') httpConfig: object,
    @Inject('config.http.listenAddress') listenAddress: string;
  ) {}
}
```


