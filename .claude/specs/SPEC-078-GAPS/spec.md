# SPEC-078-GAPS: Cloudinary Image Management — Gaps Remediation

> **Status**: in-progress
> **Priority**: P1 (security + data integrity critical)
> **Complexity**: XL (10 phases, ~176 gaps across security, DB, schemas, API, seed, web migration, observability)
> **Origin**: SPEC-078 gaps audit (specs-gaps-078.md, 2026-04-17)
> **Depends on**: SPEC-078 (initial Cloudinary implementation, in-progress)
> **Created**: 2026-04-18
> **Type**: hardening + architectural-consistency
> **Breaking change**: Yes (DB migrations, API response shape alignments, schema additive changes)

---

## Problem Statement

The initial SPEC-078 Cloudinary implementation uncovered ~200 gaps during an audit on 2026-04-17. After triage, 176 gaps are actionable within this spec (131 auto-decided + 45 complex with tradeoffs). The gaps span seven critical domains: security defense-in-depth, DB migration drift (manual migrations 0016-0020 missing from repo), schema type inconsistencies (nullability lies, missing optional fields), API response contract misalignments, seed pipeline strategy ambiguity, admin UI wiring gaps, and missing observability infrastructure. Without remediation the feature is partially deployed but insecure, untestable from a fresh clone, and structurally inconsistent. This spec organizes all remediation work into 10 sequential and parallel phases. Six additional gaps were deferred to new dedicated SPECs (084-089). Five were postponed per YAGNI. Two were discarded as false positives.

---

## Goals

- Secure the media upload/delete pipeline against path traversal, env prefix injection, decompression bombs, and SSRF.
- Restore DB reproducibility: `pnpm db:fresh` on a clean clone must complete without errors (missing manual migrations 0016-0020).
- Achieve type honesty: nullable columns declared nullable, optional fields marked optional, no `$type<Media>` lies.
- Establish clean bundle architecture: `@repo/media` subpath exports prevent SDK leaking into browser bundles.
- Define clear seed strategy: `required` seeds upload to Cloudinary; `example` seeds skip it entirely.
- Wire all 4 admin entity edit pages (destinations, events, posts + existing accommodations) for image upload/delete.
- Add observability: Sentry capture, structured logs, metrics counters, operational runbook.
- Achieve coverage ≥90% in `@repo/media` and integration tests covering 17+ API scenarios.

---

## Non-Goals

- Re-architecting the Cloudinary provider abstraction or replacing it with a different CDN.
- GDPR/right-to-erasure orchestration (deferred to SPEC-084).
- Outbox pattern for external consistency (deferred to SPEC-085).
- Admin CSP nonce tightening beyond `img-src` and explicit allowlist (full hardening deferred to SPEC-086).
- Disaster recovery / Cloudinary backup strategy (deferred to SPEC-087).
- `srcset`/`sizes` responsive images or LCP preload (deferred to SPEC-088).
- Web toast system for upload feedback (deferred to SPEC-089).
- Idempotency-Key header for upload retries (deferred to SPEC-085).
- GIN index on `media` JSONB columns (deferred: YAGNI until admin filter appears).
- Soft-delete + restore race condition with out-of-band Cloudinary deletion (documented in runbook, deferred YAGNI).
- Kill-switch `HOSPEDA_MEDIA_UPLOAD_ENABLED` (deferred to SPEC-079 rate limiting + ops kill-switches).
- Endpoint `GET /api/v1/public/config/media-limits` (deferred: YAGNI).
- Hash-based seed URL deduplication (deferred: YAGNI, <50 required seeds).

---

## Requirements (by phase)

---

### Phase 0 — Blockers: routes, env, provider injection (status: done)

**Rationale**: The feature does not exist at runtime without registered routes, validated env vars, and a wired media provider.
**Dependencies**: none (entrypoint).
**Completed in commits**: f0d9d2fc..fbd714d1

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-001 | Register `/api/v1/admin/media` + `/api/v1/protected/media` in `apps/api/src/routes/index.ts` + smoke test | `GET /api/v1/admin/media/upload` returns 405 (not 404); smoke test passes in CI |
| GAP-078-003 | Add `@repo/media: workspace:*` to `apps/api/package.json` + `pnpm install` | `pnpm typecheck` passes; no "Cannot find module @repo/media" error |
| GAP-078-025 | Add 4 Cloudinary env vars to `ApiEnvSchema` Zod in `apps/api/src/utils/env.ts`; consume via `env.HOSPEDA_...` | App fails fast with descriptive Zod error if vars missing at startup; `env.HOSPEDA_CLOUDINARY_CLOUD_NAME` is typed string |
| GAP-078-002 | Inject `mediaProvider` via `getMediaProvider()` per-request in all 5 `hardDelete.ts` handlers | `pnpm test` passes; mock provider receives `deleteByPrefix` call after entity hardDelete |

---

### Phase 1A — Permissions + authorization (status: done)

**Rationale**: Upload and delete routes are accessible without permission checks, violating the permission-only auth policy.
**Dependencies**: Phase 0.
**Completed in commit**: e40c32f3

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-053 + GAP-078-164 | Add `MEDIA_UPLOAD`/`MEDIA_DELETE` to `PermissionEnum` in `@repo/schemas`; routes use `requiredPermissions`; handler validates entity-specific permission (`ACCOMMODATION_UPDATE`, etc.) per `entityType` body field | `POST /api/v1/admin/media/upload` returns 403 without `MEDIA_UPLOAD` permission; 403 with `MEDIA_UPLOAD` but without entity-specific permission; 200 with both; ADR created |

---

### Phase 1B — DB setup: manual migrations reconstruction (status: pending)

**Rationale**: Manual migrations 0016-0020 are missing from the repo; `pnpm db:fresh` on a clean clone fails, blocking CI/CD.
**Dependencies**: Phase 0.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-188 | Audit `apply-postgres-extras.sh`, `triggers-manifest.md`, ADR-017, git log; reconstruct SQL files `packages/db/src/migrations/manual/0016-0020` covering: `search_index` materialized view, triggers `set_updated_at` and `delete_entity_bookmarks`, CHECK `chk_limit_adjustments_type`, gallery max constraint, media shape CHECK | `pnpm db:fresh` on clean clone completes without error; `apply-postgres-extras.sh` is idempotent |
| GAP-078-189 | Investigate orphan entry `0002_kind_wolfpack` in `_journal.json`; remove if no matching SQL schema, or regenerate SQL | `_journal.json` references only entries that have corresponding SQL files; `pnpm db:migrate` succeeds |
| GAP-078-187 | Migration: `CREATE UNIQUE INDEX search_index_entity_key ON search_index (entity_type, entity_id)`; register in `apply-postgres-extras.sh` | Index exists after `pnpm db:fresh`; `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index` succeeds without error |

---

### Phase 1C — Security defensive hardening (status: pending)

