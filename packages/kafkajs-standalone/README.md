# Standalone Wrapper for KafkaJS

This package provide an advanced consumer based on [kafkajs], and can be
used without the core parts of sense.js.

## Install

```bash
npm install @sensejs/kafkajs-standalone kafkajs
```

## Highlights:

-   Consumer:

    1.  Automatically set `partitionConsumedConcurrently` to  number of
        partitions of a topic, to maximum the throughput.

    2.  Detect rebalance as quickly as possible.

    3.  Save offset when consumer group is going to rebalance, to avoid
        any message be re-consumed as possible as it can (while still
        you should not expect it won't happen).

-   Producer:

    1.  Default `maxInFlightRequests` to `1` and `idempotent` to `true`,
        to fit requirements of transactional producer. Can be overridden
        if transaction is not required.

    2.  Ability to provide `messageKeyProvider` to assign a key to
        message if not specified.

[kafkajs]: https://kafka.js.org
