import * as ShardManagerState from "./ShardManagerState";
import * as RefSynchronized from "@effect/io/Ref/Synchronized";
import * as Effect from "@effect/io/Effect";
import * as Hub from "@effect/io/Hub";
import * as ShardingEvent from "./ShardingEvent";
import * as PodsHealth from "./PodsHealth";
import * as Pods from "./Pods";
import * as ManagerConfig from "./ManagerConfig";
import { pipe } from "@effect/data/Function";
import * as HashMap from "@effect/data//HashMap";
import * as List from "@effect/data/List";
import * as HashSet from "@effect/data/HashSet";
import * as Chunk from "@effect/data/Chunk";
import * as ShardId from "./ShardId";
import * as PodAddress from "./PodAddress";
import * as PodWithMetadata from "./PodWithMetadata";
import * as Option from "@effect/data/Option";
import * as Stream from "@effect/stream/Stream";
import * as Schedule from "@effect/io/Schedule";
import * as Storage from ".//Storage";
import * as Pod from "./Pod";
import { equals } from "@effect/data/Equal";
import * as ReadonlyArray from "@effect/data/ReadonlyArray";
import * as Order from "@effect/data/typeclass/Order";
import { groupBy, minByOption } from "./utils";

export function apply(
  stateRef: RefSynchronized.Synchronized<ShardManagerState.ShardManagerState>,
  rebalanceSemaphore: Effect.Semaphore,
  eventsHub: Hub.Hub<ShardingEvent.ShardingEvent>,
  healthApi: PodsHealth.PodsHealth,
  podApi: Pods.Pods,
  stateRepository: Storage.Storage,
  config: ManagerConfig.ManagerConfig
) {
  const getAssignments: Effect.Effect<
    never,
    never,
    HashMap.HashMap<ShardId.ShardId, Option.Option<PodAddress.PodAddress>>
  > = pipe(
    RefSynchronized.get(stateRef),
    Effect.map((_) => _.shards)
  );

  const getShardingEvents = Stream.fromHub(eventsHub);

  function register(pod: Pod.Pod) {
    return pipe(
      Effect.logInfo("Registering " + JSON.stringify(pod)),
      Effect.zipRight(
        RefSynchronized.updateAndGetEffect(stateRef, (state) =>
          pipe(
            Effect.flatMap(Effect.clock(), (_) => _.currentTimeMillis()),
            Effect.map((millis) => new Date(millis)),
            Effect.map((cdt) =>
              ShardManagerState.apply(
                HashMap.set(state.pods, pod.address, PodWithMetadata.apply(pod, cdt)),
                state.shards
              )
            )
          )
        )
      ),
      Effect.zipLeft(Hub.publish(eventsHub, ShardingEvent.PodRegistered(pod.address))),
      Effect.flatMap((state) =>
        Effect.when(rebalance(false), () => HashSet.size(state.unassignedShards) > 0)
      ),
      Effect.zipRight(Effect.forkDaemon(persistPods)),
      Effect.asUnit
    );
  }

  function stateHasPod(podAddress: PodAddress.PodAddress) {
    return pipe(
      RefSynchronized.get(stateRef),
      Effect.map((_) => HashMap.has(_.pods, podAddress))
    );
  }

  function notifyUnhealthyPod(podAddress: PodAddress.PodAddress) {
    return pipe(
      Effect.whenEffect(
        pipe(
          Hub.publish(eventsHub, ShardingEvent.PodHealthChecked(podAddress)),
          Effect.zipRight(
            Effect.unlessEffect(
              Effect.zipRight(
                Effect.logWarning(`${podAddress} is not alive, unregistering`),
                unregister(podAddress)
              ),
              healthApi.isAlive(podAddress)
            )
          )
        ),
        stateHasPod(podAddress)
      ),
      Effect.asUnit
    );
  }

  const checkAllPodsHealth = pipe(
    RefSynchronized.get(stateRef),
    Effect.map((_) => HashMap.keySet(_.pods)),
    Effect.flatMap((_) => Effect.withParallelism(Effect.forEachDiscard(_, notifyUnhealthyPod), 4))
  );

  /// TODO: finish porting
  function unregister(podAddress: PodAddress.PodAddress) {
    return Effect.whenEffect(
      pipe(Effect.logInfo(`Unregistering ${podAddress}`)),
      stateHasPod(podAddress)
    );
  }

  /**
  def unregister(podAddress: PodAddress): UIO[Unit] =
    ZIO
      .whenZIO(stateRef.get.map(_.pods.contains(podAddress))) {
        for {
          _             <- ZIO.logInfo(s"Unregistering $podAddress")
          unassignments <- stateRef.modify { state =>
                             (
                               state.shards.collect { case (shard, Some(p)) if p == podAddress => shard }.toSet,
                               state.copy(
                                 pods = state.pods - podAddress,
                                 shards =
                                   state.shards.map { case (k, v) => k -> (if (v.contains(podAddress)) None else v) }
                               )
                             )
                           }
          _             <- eventsHub.publish(ShardingEvent.PodUnregistered(podAddress))
          _             <- eventsHub
                             .publish(ShardingEvent.ShardsUnassigned(podAddress, unassignments))
                             .when(unassignments.nonEmpty)
          _             <- persistPods.forkDaemon
          _             <- rebalance(rebalanceImmediately = true).forkDaemon
        } yield ()
      }
      .unit
   */

  function withRetry<E, A>(zio: Effect.Effect<never, E, A>): Effect.Effect<never, never, void> {
    return pipe(
      zio,
      Effect.retry(
        pipe(
          Schedule.spaced(config.persistRetryInterval),
          Schedule.andThen(Schedule.recurs(config.persistRetryCount))
        )
      ),
      Effect.ignore
    );
  }

  const persistAssignments = withRetry(
    pipe(
      RefSynchronized.get(stateRef),
      Effect.flatMap((state) => stateRepository.saveAssignments(state.shards))
    )
  );

  const persistPods = withRetry(
    pipe(
      RefSynchronized.get(stateRef),
      Effect.flatMap((state) => stateRepository.savePods(HashMap.map(state.pods, (v) => v.pod)))
    )
  );

  function updateShardsState(shards: HashSet.HashSet<ShardId.ShardId>, pod: Option.Option<PodAddress.PodAddress>) {
    return pipe(
      stateRef,
      RefSynchronized.updateEffect(state => pipe(
        Effect.whenCase(() => )
      ))
    )
  }

  /**
  private def updateShardsState(shards: Set[ShardId], pod: Option[PodAddress]): Task[Unit] =
    stateRef.updateZIO(state =>
      ZIO
        .whenCase(pod) {
          case Some(pod) if !state.pods.contains(pod) => ZIO.fail(new Exception(s"Pod $pod is no longer registered"))
        }
        .as(
          state.copy(shards = state.shards.map { case (shard, assignment) =>
            shard -> (if (shards.contains(shard)) pod else assignment)
          })
        )
    )
   */


  function rebalance(rebalanceImmediately: boolean) {
    const algo = pipe(
      Effect.Do(),
      Effect.bind("state", () => RefSynchronized.get(stateRef)),
      Effect.bindValue("_1", ({ state }) =>
        rebalanceImmediately || HashSet.size(state.unassignedShards) > 0
          ? decideAssignmentsForUnassignedShards(state)
          : decideAssignmentsForUnbalancedShards(state, config.rebalanceRate)
      ),
      Effect.bindValue("assignments", (_) => _._1[0]),
      Effect.bindValue("unassignments", (_) => _._1[1]),
      Effect.bindValue(
        "areChanges",
        (_) => HashMap.size(_.assignments) > 0 || HashMap.size(_.unassignments) > 0
      ),
      Effect.tap((_) =>
        Effect.when(
          Effect.logDebug(
            "Rebalance (rebalanceImmidiately=" + JSON.stringify(rebalanceImmediately) + ")"
          ),
          () => _.areChanges
        )
      ),
      // ping pods first to make sure they are ready and remove those who aren't
      Effect.bind("failedPingedPods", (_) =>
        pipe(
          Effect.forEachPar(
            HashSet.union(HashMap.keySet(_.assignments), HashMap.keySet(_.unassignments)),
            (pod) =>
              pipe(
                podApi.ping(pod),
                Effect.timeout(config.pingTimeout),
                Effect.someOrFailException,
                Effect.match(
                  () => Chunk.fromIterable([pod]),
                  () => Chunk.empty()
                )
              )
          ),
          Effect.map(Chunk.flatten),
          Effect.map(HashSet.fromIterable)
        )
      ),
      Effect.bindValue("shardsToRemove", (_) =>
        pipe(
          List.fromIterable(_.assignments),
          List.concat(List.fromIterable(_.unassignments)),
          List.filter(([pod, __]) => HashSet.has(_.failedPingedPods, pod)),
          List.map(([_, shards]) => List.fromIterable(shards)),
          List.flatMap(_ => _), // TODO: List is missing flatMap
          HashSet.fromIterable
        )
      ),
      Effect.bindValue("readyAssignments", _ => pipe(
        _.assignments,
        HashMap.map(HashSet.difference(_.shardsToRemove)),
        HashMap.filter(__ => HashSet.size(__) > 0)
      )),
      Effect.bindValue("readyUnassignments", _ => pipe(
        _.unassignments,
        HashMap.map(HashSet.difference(_.shardsToRemove)),
        HashMap.filter(__ => HashSet.size(__) > 0)
      ))
    );

    return rebalanceSemaphore.withPermits(1)(algo);
  }

  return { getAssignments, getShardingEvents, register };
}