**Rationale**: Multiple attack vectors exist: path traversal in publicId, env prefix bypass on DELETE, decompression bombs, SSRF in seed fetch, malformed cloudName injection.
**Dependencies**: Phase 0.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-035 | DELETE validates env prefix via `resolveEnvironment()`; return HTTP 403 if `publicId` does not start with `hospeda/{currentEnv}/` | `DELETE /admin/media` with `publicId=hospeda/prod/x` in non-prod env returns 403; correct prefix returns 200 |
| GAP-078-103 + GAP-078-104 | Add dep `file-type`; `validateMediaFile` validates magic-bytes match declared MIME; reject if pixel count > 2e8 | JPEG with PNG magic-bytes is rejected with 422; PNG with 15001×15001 dimensions is rejected with 422 `DECOMPRESSION_BOMB` |
| GAP-078-105 | Upload options: `invalidate: true, exif: false, faces: false` | Cloudinary `upload_stream` is called with those exact options in unit test mock |
| GAP-078-117 + GAP-078-234 | Env var `HOSPEDA_ALLOW_PROD_CLEANUP=true` required for `--clean-images` / `deleteByPrefix` when `resolveEnvironment() === 'prod'`; exit 1 with clear error if missing | Seed `--clean-images` in prod env without `HOSPEDA_ALLOW_PROD_CLEANUP=true` exits with code 1 and error message |
| GAP-078-058 + GAP-078-175 | `z.string().uuid().safeParse(actor.id)` before using actor.id as publicId component; return 500 sanitized error if fails | Request with non-UUID actor.id does not reach Cloudinary; test asserts sanitized 500 |
| GAP-078-109 | `extractPublicId` uses `new URL(url).hostname === 'res.cloudinary.com'` instead of `.includes()` | `extractPublicId('https://evil.res.cloudinary.com.attacker.com/...')` returns null |
| GAP-078-112 | Provider `upload()` asserts `options.folder?.startsWith('hospeda/')` at start; throws `InvalidFolderError` if not | Test: upload with `folder='other/x'` throws `InvalidFolderError` before SDK call |
| GAP-078-114 | Re-verify session (`actor.id` matches current session) right before provider call | Test: session replaced between route entry and provider call → 401 response |
| GAP-078-182 | `getMediaUrl` option `raw` allowlists tokens (`w_,h_,c_,q_,f_,g_,ar_,dpr_,e_`); reject unknown tokens | `getMediaUrl(url, { raw: 'e_grayscale' })` passes; `getMediaUrl(url, { raw: 'unknown_token' })` throws or strips |
| GAP-078-034 + GAP-078-173 | Add `.refine(s => !s.includes('..') && !decodeURIComponent(s).includes('..'))` to `DeleteMediaQuerySchema` | `DELETE /admin/media?publicId=hospeda/dev/../prod/x` returns 422 |
| GAP-078-057 | Validate `config.cloudName` regex `/^[a-z0-9_-]+$/` in provider constructor | `new CloudinaryProvider({ cloudName: 'my cloud!' })` throws at construction time |
| GAP-078-027 | Add `stream.on('error', reject)` in `uploadBuffer()` | Unit test: stream emitting error event causes returned promise to reject |
| GAP-078-113 | `apps/api/vercel.json` per-route `maxBodySize: "12mb"` for both upload routes | `vercel.json` contains function config for upload routes with `maxBodySize: "12mb"` |

---

### Phase 2A — Schema alignment (Zod) (status: pending)

**Rationale**: `MediaSchema.featuredImage` is required while `BaseMediaFields` marks it optional; `ImageSchema` is missing `publicId` and `attribution`; additive-only policy undocumented.
**Dependencies**: Phase 1B (migrations).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-185 + GAP-078-163 | `MediaSchema.featuredImage` → `.optional()` to align with `BaseMediaFields` | `MediaSchema.parse({})` succeeds; `MediaSchema.parse({ gallery: [] })` succeeds; TypeScript `Media.featuredImage` is typed `Image \| undefined` |
| GAP-078-196 | `ImageSchema` adds `publicId: z.string().min(1).optional()` | `ImageSchema.parse({ url: '...' })` succeeds; `ImageSchema.parse({ url: '...', publicId: 'hospeda/dev/x' })` succeeds |
| GAP-078-116 | `ImageSchema` adds `attribution?: { photographer?: string, sourceUrl?: string, license?: string }` | `ImageSchema.parse({ url: '...', attribution: { photographer: 'Alice' } })` succeeds |
| GAP-078-122 + GAP-078-201 | Document additive-only policy in `packages/schemas/CLAUDE.md`; create `media.schema.compat.test.ts` with historic shape fixtures | Fixture `{ url, moderationState }` (no caption/description/publicId) passes `ImageSchema.safeParse`; policy documented |

---

### Phase 2B — DB nullability alignment (status: pending)

**Rationale**: `posts.media` and `destinations.media` are `NOT NULL` in DB but the domain allows draft entities with no media; `$type<Media>()` lies about nullability; no DB-level shape enforcement exists.
**Dependencies**: Phase 1B (migrations).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-184 + GAP-078-180 + GAP-078-080 | Migration: `ALTER TABLE posts ALTER COLUMN media DROP NOT NULL; ALTER TABLE destinations ALTER COLUMN media DROP NOT NULL;`; change `$type<Media>()` to `$type<Media \| null>()` in all 4 entities; update derived types in `@repo/schemas` | Insert post without media succeeds; TypeScript Drizzle type reflects `Media \| null`; consumers with null-unsafe access fail typecheck |
| GAP-078-075 | Migration: `ALTER TABLE {accommodations,destinations,events,posts,post_sponsor} ADD CONSTRAINT chk_{entity}_media_shape CHECK (media IS NULL OR jsonb_typeof(media) = 'object')`; `BaseCrudService._beforeCreate/_beforeUpdate` run `MediaSchema.safeParse(payload.media)` when entity has media column | Insert via Drizzle with `media = '"string"'::jsonb` fails with CHECK violation; service-level invalid shape returns `ValidationError` with issues |
| GAP-078-195 | Migration: `ALTER TABLE {accommodations,destinations,events,posts} ADD CONSTRAINT chk_gallery_max_items CHECK (media IS NULL OR media->'gallery' IS NULL OR jsonb_array_length(media->'gallery') <= 50)` | Insert with `gallery.length = 51` fails with CHECK violation; insert with 50 succeeds |

---

### Phase 2C — users.image satellite columns (status: pending)

**Rationale**: `users.image` is a plain text URL with no publicId, moderationState, or caption tracked, making cleanup in `_afterHardDelete` rely on fragile URL parsing.
**Dependencies**: Phase 1B (migrations).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-081 + GAP-078-197 | Migration: add nullable columns `users.image_public_id text`, `users.image_moderation_state enum`, `users.image_caption text`; `UserService.updateAvatar()` sets all 3 on upload; `_afterHardDelete` reads `image_public_id` directly (fallback to `extractPublicId` for legacy rows); optional backfill script | `UserService.updateAvatar()` test asserts all 3 columns updated; hardDelete test uses column directly without URL parsing |

---

### Phase 2D — BaseModel merge semantics (status: pending)

**Rationale**: `BaseModel.update()` replaces JSONB columns entirely; a PATCH sending only `gallery` destroys `featuredImage`.
**Dependencies**: Phase 1B (migrations), Phase 2B.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-186 | `BaseModel.update()` uses `sql\`${table.media} \|\| ${JSON.stringify(patch.media)}::jsonb\`` when entity declares `mergeableJsonbColumns = ['media']` | Test: PATCH with `{ gallery: [] }` on entity with existing `featuredImage` preserves `featuredImage` in DB |
| GAP-078-198 | Wrap JSONB merge path in `SELECT ... FOR UPDATE` transaction when entity has `mergeableJsonbColumns` | Test: simulate 2 concurrent PATCH writers on same entity; both values present in final state (no lost update) |

---

### Phase 2E — Bookmarks trigger soft-delete extension (status: pending)

**Rationale**: The `delete_entity_bookmarks` trigger fires only on hard DELETE, leaving orphan bookmark rows after soft-delete.
**Dependencies**: Phase 1B (migrations).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-192 | Extend trigger `delete_entity_bookmarks` to also fire `AFTER UPDATE` when `OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL` | Test: soft-delete accommodation → bookmarks for that entity are removed from DB |

---

