/**
 * @since 1.0.0
 */
import * as ShardManagerProtocolHttp from "@effect/cluster-node/ShardManagerProtocolHttp"
import * as Pod from "@effect/cluster/Pod"
import * as ShardingConfig from "@effect/cluster/ShardingConfig"
import * as ShardManagerClient from "@effect/cluster/ShardManagerClient"
import * as Http from "@effect/platform/HttpClient"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"

/**
 * @since 1.0.0
 * @category layers
 */
export const shardManagerClientHttp = Layer.effect(
  ShardManagerClient.ShardManagerClient,
  Effect.gen(function*(_) {
    const config = yield* _(ShardingConfig.ShardingConfig)
    const client = yield* _(Http.client.Client, Effect.map(Http.client.filterStatusOk))

    return ({
      register: (podAddress) =>
        Effect.gen(function*(_) {
          const request = yield* _(
            Http.request.post("/register"),
            Http.request.prependUrl(config.shardManagerUri),
            Http.request.schemaBody(ShardManagerProtocolHttp.Register_)({
              pod: Pod.make(podAddress, config.serverVersion)
            })
          )

          return yield* _(client(request))
        }).pipe(Effect.orDie),
      unregister: (podAddress) =>
        Effect.gen(function*(_) {
          const request = yield* _(
            Http.request.post("/unregister"),
            Http.request.prependUrl(config.shardManagerUri),
            Http.request.schemaBody(ShardManagerProtocolHttp.Unregister_)({
              pod: Pod.make(podAddress, config.serverVersion)
            })
          )

          return yield* _(client(request))
        }).pipe(Effect.orDie),
      notifyUnhealthyPod: (podAddress) =>
        Effect.gen(function*(_) {
          const request = yield* _(
            Http.request.post("/notify-unhealthy-pod"),
            Http.request.prependUrl(config.shardManagerUri),
            Http.request.schemaBody(ShardManagerProtocolHttp.NotifyUnhealthyPod_)({
              podAddress
            })
          )

          return yield* _(client(request))
        }).pipe(Effect.orDie),
      getAssignments: Effect.gen(function*(_) {
        const request = pipe(
          Http.request.get("/get-assignments"),
          Http.request.prependUrl(config.shardManagerUri)
        )

        const response = yield* _(
          client(request),
          Effect.flatMap(
            Http.response.schemaBodyJson(ShardManagerProtocolHttp.GetAssignmentsResult_)
          )
        )

        return HashMap.fromIterable(response)
      }).pipe(Effect.orDie)
    } as ShardManagerClient.ShardManagerClient)
  })
).pipe(Layer.use(Http.client.layer))
