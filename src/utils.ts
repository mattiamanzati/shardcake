import * as Option from "@effect/data/Option";
import * as HashMap from "@effect/data/HashMap";
import { key } from "@effect/schema/ParseResult";
import * as HashSet from "@effect/data/HashSet";
import * as Schema from "@effect/schema/Schema";
import * as Effect from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";

export function minByOption<A>(f: (value: A) => number) {
  return (fa: Iterable<A>) => {
    let current: Option.Option<A> = Option.none();
    for (let item of fa) {
      if (Option.isNone(current)) {
        current = Option.some(item);
      } else {
        if (f(item) < f(current.value)) {
          current = Option.some(item);
        }
      }
    }
    return current;
  };
}

export function groupBy<A, K>(f: (value: A) => K) {
  return (fa: Iterable<A>) => {
    let current = HashMap.empty<K, HashSet.HashSet<A>>();
    for (let item of fa) {
      const k = f(item);
      if (HashMap.has(current, k)) {
        current = HashMap.modify(current, k, HashSet.add(item));
      } else {
        current = HashMap.set(current, k, HashSet.fromIterable([item]));
      }
    }
    return current;
  };
}

export function jsonStringify<A>(value: A, schema: Schema.Schema<A>) {
  return pipe(
    value,
    Schema.encodeEffect(schema),
    Effect.map((_) => JSON.stringify(_))
  );
}
export function jsonParse<A>(value: string, schema: Schema.Schema<A>) {
  return pipe(
    Effect.sync(() => JSON.parse(value)),
    Effect.flatMap(Schema.decodeEffect(schema))
  );
}