### Phase 3A — `@repo/media` subpath exports bundle architecture (status: pending)

**Rationale**: Server-only code (Cloudinary SDK, `process.env`) leaks into browser bundle via the current single root export.
**Dependencies**: Phase 0.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-126 + GAP-078-162 + GAP-078-183 + GAP-078-172 + GAP-078-177 | Restructure `packages/media`: root `index.ts` exports browser-safe only (`getMediaUrl`, `MEDIA_PRESETS`, `extractPublicId`, `generateGalleryId`, types); `src/server/index.ts` exports server-only (`CloudinaryProvider`, `uploadBuffer`, `validateMediaFile`, `resolveEnvironment`); `src/test-utils/index.ts` exports `InMemoryImageProvider`. `package.json exports` field with 3 subpath entries. `tsup.config.ts` with 3 entries + `external: ['cloudinary', 'image-size']`. Node types restricted to `src/server/**` and `src/test-utils/**`. Biome rule prevents admin/web from importing `@repo/media/server`. Vite/Astro `optimizeDeps.exclude: ['cloudinary', 'image-size']` | `import { CloudinaryProvider } from '@repo/media'` fails TypeScript; `import { CloudinaryProvider } from '@repo/media/server'` succeeds; `pnpm build:api` completes without Cloudinary SDK in browser chunk; Biome CI blocks wrong subpath imports |

---

### Phase 3B — Test utilities (status: pending)

**Rationale**: No mock provider exists for unit/integration tests; `getMediaProvider()` in dev crashes without Cloudinary credentials.
**Dependencies**: Phase 0, Phase 3A.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-102 | `packages/media/src/test-utils/mock-provider.ts` with `InMemoryImageProvider` implementing `ImageProvider`; exported via `@repo/media/test-utils` | `import { InMemoryImageProvider } from '@repo/media/test-utils'` resolves; `InMemoryImageProvider.upload()` stores in-memory and returns valid URL |
| GAP-078-082 | `packages/media/src/server/extract-all-public-ids.ts` exporting `extractAllMediaPublicIds(entity, opts?)`; traverses `media.featuredImage`, `media.gallery[]`, `media.videos[]`; reads `publicId` direct if present, falls back to `extractPublicId(url)` | Test: entity with featuredImage + 3 gallery items returns array of 4 publicIds |
| GAP-078-229 | `getMediaProvider()` auto-uses `InMemoryImageProvider` in dev when Cloudinary creds missing | In dev env without Cloudinary vars, `getMediaProvider()` returns `InMemoryImageProvider` instance and logs warn; no crash |
| GAP-078-059 + GAP-078-168 | Export `resetMediaProviderForTesting()` from `apps/api/src/services/media.ts` guarded by `NODE_ENV === 'test'` | In test env, calling `resetMediaProviderForTesting()` allows next `getMediaProvider()` call to instantiate fresh; in production import, symbol is undefined |

---

### Phase 3C — Documentation and spec amendments (status: pending)

**Rationale**: JSDoc gaps and removed `buildUrl` from interface cause confusion; package lacks quickstart docs.
**Dependencies**: Phase 3A.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-028 + GAP-078-174 | JSDoc on `CloudinaryProvider` constructor warns: "For internal use; access only via `getMediaProvider()`. SDK v2 uses global config state — multi-instance per process is unsupported." | JSDoc visible in IDE hover on constructor; no constructor call outside `media.ts` allowed by Biome rule |
| GAP-078-032 | Amend SPEC-078 v1.5 → v1.6: remove `buildUrl` from `ImageProvider` interface; `getMediaUrl()` covers the case | `ImageProvider` interface in `packages/media` does not declare `buildUrl`; spec section updated |
| GAP-078-161 | Close GAP-078-161 as duplicate of GAP-078-032 | Noted in spec as duplicate; no code change required |
| GAP-078-047 | Create `packages/media/README.md` (quickstart, exports table, presets table) + `packages/media/CLAUDE.md` (patterns, race condition note for avatar) | Both files exist with substantive content; README has working import examples |

---

### Phase 4A — Seed strategy refactor (status: pending)

**Rationale**: All seed images currently go through Cloudinary; `example` seeds (Unsplash/Pexels URLs) should stay as-is in dev; required seeds must upload strictly.
**Dependencies**: Phase 2A (schema), Phase 2B (DB).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-036 + GAP-078-116 | `seedFactory.ts` passes `seedSource: 'required' \| 'example'` to processor; processor early-returns for `example` (skips Cloudinary); required fetch failure throws loud with optional `--allow-required-fallback` flag; `ImageSchema` adds `attribution?: { photographer?, sourceUrl?, license? }` (see Phase 2A); counter `{ uploaded, cached, failures, skippedExample }` reported at end | `pnpm db:seed` with `example` sources completes without Cloudinary creds; counter output matches file counts |
| GAP-078-007 | Replace `process.env.NODE_ENV ?? 'development'` with `resolveEnvironment()` in `packages/seed/src/cli.ts:76`, `index.ts:95`, `seedFactory.ts:186` | `resolveEnvironment()` is called in all 3 sites; `vi.stubEnv('NODE_ENV', ...)` test verifies correct resolution |
| GAP-078-008 | Avatars seed path: `hospeda/{env}/seed/avatars/{userId}.{ext}` with `entityType: 'avatars'` override in processor | Uploaded avatar publicId starts with `hospeda/dev/seed/avatars/` in test env |
| GAP-078-037 | `role: 'gallery/${index}'` instead of `role: String(index)` in `cloudinary-image-processor.ts` | Test: gallery item at index 2 has `role: 'gallery/2'` |
| GAP-078-039 | `apps: ['api', 'seed']` in the 4 Cloudinary entries of `env-registry.hospeda.ts` | `pnpm env:check` validates Cloudinary vars for both api and seed apps |
| GAP-078-063 | Seed processor injects `moderationState: 'APPROVED'` default if missing | Test: processed image without explicit moderationState gets `moderationState: 'APPROVED'` |
| GAP-078-077 | Seed processor handles `postSponsor.logo` (object `{url}`) and `eventOrganizer.logo` (string); paths `postSponsor/{id}/logo` and `eventOrganizer/{id}/logo` | Seed completes without error for sponsor + event fixtures; publicIds match expected paths |
| GAP-078-076 | Bulk-replace `"moderationState": "PENDING"` → `"APPROVED"` in 26 destination JSONs; add 1-2 REJECTED fixtures; document in `packages/seed/CLAUDE.md` | `grep -r '"PENDING"' packages/seed/data/destinations` returns 0 results; REJECTED fixtures exist |
| GAP-078-083 | `MediaBlock` interface adds `videos?: unknown[]` pass-through | `MediaBlock` in `packages/seed` includes `videos` field; TypeScript does not error on video entries |
| GAP-078-084 | `MediaSchema.parse(processed.media)` in `seedFactory.ts` after `processEntityImages` | Seed fails loudly with Zod error if processed media shape is invalid; test with malformed media confirms throw |
| GAP-078-019 | Amend SPEC-078 v1.5 → v1.6 REQ-02: "Seed gallery uses array index; runtime admin uses nanoid (Technical Notes)" | SPEC-078 spec.md updated; no code change |

---

### Phase 4B — Seed hardening (status: pending)

