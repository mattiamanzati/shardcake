/**
 * @since 1.0.0
 * @internal
 */
import type * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as HashMap from "@effect/data/HashMap"
import * as HashSet from "@effect/data/HashSet"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import { DecodeError, EncodeError, FetchError } from "@effect/shardcake/ShardError"
import * as Stream from "@effect/stream/Stream"
import fetch from "node-fetch"

/** @internal */
export function minByOption<A>(f: (value: A) => number) {
  return (fa: Iterable<A>) => {
    let current: Option.Option<A> = Option.none()
    for (const item of fa) {
      if (Option.isNone(current)) {
        current = Option.some(item)
      } else {
        if (f(item) < f(current.value)) {
          current = Option.some(item)
        }
      }
    }
    return current
  }
}

/** @internal */
export function groupBy<A, K>(f: (value: A) => K) {
  return (fa: Iterable<A>) => {
    let current = HashMap.empty<K, HashSet.HashSet<A>>()
    for (const item of fa) {
      const k = f(item)
      if (HashMap.has(current, k)) {
        current = HashMap.modify(current, k, HashSet.add(item))
      } else {
        current = HashMap.set(current, k, HashSet.fromIterable([item]))
      }
    }
    return current
  }
}

/** @internal */
export function jsonStringify<A>(value: A, schema: Schema.Schema<any, A>) {
  return pipe(
    value,
    Schema.encode(schema),
    Effect.mapError((e) => EncodeError(e)),
    Effect.map((_) => JSON.stringify(_))
  )
}

/** @internal */
export function jsonParse<A>(value: string, schema: Schema.Schema<any, A>) {
  return pipe(
    Effect.sync(() => JSON.parse(value)),
    Effect.flatMap(Schema.decode(schema)),
    Effect.mapError((e) => DecodeError(TreeFormatter.formatErrors(e.errors)))
  )
}

/** @internal */
export function sendInternal<A>(send: Schema.Schema<any, A>) {
  return (url: string, data: A) =>
    pipe(
      jsonStringify(data, send),
      // Effect.tap((body) => Effect.logDebug("Sending HTTP request to " + url + " with data " + body)),
      Effect.flatMap((body) =>
        Effect.tryPromiseInterrupt({
          try: (signal) => {
            return fetch(url, {
              signal,
              method: "POST",
              body
            })
          },
          catch: (error) => FetchError(url, body, String(error))
        })
      )
      // Effect.tap((response) => Effect.logDebug(url + " status: " + response.status))
    )
}

/** @internal */
export function send<A, E, R>(send: Schema.Schema<any, A>, reply: Schema.Schema<any, Either.Either<E, R>>) {
  return (url: string, data: A) =>
    pipe(
      sendInternal(send)(url, data),
      Effect.flatMap((response) => Effect.promise(() => response.text())),
      Effect.flatMap((data) => jsonParse(data, reply)),
      Effect.orDie,
      Effect.flatten
    )
}

/** @internal */
export function sendStream<A, E, R>(send: Schema.Schema<any, A>, reply: Schema.Schema<any, Either.Either<E, R>>) {
  return (url: string, data: A) =>
    pipe(
      sendInternal(send)(url, data),
      Effect.map((response) =>
        pipe(
          Stream.fromAsyncIterable(response.body, (e) => FetchError(url, "", e)),
          Stream.map((value) => typeof value === "string" ? value : value.toString()),
          Stream.splitLines,
          Stream.filter((line) => line.length > 0),
          Stream.map((line) => line.startsWith("data:") ? line.substring("data:".length).trim() : line),
          Stream.mapEffect((data) => jsonParse(data, reply)),
          Stream.mapEffect((_) => _)
        )
      ),
      Stream.fromEffect,
      Stream.flatten
    )
}

/** @internal */
export function showHashSet<A>(fn: (value: A) => string) {
  return (fa: HashSet.HashSet<A>) => {
    return "HashSet(" + Array.from(fa).map(fn).join("; ") + ")"
  }
}

/** @internal */
export function showHashMap<K, A>(fnK: (value: K) => string, fn: (value: A) => string) {
  return (fa: HashMap.HashMap<K, A>) => {
    return "HashMap(" + Array.from(fa).map(([key, value]) => fnK(key) + "=" + fn(value)).join("; ") + ")"
  }
}

/** @internal */
export function showOption<A>(fn: (value: A) => string) {
  return (fa: Option.Option<A>) => {
    return Option.match(fa, { onNone: () => "None()", onSome: (_) => "Some(" + fn(_) + ")" })
  }
}
