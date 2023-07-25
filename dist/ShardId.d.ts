/**
 * @since 1.0.0
 */
import * as Data from "@effect/data/Data";
import * as Schema from "@effect/schema/Schema";
/**
 * @since 1.0.0
 * @category symbols
 */
export declare const TypeId = "@effect/shardcake/ShardId";
/**
 * @since 1.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId;
/**
 * @since 1.0.0
 * @category models
 */
export interface ShardId extends Schema.To<typeof schema> {
}
/**
 * @since 1.0.0
 * @category constructors
 */
export declare function make(value: number): ShardId;
/**
 * This is the schema for a value.
 *
 * @since 1.0.0
 * @category schema
 */
export declare const schema: Schema.Schema<{
    readonly value: number;
    readonly _id: "@effect/shardcake/ShardId";
}, Data.Data<{
    readonly value: number;
    readonly _id: "@effect/shardcake/ShardId";
}>>;
//# sourceMappingURL=ShardId.d.ts.map