**Rationale**: Seed fetch is vulnerable to SSRF; cache has no schema validation; cache file is committed by accident.
**Dependencies**: Phase 4A.

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-030 | Allowlist `['images.unsplash.com', 'images.pexels.com', 'res.cloudinary.com']` + `isAllowedSeedUrl()` in seed fetch; skip + log if URL not in allowlist | Seed with URL from unlisted host logs warning and skips; no HTTP request made |
| GAP-078-006 + GAP-078-078 | `--reset` flag implies `--clean-images` for `hospeda/{env}/seed/` prefix automatically; flags are not mutually exclusive | `pnpm db:seed --reset` calls `deleteByPrefix('hospeda/dev/seed/')` before uploading |
| GAP-078-010 | `DEFAULT_MEDIA_MAX_SIZE_BYTES = 10 * 1024 * 1024` constant in `apps/admin/src/lib/constants.ts`; replace 6 hardcoded occurrences of `5242880` | `grep -r '5242880' apps/admin/src` returns 0 results; constant used in all 6 locations |
| GAP-078-033 | Cache writes accumulate in memory during `Promise.all`; single flush at end | Test: 3 concurrent writes result in exactly 1 file system write call (spy on `fs.writeFile`) |
| GAP-078-079 | Optional `--validate-cache` flag: HEAD each cached URL; remove stale entries | `pnpm db:seed --validate-cache` completes; stale URLs removed from cache file |
| GAP-078-120 | Validate cache file shape with Zod on read; truncate orphan entries; add `version` field | Cache read with malformed JSON entry logs warn and drops entry; `version` field present in written cache |
| GAP-078-074 | Add `**/.cloudinary-cache.json` to root `.gitignore` | `.gitignore` contains `**/.cloudinary-cache.json`; `git status` does not show cache file |

---

### Phase 5A — API response contract (status: pending)

**Rationale**: Upload routes return 201 (wrong: overwrite is not a creation), response shape bypasses `ResponseFactory`, and DELETE has no `wasPresent` field.
**Dependencies**: Phase 2A (schemas), Phase 3A (helpers).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-026 + GAP-078-029 + GAP-078-159 + GAP-078-178 | Add `successStatusCode?: number` to route factory interface; upload routes pass `successStatusCode: 200`; maintain `ResponseFactory` wrap `{success, data, metadata}`; `UploadResponseSchema` updated to wrapped shape; all success paths use factory (no `ctx.json` bypass); amend SPEC-078 v1.6 | `POST /admin/media/upload` returns HTTP 200 (not 201); response is `{ success: true, data: {...}, metadata: {...} }`; TypeScript compile passes |
| GAP-078-062 | Upload response adds `moderationState: 'APPROVED'`; `UploadResponseSchema` updated | Upload response JSON contains `data.moderationState === 'APPROVED'`; runtime parse via `UploadResponseSchema.parse()` succeeds |
| GAP-078-149 | `UploadResponseSchema.parse(response)` at runtime in upload handler before returning | Malformed provider response causes 500 (not silent bad data); test: mock provider returning extra field passes parse |
| GAP-078-154 | DELETE response adds `wasPresent: boolean` based on Cloudinary `result === 'ok'` vs `'not found'` | `DELETE /admin/media?publicId=nonexistent` returns `{ wasPresent: false }`; existing publicId returns `{ wasPresent: true }` |
| GAP-078-155 | Forward `tags` and `overwrite` from `routes/media/admin/upload.ts` to provider | Provider `upload()` unit test asserts tags and overwrite values passed through from route request body |

---

### Phase 5B — Request schemas (status: pending)

**Rationale**: `AdminUploadRequestSchema` is a flat object with no type narrowing per role; empty file upload is not rejected early; max file size is not env-configurable.
**Dependencies**: Phase 2A (schemas).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-153 | Refactor `AdminUploadRequestSchema` to `z.discriminatedUnion('role', [...])` with branches `featured` and `gallery`; `ProtectedUploadRequestSchema` has implicit role `avatar` | `parse({ role: 'featured', entityType: 'user' })` fails with clear error; `parse({ role: 'featured', entityType: 'accommodation', entityId: uuid })` succeeds |
| GAP-078-055 | `ENTITY_FOLDER_MAP` explicit: `{ accommodation: 'accommodations', destination: 'destinations', event: 'events', post: 'posts' }` | Map is exported constant; TypeScript `keyof` narrows to 4 entity types only |
| GAP-078-148 | Reject `file.size === 0` with 422 `EMPTY_FILE` before multipart validation | `POST /admin/media/upload` with empty file body returns 422 `EMPTY_FILE` |
| GAP-078-106 | `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10)` in `ApiEnvSchema` | `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB=abc` at startup causes Zod error; missing value defaults to 10 |

---

### Phase 5C — Defensive route hardening (status: pending)

**Rationale**: Upload routes have no rate limiting, no server-side gallery cap enforcement, and no OpenAPI multipart schema.
**Dependencies**: Phase 2A (schemas).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-068 | Interim rate limit `{ requests: 10, windowMs: 60000 }` on upload routes; TODO comment linking to SPEC-079 | 11th upload in 60s window returns 429; TODO comment references SPEC-079 |
| GAP-078-021 | Content-Length pre-check uses `maxBytes + 1024` margin | File exactly at limit is not rejected by Content-Length check; limit + 2KB IS rejected |
| GAP-078-071 | Server hard cap 50 gallery items; reject 422 `GALLERY_LIMIT_EXCEEDED`; TODO comment for billing entitlements | `POST /admin/media/upload` with entity gallery at 50 items returns 422 `GALLERY_LIMIT_EXCEEDED` |
| GAP-078-072 | OpenAPI `requestBody` multipart schema for upload routes via `createAdminRoute` factory | OpenAPI spec JSON contains `requestBody.content['multipart/form-data']` for upload routes |
| GAP-078-060 | Lazy services instantiation inside handler (not module-level) | Module-level `const service = new XService()` is not present in route files; service instantiated per-request |
| GAP-078-150 | Document CORS contract for media routes in `apps/api/docs/route-architecture.md` | Doc section "CORS — media routes" exists with examples of allowed origins and methods |

---

### Phase 5D — Resilience (status: pending)

**Rationale**: Provider has no retry logic; transient Cloudinary errors cause permanent failures.
**Dependencies**: Phase 3A (bundle), Phase 3B (test utils).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-087 | Add dep `p-retry`; `delete()` and `deleteByPrefix()` wrapped with `pRetry({ retries: 3, factor: 3, minTimeout: 1000 })`; retry on 429/5xx only; `upload()` has no retry; JSDoc on `upload()` noting "no retry by design" | Test: delete mock rejects once with 429 then resolves; `pRetry` callback invoked twice total; upload mock rejects → no retry, promise rejects immediately |
| GAP-078-054 | `delete_resources_by_prefix()` passes `{ invalidate: true }` | Unit test mock asserts `invalidate: true` in SDK call options |

---

### Phase 5E — i18n error keys (status: pending)

**Rationale**: Error codes are returned as raw strings; i18n keys allow the client to display localized error messages.
**Dependencies**: Phase 5A (response contract).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-139 | Error codes map to i18n keys `api.media.errors.{code}` via `@repo/i18n`; response includes `code` for client | Keys `api.media.errors.EMPTY_FILE`, `.GALLERY_LIMIT_EXCEEDED`, `.CLOUDINARY_NOT_CONFIGURED` exist in es/en/pt locale files; response body includes `code` string |

---

### Phase 5F — Spec amendment: `/users/me` convention (status: pending)

**Rationale**: SPEC-078 documents AvatarUpload using `/users/me` which does not match the repo convention; spec needs alignment.
**Dependencies**: none (documentation only).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-009 | Amend SPEC-078 v1.5 → v1.6 REQ-04.2-FLOW: `AvatarUpload` uses `PATCH /api/v1/protected/users/${userId}` with ownership check; note future `/me` pattern requires dedicated SPEC | SPEC-078 spec.md updated; no code change |