/*
  private def rebalance(rebalanceImmediately: Boolean): UIO[Unit] =
    rebalanceSemaphore.withPermit {
      for {
        // do the unassignments first
        failed                                        <- ZIO
                                                           .foreachPar(readyUnassignments.toList) { case (pod, shards) =>
                                                             (podApi.unassignShards(pod, shards) *> updateShardsState(shards, None)).foldZIO(
                                                               _ => ZIO.succeed((Set(pod), shards)),
                                                               _ =>
                                                                 eventsHub
                                                                   .publish(ShardingEvent.ShardsUnassigned(pod, shards))
                                                                   .as((Set.empty, Set.empty))
                                                             )
                                                           }
                                                           .map(_.unzip)
                                                           .map { case (pods, shards) => (pods.flatten.toSet, shards.flatten.toSet) }
        (failedUnassignedPods, failedUnassignedShards) = failed
        // remove assignments of shards that couldn't be unassigned, as well as faulty pods
        filteredAssignments                            = (readyAssignments -- failedUnassignedPods).map { case (pod, shards) =>
                                                           pod -> (shards diff failedUnassignedShards)
                                                         }
        // then do the assignments
        failedAssignedPods                            <- ZIO
                                                           .foreachPar(filteredAssignments.toList) { case (pod, shards) =>
                                                             (podApi.assignShards(pod, shards) *> updateShardsState(shards, Some(pod))).foldZIO(
                                                               _ => ZIO.succeed(Set(pod)),
                                                               _ => eventsHub.publish(ShardingEvent.ShardsAssigned(pod, shards)).as(Set.empty)
                                                             )
                                                           }
                                                           .map(_.flatten.toSet)
        failedPods                                     = failedPingedPods ++ failedUnassignedPods ++ failedAssignedPods
        // check if failing pods are still up
        _                                             <- ZIO.foreachDiscard(failedPods)(notifyUnhealthyPod).forkDaemon
        _                                             <- ZIO.logWarning(s"Failed to rebalance pods: $failedPods").when(failedPods.nonEmpty)
        // retry rebalancing later if there was any failure
        _                                             <- (Clock.sleep(config.rebalanceRetryInterval) *> rebalance(rebalanceImmediately)).forkDaemon
                                                           .when(failedPods.nonEmpty && rebalanceImmediately)
        // persist state changes to Redis
        _                                             <- persistAssignments.forkDaemon.when(areChanges)
      } yield ()
    }
* */

