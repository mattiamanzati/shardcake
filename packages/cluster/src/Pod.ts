/**
 * @since 1.0.0
 */
import * as PodAddress from "@effect/cluster/PodAddress"
import * as Schema from "@effect/schema/Schema"
import * as Data from "effect/Data"
import { pipe } from "effect/Function"

/**
 * @since 1.0.0
 * @category symbols
 */
export const TypeId = "@effect/cluster/Pod"

/**
 * @since 1.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface Pod extends Schema.Schema.To<typeof schema> {}

/**
 * @since 1.0.0
 * @category utils
 */
export function isPod(value: unknown): value is Pod {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value &&
    value["_id"] === TypeId
  )
}

/**
 * @since 1.0.0
 * @category constructors
 */
export function make(address: PodAddress.PodAddress, version: string): Pod {
  return Data.struct({ _id: TypeId, address, version })
}

/** @internal */
export function show(value: Pod) {
  return "Pod(address=" + value.address + ", version=" + value.version + ")"
}

/**
 * @since 1.0.0
 * @category schema
 */
export const schema = pipe(
  Schema.struct({
    _id: Schema.literal(TypeId),
    address: PodAddress.schema,
    version: Schema.string
  }),
  Schema.data
)