---

### Phase 6A — Admin UI: wiring upload/delete for all 4 entities (status: pending)

**Rationale**: Only `accommodations/$id_.edit.tsx` has upload/delete wiring; destinations, events, and posts are unwired dead ends.
**Dependencies**: Phase 3A (`@repo/media` subpath), Phase 5A (API contracts).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-004 + GAP-078-005 + GAP-078-018 | Replicate wiring from `accommodations/$id_.edit.tsx` in `destinations/$id_.edit.tsx`, `events/$id_.edit.tsx`, `posts/$id_.edit.tsx`: handlers `images` + `featuredImage`/`mainImage` via `uploadEntityImage.mutateAsync` | Upload image button functional in all 3 entity edit pages; integration test: upload + assert entity `media.featuredImage.url` updated |
| GAP-078-073 | Delete `apps/admin/src/routes/_authed/accommodations/$id_.gallery.tsx`; add TanStack Router redirect `/accommodations/:id/gallery` → `/accommodations/:id/edit#gallery-section` | File deleted; navigation to `/gallery` redirects; no 404 in admin |

---

### Phase 6B — Admin hooks type safety (status: pending)

**Rationale**: Hooks use raw strings for entity type and role, bypassing schema type safety.
**Dependencies**: Phase 5B (request schemas).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-052 | Admin hook `use-media-upload` uses `MediaEntityType`/`MediaRole` from `@repo/schemas`; validates with `AdminUploadRequestSchema.parse()` before FormData construction | TypeScript error if `entityType: 'unknown'` passed to hook; Zod parse throws before network call if payload invalid |

---

### Phase 6C — Raw `<img>` → `getMediaUrl()` migration (status: pending)

**Rationale**: Several components use raw `<img src={x}>` where `x` is a Cloudinary URL, bypassing preset-based transforms and double-transform protection.
**Dependencies**: Phase 3A (`@repo/media` subpath).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-015 | `apps/admin/src/routes/_authed/me/profile.tsx:124` — use `getMediaUrl(src, { preset: 'avatar' })` | No raw `<img src={avatarUrl}` in that file; preset `avatar` applied |
| GAP-078-016 | `apps/admin/src/routes/_authed/posts/$id_.seo.tsx:201` — use `getMediaUrl(src, { preset: 'og' })` | No raw `<img src={ogUrl}` in that file; preset `og` applied |
| GAP-078-017 | `apps/web/src/components/accommodation/OwnerCard.astro:32` + `ReviewPreview.astro:64` via `transforms.ts` | Both components use transformed URL; `transforms.ts` calls `getMediaUrl` |
| GAP-078-041 | `apps/web/src/components/account/AvatarUpload.client.tsx:178` — preset `avatar` | File uses `getMediaUrl(src, { preset: 'avatar' })` |
| GAP-078-042 | `apps/admin/src/integrations/clerk/header-user.tsx:86` — preset `avatar` + `width={32} height={32} loading="eager" decoding="async"` (absorbs GAP-078-049) | File uses `getMediaUrl` with avatar preset and all img attributes set |
| GAP-078-043 + GAP-078-137 | `apps/admin/src/components/entity-form/fields/GalleryField.tsx:387` + `$id_.gallery.tsx:61` — preset `thumbnail` + `loading="lazy"` | Both files use `getMediaUrl(src, { preset: 'thumbnail' })` with lazy loading |
| GAP-078-044 | `apps/web/src/pages/[lang]/destinos/atraccion/[slug]/index.astro:50` — preset `hero` | File uses `getMediaUrl` with hero preset |
| GAP-078-045 | `apps/web/src/pages/[lang]/publicaciones/[slug].astro:137` — preset `avatar` | File uses `getMediaUrl` with avatar preset |
| GAP-078-099 | Biome `noRestrictedSyntax` rule + custom script flagging bare `<img src={` with Cloudinary URL heuristic | CI step runs script; PR with bare `<img src={cloudinaryUrl}` is blocked |
| GAP-078-061 | `extractFeaturedImageUrl` returns `getMediaUrl(fallback, { preset })` instead of raw `fallback` | Test: fallback URL is transformed before return |
| GAP-078-069 | `getMediaUrl` accepts `options.fallback?: string` per-call override | `getMediaUrl(undefined, { preset: 'avatar', fallback: '/default.png' })` returns `/default.png` |
| GAP-078-179 | `getMediaUrl` detects `/fetch/`, `/private/` delivery types and skips `.replace('/upload/')` | `getMediaUrl('https://res.cloudinary.com/c/image/fetch/...')` does not inject upload transforms |
| GAP-078-166 + GAP-078-211 + GAP-078-218 | Regex anchor in `getMediaUrl.replace()` using `/\/upload\/([^/]+\/)*/ ` to prevent double-transform; 2 regression tests | Test: calling `getMediaUrl` on already-transformed URL does not double-apply transforms |

---

### Phase 6D — Accessibility + UX (status: pending)

