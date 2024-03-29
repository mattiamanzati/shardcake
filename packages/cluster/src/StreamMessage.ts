/**
 * @since 1.0.0
 */
import type * as ReplyId from "@effect/cluster/ReplyId"
import * as StreamReplier from "@effect/cluster/StreamReplier"
import * as Schema from "@effect/schema/Schema"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"

/**
 * A `Message<A>` is a request from a data source for a value of type `A`
 *
 * @since 1.0.0
 * @category models
 */
export interface StreamMessage<A> {
  readonly replier: StreamReplier.StreamReplier<A>
}

/**
 * Extracts the success type from a `Message<A>`.
 *
 * @since 1.0.0
 * @category utils
 */
export type Success<A> = A extends StreamMessage<infer X> ? X : never

/**
 * @since 1.0.0
 * @category utils
 */
export function isStreamMessage<A>(value: unknown): value is StreamMessage<A> {
  return (
    typeof value === "object" &&
    value !== null &&
    "replier" in value &&
    (StreamReplier.isStreamReplier(value.replier))
  )
}

/**
 * Creates both the schema and a constructor for a `Message<A>`
 *
 * @since 1.0.0
 * @category schema
 */
export function schema<RI, RA>(success: Schema.Schema<RI, RA>) {
  return function<I, A extends object>(
    item: Schema.Schema<I, A>
  ): readonly [
    Schema.Schema<I, A & StreamMessage<RA>>,
    (arg: A) => (replyId: ReplyId.ReplyId) => A & StreamMessage<RA>
  ] {
    const result = pipe(item, Schema.extend(Schema.struct({ replier: StreamReplier.schema(success) })))

    const make = (arg: A) => (replyId: ReplyId.ReplyId): A & StreamMessage<RA> =>
      Data.struct({ ...arg, replier: StreamReplier.streamReplier(replyId, success) }) as any

    return [result as any, make] as const
  }
}
