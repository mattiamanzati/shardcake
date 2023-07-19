/**
 * @since 1.0.0
 */
import * as Data from "@effect/data/Data";
import { pipe } from "@effect/data/Function";
import * as List from "@effect/data/List";
import * as Option from "@effect/data/Option";
import * as Schema from "@effect/schema/Schema";
import * as Pod from "@effect/shardcake/Pod";
/**
 * @since 1.0.0
 * @category symbols
 */
export const TypeId = "@effect/shardcake/PodWithMetadata";
/** @internal */
export function isPodWithMetadata(value) {
  return typeof value === "object" && value !== null && "_id" in value && value["_id"] === TypeId;
}
/**
 * @since 1.0.0
 * @category constructors
 */
export function make(pod, registered) {
  return Data.struct({
    _id: TypeId,
    pod,
    registered
  });
}
/**
 * @since 1.0.0
 * @category utils
 */
export function extractVersion(pod) {
  return pipe(List.fromIterable(pod.pod.version.split(".")), List.map(_ => parseInt(_, 10)));
}
/**
 * @since 1.0.0
 * @category utils
 */
export function compareVersion(a, b) {
  let restA = a;
  let restB = b;
  while (List.size(restA) > 0 || List.size(restB) > 0) {
    const numA = pipe(List.head(restA), Option.getOrElse(() => 0));
    const numB = pipe(List.head(restB), Option.getOrElse(() => 0));
    if (numA < numB) return -1;
    if (numB > numA) return 1;
    restA = pipe(List.tail(restA), Option.getOrElse(() => List.empty()));
    restB = pipe(List.tail(restB), Option.getOrElse(() => List.empty()));
  }
  return 0;
}
/** @internal */
export function show(value) {
  return "PodWithMetadata(pod=" + Pod.show(value.pod) + ", registered=" + value.registered + ")";
}
/**
 * @since 1.0.0
 * @category schema
 */
export const schema = /*#__PURE__*/Schema.data( /*#__PURE__*/Schema.struct({
  _id: /*#__PURE__*/Schema.literal(TypeId),
  pod: Pod.schema,
  registered: Schema.number
}));
//# sourceMappingURL=PodWithMetadata.mjs.map