**Rationale**: GalleryField drag-drop has no keyboard support; ImageField has no accessible error state; upload progress is indeterminate with no feedback.
**Dependencies**: Phase 3A (`@repo/media` subpath), Phase 6A (entity wiring).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-048 + GAP-078-144 | Add deps `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; refactor `GalleryField.tsx` with `<DndContext sensors=[KeyboardSensor, PointerSensor]>` + `<SortableContext>`; each item uses `useSortable` | Keyboard test: Tab + Space + ArrowDown + Space reorders item; `aria-live` announcement present |
| GAP-078-046 + GAP-078-138 | Replicate GalleryField error pattern in ImageField: `uploadError` local state + `<p role="alert">` | Test: failed upload renders `<p role="alert">` with error message; toast also shown |
| GAP-078-141 | Shadcn `AlertDialog` before delete in `GalleryField` + confirmation in `AvatarUpload` | Delete without confirmation dialog is impossible; `userEvent.click(delete)` shows dialog; `userEvent.click(confirm)` proceeds |
| GAP-078-142 | `@media (prefers-reduced-motion: reduce)` in `AvatarUpload.module.css` spinner + `GalleryField` overlay | CSS file contains `prefers-reduced-motion` rule disabling animation |
| GAP-078-143 | `AvatarUpload` button has `aria-describedby="avatar-hint"` pointing to constraints `<p>` | Accessibility test: button `aria-describedby` references element with file size/type constraints |
| GAP-078-152 | Client MIME allowlist in `GalleryField`, `AvatarUpload.client`, `ImageField` accepts HEIC/HEIF/AVIF; show placeholder "Preview no disponible" for those formats | Test: HEIC file accepted by input; `URL.createObjectURL` not called; placeholder text rendered |
| GAP-078-127 | Refactor `GalleryField` from `for...of await` to `Promise.all` with `p-limit` cap=4 | Test: 6 files upload with max 4 concurrent (spy on provider); total time < sequential 6× |
| GAP-078-140 | Upload shows rich indeterminate progress: "Subiendo X MB...", animated bar, estimated time; `role="status" aria-live="polite"` | Test: upload in progress renders status element; estimated time string matches file size heuristic |
| GAP-078-145 | Admin: refactor `header-user.tsx` + `profile.tsx` using shadcn `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` with initials | Both files use shadcn Avatar components; raw `<img>` for avatar removed |
| GAP-078-176 | `validateMediaFile` respects `maxFileSizeMb` prop in avatar branch | Test: avatar upload with file > `maxFileSizeMb` returns size error (not default limit) |

---

### Phase 6E — Web component media migration (status: pending)

**Rationale**: Several web components render Cloudinary images without transforms; transforms.ts drops caption/description; race condition for avatar is undocumented.
**Dependencies**: Phase 3A (`@repo/media` subpath), Phase 2A (schema).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-017 | `OwnerCard.astro` + `ReviewPreview.astro` via `transforms.ts` (see Phase 6C) | `transforms.ts` calls `getMediaUrl` for avatar preset |
| GAP-078-041 | `AvatarUpload.client.tsx` preset avatar (see Phase 6C) | — |
| GAP-078-044 | `atraccion/[slug]/index.astro` preset `hero` (see Phase 6C) | — |
| GAP-078-045 | `publicaciones/[slug].astro` preset `avatar` (see Phase 6C) | — |
| GAP-078-040 | i18n keys for `AvatarUpload`: `account.avatar.errors.*`, `account.avatar.actions.*`, `account.avatar.hint` in es/en/pt | All 3 locales contain keys; `AvatarUpload` uses `t()` calls for all user-facing strings |
| GAP-078-136 | `apps/web/src/lib/api/transforms.ts:368` preserves `caption` and `description` in HeroGallery output | Test: entity with captioned gallery image → transforms output includes `caption` field |
| GAP-078-064 | Remove `moderationState` reading from web helpers | `grep -r 'moderationState' apps/web/src/lib` returns 0 results |
| GAP-078-070 + GAP-078-118 | Document avatar upload race condition in `@repo/media/CLAUDE.md`: "last-PATCH-wins accepted; no locking" | CLAUDE.md section titled "Avatar Upload Race Condition" exists with explanation |
| GAP-078-145 (web part) | Extract initials/fallback logic to `apps/web/src/lib/avatar-utils.ts` | File exists; AvatarUpload imports from it; no inline initials logic |
| GAP-078-194 | `processEntityImages` logs warn if `media` present but `featuredImage` absent | Test: entity with `gallery` but no `featuredImage` produces `logger.warn` call |

---

### Phase 6F — CSP updates (status: pending)

**Rationale**: Cloudinary image domain is not in CSP `img-src`; Astro `remotePatterns` does not allow it; admin CSP uses `https:` blanket.
**Dependencies**: Phase 6C (migration complete — need to know all new image sources).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-065 + GAP-078-228 | Web CSP `img-src`: add `https://res.cloudinary.com` in `middleware-helpers.ts:354` (both Report-Only and enforced); add test asserting header | HTTP response header `Content-Security-Policy` contains `img-src ... https://res.cloudinary.com`; test passes |
| GAP-078-066 | Admin CSP: replace `https:` blanket `script-src` with explicit list including `https://res.cloudinary.com`, `https://*.mlstatic.com`; test asserts no `https:` blanket | Admin CSP test asserts no `script-src https:` and explicit allowlist present |
| GAP-078-125 + GAP-078-227 | `astro.config.mjs` adds `{ protocol: 'https', hostname: 'res.cloudinary.com' }` to `image.remotePatterns` | Astro `<Image src="https://res.cloudinary.com/...">` renders without config error |

---

### Phase 7A — Vercel config (status: pending)

**Rationale**: Upload routes need increased `maxDuration` and `maxBodySize`; orphan preview assets need periodic cleanup.
**Dependencies**: Phase 0 (env), Phase 5A (routes).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-222 + GAP-078-223 | `apps/api/vercel.json` per-route `functions` config with `maxDuration: 60` and `regions: ["iad1"]` for both upload routes (absorbs GAP-078-147) | `vercel.json` contains function entries for upload routes with correct config |
| GAP-078-134 | Log warn at startup if Cloudinary vars missing AND `VERCEL_ENV === 'preview'` | In preview deploy without creds, startup log contains warn about missing Cloudinary config; app continues (graceful degradation) |
| GAP-078-232 | Endpoint `GET /api/v1/public/health/media` calls Cloudinary `GET /resources/image` with creds; returns 200 if auth succeeds, 503 if not | `GET /health/media` with valid creds returns 200; with invalid creds returns 503 |
| GAP-078-231 | Weekly cron orphan cleanup for `hospeda/preview/*` and `hospeda/test/*` prefix | Cron job registered in codebase targeting weekly schedule; `deleteByPrefix('hospeda/preview/')` called |

---

### Phase 7B — Turbo config (status: pending)

**Rationale**: Turbo does not track Cloudinary env vars; cache invalidation is unreliable when creds change.
**Dependencies**: Phase 0 (env).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-220 + GAP-078-221 + GAP-078-233 | `turbo.json` `globalEnv` adds: `HOSPEDA_CLOUDINARY_CLOUD_NAME`, `HOSPEDA_CLOUDINARY_API_KEY`, `HOSPEDA_CLOUDINARY_API_SECRET`, `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`, `VERCEL_ENV`; per-package outputs for `@repo/media` | `turbo.json` contains all 5 vars in `globalEnv`; changing a Cloudinary var invalidates Turbo cache |

---

### Phase 7C — CI/CD and tooling (status: pending)

**Rationale**: No CI guardrail prevents direct `cloudinary` imports outside `@repo/media`; CI lacks integration test secrets; Renovate auto-bumps Cloudinary major versions.
**Dependencies**: Phase 3A (subpath exports), Phase 5A (routes).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-038 | `scripts/check-cloudinary-isolation.sh`: `rg -g '!packages/media/**' "from ['\"]cloudinary['\"]" apps/ packages/` exits non-zero if any match found | Script exits 0 with no violations; exits non-zero with sample violation |
| GAP-078-225 | CI job `check-cloudinary-isolation` runs the script | `.github/workflows/ci.yml` contains job invoking the script |
| GAP-078-224 | CI `.github/workflows/ci.yml` adds `HOSPEDA_CLOUDINARY_*` secrets to integration test step | Integration tests receive Cloudinary vars in CI environment |
| GAP-078-226 | `renovate.json` pin rule: `cloudinary` minor-only, no major auto-bump | `renovate.json` contains package rule for `cloudinary` with `allowedVersions` or `matchUpdateTypes` restricting major |
| GAP-078-230 | CI step `pnpm env:check` before deploy to preview/production | `.github/workflows/ci.yml` deploy job runs `pnpm env:check` before deploy steps |
| GAP-078-133 | Add `dpr_auto` to each preset in `packages/media/src/presets.ts` | Every preset in `MEDIA_PRESETS` includes `dpr_auto` transform; Retina screens get 2× resolution |
| GAP-078-135 | `Cache-Control: no-store` header on POST `/media/*` responses | Unit test asserts `Cache-Control: no-store` in upload response headers |

---

### Phase 8 — Observability + operations (status: pending)

**Rationale**: No structured logs for upload success; Cloudinary errors not captured in Sentry; no operational runbook exists.
**Dependencies**: Phase 5A (routes).

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-050 + GAP-078-128 + GAP-078-129 | Structured info log per upload success; `Sentry.captureException` on Cloudinary SDK errors; counters `media_upload_total{result=success/failure}`, `media_delete_total{result}` | Test: upload success produces log entry with `publicId` + `preset`; mock Sentry receives exception on provider error; counter increments |
| GAP-078-014 | `apps/api/src/services/media.ts:33` replace `console.warn` with `apiLogger.warn`; move initialization log to startup | `grep 'console.warn' apps/api/src/services/media.ts` returns 0 results; startup log emitted once at init |
| GAP-078-056 | `AccommodationService._afterHardDelete`: replace `revalidationLogger.warn` with `this.logger.warn` | `grep 'revalidationLogger' apps/api/src/services/accommodation.service.ts` returns 0 results |
| GAP-078-158 | Create `docs/runbooks/cloudinary-incidents.md` with sections: detection, health check, credential rotation, account suspension, quota exceeded, soft-delete+restore note, GDPR erasure reference, emergency contacts, escalation tree | File exists with all 9 sections; reviewed by tech lead |

