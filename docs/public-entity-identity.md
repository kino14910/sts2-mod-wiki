# Public entity identity contract

Pure helpers define identity policy, route loaders resolve incoming URLs, and the
server identity service preserves community ownership during catalog changes.

## Shared API (2026-11-13)

Import from `#lib/entities` in application code. Pure implementation lives in
`src/lib/entity-identity.ts`; it uses relative `.ts` imports only. `cards.ts` and
`collections.ts` must remain importable by Node `--experimental-strip-types` without
`#lib`, SvelteKit, `data/entities` or `virtual:mods` runtime dependencies.

- `ScopedEntityRef = EntityRef & { modId?: string }`: internal `id` remains rawId.
- `ResolvedEntityRef = EntityRef & { modId: string }`: resolved internal reference.
- `initializePublicEntityRefs(refs: Iterable<ScopedEntityRef>): void`: replace the
  static catalog identity index; use after loading CARDS/RELICS/POTIONS/MOD_POWERS.
  `registerPublicEntityRefs(refs)` adds owners idempotently. The full entity registry
  and eager glossary links use it to register all entities before generating links.
- `resolvePublicEntityRef(ref: ScopedEntityRef): ResolvedEntityRef | null`:
  explicit prefix selects exactly that Mod; conflicting explicit `modId` rejects;
  unknown IDs reject; bare legacy ID resolves only when exactly one catalog owner exists.
- `publicEntityId(ref: ScopedEntityRef): string | null`: generate the canonical public
  ID. Explicit scope can be formatted before catalog registration; callers handling
  external input must first resolve it. Unscoped ambiguous refs reject. Non-sts2 IDs
  always use `modId:rawId`. sts2 uses rawId unless the same type/rawId has another owner,
  in which case it uses `sts2:rawId`.
- `toPublicEntityRef(ref: ScopedEntityRef): EntityRef | null`: public `{type,id}`.
- `publicEntityKey(ref: ScopedEntityRef): string | null`: canonical `type:publicId`.
- `entityHref(ref: ScopedEntityRef): string | null`: canonical encoded URL; refuses
  ambiguous input. Existing `entityKey`, `parseEntityKey`, `wikiPageKey` remain serializers;
  normalize external refs before using those serializers for persistence.
- `findGameEntity(ref)`: accepts scoped raw refs, explicit public IDs and unique legacy
  bare IDs. Returns null for ambiguous/unknown refs; returns raw data without rewriting IDs.
- `listEntityRefs()`: all internal refs with required Mod scope;
  `listEntityKeys()`: canonical public keys, not ambiguous raw keys.

Examples for the real collision:

```ts
resolvePublicEntityRef({ type: 'card', id: 'TeslaCoil' }) // null
resolvePublicEntityRef({ type: 'card', id: 'fgo:TeslaCoil' })
// { type: 'card', id: 'TeslaCoil', modId: 'fgo' }
publicEntityId({ type: 'card', id: 'TeslaCoil', modId: 'sts2' }) // 'sts2:TeslaCoil'
entityHref({ type: 'card', id: 'TeslaCoil', modId: 'fgo' }) // '/cards/fgo%3ATeslaCoil'
publicEntityId({ type: 'card', id: 'Bash', modId: 'sts2' }) // 'Bash'
```

## Loader hook

Runtime catalog loading initializes owners in `mods.ts` before downstream indexes
evaluate. Glossary/entity registries then register additional keyword owners. The
loader includes cards, relics, potions, powers and imported characters:

```ts
import { initializePublicEntityRefs } from '../entity-identity.ts';
initializePublicEntityRefs([
  ...CARDS.map(x => ({ type: 'card' as const, id: x.id, modId: x.mod })),
  ...RELICS.map(x => ({ type: 'relic' as const, id: x.id, modId: x.mod })),
  ...POTIONS.map(x => ({ type: 'potion' as const, id: x.id, modId: x.mod })),
  ...MOD_POWERS.map(x => ({ type: 'power' as const, id: x.id, modId: x.mod ?? 'sts2' }))
]);
```

Do not rename raw IDs in artifacts, localization or entity data. Route loaders resolve
input, locate the scoped entity, then redirect unique legacy URLs to entityHref(resolved).
Server canonicalizes toPublicEntityRef(resolved) before page keys, queries, and seed creation.
For legacy history, recorded ownership constrains migration. Rows from a formerly
ambiguous public route cannot be attributed merely from the old page's mod_id:
they may contain mixed contributions. Keep them archived for manual review,
never assign them according to current catalog load order.

Contract files: `src/lib/entities.ts`, `src/lib/entity-identity.ts`,
`src/lib/data/entities.ts`, `src/lib/data/cards.ts`, `src/lib/data/collections.ts`,
`src/lib/data/glossary.ts`, `src/lib/data/wiki-links.ts`,
`src/lib/data/localize.ts`, `src/lib/data/power-references.ts`.
