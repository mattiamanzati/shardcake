---
title: Messenger.ts
nav_order: 9
parent: "@effect/cluster"
---

## Messenger overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [models](#models)
  - [Messenger (interface)](#messenger-interface)
- [utils](#utils)
  - [sendStreamAutoRestart](#sendstreamautorestart)

---

# models

## Messenger (interface)

An interface to communicate with a remote entity

**Signature**

```ts
export interface Messenger<Msg> {
  /**
   * Send a message without waiting for a response (fire and forget)
   * @since 1.0.0
   */
  sendDiscard(entityId: string): (msg: Msg) => Effect.Effect<never, ShardingError.ShardingError, void>

  /**
   * Send a message and wait for a response of type `Res`
   * @since 1.0.0
   */
  send(
    entityId: string
  ): <A extends Msg & Message.Message<any>>(
    msg: (replyId: ReplyId.ReplyId) => A
  ) => Effect.Effect<never, ShardingError.ShardingError, Message.Success<A>>

  /**
   * Send a message and receive a stream of responses of type `Res`.
   *
   * Note: The returned stream will fail with a `PodUnavailable` error if the remote entity is rebalanced while
   * streaming responses. See `sendStreamAutoRestart` for an alternative that will automatically restart the stream
   * in case of rebalance.
   * @since 1.0.0
   */
  sendStream(
    entityId: string
  ): <A extends Msg & StreamMessage.StreamMessage<any>>(
    fn: (replyId: ReplyId.ReplyId) => A
  ) => Effect.Effect<
    never,
    ShardingError.ShardingError,
    Stream.Stream<never, ShardingError.ShardingError, StreamMessage.Success<A>>
  >
}
```

Added in v1.0.0

# utils

## sendStreamAutoRestart

Send a message and receive a stream of responses of type `Res` while restarting the stream when the remote entity
is rebalanced.

To do so, we need a "cursor" so the stream of responses can be restarted where it ended before the rebalance. That
is, the first message sent to the remote entity contains the given initial cursor value and we extract an updated
cursor from the responses so that when the remote entity is rebalanced, a new message can be sent with the right
cursor according to what we've seen in the previous stream of responses.

**Signature**

```ts
export declare function sendStreamAutoRestart<Msg, Cursor>(messenger: Messenger<Msg>, entityId: string, cursor: Cursor)
```

Added in v1.0.0