---

### Phase 9 — Tests + coverage + quality gates (status: pending)

**Rationale**: `@repo/media` has <90% coverage; integration tests are absent; resilience and edge case scenarios are untested.
**Dependencies**: Phases 3-8 (code must exist before integration tests).

#### 9A — Schema tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-101 | `packages/schemas/test/common/media.schema.test.ts` covering `ImageSchema`, `VideoSchema`, `MediaSchema`, `BaseMediaFields` including optional `featuredImage`, `publicId`, `attribution` shapes | Test file exists; all 4 schemas covered; test suite passes |
| GAP-078-122 + GAP-078-201 | `packages/schemas/test/common/media.schema.compat.test.ts` with historic shape fixtures | Fixture `{ url, moderationState }` passes safeParse; test file exists and passes |

#### 9B — `@repo/media` unit tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-013 | Coverage edge cases for `extract-public-id` and `validate-media-file` | Branch coverage ≥90% for both files per `perFile` threshold |
| GAP-078-085 | Upload with data-URI and remote URL as input | Tests exist and pass in `cloudinary.provider.test.ts` |
| GAP-078-086 | `deleteByPrefix` asserts Admin API path (not Uploader) | Test: spy on SDK asserts `admin.delete_resources_by_prefix` called (not `uploader.*`) |
| GAP-078-088 + GAP-078-206 + GAP-078-207 | `extractPublicId` edge cases: video URLs, fetch delivery type, query strings, folder with `.`, `/upload/` appearing twice in URL, fragment | All edge case tests pass |
| GAP-078-089 | `Object.isFrozen(MEDIA_PRESETS)` + regex format check for all preset transform strings | Test: `MEDIA_PRESETS` is frozen; each transform string matches `/^[a-z0-9_,\/]+$/` |
| GAP-078-090 | Boundary 10MB test with PNG padded inside data chunk (deterministic byte count) | Test: file at exactly 10MB passes; file at 10MB + 1 byte fails with `FILE_TOO_LARGE` |
| GAP-078-091 + GAP-078-202 + GAP-078-203 | `environment.test.ts` uses `vi.stubEnv` + `vi.unstubAllEnvs` in `afterEach`; separate test for `delete process.env.NODE_ENV` with restore | Tests isolated; no env state leaks between test cases |
| GAP-078-100 | Contract test: import real `cloudinary` and assert `v2.uploader.upload_stream` exists | Test imports `cloudinary` and asserts method exists (guards against SDK breaking changes) |
| GAP-078-204 | `validateMediaFile` `IMAGE_TOO_LARGE` branch (pixel count > 2e8) | Test with synthetic large-dimension image returns `IMAGE_TOO_LARGE` error |
| GAP-078-205 | Fix HEIC/AVIF test: use real binary fixtures instead of PNG with MIME spoof | Test fixtures are actual HEIC/AVIF binary files; `file-type` detects correctly |
| GAP-078-208 + GAP-078-209 | `CloudinaryProvider.delete()` error paths + `deleteByPrefix` partial-delete response handling | Test: SDK returns partial success (`{ deleted: {a: 'deleted', b: 'not_found'} }`) → `wasPresent` logic correct |
| GAP-078-210 | Mock `upload_stream` with `setImmediate(callback, null, result)` for realistic async | Tests using mock `upload_stream` use `setImmediate` pattern; no synchronous mock |
| GAP-078-212 | `getMediaUrl` with HTTP (non-HTTPS) URL | `getMediaUrl('http://res.cloudinary.com/...')` either upgrades to HTTPS or throws clearly |
| GAP-078-213 | 0-byte file test with exact assertion (not `.toContain`) | Test: 0-byte file returns exact error `EMPTY_FILE`; assertion uses `.toBe` |
| GAP-078-214 | `generateGalleryId` with seeded fake random for determinism | Test uses `vi.spyOn(Math, 'random')` or nanoid mock for deterministic output |
| GAP-078-215 | Constructor multi-instance config behavior documented and tested | Test: 2 instances with different creds; last-one-wins behavior documented; test asserts and documents limitation |
| GAP-078-216 | Avatar boundary 5MB off-by-one | Test: avatar at exactly 5MB passes; 5MB + 1 byte fails |
| GAP-078-217 | Upload passes `resource_type: 'image'` to SDK | Test: spy on SDK `upload_stream` asserts `resource_type: 'image'` in options |
| GAP-078-219 | Upload with `tags: []` empty array | Test: empty tags array does not cause SDK error; resolved successfully |
| GAP-078-098 | `packages/media/vitest.config.ts` adds `coverage.thresholds.perFile: true` with 90/85/90/90 (statements/branches/functions/lines) | `pnpm test:coverage` in `packages/media` fails if any file falls below threshold |
| GAP-078-031 | Test with 2 `CloudinaryProvider` instances having different creds | Test exists asserting documented global config behavior (last-init-wins) |

#### 9C — Seed tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-020 | `cloudinary-upload.test.ts` + `cloudinary-image-processor.test.ts` | Both test files exist; cover upload strategy logic, seedSource branching, counter reporting |

#### 9D — Service-core tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-094 | Tests for hardDelete cleanup: 5 services × mock provider → assert `deleteByPrefix` called with correct prefix + error swallowed | Test per service: mock `InMemoryImageProvider`; hardDelete entity; assert `deleteByPrefix('hospeda/dev/{entityType}/{entityId}/')` called |
| GAP-078-095 | `hookstate.test.ts` per service: `deletedEntityId` propagation via `ctx.hookState` | Test: after hardDelete, `ctx.hookState.deletedEntityId` equals entity ID |

#### 9E — API integration tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-092 + GAP-078-024 | `apps/api/test/integration/media/admin-upload.test.ts` (9 scenarios REQ-04.1) + `admin-delete.test.ts` (5 REQ-04.3) + `protected-upload.test.ts` (2 REQ-04.2); mock `getMediaProvider()` with `InMemoryImageProvider` | All 16 integration test scenarios pass; each test file has named scenarios matching spec REQ numbers |
| GAP-078-093 | Test HTTP 503 `CLOUDINARY_NOT_CONFIGURED` by unsetting Cloudinary env vars | Test: unset env vars → `POST /admin/media/upload` returns 503 with code `CLOUDINARY_NOT_CONFIGURED` |

#### 9F — UI component tests

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-097 | `@testing-library/react` tests for `GalleryField`, `ImageField`, `use-media-upload`, `AvatarUpload.client`; cover success, 413, 422, 503 scenarios; AvatarUpload test verifies PATCH called after upload | All 4 component test files exist; success + 3 error scenarios covered; AvatarUpload test asserts `PATCH /api/v1/protected/users/:id` called after upload |

#### 9G — Reconciliation

| Gap | Action | Acceptance criteria |
|-----|--------|---------------------|
| GAP-078-022 | Reconcile `state.json` / `TODOs.md` vs actual post-remediation state | `state.json` reflects all completed tasks; `TODOs.md` has no stale entries |

---

## Phase 10 — Handoff to new SPECs (status: pending, post SPEC-078 close)

These gaps are deferred to dedicated specs. Work begins after Phases 0-9 are closed.

