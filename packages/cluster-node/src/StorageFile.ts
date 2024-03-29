/**
 * @since 1.0.0
 */
import * as Pod from "@effect/cluster/Pod"
import * as PodAddress from "@effect/cluster/PodAddress"
import * as ShardId from "@effect/cluster/ShardId"
import * as Storage from "@effect/cluster/Storage"
import * as Schema from "@effect/schema/Schema"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import type * as Option from "effect/Option"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import * as fs from "fs"
import { jsonParse, jsonStringify } from "./utils"

const PODS_FILE = "pods.json"
const ASSIGNMENTS_FILE = "assignments.json"

const AssignmentsSchema = Schema.array(
  Schema.tuple(ShardId.schema, Schema.optionFromNullable(PodAddress.schema))
)

const PodsSchema = Schema.array(Schema.tuple(PodAddress.schema, Pod.schema))

function writeJsonData<I, A>(fileName: string, schema: Schema.Schema<I, A>, data: A) {
  return pipe(
    jsonStringify(data, schema),
    Effect.flatMap((data) => Effect.sync(() => fs.writeFileSync(fileName, data))),
    Effect.orDie
  )
}

function readJsonData<I, A>(fileName: string, schema: Schema.Schema<I, A>, empty: A) {
  return pipe(
    Effect.sync(() => fs.existsSync(fileName)),
    Effect.flatMap((exists) =>
      exists
        ? pipe(
          Effect.sync(() => fs.readFileSync(fileName)),
          Effect.flatMap((data) => jsonParse(data.toString(), schema))
        )
        : Effect.succeed(empty)
    ),
    Effect.orDie
  )
}

const getAssignments: Effect.Effect<
  never,
  never,
  HashMap.HashMap<ShardId.ShardId, Option.Option<PodAddress.PodAddress>>
> = pipe(readJsonData(ASSIGNMENTS_FILE, AssignmentsSchema, []), Effect.map(HashMap.fromIterable))

function saveAssignments(
  assignments: HashMap.HashMap<ShardId.ShardId, Option.Option<PodAddress.PodAddress>>
): Effect.Effect<never, never, void> {
  return writeJsonData(ASSIGNMENTS_FILE, AssignmentsSchema, Array.from(assignments))
}

const getPods: Effect.Effect<never, never, HashMap.HashMap<PodAddress.PodAddress, Pod.Pod>> = pipe(
  readJsonData(PODS_FILE, PodsSchema, []),
  Effect.map(HashMap.fromIterable)
)

function savePods(
  pods: HashMap.HashMap<PodAddress.PodAddress, Pod.Pod>
): Effect.Effect<never, never, void> {
  return writeJsonData("pods.json", PodsSchema, Array.from(pods))
}

/**
 * A layer that stores data in-memory.
 * This is useful for testing with a single pod only.
 */

function getChangesStream(fileName: string) {
  return pipe(
    Queue.unbounded<boolean>(),
    Effect.flatMap((queue) =>
      pipe(
        Effect.acquireRelease(
          Effect.sync(
            () => [fs.watchFile(fileName, () => Effect.runSync(queue.offer(true))), queue] as const
          ),
          ([watcher, queue]) =>
            Effect.zip(
              queue.shutdown(),
              Effect.sync(() => watcher.unref()),
              { concurrent: true }
            )
        ),
        Effect.map(([_, queue]) => Stream.fromQueue(queue))
      )
    ),
    Stream.unwrapScoped
  )
}

const assignmentsStream = pipe(
  getChangesStream(ASSIGNMENTS_FILE),
  Stream.mapEffect(() => getAssignments)
)

/**
 * @since 1.0.0
 * @category layers
 */
export const storageFile = Layer.scoped(
  Storage.Storage,
  Effect.succeed({
    getAssignments,
    saveAssignments,
    assignmentsStream,
    getPods,
    savePods
  })
)
