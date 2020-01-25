import {ConstantProvider, Inject, RequestContext, RequestInterceptor} from '@sensejs/core';
import {Constructor} from '@sensejs/utility';

export interface EventListener {
  close(): void;
}

export interface EventReceiver<T> {
  listen(callback: (...payloads: T[]) => Promise<void>): EventListener;
}

export interface EventTransmitter<T> {
  transmit(...payload: T[]): Promise<void>;
}

/**
 * Source of the event
 *
 * Typically instantiate within your domain layer, to ensure events can only be
 * transmitted from related module, only the receiver need be export to external modules
 *
 * @example
 * ```
 * const myEventChannel = somehowCreateMyEventChannel();
 * export topicEventReceiver = topicEventSource.receiver();
 * ```
 */
export abstract class EventChannel<T> {

  abstract readonly symbol: symbol;
  /**
   * The receiver that can listen to this channel
   */
  abstract readonly receiver: EventReceiver<T>;

  /**
   * The transmitter that will broadcast to this channel
   */
  abstract readonly transmitter: EventTransmitter<T>;
}

export class BufferedEventTransmitter<T> implements EventTransmitter<T> {

  private bufferedPayload: T[] = [];

  constructor(private targetEventPublisher: EventTransmitter<T>) {}

  async transmit(...payload: T[]) {
    this.bufferedPayload = this.bufferedPayload.concat(payload);
  }

  async flush() {
    return this.targetEventPublisher.transmit(...this.bufferedPayload);
  }
}

export function InjectEventTransmitter(channel: EventChannel<unknown>) {
  return Inject(channel.symbol);
}

export function provideEventTransmitter<T>(channel: EventChannel<T>): ConstantProvider<EventTransmitter<T>> {
  return {
    provide: channel.symbol,
    value: channel.transmitter,
  };
}

export function transactionalTransmitInterceptor(channels: EventChannel<unknown>[]): Constructor<RequestInterceptor> {
  class TransactionInterceptor extends RequestInterceptor {

    async intercept(context: RequestContext, next: () => Promise<void>) {

      const bufferedEventPublishers: BufferedEventTransmitter<unknown>[] = [];
      for (const channel of channels) {
        const provider = channel.transmitter;
        const publisher = new BufferedEventTransmitter(provider);
        bufferedEventPublishers.push(publisher);
        context.bindContextValue(channel.symbol, publisher);
      }

      await next();
      for (const publisher of bufferedEventPublishers) {
        await publisher.flush();
      }
    }
  }
  return TransactionInterceptor;
}