| New SPEC | Title | Gaps | Trigger |
|---------|-------|------|---------|
| SPEC-084 | GDPR Compliance | GAP-078-157, 123, 156 | Account closure, `uploadedBy`, data portability, audit trail, retention policy |
| SPEC-085 | Outbox Pattern + External Consistency | GAP-078-096, 151, 067 | Cloudinary cleanup outside DB transaction, idempotency keys for upload retry |
| SPEC-086 | Admin Security Hardening | GAP-078-110 | CSP nonce generation, script-src tightening, Report-Only → enforced |
| SPEC-087 | DR + Business Continuity | GAP-078-119, 131 | Cloudinary backup, Neon DR, Redis failover, capacity + cost projection |
| SPEC-088 | Web Performance Optimization | GAP-078-124, 130, 132, 167 | srcset/sizes, LCP preload, streaming upload body, Core Web Vitals |
| SPEC-089 | Web UX Polish | GAP-078-146 | Toast system for upload feedback, loading/empty states, error boundaries |

### Postponed gaps (YAGNI — review checklist)

| Gap | Review when |
|-----|-------------|
| GAP-078-023 (media-limits endpoint) | > 3 `MAX_FILE_SIZE` changes in 6 months, or per-role limits needed, or dynamic `allowedMimeTypes` required |
| GAP-078-121 (seed URL deduplication) | Destination catalog > 500 entries, or Cloudinary storage cost > $20/month |
| GAP-078-193 (bookmarks FK polymorphic) | Trigger GAP-078-192 fails in production, or orphan rows detected in `user_bookmarks` |
| GAP-078-199 (GIN index on `media` JSONB) | Admin list gains `hasFeatured: boolean` filter (benchmark first) |
| GAP-078-200 (soft-delete + restore race) | 404 rate on `res.cloudinary.com` exceeds alerting threshold |

### Discarded gaps (false positives)

| Gap | Reason |
|-----|--------|
| GAP-078-011 | Confirmed false positive by auditor |
| GAP-078-115 | False positive: "772 URLs" count mixed example (dev-only) with required seeds; real scope is ~50 URLs covered by GAP-078-036 |

---

## Phase Ordering and Dependencies

```
Phase 0 (Blockers) — done
   |
   +---> Phase 1A (Permissions) — done
   |
   +---> Phase 1B (DB migrations) ---+---> Phase 2A (Schema alignment)
   |                                  |          |
   +---> Phase 1C (Security)          |          +---> Phase 2B (DB nullability)
   |                                  |          |          |
   +---> Phase 3A (Bundle arch) ---+  |          +---> Phase 2C (users.image)
   |         |                     |  |          |
   |         +---> Phase 3B        |  |          +---> Phase 2D (BaseModel merge)
   |         |     (Test utils)    |  |          |
   |         +---> Phase 3C        |  |          +---> Phase 2E (Bookmarks trigger)
   |               (Docs)          |  |          |
   |                               |  |          v
   +---> Phase 7A (Vercel)         |  |   Phase 4A (Seed strategy)
   |                               |  |          |
   +---> Phase 8 (Observability)   |  |          +---> Phase 4B (Seed hardening)
                                   |  |
                                   +--+--> Phase 5A (Response contract)
                                             |
                                             +---> Phase 5B (Request schemas)
                                             |
                                             +---> Phase 5C (Route hardening)
                                             |
                                             +---> Phase 5D (Resilience)
                                             |
                                             +---> Phase 5E (i18n errors)
                                             |
                                             +---> Phase 5F (Spec amendment)
                                             |
                                             v
                                       Phase 6A (UI wiring)
                                             |
                                       Phase 6B (Hook types)
                                       Phase 6C (img migration)
                                       Phase 6D (A11y + UX)
                                       Phase 6E (Web migration)
                                       Phase 6F (CSP)
                                             |
                                             v
                                       Phase 7B (Turbo)
                                       Phase 7C (CI/CD)
                                             |
                                             v
                                       Phase 9 (Tests + coverage)
                                             |
                                             v
                                       Phase 10 (Handoff new SPECs)
```

Phases 1B, 1C, 3A, 7A, 8 can run in parallel after Phase 0 + 1A.
Phases 2A-2E run in parallel after Phase 1B.
Phases 4A-4B run in parallel after Phase 2A-2B.
Phases 5A-5F run in parallel after Phase 2A + 3A.
Phases 6A-6F run in parallel after Phase 3A + 5A.
Phase 7B-7C run in parallel after Phase 3A + 5A.
Phase 9 runs last (requires all code complete).

---

## Risks

1. **Phase 1B (GAP-078-188) migration archaeology may unblock or block everything.** Manual migrations 0016-0020 are undocumented in git; reconstructing them requires auditing `apply-postgres-extras.sh`, ADR-017, `triggers-manifest.md`, and git history. If reconstruction is incorrect, `pnpm db:fresh` will fail on CI and block Phase 2 work. Mitigation: dedicate the first engineering cycle exclusively to Phase 1B; validate on 3 separate clean clones before merging.

2. **Phase 3A bundle refactor may cause Vite HMR regressions in dev mode.** Subpath exports introduce conditional package resolution; Vite + Astro HMR have known edge cases with `exports` fields in workspaces. Mitigation: validate in dev (`pnpm dev:all`), CI (`pnpm build`), and preview deploy before merging; add `optimizeDeps.exclude` as defense in depth.

3. **Phase 6 scope can expand through UX review.** The Admin UI wiring (6A-6D) and web migration (6E-6F) together span 4 entity edit pages, 8+ components, and CSP changes. Any component discovered to need migration mid-flight will extend scope. Mitigation: prioritize 6A (entity wiring) and 6F (CSP) as must-complete; 6D (a11y UX polish) is acceptable in a follow-on PR.

4. **Phase 9 integration tests require DB + Cloudinary provider infrastructure.** Integration tests (`admin-upload.test.ts`) depend on `InMemoryImageProvider` from Phase 3B and DB migrations from Phase 1B. If either is late, Phase 9E is blocked. Mitigation: Phase 3B is a Phase 0 dependency escalation candidate; complete it immediately after Phase 1A.

5. **Deferred SPECs (084-089) require product prioritization before scoping.** The 6 new SPECs absorb ~20 gaps with significant engineering effort each (~20-30 dev-days each). Without explicit product priority decisions, they will remain open indefinitely. Mitigation: tech lead + product to schedule drafting sessions for each SPEC within 2 weeks of SPEC-078 closing; document scope decisions in each new spec.

---

## Global Estimation

| Phase | Size | Notes |
|-------|------|-------|
| 0 | S (done) | Completed |
| 1A | S (done) | Completed |
| 1B | M | DB archaeology + validation on 3 clones |
| 1C | M | 13 security gaps |
| 2A-2E | M | Schema + DB alignment (parallel) |
| 3A-3C | M | Bundle refactor (parallel with 1B) |
| 4A-4B | M | Seed strategy (parallel with 3) |
| 5A-5F | M | API contracts (parallel with 4) |
| 6A-6F | L | UI complete + a11y (parallel internaly) |
| 7A-7C | S | Infra (parallel with 5) |
| 8 | S | Observability (parallel with 5) |
| 9A-9G | L | Tests + coverage (last, sequential) |
| **Total** | **~33-43 dev-days** | Parallelizable with 2-3 developers |

---

## References

- Implementation plan: `.claude/specs/specs-gaps-078-implementation-plan.md`
- Decisions: `.claude/specs/specs-gaps-078-decisions.md`
- Original SPEC-078 spec: `.claude/specs/SPEC-078-cloudinary-image-management/spec.md`
- DB triggers manifest: `packages/db/docs/triggers-manifest.md`
- ADR-017 Postgres-specific features: `docs/decisions/ADR-017-postgres-specific-features.md`
- Route architecture: `apps/api/docs/route-architecture.md`
- Gaps discarded: `.claude/gaps-descartados.md`
- Gaps postponed: `.claude/gaps-postergados.md`