function decideAssignmentsForUnassignedShards(state: ShardManagerState.ShardManagerState) {
  return pickNewPods(List.fromIterable(state.unassignedShards), state, true, 1);
}

function decideAssignmentsForUnbalancedShards(
  state: ShardManagerState.ShardManagerState,
  rebalanceRate: number
) {
  // don't do regular rebalance in the middle of a rolling update
  const extraShardsToAllocate = state.allPodsHaveMaxVersion
    ? pipe(
        state.shardsPerPod,
        HashMap.flatMapWithIndex((shards, _) => {
          // count how many extra shards compared to the average
          const extraShards = Math.max(HashSet.size(shards) - state.averageShardsPerPod.value, 0);
          return pipe(
            HashMap.empty(),
            HashMap.set(_, HashSet.fromIterable(List.take(List.fromIterable(shards), extraShards)))
          );
        }),
        HashSet.fromIterable,
        HashSet.map((_) => _[1]),
        HashSet.flatMap((_) => _)
      )
    : HashSet.empty();

  /*
        TODO: port sortBy

    val sortedShardsToRebalance = extraShardsToAllocate.toList.sortBy { shard =>
      // handle unassigned shards first, then shards on the pods with most shards, then shards on old pods
      state.shards.get(shard).flatten.fold((Int.MinValue, OffsetDateTime.MIN)) { pod =>
        (
          state.shardsPerPod.get(pod).fold(Int.MinValue)(-_.size),
          state.pods.get(pod).fold(OffsetDateTime.MIN)(_.registered)
        )
      }
    }
* */
  const sortedShardsToRebalance = List.fromIterable(extraShardsToAllocate);
  return pickNewPods(sortedShardsToRebalance, state, false, rebalanceRate);
}

