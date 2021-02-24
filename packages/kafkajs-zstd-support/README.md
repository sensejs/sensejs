# KafkaJS integrations for SENSE.JS

This package integrates ZSTD compression codec to kafkajs


## Usage

Import this package in the entry point of your apps

```typescript
import '@sensejs/kafkajs-zstd-support';
```

Be careful that import this package multiple times will result in error:

```typescript
import '@sensejs/kafkajs-zstd-support';
import '@sensejs/kafkajs-zstd-support'; // An error will be thrown
```


