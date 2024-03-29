---
title: Replier.ts
nav_order: 18
parent: "@effect/cluster"
---

## Replier overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [replier](#replier)
- [models](#models)
  - [Replier (interface)](#replier-interface)
- [schema](#schema)
  - [schema](#schema-1)
- [symbols](#symbols)
  - [TypeId](#typeid)
  - [TypeId (type alias)](#typeid-type-alias)
- [utils](#utils)
  - [isReplier](#isreplier)

---

# constructors

## replier

**Signature**

```ts
export declare const replier: <I, A>(id: ReplyId.ReplyId, schema: Schema.Schema<I, A>) => Replier<A>
```

Added in v1.0.0

# models

## Replier (interface)

**Signature**

```ts
export interface Replier<A> {
  readonly _id: TypeId
  readonly id: ReplyId.ReplyId
  readonly schema: Schema.Schema<unknown, A>
}
```

Added in v1.0.0

# schema

## schema

**Signature**

```ts
export declare const schema: <I, A>(schema: Schema.Schema<I, A>) => Schema.Schema<I, Replier<A>>
```

Added in v1.0.0

# symbols

## TypeId

**Signature**

```ts
export declare const TypeId: '@effect/cluster/Replier'
```

Added in v1.0.0

## TypeId (type alias)

**Signature**

```ts
export type TypeId = typeof TypeId
```

Added in v1.0.0

# utils

## isReplier

**Signature**

```ts
export declare function isReplier<A>(value: unknown): value is Replier<A>
```

Added in v1.0.0