function pickNewPods(
  shardsToRebalance: List.List<ShardId.ShardId>,
  state: ShardManagerState.ShardManagerState,
  rebalanceImmediately: boolean,
  rebalanceRate: number
): readonly [
  assignments: HashMap.HashMap<PodAddress.PodAddress, HashSet.HashSet<ShardId.ShardId>>,
  unassignments: HashMap.HashMap<PodAddress.PodAddress, HashSet.HashSet<ShardId.ShardId>>
] {
  const [_, assignments] = pipe(
    List.reduce(
      shardsToRebalance,
      [
        state.shardsPerPod,
        List.empty<readonly [ShardId.ShardId, PodAddress.PodAddress]>(),
      ] as const,
      ([shardsPerPod, assignments], shard) => {
        const unassignedPods = pipe(
          assignments,
          List.flatMap(([shard, _]) =>
            pipe(
              HashMap.get(state.shards, shard),
              Option.flatten,
              Option.toArray,
              List.fromIterable
            )
          )
        );

        // find pod with least amount of shards
        return pipe(
          // keep only pods with the max version
          HashMap.filterWithIndex(shardsPerPod, (_, pod) => {
            const maxVersion = state.maxVersion;
            if (Option.isNone(maxVersion)) return true;
            return pipe(
              HashMap.get(state.pods, pod),
              Option.map(PodWithMetadata.extractVersion),
              Option.map((_) => PodWithMetadata.compareVersion(_, maxVersion.value) === 0),
              Option.getOrElse(() => false)
            );
          }),
          // don't assign too many shards to the same pods, unless we need rebalance immediately
          HashMap.filterWithIndex((_, pod) => {
            if (rebalanceImmediately) return true;
            return (
              pipe(
                assignments,
                List.filter(([_, p]) => equals(p)(pod)),
                List.length
              ) <
              HashMap.size(state.shards) * rebalanceRate
            );
          }),
          // don't assign to a pod that was unassigned in the same rebalance
          HashMap.filterWithIndex(
            (_, pod) => !Option.isSome(List.findFirst(unassignedPods, equals(pod)))
          ),
          minByOption(([address, pods]) => HashSet.size(pods)),
          Option.match(
            () => [shardsPerPod, assignments] as const,
            ([pod, shards]) => {
              const oldPod = Option.flatten(HashMap.get(state.shards, shard));
              // if old pod is same as new pod, don't change anything
              if (equals(oldPod)(pod)) {
                return [shardsPerPod, assignments] as const;
                // if the new pod has more, as much, or only 1 less shard than the old pod, don't change anything
              } else if (
                Option.match(HashMap.get(shardsPerPod, pod), () => 0, HashSet.size) + 1 >=
                Option.match(
                  oldPod,
                  () => Number.MAX_SAFE_INTEGER,
                  (_) => Option.match(HashMap.get(shardsPerPod, _), () => 0, HashSet.size)
                )
              ) {
                return [shardsPerPod, assignments] as const;

                // otherwise, create a new assignment
              } else {
                const unassigned = Option.match(
                  oldPod,
                  () => shardsPerPod,
                  (oldPod) => HashMap.modify(shardsPerPod, oldPod, HashSet.remove(shard))
                );
                return [
                  HashMap.modify(unassigned, pod, (_) => HashSet.add(shards, shard)),
                  List.prepend(assignments, [shard, pod] as const),
                ] as const;
              }
            }
          )
        );
      }
    )
  );

  const unassignments = List.flatMap(assignments, ([shard, _]) =>
    pipe(
      Option.flatten(HashMap.get(state.shards, shard)),
      Option.map((_) => [shard, _] as const),
      Option.match(List.empty, List.of)
    )
  );

  const assignmentsPerPod = pipe(
    assignments,
    groupBy(([_, pod]) => pod),
    HashMap.map(HashSet.map(([shardId, pod]) => shardId))
  );
  const unassignmentsPerPod = pipe(
    unassignments,
    groupBy(([_, pod]) => pod),
    HashMap.map(HashSet.map(([shardId, pod]) => shardId))
  );
  return [assignmentsPerPod, unassignmentsPerPod] as const;
}