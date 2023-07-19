/**
 * @since 1.0.0
 */

import * as Effect from "@effect/io/Effect";
import * as Layer from "@effect/io/Layer";
import * as Pods from "@effect/shardcake/Pods";
import { isFetchError, PodUnavailable } from "@effect/shardcake/ShardError";
import * as ShardingProtocolHttp from "@effect/shardcake/ShardingProtocolHttp";
import * as Stream from "@effect/stream/Stream";
import { send, sendStream } from "./utils";
/** @internal */
function asHttpUrl(pod) {
  return `http://${pod.host}:${pod.port}/`;
}
/**
 * @since 1.0.0
 * @category layers
 */
export const httpPods = /*#__PURE__*/Layer.succeed(Pods.Pods, {
  [Pods.TypeId]: {},
  assignShards: (pod, shards) => Effect.orDie(send(ShardingProtocolHttp.AssignShard_, ShardingProtocolHttp.AssignShardResult_)(asHttpUrl(pod), {
    _tag: "AssignShards",
    shards: Array.from(shards)
  })),
  unassignShards: (pod, shards) => Effect.orDie(send(ShardingProtocolHttp.UnassignShards_, ShardingProtocolHttp.UnassignShardsResult_)(asHttpUrl(pod), {
    _tag: "UnassignShards",
    shards: Array.from(shards)
  })),
  ping: pod => Effect.catchAllDefect(e => {
    if (isFetchError(e)) {
      return Effect.fail(PodUnavailable(pod));
    }
    return Effect.die(e);
  })(send(ShardingProtocolHttp.PingShards_, ShardingProtocolHttp.PingShardsResult_)(asHttpUrl(pod), {
    _tag: "PingShards"
  })),
  sendMessage: (pod, message) => Effect.orDie(send(ShardingProtocolHttp.Send_, ShardingProtocolHttp.SendResult_)(asHttpUrl(pod), {
    _tag: "Send",
    message
  })),
  sendMessageStreaming: (pod, message) => Stream.orDie(sendStream(ShardingProtocolHttp.SendStream_, ShardingProtocolHttp.SendStreamResultItem_)(asHttpUrl(pod), {
    _tag: "SendStream",
    message
  }))
});
//# sourceMappingURL=PodsHttp.mjs.map