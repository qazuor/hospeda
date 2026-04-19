# CLAUDE.md - Media Package

> **Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the media package (`@repo/media`) — Cloudinary-backed image upload, transform URL building, file validation, and named transform presets.

## When To Use This Package

Use `@repo/media` whenever code needs to:

- Build a Cloudinary delivery URL from a public ID + named preset.
- Parse a Cloudinary URL back into its public ID.
- Upload, delete, or health-check media on the server side.
- Validate an uploaded file's magic bytes and size before storing it.

Do NOT reach for the `cloudinary` SDK directly anywhere in the monorepo. All Cloudinary access goes through this package.

## The 3-Subpath Rule (CRITICAL)

The package is split into three subpaths to keep the `cloudinary` SDK and other Node-only modules out of browser bundles:

| Subpath | Allowed In | Forbidden In |
|---------|------------|--------------|
| `@repo/media` | Anywhere (browser-safe) | — |
| `@repo/media/server` | `apps/api`, `packages/seed`, Node scripts | `apps/admin`, `apps/web` (Biome `noRestrictedImports` blocks it) |
| `@repo/media/test-utils` | `*.test.ts` / `*.test.tsx` files | Production source under `src/` |

If you find yourself wanting to import from `@repo/media/server` inside `apps/admin` or `apps/web`, stop. Move the work to the API and call it via a route. See SPEC-078-GAPS T-017 for the rationale (bundle size + secret leakage prevention).

## Anti-Patterns

### Never instantiate `CloudinaryProvider` directly

```ts
// WRONG: bypasses the singleton, leaks credentials, breaks dev fallback
import { CloudinaryProvider } from '@repo/media/server';
const provider = new CloudinaryProvider({ cloudName: '...', apiKey: '...', apiSecret: '...' });
```

```ts
// CORRECT: always go through the singleton
import { getMediaProvider } from '../services/media.js';
const provider = getMediaProvider();
if (!provider) return c.json({ error: 'media unavailable' }, 503);
```

The `CloudinaryProvider` constructor is marked `@internal` (SPEC-078-GAPS T-020). Only `apps/api/src/services/media.ts` is allowed to instantiate it.

### Never inline Cloudinary URLs

```ts
// WRONG: hand-built transform string, no DPR handling, easy to drift
const url = `https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill/${id}.jpg`;
```

```ts
// CORRECT: use the preset
import { getMediaUrl } from '@repo/media';
const url = getMediaUrl({ publicId: id, preset: 'card', cloudName: 'hospeda' });
```

### Never add a new preset without coordination

`MEDIA_PRESETS` is `Object.freeze`d (SPEC-078-GAPS T-060). Adding a preset is a coordinated change: it touches the schema enum (`MediaPreset`), the URL builder, every consumer that branches on preset name, and the test fixtures. Open a SPEC ticket first.

## Avatar Race Condition (Known Trade-off)

Avatars use a **fixed `publicId` equal to the user ID** (e.g. `users/<userId>/avatar`). This is intentional: it means the latest upload always overwrites the previous one and no orphan assets accumulate.

The trade-off: **two concurrent admin updates on the same avatar race**, and the order of writes is not guaranteed. Cloudinary's delivery is last-write-wins — whichever upload completes second is the one served.

Mitigations in place:

- The avatar route re-verifies the actor's session inside the handler before allowing the write (SPEC-078-GAPS T-008), so a stale form post can't overwrite a freshly logged-in user's avatar.
- Future JSONB merge semantics on the user `media` field (SPEC-078-GAPS T-015) will detect simultaneous writes at the persistence layer.

If you need true serialization on avatar writes, use a per-user advisory lock around the upload + DB update — but only for cases where order genuinely matters (audit-graded media, contracts, etc.). Do not add locking to the default avatar flow.

## Provider Behavior

### `delete` and `deleteByPrefix` are idempotent + retried

Both wrap their Cloudinary calls in `p-retry` with exponential backoff (SPEC-078-GAPS T-035 / GAP-078-035). Calling `delete` on a public ID that doesn't exist returns success — repeated cleanup attempts are safe.

### `upload` is NOT retried by design

Upload retries can produce duplicate assets when the first attempt succeeded but the response was lost in transit. The provider returns the error immediately and lets the caller decide. Routes that need resilient uploads must:

1. Generate a deterministic `publicId` (preferred — Cloudinary will overwrite the same ID, not duplicate).
2. Or implement their own idempotency token + dedup check.

### `healthCheck` for liveness

Each provider exposes `healthCheck(): Promise<HealthCheckResult>` returning `{ ok, latencyMs?, error? }` (SPEC-078-GAPS T-052). Wire it into the API's `/health` endpoint when you need media availability surfaced.

## Dev Fallback

When `NODE_ENV=development` and Cloudinary env vars are missing, `getMediaProvider()` falls back to `InMemoryImageProvider` from `@repo/media/test-utils` and logs a `warn` line via `apiLogger`. Local dev never crashes on upload paths just because nobody set up a Cloudinary account.

In `production` and `test`, missing credentials leave the provider as `null` — routes must check for `null` and return 503.

## Testing

- Use `InMemoryImageProvider` from `@repo/media/test-utils` as a drop-in `ImageProvider`.
- For tests that need to swap singletons, call `resetMediaProviderForTesting()` from `apps/api/src/services/media.ts` (only works under `NODE_ENV=test`).
- The package's own test suite covers all three subpaths (178 tests at time of writing). Do not weaken these — the `q_auto,f_auto,dpr_auto` invariants and the "browser-safe entrypoint imports zero Node modules" guarantee are both covered.

## Key Files

- `src/index.ts` — browser-safe barrel.
- `src/server/index.ts` — server barrel (CloudinaryProvider, validation, env).
- `src/test-utils/index.ts` — test doubles barrel.
- `src/presets.ts` — frozen `MEDIA_PRESETS` lookup.
- `src/server/cloudinary.provider.ts` — provider implementation with retry + healthCheck.
- `apps/api/src/services/media.ts` — canonical singleton (`getMediaProvider`, `initializeMediaProvider`, `resetMediaProviderForTesting`).

## Related

- SPEC-078-GAPS — full Cloudinary remediation track (T-017 split, T-018/T-019 test utils, T-020 @internal, T-035 retry, T-052 healthCheck, T-055 dpr_auto, T-060 freeze).
- [Runbook: Cloudinary Incidents](../../docs/runbooks/cloudinary-incidents.md)
- ADRs under `docs/decisions/` covering image management.
