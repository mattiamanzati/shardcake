/**
 * @since 1.0.0
 */
import * as Data from "@effect/data/Data";
import * as List from "@effect/data/List";
import * as Schema from "@effect/schema/Schema";
import * as Pod from "@effect/shardcake/Pod";
/**
 * @since 1.0.0
 * @category symbols
 */
export declare const TypeId = "@effect/shardcake/PodWithMetadata";
/**
 * @since 1.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId;
/**
 * @since 1.0.0
 * @category models
 */
export interface PodWithMetadata extends Schema.To<typeof schema> {
}
/**
 * @since 1.0.0
 * @category utils
 */
export declare function isPodWithMetadata(value: unknown): value is PodWithMetadata;
/**
 * @since 1.0.0
 * @category constructors
 */
export declare function make(pod: Pod.Pod, registered: number): PodWithMetadata;
/**
 * @since 1.0.0
 * @category utils
 */
export declare function extractVersion(pod: PodWithMetadata): List.List<number>;
/**
 * @since 1.0.0
 * @category utils
 */
export declare function compareVersion(a: List.List<number>, b: List.List<number>): 0 | 1 | -1;
/**
 * @since 1.0.0
 * @category schema
 */
export declare const schema: Schema.Schema<{
    readonly _id: "@effect/shardcake/PodWithMetadata";
    readonly pod: {
        readonly _id: "@effect/shardcake/Pod";
        readonly address: {
            readonly _id: "@effect/shardcake/PodAddress";
            readonly host: string;
            readonly port: number;
        };
        readonly version: string;
    };
    readonly registered: number;
}, Data.Data<{
    readonly _id: "@effect/shardcake/PodWithMetadata";
    readonly pod: Data.Data<{
        readonly _id: "@effect/shardcake/Pod";
        readonly address: Data.Data<{
            readonly _id: "@effect/shardcake/PodAddress";
            readonly host: string;
            readonly port: number;
        }>;
        readonly version: string;
    }>;
    readonly registered: number;
}>>;
//# sourceMappingURL=PodWithMetadata.d.ts.map