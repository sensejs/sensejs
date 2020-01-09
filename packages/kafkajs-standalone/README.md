# Standalone Wrapper for KafkaJS

This package provide an advanced consumer based on [kafkajs], and can be
used without the core parts of sense.js.

Highlights:

-   Consumer:

    1.  Automatically set `partitionConsumedConcurrently` to  number of
        partitions of a topic, to maximum the throughput.

    2.  Detect rebalance as quickly as possible.

    3.  Save offset when consumer group is going to rebalance, to avoid
        any message be re-consumed as possible as it can (while still
        you should not expect it won't happen).

[kafkajs]: https://kafka.js.org
