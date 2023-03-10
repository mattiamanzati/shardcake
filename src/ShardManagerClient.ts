import * as Effect from "@effect/io/Effect";
import { Tag } from "@effect/data/Context";
import { pipe } from "@effect/data/Function";
import * as HashMap from "@effect/data/HashMap";
import * as Option from "@effect/data/Option";
import { Config } from "./Config";
import * as PodAddress from "./PodAddress";
import * as Layer from "@effect/io/Layer";
import { apply, ShardId } from "./ShardId";

export interface ShardManagerClient {
  register(podAddress: PodAddress.PodAddress): Effect.Effect<never, never, void>;
  unregister(podAddress: PodAddress.PodAddress): Effect.Effect<never, never, void>;
  notifyUnhealthyPod(podAddress: PodAddress.PodAddress): Effect.Effect<never, never, void>;
  getAssignments: Effect.Effect<
    never,
    never,
    HashMap.HashMap<ShardId, Option.Option<PodAddress.PodAddress>>
  >;
}

export const ShardManagerClient = Tag<ShardManagerClient>();

export const local = pipe(
  Layer.effect(
    ShardManagerClient,
    Effect.gen(function* ($) {
      const config = yield* $(Effect.service(Config));
      const pod = PodAddress.podAddress(config.selfHost, config.shardingPort);
      let shards = HashMap.empty<ShardId, Option.Option<PodAddress.PodAddress>>();
      for (let i = 0; i < config.numberOfShards; i++) {
        shards = HashMap.set(shards, apply(i), Option.some(pod));
      }
      return {
        register: () => Effect.unit(),
        unregister: () => Effect.unit(),
        notifyUnhealthyPod: () => Effect.unit(),
        getAssignments: Effect.succeed(shards),
      } as ShardManagerClient;
    })
  )
);
