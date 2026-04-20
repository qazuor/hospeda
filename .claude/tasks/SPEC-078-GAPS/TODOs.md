# SPEC-078-GAPS: Cloudinary Image Management — Gaps Remediation

## Progress: 67/68 tasks (99%)

**Average Complexity**: 1.7 / 2.5 (max)
**Completed from prior work**: 3 tasks (Phase 0 + Phase 1A) — see already-done.md
**Completed 2026-04-18 (previous session)**: 1 task (T-004 — Phase 1B migrations reconstruction)
**Completed 2026-04-18/19 (current session)**: 46 tasks — 4 warmups + 5 security + 5 schema/DB + T-017 + T-022 + T-029 + T-018/T-019 + T-031 + T-023 + T-040 + T-024 + T-030 + T-025 + T-032 + T-033 + T-035 + T-034 + T-051 + T-052 + T-054 + T-056 + T-057 + T-036 + T-055 + T-020 + T-058 + T-059 + T-060 + T-062 + T-064 + T-021 + T-061 + T-063 + T-039
**Completed 2026-04-20 (current session)**: 17 tasks — T-041 + T-048 + T-042 + T-049 + T-043 + T-050 + T-065 + T-066 + T-068 + T-026 + T-027 + T-038 + T-044 + T-045 + T-046 + T-047 + T-067
**Splits applied**: 20 parent tasks split into 45 child tasks (68 total vs 47 original)

**Remaining pending (1 task, architectural consult required)**:
- **T-015** (complexity 2.5, no deps) — BaseModel JSONB merge semantics with FOR UPDATE transaction. **Requires architectural consult** on concurrency model before implementation (affects all entities with `mergeableJsonbColumns`).

**Known follow-ups** (captured in commits but not tracked as standalone tasks):
- **GAP-078-105** (Cloudinary upload_stream flags invalidate/exif/faces): lives in `packages/media/src/server/cloudinary.provider.ts`, fell outside T-006 scope.
- **env-registry-schema-cross-validation**: 4 pre-existing failures on Cloudinary vars not yet in `ApiEnvSchema` (unrelated to any current task).
- **destination.service.ts workaround cleanup** (5-line dead code block post-DROP NOT NULL): left unstaged to avoid mixing with pre-existing uncommitted work in that file.
- **GAP-078-061 web-side fallback migration**: `apps/web/src/lib/media.ts:82` still returns raw fallback; switch to `options.fallback` deferred (documented in T-042 + T-049 outcomes).
- **transforms.ts#getInitials @deprecated wrapper**: still imported by `OwnerCard.astro`, `ReviewPreview.astro`, `ReviewsModal.client.tsx`. Migrate to `getInitialsFromName` + delete wrapper (adoption sweep, cross-cuts T-049).
- **processEntityImages adoption**: helper seeded in `transforms.ts` but not wired into existing transforms. Separate adoption sweep.
- **EN/PT translations of `account.avatar.*`**: unreviewed; translation-team pass recommended (T-049 deliverable).
- **T-066 spec drift 400 vs 422**: REQ-04.1-D/H + REQ-04.3-B/E spec 422 but implementation surfaces 400 `VALIDATION_ERROR` from explicit `safeParse` branch. Tests assert real behavior with inline comments. Spec reconciliation deferred (would be a SPEC-078 amendment, not a code fix).
- **GAP-078-066 admin script-src `'https:'` blanket replacement**: `'strict-dynamic'` neutralizes it in CSP2+ browsers; dedicated admin-hardening pass would cover CSP1 fallback (T-050 partial close).
- **Backend gallery cap drift vs frontend config**: `apps/api` enforces `GALLERY_HARD_CAP = 50` flat for all entities, but admin frontend config-sections declare smaller caps per entity (acc 50 / dest 20 / event 10 / post 15). Adversary with direct API access could exceed the config cap. Deferred from T-038 (D4 decision). Needs either new task or inclusion in next admin/API sweep.
- **T-044 partial work resolved 2026-04-20**: Rate-limited sub-agent had done ~70% of the dnd-kit refactor. Closer agent finished i18n + tests and committed at `fad73ed7`. ✓ Closed.
- **T-047 scope miss (2026-04-20)**: First T-047 agent built a NEW AvatarUpload.tsx component instead of refactoring the 3 original target files. Valuable foundation laid (shadcn primitive + pattern + 9 i18n keys). Recovery agent spawned to close original scope (header-user.tsx + profile.tsx migration to shadcn Avatar primitive + validate-media-file.ts maxFileSizeMb prop). Lesson: when task description lists SPECIFIC target files, spec out "MUST touch these files, not replace them" explicitly in the agent prompt.

---

### Phase 0 — Blockers: routes, env, provider injection (DONE)

- [x] **T-001** (complexity: 1.5) — Register media routes and verify env vars in apps/api
  - Gaps: GAP-078-001, GAP-078-003, GAP-078-025
  - Blocked by: none
  - Blocks: T-002

- [x] **T-002** (complexity: 2.0) — Fix mediaProvider injection in _afterHardDelete handlers
  - Gap: GAP-078-002
  - Blocked by: T-001
  - Blocks: T-003

---

### Phase 1A — Permissions + authorization (DONE)

- [x] **T-003** (complexity: 2.5) — Add MEDIA_UPLOAD / MEDIA_DELETE permissions and entity-validation helper
  - Gaps: GAP-078-053, GAP-078-164
  - Blocked by: T-001
  - Blocks: T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011

---

### Phase 1B — DB setup: manual migrations reconstruction (DONE)

- [x] **T-004** (complexity: 2.5) — Reconstruct missing manual migrations (renumbered clean 0001-0010 sequence)
  - Gaps: GAP-078-188, GAP-078-189, GAP-078-187
  - Blocked by: T-003
  - Blocks: T-012, T-013, T-014, T-015, T-016
  - Outcome: 10 manual/*.sql files; generic orchestrator in apply-postgres-extras.sh; db:apply-extras wrapper chained from db:fresh/db:fresh-dev/db:reset; Drizzle-generated artifacts removed; ADR-017 + manifest + CLAUDE.md updated; db:fresh-dev validates clean (3571 rows, 3 CHECKs + MV + 43 triggers)

---

### Phase 1C — Security defensive hardening

- [x] **T-005** (complexity: 2.0) — Security: env-prefix validation on DELETE and path-traversal refine
  - Gaps: GAP-078-035, GAP-078-034, GAP-078-173
  - Blocked by: T-003
  - Blocks: none
  - Outcome: DeleteMediaQuerySchema refine rejects `..` (raw + URL-encoded). adminDeleteMediaPreValidation middleware returns 422 for traversal and 403 for env-prefix mismatch before OpenAPI zod hook. Defense-in-depth env check kept in handler.

- [x] **T-006** (complexity: 2.0) — Security: magic-bytes validation, decompression-bomb guard, and pixel-count reject
  - Gaps: GAP-078-103, GAP-078-104, GAP-078-105
  - Blocked by: T-003
  - Blocks: none
  - Outcome: validateMediaFile inspects PNG/JPEG/WEBP/HEIC/AVIF magic bytes and rejects with MIME_MISMATCH. DECOMPRESSION_BOMB for pixel count > 2e8. `file-type ^19.6.0` added as dep (held for future async path). **GAP-078-105 partial** — Cloudinary upload_stream flags belong in provider, deferred as follow-up.

- [x] **T-007** (complexity: 1.5) — Security: Cloudinary provider hardening — cloudName regex, stream error, folder assertion
  - Gaps: GAP-078-057, GAP-078-027, GAP-078-112
  - Blocked by: T-003
  - Blocks: none
  - Outcome: Constructor validates cloudName regex; uploadBuffer surfaces stream errors via reject; upload() throws new InvalidFolderError if folder does not start with `hospeda/`. InvalidFolderError re-exported from barrel.

- [x] **T-008** (complexity: 1.5) — Security: actor-UUID validation and session re-verify before provider call
  - Gaps: GAP-078-058, GAP-078-175, GAP-078-114
  - Blocked by: T-003
  - Blocks: none
  - Outcome: ActorIdSchema UUID check yields sanitized 500 on failure. Session re-verify is an in-memory cmp against ctx user/session, applied both early and just before provider.upload() (defense-in-depth). Strict variant (missing session => 401) flagged for optional follow-up.

- [x] **T-009** (complexity: 2.0) — Security: getMediaUrl SSRF guards, extractPublicId hostname fix, and prod-cleanup env var
  - Gaps: GAP-078-109, GAP-078-182, GAP-078-117, GAP-078-234, GAP-078-113
  - Blocked by: T-003
  - Blocks: none
  - Outcome: extractPublicId requires hostname === 'res.cloudinary.com' exactly. getMediaUrl allowlists raw transform tokens. HOSPEDA_ALLOW_PROD_CLEANUP gates seed --clean-images in prod; evaluateProdCleanupGate extracted as pure helper. Env var registered in packages/config. apps/api/vercel.json functions[api/index.js].maxBodySize=12mb (catch-all topology).

---

### Phase 2A — Schema alignment (Zod)

- [x] **T-010** (complexity: 1.5) — Schema alignment: MediaSchema.featuredImage optional, ImageSchema publicId and attribution
  - Gaps: GAP-078-185, GAP-078-163, GAP-078-196, GAP-078-116
  - Blocked by: T-004
  - Blocks: T-019, T-020 (seed), T-029 (API)
  - Outcome: MediaSchema.featuredImage optional. ImageSchema gains optional publicId + attribution (ImageAttributionSchema sub-schema). Additive-only per compat policy. 18 new tests; historic fixtures still parse.

- [x] **T-011** (complexity: 1.0) — Schema compat policy: additive-only documentation and historic shape fixtures
  - Gaps: GAP-078-122, GAP-078-201
  - Blocked by: T-003
  - Blocks: none
  - Outcome: packages/schemas/docs/guides/schema-compat-policy.md guide + test/fixtures/historic/{README.md,media.historic.ts}; CLAUDE.md + docs/README.md cross-linked

---

### Phase 2B — DB nullability alignment

- [x] **T-012** (complexity: 2.5) — DB nullability alignment: DROP NOT NULL on posts/destinations media + $type fix + media shape CHECK
  - Gaps: GAP-078-184, GAP-078-180, GAP-078-080, GAP-078-075
  - Blocked by: T-004
  - Blocks: T-015
  - Outcome: manual migration 0011 drops NOT NULL on posts/destinations.media; $type widened to Media | null; chk_{accommodations,destinations,events,posts}_media_shape CHECKs added. post_sponsors uses logo (Image), not media JSONB — documented via RAISE NOTICE. BaseCrudService._validateMediaShape hook runs MediaSchema.safeParse on create/update. destination.service.ts workaround cleanup deferred (see follow-ups).

- [x] **T-013** (complexity: 1.5) — DB gallery max CHECK constraint migration
  - Gap: GAP-078-195
  - Blocked by: T-004
  - Blocks: none
  - Outcome: manual migration 0012 adds 50-item CHECK on 4 tables. Seed safe (max existing gallery is 10). Idempotent down migration.

---

### Phase 2C — users.image satellite columns

- [x] **T-014** (complexity: 2.5) — Add users.image satellite columns migration and update UserService.updateAvatar
  - Gaps: GAP-078-081, GAP-078-197
  - Blocked by: T-004
  - Blocks: none
  - Outcome: manual migration 0013 adds image_public_id text, image_moderation_state enum, image_caption text + btree index on moderation state. UserService.updateAvatar writes JSONB + 3 satellites atomically. _beforeHardDelete captures deletedImagePublicId in UserHookState for _afterHardDelete to consume. 10 new updateAvatar tests.

---

### Phase 2D — BaseModel merge semantics

- [ ] **T-015** (complexity: 2.5) — BaseModel JSONB merge semantics with transaction FOR UPDATE
  - Gaps: GAP-078-186, GAP-078-198
  - Blocked by: T-004, T-012
  - Blocks: none

---

### Phase 2E — Bookmarks trigger soft-delete extension

- [x] **T-016** (complexity: 1.5) — Extend delete_entity_bookmarks trigger for soft-delete
  - Gap: GAP-078-192
  - Blocked by: T-004
  - Blocks: none
  - Outcome: manual migration 0014 adds AFTER UPDATE triggers (5 tables) guarded on deleted_at NULL -> NOT NULL transition. Original AFTER DELETE triggers unchanged. Triggers manifest updated.

---

### Phase 3A — @repo/media subpath exports bundle architecture

- [x] **T-017** (complexity: 2.5) — Restructure @repo/media subpath exports bundle architecture
  - Gaps: GAP-078-126, GAP-078-162, GAP-078-183, GAP-078-172, GAP-078-177
  - Blocked by: T-003
  - Blocks: T-018, T-021, T-022, T-023, T-024, T-025, T-026, T-027
  - Outcome (commit `697b8404`): Big-bang split — 3 subpath entries (`.`, `./server`, `./test-utils`). New `tsup.config.ts` with `external: ['cloudinary', 'image-size']`. Biome `noRestrictedImports` in admin+web blocks `/server`. Vite `optimizeDeps.exclude` + Astro `optimizeDeps` + `ssr.external`. 14 server-side consumers migrated to `@repo/media/server`; 7 browser-safe consumers unchanged; `apps/api/routes/media/admin/upload.ts` splits imports. `test-utils/index.ts` is empty placeholder (InMemoryImageProvider → T-018). All typechecks green, 122/122 media tests pass. **Deviation**: kept single tsconfig with `types: [node]` — runtime isolation via tsup `external` + Biome is sufficient; second tsconfig would need composite refactor (follow-up if needed).

---

### Phase 3B — Test utilities

- [x] **T-018** (complexity: 2.0) — Add InMemoryImageProvider and extractAllMediaPublicIds to @repo/media
  - Gaps: GAP-078-102, GAP-078-082, GAP-078-229
  - Blocked by: T-017
  - Blocks: T-036 (i18n), T-037 (spec amendment)
  - Outcome (commit `c3c64823`, merged with T-019): `InMemoryImageProvider` under `@repo/media/test-utils` implements full ImageProvider contract (upload/delete/deleteByPrefix) with in-memory Map; returns `res.cloudinary.com` URLs so `extractPublicId` round-trips. `extractAllMediaPublicIds` under `@repo/media/server` walks featuredImage → gallery → videos with de-dup. `getMediaProvider()` falls back to InMemory in dev NODE env when creds missing, warn-logged. 15 new tests, media suite 133/133 green, API media suite 28/28 green.

- [x] **T-019** (complexity: 1.0) — Add resetMediaProviderForTesting export and test-utils subpath
  - Gaps: GAP-078-059, GAP-078-168
  - Blocked by: T-017, T-010
  - Blocks: T-036, T-037
  - Outcome (commit `c3c64823`, merged with T-018): `resetMediaProviderForTesting()` exported from API media service, throws on non-test NODE env (cleaner than conditional undefined). Works correctly after `vi.resetModules()` via `constructor.name` assertion pattern. 4 of 15 new tests cover this path.

---

### Phase 3C — Documentation and spec amendments

- [x] **T-020** (complexity: 1.0) — Create packages/media JSDoc and interface cleanup documentation
  - Gaps: GAP-078-028, GAP-078-174, GAP-078-032, GAP-078-161
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commit `00025241`): 32-line JSDoc on `CloudinaryProvider` constructor with `@internal` tag, SDK v2 singleton warning, `@see {@link getMediaProvider}` ref, and TODO note (Biome 1.5.3 lacks AST-level rule to block `new CloudinaryProvider(...)` outside the canonical access point — flagged 2 known direct-construction sites in `packages/seed/src/{cli,index}.ts` as out of scope). `buildUrl` already absent from `ImageProvider` interface (likely removed during T-017 restructure) — pure doc work for GAP-078-032 + closed 161 as duplicate. Spec v1.8 → v1.9 amendment.

- [x] **T-021** (complexity: 1.0) — Create packages/media README.md and CLAUDE.md
  - Gap: GAP-078-047
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commit `014c30f1`): README.md (152 lines) with installation, subpath exports table, 3-pattern quickstart (browser-safe / server / test-utils), exports tables, presets table for 7 transforms, env vars table, operational notes (T-035 retry + T-052 healthCheck), runbook link. CLAUDE.md (122 lines) with the 3-subpath rule (allowed/forbidden matrix), anti-patterns (never `new CloudinaryProvider` outside services/media.ts, never inline cloudinary URLs), avatar fixed-publicId race condition note (last-write-wins mitigated by T-008 + future T-015), provider behavior summary, dev fallback to InMemoryImageProvider, key files list, related SPEC links. Style matches `packages/i18n/{README,CLAUDE}.md`.

---

### Phase 4A — Seed strategy refactor

- [x] **T-022** (complexity: 2.0) — Seed strategy refactor: seedSource required/example, processor counters, and resolveEnvironment
  - Gaps: GAP-078-036, GAP-078-116, GAP-078-007, GAP-078-037, GAP-078-039
  - Blocked by: T-010
  - Blocks: T-023
  - Outcome (commit `6f5b0589`): seedSource discriminator on SeedContext; `example` early-returns preserving raw URL + attribution. CLI flag `--allow-required-fallback` tolerates required failures with warn. Counters `{ uploaded, cached, failures, skippedExample }` emitted. `resolveEnvironment()` replaces 3 NODE env read sites (imported from `@repo/media/server` per T-017). Gallery role is template-literal `gallery/${index}`. env-registry adds `'seed'` to 4 Cloudinary entries. Refactor: `uploadSeedImage` returns discriminated `UploadSeedImageOutcome`. 9 new tests, 121/121 pass.

- [x] **T-023** (complexity: 1.5) — Seed strategy: avatars path, moderation default, and spec amendment
  - Gaps: GAP-078-008, GAP-078-063, GAP-078-019
  - Blocked by: T-022
  - Blocks: T-024, T-025
  - Outcome (commit `2d5e4be2`): Avatar pipeline now uses `hospeda/{env}/seed/avatars/{userId}` flat path via new `publicIdOverride` parameter on `uploadSeedImage()`; `AVATAR_ENTITY_TYPE='avatars'` constant. `withModerationDefault()` helper injects `ModerationStatusEnum.APPROVED` on `featuredImage` + `gallery[]` entries when missing; explicit values (PENDING/REJECTED) preserved. SPEC-078 amended v1.7 → v1.8 with REQ-02 Technical Notes documenting (a) seed=array index vs runtime=nanoid divergence, (b) avatar flat-path override. 3 new processor tests (8/8 file pass, 124/124 suite pass).

- [x] **T-024** (complexity: 2.0) — Seed strategy: sponsor/organizer logo handling, MediaBlock videos, and MediaSchema validation
  - Gaps: GAP-078-077, GAP-078-083, GAP-078-084
  - Blocked by: T-023
  - Blocks: none
  - Outcome (commit `dcdb9d77`): Two new processor branches mirroring T-023 avatar pattern: postSponsor.logo (object `{url}`) + eventOrganizer.logo (string), both via `publicIdOverride` to `hospeda/{env}/seed/{postSponsor|eventOrganizer}/{id}/logo`. Branches gate on `entityType.toLowerCase().startsWith()` so singular+plural casings handled. `MediaBlock` interface (lives inline in cloudinary-image-processor.ts, no separate types.ts) widened with `videos?: unknown[]`. `seedFactory.MediaSchema.parse()` runs unconditionally after `processEntityImages` (even with no Cloudinary provider) so malformed fixtures fail loudly via errorHistory + rethrow. 5 new tests (2 sponsor/organizer + 3 seedFactory media validation), 12 files / 129 tests pass.

- [x] **T-025** (complexity: 1.0) — Seed data: moderation state bulk-fix in destination JSONs and CLAUDE.md doc
  - Gap: GAP-078-076
  - Blocked by: T-023
  - Blocks: none
  - Outcome (commit `9ef34171`): 26 destination JSONs (101 occurrences) flipped from `"PENDING"` to `"APPROVED"`. Two REJECTED fixtures kept on gallery image #2 of 022-destination-ceibas + 020-destination-larroque (preserved hero image usability while exercising rejected branch). ImageSchema/VideoSchema have no `moderationReason` field — only state flipped. `packages/seed/CLAUDE.md` gains "Seed Moderation Conventions" subsection documenting APPROVED-default rule + relationship to T-023's `withModerationDefault` + T-024's `MediaSchema.parse` fail-loud validation.

---

### Phase 4B — Seed hardening

- [x] **T-026** (complexity: 1.5) — Seed hardening: SSRF allowlist and --reset / --clean-images flag integration
  - Gaps: GAP-078-030, GAP-078-006, GAP-078-078
  - Blocked by: T-022
  - Blocks: none
  - Outcome (commit `306f62d0`): New `is-allowed-seed-url.ts` helper with frozen readonly allowlist (unsplash/pexels/cloudinary), case-insensitive hostname match, rejects non-HTTP(S) + malformed URLs. `cloudinary-upload.ts` short-circuits with logged warn + `{status:'failed'}` even under `throwOnFailure=true` (fixture defect, not network error). `cli.ts` gains pure exported `coerceResetImpliesCleanImages` helper; `--reset` branch runs `handleCleanImages()` then `runSeed()` sequentially; `--clean-images` alone still cleanup-only. 15 new tests (7 allowlist + 5 coerce + 3 SSRF-flow). 159/159 pass. Knock-on: pre-existing test files updated to use real allowlisted hostnames.

- [x] **T-027** (complexity: 1.5) — Seed hardening: cache flush, --validate-cache, cache schema Zod validation, and .gitignore
  - Gaps: GAP-078-033, GAP-078-079, GAP-078-120, GAP-078-074
  - Blocked by: T-022
  - Blocks: none
  - Outcome (commit `dd644eb1`): New `packages/seed/src/schemas/cloudinary-cache.schema.ts` with Zod versioned envelope `{version:1, entries:{...}}` + `CLOUDINARY_CACHE_VERSION` constant. `cloudinary-cache.ts` validates on read, rejects legacy unversioned caches with warn (cheap-to-rebuild cache — no migration needed); `updateCacheEntry` now mutates in-memory only (kept `cachePath` param as `@deprecated` to avoid touching T-026's upload file); new `flushCache` + `validateCacheEntries` helpers. `index.ts#runSeed` flushes once in finally block (error-swallowed). `cli.ts` gains `--validate-cache` flag independent of reset/clean-images — sequential HEAD with 5s timeout. Root `.gitignore` gets `**/.cloudinary-cache.json`. 17 new tests (7 Zod shape + 3 envelope-write + 2 deferred-flush + 5 validate). 170/170 seed tests pass.

- [x] **T-028** (complexity: 1.0) — Seed hardening: admin max-size constant replacing hardcoded magic numbers
  - Gap: GAP-078-010
  - Blocked by: T-003
  - Blocks: none
  - Outcome: apps/admin/src/lib/constants.ts with DEFAULT_MEDIA_MAX_SIZE_BYTES (5 MiB) + DEFAULT_GALLERY_FALLBACK_MAX_SIZE_BYTES (10 MiB); 7 hardcoded occurrences replaced across entity-form fields + section configs

---

### Phase 5A — API response contract

- [x] **T-029** (complexity: 2.0) — API response contract: route factory status 200, ResponseFactory wrap, UploadResponseSchema, and moderationState
  - Gaps: GAP-078-026, GAP-078-029, GAP-078-159, GAP-078-178, GAP-078-062, GAP-078-149
  - Blocked by: T-010, T-017
  - Blocks: T-030, T-031, T-032, T-033
  - Outcome (commit `c28cb4c6`): `route-factory.ts` gains `successStatusCode?: 200 | 201` honored in `createCRUDRoute`. Both admin+protected upload routes pass 200 and removed every `ctx.json` bypass (all exit via `createErrorResponse` / factory-wrapped `createResponse`). Handler runs `UploadResponseDataSchema.parse()` before return and injects `moderationState: 'APPROVED'`. Schemas split: `UploadResponseDataSchema` (unwrapped payload, APPROVED default) + `UploadResponseSchema` (wrapped). 35 new schema tests + 2 integration tests. SPEC-078 parent amended v1.7. **Deviation**: fixed latent bug in `createCRUDRoute` consuming body stream on POST even without requestBody schema — was breaking multipart handlers. Factory now skips body parse when `requestBody` is undefined.

- [x] **T-030** (complexity: 1.0) — API response contract: DELETE wasPresent flag and tags/overwrite forwarding
  - Gaps: GAP-078-154, GAP-078-155
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `0d9fca75`): `ImageProvider.delete()` widened from `Promise<void>` to `Promise<DeleteResult>` exposing `wasPresent: boolean` (Cloudinary `result==='ok'` → true; `'not found'` and any other defensive value → false). `DeleteResult` interface added to `packages/media/src/server/types.ts`, exported via barrel. `CloudinaryProvider`, mock provider, and admin DELETE route propagate end-to-end. Single existing service-core consumer (`user.service.ts:583`) discards return via `await`, so no caller break. `DeleteMediaResponseSchema` adds optional `wasPresent` per additive-only schema-compat. Admin upload route parses multipart `tags` (comma-split, `[A-Za-z0-9_-]{1,64}` regex, max 20) and `overwrite` (boolean coerce); centralized `MediaTagsSchema`/`MediaOverwriteSchema` consts so all 5 AdminUploadRequest variants share validation; forwarded to `provider.upload()` only when supplied. **T-029 follow-up cleanup**: 9 ctx.json bypass calls in admin delete route replaced with `createErrorResponse` + return-shape (full factory flow). 8 new tests (3 wasPresent + 5 tags/overwrite); 137/137 media, 89/89 schemas, 36/36 api media routes pass.

---

### Phase 5B — Request schemas

- [x] **T-031** (complexity: 1.5) — Request schema refinements: discriminatedUnion role and ENTITY_FOLDER_MAP
  - Gaps: GAP-078-153, GAP-078-055
  - Blocked by: T-029
  - Blocks: T-040
  - Outcome (commit `8328477f`): `packages/schemas/src/common/media-upload.schema.ts` rewritten with `z.discriminatedUnion('role', [featured, gallery, avatar, sponsorLogo, organizerLogo])`. Each variant double-narrows by pinning entityType (featured/gallery → 4 CRUD entities; avatar → user + requires userId; sponsorLogo → postSponsor; organizerLogo → eventOrganizer). `galleryId` regex matches `generateGalleryId()` output (nanoid 10). `ENTITY_FOLDER_MAP` is `Readonly<Record<MediaEntityType, (ctx) => string>>` function-only for uniformity; resolvers throw on missing ctx. apps/api admin upload route wires the map + 400 early-return for avatar/sponsor/organizer variants (those flow through dedicated routes, out of scope here). 81 tests (55 → 81).

- [x] **T-032** (complexity: 1.0) — Request schema refinements: empty file reject and env-configurable max size
  - Gaps: GAP-078-148, GAP-078-106
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `bc53c7b5`): Both upload routes (admin + protected) check `file.size === 0` right after multipart parsing and return 422 `EMPTY_FILE` before any other validation. Provider never reached for empty payloads. EMPTY_FILE follows existing route-level inline literal pattern. **Discovery**: GAP-078-106 was 90% pre-implemented (env var in `ApiEnvSchema`, registry entry, route wiring all already present from prior sweep) — only the boot-time validation tests were missing. 4 new env tests cover default=10, numeric coercion, non-numeric → boot fails, non-positive → boot fails. 2 new route tests + 4 env tests; 38/38 media-routes pass; 65/65 new tests pass.

---

### Phase 5C — Defensive route hardening

- [x] **T-033** (complexity: 1.5) — Defensive route hardening: rate limit, Content-Length margin, and gallery cap
  - Gaps: GAP-078-068, GAP-078-021, GAP-078-071
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `bfa122df`): Both upload routes (admin + protected) gain `customRateLimit { requests: 10, windowMs: 60000 }` via existing route factory option (TODO comments inline reference SPEC-079). Content-Length pre-check uses `maxBytes + 1024` margin so payload exactly at limit isn't falsely rejected. Admin upload route adds server-side hard cap of 50 gallery items per entity (matches T-013 DB CHECK with typed error code `GALLERY_LIMIT_EXCEEDED`); reads from entity already loaded by `service.getById` (zero extra DB queries); skipped unless `role === 'gallery'`. **Discovery**: global `bodyLimit` middleware (10MB flat) preempts route-level Content-Length check — tests accept either `PAYLOAD_TOO_LARGE` (route) or `REQUEST_TOO_LARGE` (global) as valid 413. 7 new tests; 45/45 media routes pass. Required `HOSPEDA_TESTING_RATE_LIMIT=true` at top of test file (env cached at startup) + `clearRateLimitStore()` in beforeEach.

- [x] **T-034** (complexity: 1.5) — Defensive route hardening: OpenAPI multipart schema, lazy services, and CORS doc
  - Gaps: GAP-078-072, GAP-078-060, GAP-078-150
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `9cc01a7e`): `configure-open-api.ts` post-processes the generated OpenAPI doc; new `openapi-multipart-overrides.ts` helper holds `(path, method) → multipart schema` static map and mutates the doc to inject `requestBody.content["multipart/form-data"]`. **Architectural choice**: post-process spec rather than extend route factory — extending broke 12 tests because `@hono/zod-openapi createRoute()` body content installs a JSON validator that rejects multipart via global defaultHook. Post-processing leaves runtime path untouched. Module-level service singletons in `admin/upload.ts` + `admin/delete.ts` (4 services each) moved into per-request `resolveEntityService()` / `resolveDeleteEntityService()` helpers. `protected/upload.ts` already had no module-level state. `route-architecture.md` gains 17-line "CORS — media routes" section. 47/47 media route tests pass (2 new multipart-spec).

---

### Phase 5D — Resilience

- [x] **T-035** (complexity: 2.0) — Add p-retry resilience to provider delete/deleteByPrefix
  - Gaps: GAP-078-087, GAP-078-054
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `11e0b113`): `ImageProvider.delete()` and `deleteByPrefix()` wrapped with `pRetry({retries: 3, factor: 3, minTimeout: 1000})`. Cloudinary 429 + 5xx trigger retry; other 4xx (401, 404) throw `AbortError` (permanent failures, no retry). `isPermanent4xx()` predicate inspects `err.http_code` in `[400, 500)` excluding 429. `upload()` has NO retry by design (idempotency risk on partial publicId collision) — explicit JSDoc paragraph. `deleteByPrefix()` SDK call now passes `{invalidate: true}` to invalidate CDN cache immediately. Added `p-retry@^8.0.0` dep (ESM-only, compatible with `@repo/media` `"type": "module"`). 4 new/updated tests; 140/140 media tests pass. **Test gotcha**: p-retry v8 requires `Error` instances (not plain objects) — used `Object.assign(new Error('...'), {http_code: ...})` to mimic real Cloudinary SDK error shape. `vi.useFakeTimers()` + `vi.runAllTimersAsync()` to skip the 1s minTimeout wait.

---

### Phase 5E — i18n error keys

- [x] **T-036** (complexity: 1.5) — Add i18n error keys for media error codes
  - Gap: GAP-078-139
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `8afd6227`): Found 11 inline error codes in media routes (EMPTY_FILE, GALLERY_LIMIT_EXCEEDED, CLOUDINARY_NOT_CONFIGURED, PAYLOAD_TOO_LARGE, SESSION_STALE, VALIDATION_ERROR, ENTITY_NOT_FOUND, FORBIDDEN, UPSTREAM_ERROR, UNPROCESSABLE_ENTITY, INTERNAL_ERROR). Response shape (`response-helpers.ts`) already exposed `code` field — pure additive on i18n side. New `api.media.errors.{CODE}` keys in es/en/pt locale files (Spanish=Rioplatense, Portuguese=Brazilian). Key path uses literal CODE as leaf so server-emitted code and client lookup stay in 1:1 lockstep. 33 new key-resolution assertions (11 codes × 3 locales) pass.

---

### Phase 5F — Spec amendment: /users/me convention

- [x] **T-037** (complexity: 1.0) — Amend SPEC-078 v1.6: /users/me convention documentation fix
  - Gap: GAP-078-009
  - Blocked by: none
  - Blocks: none
  - Outcome: SPEC-078-cloudinary-image-management/spec.md v1.6: REQ-04.2-FLOW uses PATCH /api/v1/protected/users/${userId} + ownership check; /me adoption deferred to dedicated SPEC

---

### Phase 6A — Admin UI: wiring upload/delete for all 4 entities

- [x] **T-038** (complexity: 2.5) — Admin UI: wire upload/delete for destinations, events, posts entity edit pages
  - Gaps: GAP-078-004, GAP-078-005, GAP-078-018
  - Blocked by: T-017, T-029
  - Blocks: none
  - Outcome (commit `2d581d49`): 1:1 replication of accommodations wiring in 3 edit pages (~28 net lines each). Imports `useMediaUpload` + `createUploadHandler` + `useMemo`; builds `galleryFieldHandlers` memo block verbatim from accommodations pattern; forwards as `fieldHandlers` prop to `EntityEditContent`. Hook untouched — T-040 already narrowed `UploadEntityType` to `Extract<MediaEntityType, 'accommodation'|'destination'|'event'|'post'>`. 3 component-level tests added (one per entity). Product decisions: D1 1:1 replication (A), D2 atomic commit (A), D3 delete confirmation deferred to T-045 (C), D4 backend gallery cap alignment deferred as follow-up (B).

- [x] **T-039** (complexity: 1.5) — Delete accommodations gallery tab and add TanStack Router redirect
  - Gap: GAP-078-073
  - Blocked by: T-017, T-029
  - Blocks: none
  - Outcome (commit `56ef6b72`): Replaced 143-line standalone gallery route with 22-line redirect-only route via `beforeLoad: throw redirect({to: '/accommodations/$id/edit', params: {id}, hash: 'gallery-section', replace: true})`. Component returns null. 2 new tests assert beforeLoad payload + null fallback. **Follow-up flagged**: redirect targets hash `gallery-section` per spec but the actual `EntityFormSection` for gallery currently renders no DOM element with that id — auto-scroll won't fire until the anchor is added. No 404 either way.

---

### Phase 6B — Admin hooks type safety

- [x] **T-040** (complexity: 1.5) — Admin hooks type safety: use-media-upload with MediaEntityType/MediaRole and schema validation
  - Gap: GAP-078-052
  - Blocked by: T-031
  - Blocks: none
  - Outcome (commit `75068a8f`): `use-media-upload.ts` imports `MediaEntityType`, `MediaRole`, `AdminUploadRequestSchema` from `@repo/schemas`. Existing `UploadEntityType` / `UploadImageRole` aliases narrowed via `Extract<MediaEntityType, 'accommodation'|'destination'|'event'|'post'>` and `Extract<MediaRole, 'featured'|'gallery'>` to preserve back-compat with existing call sites (avatar/sponsor/organizer require different payload shapes — separate mutations TBD). `mutationFn` runs `AdminUploadRequestSchema.safeParse({role, entityType, entityId})` BEFORE FormData construction; failure throws plain `Error` (not `ApiError` — pre-network errors don't pretend to be HTTP). 4 new tests (1 compile-time `@ts-expect-error`, 3 runtime fetch-spy assertions). Single existing consumer (`accommodations/$id_.edit.tsx`) still typechecks.

---

### Phase 6C — Raw <img> to getMediaUrl() migration

- [x] **T-041** (complexity: 1.5) — Migrate raw <img> to getMediaUrl() in admin components: profile, SEO, header, GalleryField
  - Gaps: GAP-078-015, GAP-078-016, GAP-078-042, GAP-078-043, GAP-078-137
  - Blocked by: T-017
  - Blocks: T-050 (CSP)
  - Outcome (commit `fcb9e9a6`): 4 admin surfaces migrated. profile.tsx (avatar preset, lazy), $id_.seo.tsx (og preset, lazy), header-user.tsx (avatar preset, eager — above fold), GalleryField.tsx (thumbnail preset, lazy). $id_.gallery.tsx skipped — already a 22-line TanStack redirect since T-039 (56ef6b72). ImageField/GalleryViewField/ImageViewField/ImageCell/GalleryCell already used getMediaUrl from prior tasks. Biome auto-fix reordered @repo/media import after @repo/icons per useSortedImports. 11/11 header-user tests pass (src-equality holds: getMediaUrl returns non-Cloudinary URLs unchanged). Pre-existing typecheck errors in createEntityApi.ts + me/accommodations/index.tsx verified to exist on HEAD pre-change — not regressions.

- [x] **T-042** (complexity: 2.0) — Migrate getMediaUrl() API extensions: fallback override, regex anchor, delivery-type detection
  - Gaps: GAP-078-061, GAP-078-069, GAP-078-166, GAP-078-211, GAP-078-218, GAP-078-179
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commit `3c23300f`): 4 hardening extensions to getMediaUrl(). (1) Fallback precedence: per-call options.fallback wins over module default via recursive re-entry with fallback stripped; empty/whitespace fallback collapses back to module default (no infinite recursion). (2) Delivery-type detection: regex `/\/image\/(fetch|private|authenticated)\//` path-segment anchored — unchanged URL return for those delivery types; regression test for `/upload/v1/fetch-notes/hero.jpg` proves anchor isn't substring-fuzzed. (3) Double-transform guard: positive-match heuristic slices first path segment after /upload/, flags token with `t_` prefix or any ALLOWED_RAW_TOKEN_PREFIXES prefix, version markers v\d+ excluded. Catches human-crafted URLs with custom t_* tokens. (4) Switched .replace('/upload/', ...) → indexOf+slice compose for reviewable first-occurrence semantics. 18 new tests, 208/208 media pass. Coverage 94.11/91.83/100/94.11 on get-media-url.ts (above perFile 90/85/90/90). GAP-078-061 transitively covered — web-side `apps/web/src/lib/media.ts:82` switch to options.fallback is T-049 scope (left as documented follow-up).

- [x] **T-043** (complexity: 1.5) — Add Biome noRestrictedSyntax rule and CI script for bare <img> Cloudinary URL detection
  - Gap: GAP-078-099
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commit `999e4ed5`): New `scripts/check-bare-cloudinary-img.sh` (109 lines, executable, mirrors check-cloudinary-isolation.sh style with rg primary + grep/find fallback). Registered as `pnpm check:bare-cloudinary-img`. CI step added in ci.yml between "Check Cloudinary SDK isolation" and "Check for disabled tests". **Biome rule skipped** (fallback per spec): Biome 1.9.4 ships no `noRestrictedSyntax` (that's ESLint-only); `noRestrictedImports` matches module specifiers not JSX attribute contents — CI script is authoritative enforcement surface. Baseline exit 0 (T-041/T-048 migrations clean). Injection test verified exit 1 with fixture path listed. `tiptap-renderer.ts:161` correctly NOT flagged (emits `${src}` from user JSON, not cloudinary literal). No intentional-escape exclusions needed.

---

### Phase 6D — Accessibility + UX

- [x] **T-044** (complexity: 2.0) — Admin accessibility: GalleryField dnd-kit drag-and-drop refactor
  - Gaps: GAP-078-048, GAP-078-144
  - Blocked by: T-017, T-038
  - Blocks: T-067
  - Outcome (commit `fad73ed7`, recovery close): Original agent hit rate limit at ~70%; closer finished i18n keys + tests. 11 files, +863/-304. dnd-kit deps (`@dnd-kit/core ^6.3.1`, `@dnd-kit/sortable ^10.0.0`, `@dnd-kit/utilities ^3.2.2`). Extracted `SortableGalleryItem.tsx`, `gallery-types.ts`, `use-gallery-uploads.ts` to respect 500-line budget. 7 i18n keys × 3 locales = 21 entries under `admin-entities.fields.gallery.*` (dnd announcements with position placeholders + instructions + dragHandleLabel + deleteLabel). 4 component tests via `vi.hoisted + vi.mock('@dnd-kit/core')` spy pattern. 1012/1014 admin tests pass (2 pre-existing).

- [x] **T-045** (complexity: 2.0) — Admin accessibility: ImageField error state, delete confirmation dialog, reduced-motion, and aria-describedby
  - Gaps: GAP-078-046, GAP-078-138, GAP-078-141, GAP-078-142, GAP-078-143
  - Blocked by: T-017, T-038
  - Blocks: T-067
  - Outcome (commit `d53d940b`): 4 files, +534/-11. ImageField.tsx refactored with new `ImageFieldErrorBanner.tsx` (90 lines, role=alert + aria-live=assertive, dismissible) + `DeleteConfirmDialog.tsx` (127 lines, shadcn AlertDialog). Reduced-motion via Tailwind `motion-reduce:animate-none` + `motion-reduce:transition-none`. 9 i18n keys × 3 locales under `admin-entities.fields.image.*`. 8 component tests covering error banner + delete dialog + reduced-motion. Test gotcha: `user.upload` honors `accept` attribute silently; used `fireEvent.change` + `Object.defineProperty(files)` instead.

- [x] **T-046** (complexity: 2.0) — Admin UX: HEIC/AVIF accept, p-limit parallel upload, and progress indicator
  - Gaps: GAP-078-152, GAP-078-127, GAP-078-140
  - Blocked by: T-017, T-038
  - Blocks: none
  - Outcome (commit `227f90ca`): 12 files. p-limit refactor in `use-gallery-uploads.ts` hook (respecting T-044 extraction), `GALLERY_UPLOAD_CONCURRENCY = 4`. `p-limit` added as admin dep. MIME allowlist (HEIC/HEIF/AVIF) on accept attribute of GalleryField + ImageField + AvatarUpload. New `UploadProgressIndicator.tsx` helper (role=status + aria-live=polite + motion-reduce). 4 i18n keys × 3 locales = 12 entries (previewUnavailable + uploadingProgress + uploadingProgressCount). 11 new tests + T-044/T-045 regression-free. 1037/1039 admin tests pass (2 pre-existing).

- [x] **T-047** (complexity: 1.5) — Admin UX: shadcn Avatar component refactor and validateMediaFile maxFileSizeMb prop
  - Gaps: GAP-078-145, GAP-078-176
  - Blocked by: T-017, T-038
  - Blocks: none
  - Outcome (2 commits): **Foundation** at `2f206323` — new AvatarUpload.tsx + `ui/avatar.tsx` shadcn primitive (+ `@radix-ui/react-avatar` dep) + `avatar-utils.ts` + `DEFAULT_AVATAR_MAX_SIZE_MB` in constants + 9 i18n keys × 3 locales + 6 component tests. **Scope miss recovery** at `0e2ac7c9` — migrated `apps/admin/src/integrations/clerk/header-user.tsx` and `apps/admin/src/routes/_authed/me/profile.tsx` to use the shadcn Avatar primitive; extended `packages/media/src/server/validate-media-file.ts` to honor `maxFileSizeMb` prop dynamically (`const maxMb = maxFileSizeMb ?? defaultMb`). Inverted pre-existing "should ignore maxFileSizeMb for avatar" test to match new contract. 4 new validate tests. 211/211 media tests + 1026/1028 admin pass. Jsdom gotcha: Radix AvatarImage deferred render — tests assert `data-slot=avatar` + fallback instead of `getByRole('img')`. Lesson for future: when spec lists target files explicitly, prompt MUST state "modify these files, not create replacements".

---

### Phase 6E — Web component media migration

- [x] **T-048** (complexity: 2.0) — Web media migration: transforms.ts and Astro component raw img replacements
  - Gaps: GAP-078-017, GAP-078-041, GAP-078-044, GAP-078-045, GAP-078-136
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commit `a321ee66`): Path correction — actual file is `apps/web/src/lib/api/transforms.ts` (not `utils/transforms.ts`); no shim/delete needed because it already delegated to `lib/media.ts` which wraps getMediaUrl. Work split into (a) 7 Astro components/pages + AvatarUpload island raw `<img>` → `getMediaUrl(publicId, preset)` with preset-appropriate attrs (hero eager+fetchpriority=high, avatars/cards lazy); (b) new `extractGalleryItems` + `media.galleryItems` field through lib/media + lib/api/transforms + data/types so HeroGallery.astro and fotos.astro can emit GLightbox `data-title`/`data-description` (closes GAP-078-136). Dropped redundant Astro `<Image>` double-optimization branch for author avatars in publicaciones/[slug].astro (Cloudinary already delivers optimized variant). AvatarUpload: only persisted displayUrl transformed; previewUrl blob: URL kept raw. 7 new tests (5 media.test + 2 transforms.test), 62/62 lib pass, 599 web test suite pass. Pre-existing AccommodationCard/EventCard Astro-path regressions from 1583b849 unrelated.

- [x] **T-049** (complexity: 2.0) — Web media migration: i18n avatar keys, moderationState cleanup, avatar-utils, and race condition doc
  - Gaps: GAP-078-040, GAP-078-064, GAP-078-070, GAP-078-118, GAP-078-145 (web part), GAP-078-194
  - Blocked by: T-017
  - Blocks: none
  - Outcome (commits `1e290384` + `1ac1c5c8` + `dfbd9291`): 3 atomic commits. (1) i18n: 10 account.avatar.* keys × 3 locales = 30 entries (hint, alt, success, actions.change/uploading, errors.invalidType/fileTooLarge/uploadFailed/updateFailed/unexpectedResponse). EN/PT unreviewed translations flagged for team pass. (2) avatar-utils extraction: new `apps/web/src/lib/avatar-utils.ts` with RO-RO `getInitials({name, email, placeholder})` + `getInitialsFromName(name)`. 12 tests. Migrated 5 callsites: AvatarUpload.client.tsx (full consumer + locale + userEmail props), UserNav.client.tsx + MobileMenu.client.tsx (thin shims with placeholder='' legacy contract), ReviewCard.tsx, transforms.ts (kept @deprecated positional wrapper because OwnerCard.astro/ReviewPreview.astro/ReviewsModal.client.tsx still import it — follow-up sweep needed). Scope-growth justification: added 2 components (UserNav/MobileMenu) beyond spec because they had identical duplicated getInitials bodies. (3) processEntityImages helper in transforms.ts — identity function emits PUBLIC_ENABLE_LOGGING-gated webLogger.warn when media present but featuredImage absent; helper exported but not yet wired into existing transforms (adoption is broader follow-up). moderationState removed from `apps/web/src/lib/media.ts:20` MediaImage interface. Race-condition doc in packages/media/CLAUDE.md expanded from 1 paragraph to 4 subsections (The race / Why we accept / Mitigations in place / When to diverge with advisory-lock guidance).

---

### Phase 6F — CSP updates

- [x] **T-050** (complexity: 2.0) — CSP updates: web img-src Cloudinary, admin CSP explicit allowlist, Astro remotePatterns
  - Gaps: GAP-078-065, GAP-078-228, GAP-078-066, GAP-078-125, GAP-078-227
  - Blocked by: T-041
  - Blocks: none
  - Outcome (commit `d4353fc8`): 3 CSP surfaces hardened with exact-hostname allowlist `https://res.cloudinary.com` (NOT wildcard — principle of least privilege). Web `apps/web/src/lib/middleware-helpers.ts:354` img-src adds Cloudinary (blob: already present). Admin `apps/admin/src/lib/csp-helpers.ts:41` img-src adds `blob:` (for AvatarUpload URL.createObjectURL, GAP-078-125) + explicit Cloudinary entry as defense-in-depth against Phase-2 enforcement dropping `'https:'` blanket. Astro `apps/web/astro.config.mjs:90` remotePatterns adds `{ protocol: 'https', hostname: 'res.cloudinary.com' }` for `<Image>` components (T-048 kept Astro `<Image>` for accommodation cover images). Both apps stay `Content-Security-Policy-Report-Only` (Phase 1 unchanged). **GAP-078-066 partial**: only img-src tightened — admin script-src `'https:'` blanket replacement deferred to dedicated admin-hardening pass because `'strict-dynamic'` already neutralizes it in CSP2+ browsers (CSP1-fallback-only surface). 3 new web CSP tests + 3 new admin CSP tests (33/33 + 37/37 pass).

---

### Phase 7A — Vercel config

- [x] **T-051** (complexity: 1.0) — Vercel config: upload route maxDuration per-route and preview env Cloudinary warning
  - Gaps: GAP-078-222, GAP-078-223, GAP-078-134
  - Blocked by: T-003, T-029
  - Blocks: none
  - Outcome (commit `1fad794f`): `vercel.json` bumps `functions.api/index.js.maxDuration` from 30 to 60s and pins `regions: ["iad1"]`. **Tradeoff**: catch-all topology means whole app inherits 60s instead of just upload routes — per-route function config requires splitting upload routes into separate Vercel function entry points (out of scope). New `warnIfCloudinaryMissingOnPreview()` helper runs once at boot; predicate: `VERCEL_ENV === 'preview'` AND any of 3 required Cloudinary vars (CLOUD_NAME, API_KEY, API_SECRET) absent or whitespace-only. Logs structured warn via `@repo/logger`; app continues normally (graceful degradation via T-018's InMemoryImageProvider). Production stays silent (Zod schema throws hard from T-009); dev/test stay silent. 7 new unit tests (RO-RO with injectable env + logger).

- [x] **T-052** (complexity: 2.0) — Vercel observability: /health/media endpoint and orphan cleanup cron
  - Gaps: GAP-078-232, GAP-078-231
  - Blocked by: T-003, T-029
  - Blocks: none
  - Outcome (commit `738b40b9`): `ImageProvider.healthCheck(): Promise<HealthCheckResult>` added to interface, all 3 impls (Cloudinary via `cloudinary.api.ping()`, mock, InMemory) wired. New public route `GET /api/v1/public/health/media` returns 200/503 based on healthCheck result. New weekly cron `media-orphan-cleanup` (Sundays 00:00 UTC) calls `deleteByPrefix('hospeda/preview/')` + `deleteByPrefix('hospeda/test/')`; short-circuits in production (NODE_ENV guard, no-op explicit). Registered in `apps/api/src/cron/registry.ts`. 10 new tests; 146/146 media tests pass.

---

### Phase 7B — Turbo config

- [x] **T-053** (complexity: 1.0) — Turbo globalEnv: add Cloudinary vars and VERCEL_ENV cache keys
  - Gaps: GAP-078-220, GAP-078-221, GAP-078-233
  - Blocked by: T-003
  - Blocks: none
  - Outcome: turbo.json globalEnv adds HOSPEDA_CLOUDINARY_{CLOUD_NAME,API_KEY,API_SECRET}, HOSPEDA_MEDIA_MAX_FILE_SIZE_MB, VERCEL_ENV

---

### Phase 7C — CI/CD and tooling

- [x] **T-054** (complexity: 1.5) — CI/CD: Cloudinary isolation script and CI jobs
  - Gaps: GAP-078-038, GAP-078-225, GAP-078-224
  - Blocked by: T-017, T-029
  - Blocks: none
  - Outcome (commit `60207154`): New `scripts/check-cloudinary-isolation.sh` runs `rg "from ['\"]cloudinary['\"]" apps/ packages/` excluding `packages/media/**` (with `grep -rnE` fallback for runners lacking ripgrep). Exits non-zero with violating files listed. Mirrors style of existing `check-csp-patterns.sh` + `check-unsafe-ilike.sh`. CI workflow gains "Check Cloudinary SDK isolation" step right after the existing isolation checks (Hospeda CI is single quality-check job, not split lint/typecheck/test). `ci.yml` job-level `env:` block exposes 3 Cloudinary secrets via `${{ secrets.X }}`. Root `package.json` gains `check:cloudinary-isolation` script. Verified: baseline 0 violations, injected fixture in admin exits 1.

- [x] **T-055** (complexity: 1.5) — CI/CD: Renovate pin, pnpm env:check pre-deploy, dpr_auto presets, and Cache-Control header
  - Gaps: GAP-078-226, GAP-078-230, GAP-078-133, GAP-078-135
  - Blocked by: T-017, T-029
  - Blocks: none
  - Outcome (commit `e08b0c17`): renovate.json gains 2 packageRules for cloudinary (minor/patch with manual review + major disabled — split for self-documenting intent). Both `cd-staging.yml` + `cd-production.yml` deploy jobs (api/web/admin × 2 envs = 6 jobs) gain Setup Node + pnpm + install + `pnpm env:check` before each Vercel deploy step. All 7 presets in `packages/media/src/presets.ts` (thumbnail/card/hero/gallery/avatar/full/og) get `dpr_auto` transform suffix; `dpr_` token already in `ALLOWED_RAW_TOKEN_PREFIXES` so no companion change needed. Both upload routes set `Cache-Control: no-store` at handler entry — DRY one-liner that provably applies to all branches including EMPTY_FILE short-circuit (4 new tests). 147/147 media + 55/55 api media route tests pass.

---

### Phase 8 — Observability + operations

- [x] **T-056** (complexity: 2.0) — Observability: structured logs, Sentry capture, and metrics counters
  - Gaps: GAP-078-050, GAP-078-128, GAP-078-129, GAP-078-014, GAP-078-056
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `cd4658fd`): Both upload routes (admin + protected) + admin delete route emit structured info logs on success (event: `media.upload.success` / `media.delete.success` with publicId, preset, role, entityType). Provider error catch blocks call `Sentry.captureException` with tags `{component, operation}` and contexts.media. New `domainCounters` Map in `middlewares/metrics.ts` exposes `media_upload_total{result}` + `media_delete_total{result}` via existing Prometheus exporter; counters live separate from per-endpoint request map (30-min cleanup doesn't reset). `services/media.ts` console.warn → `apiLogger.warn` + new `initializeMediaProvider()` called once from `index.ts` after Sentry init. AccommodationService 7 occurrences of `revalidationLogger.warn` → `this.logger.warn` (across `_after*` hooks); removed static field + createLogger import. 55/55 media routes + provider tests pass (4 new observability tests).

- [x] **T-057** (complexity: 1.0) — Observability: create Cloudinary incidents runbook
  - Gap: GAP-078-158
  - Blocked by: T-029
  - Blocks: none
  - Outcome (commit `5005ac90`): New 401-line `docs/runbooks/cloudinary-incidents.md` with 9 mandated sections (detection, health check, credential rotation, account suspension, quota exceeded, soft-delete + restore note, GDPR erasure reference, emergency contacts, escalation tree) + quick reference + severity definitions + reference-files appendix. Cross-references real SPEC-078 tasks (T-007/T-009/T-018/T-035/T-051/T-052/T-054) + real env var names + grep-able file paths. 11 TODO placeholders flagged for team to fill (production hostname, on-call rotation, Slack channel, lead names, GDPR runbook link). Style matches existing runbooks (billing-incidents.md, sentry-setup.md).

---

### Phase 9A — Schema tests

- [x] **T-058** (complexity: 1.5) — Schema tests: ImageSchema, VideoSchema, MediaSchema, BaseMediaFields coverage
  - Gap: GAP-078-101
  - Blocked by: T-010
  - Blocks: none
  - Outcome (commit `225d1778`): Extended `media.schema.test.ts` 12 → 60 tests across 5 schema exports (ImageAttributionSchema 9, ImageSchema 22, VideoSchema 10, MediaSchema 13, BaseMediaFields 11). **Quirks documented in tests**: (a) gallery 50-item cap is DB-only CHECK constraint, NOT enforced at Zod level (51-item arrays parse fine); (b) `BaseMediaFields` uses its own inline image shape (no publicId/attribution) and silently strips those keys via Zod's strip default. 67/67 pass (60 new + 7 pre-existing compat).

---

### Phase 9B — @repo/media unit tests

- [x] **T-059** (complexity: 2.0) — Unit tests: extractPublicId and validate-media-file edge cases
  - Gaps: GAP-078-013, GAP-078-088, GAP-078-206, GAP-078-207, GAP-078-090, GAP-078-213, GAP-078-212
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `04180ddc`, combined with T-060): 13 new tests across 3 files (extract-public-id 8, validate-media-file 3, get-media-url 2). **Discoveries**: (a) 0-byte buffer returns `INVALID_IMAGE` (NOT `EMPTY_FILE` — that's the route-level T-032 code); (b) `getMediaUrl` is a pure string transformer that preserves HTTP scheme as-is (HTTPS enforcement lives in `extractPublicId` via strict URL.hostname); (c) `/image/fetch/` URLs return null; (d) double `/upload/` matches the FIRST occurrence (literal upload becomes folder).

- [x] **T-060** (complexity: 2.0) — Unit tests: MEDIA_PRESETS frozen check, environment.test.ts, and coverage thresholds
  - Gaps: GAP-078-089, GAP-078-091, GAP-078-202, GAP-078-203, GAP-078-098, GAP-078-204, GAP-078-205, GAP-078-214
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `04180ddc`, combined with T-059): 23 new tests + source change to `Object.freeze(MEDIA_PRESETS)` (as const is type-only — runtime freeze required for `Object.isFrozen` assertion). environment.test.ts full rewrite with `vi.stubEnv`/`vi.unstubAllEnvs`. validate-media-file +12 tests (4 IMAGE_TOO_LARGE pixel-count branch + 8 synthetic AVIF/HEIC/WEBP magic-byte detection — 12-byte ftyp/RIFF headers built in-process, no binary fixtures committed). gallery-id deterministic via `vi.mock('nanoid')`. vitest.config.ts coverage threshold `perFile: true` 90/85/90/90 with barrel + types excluded; final coverage 95.81/94.66/96.77/95.81. 178/178 media tests pass.

- [x] **T-061** (complexity: 1.0) — Unit tests: @repo/media contract test (cloudinary SDK shape)
  - Gap: GAP-078-100
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `cf830e97`): New `cloudinary-sdk-contract.test.ts` (33 lines) imports the real SDK (no mocks) and asserts 5 methods are functions: `cloudinary.config`, `uploader.upload_stream`, `uploader.destroy`, `api.delete_resources_by_prefix`, `api.ping`. Single test iterates a requiredMethods table for clear failure messages. Guards against SDK breaking changes that escape Renovate review. 185/185 media tests pass.

- [x] **T-062** (complexity: 2.0) — Unit tests: CloudinaryProvider upload edge cases and mock patterns
  - Gaps: GAP-078-085, GAP-078-210, GAP-078-215, GAP-078-217, GAP-078-219, GAP-078-216
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `6f0b286f`): 5 new provider tests + 2 validate-media-file boundary tests. data-URI + remote-URL inputs modeled via Buffer conversion (provider only accepts Buffer). setupUploadStream helper rewritten with `setImmediate(cb, null, result)` for realistic async — 12+ existing tests benefit. resource_type='image' assertion via mock.calls inspection. Empty `tags: []` resolves AND provider strips option entirely (`callOptions.tags === undefined`, NOT `[]`) — explicit gating on line 217. Avatar 5MB exact passes; 5MB+1 fails with FILE_TOO_LARGE. 184/184 media tests pass; coverage above T-060 perFile thresholds. **Note**: GAP-078-215 (multi-instance behavior) was listed but deferred — left for T-063 sweep where it fits with delete paths + multi-instance scenarios.

- [x] **T-063** (complexity: 2.0) — Unit tests: CloudinaryProvider delete paths, multi-instance, and avatar boundary
  - Gaps: GAP-078-086, GAP-078-031, GAP-078-208, GAP-078-209, GAP-078-215, GAP-078-216 (216 already done in T-062)
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `71a69ea0`): 4 new provider tests. (a) delete() permanent 404 NO retry (distinct from T-035's 401 — 404 is endpoint hard-reject vs auth); (b) deleteByPrefix asserts cloudinary.api.delete_resources_by_prefix called + uploader.* NOT called; (c) deleteByPrefix partial-success `{deleted: {a:'deleted', b:'not_found'}}` resolves cleanly; (d+e) **multi-instance describe with 2 tests pinning the last-init-wins footgun** — older provider reference still operates under tenant-B creds because SDK is module-level singleton. Documented in T-020's constructor JSDoc, now pinned by tests. 190/190 media pass; coverage 94.15%/91.52% above thresholds.

---

### Phase 9C — Seed tests

- [x] **T-064** (complexity: 2.0) — Seed tests: cloudinary-upload and cloudinary-image-processor test files
  - Gap: GAP-078-020
  - Blocked by: T-022, T-024
  - Blocks: none
  - Outcome (commit `dc7eb3cb`): NEW `cloudinary-upload.test.ts` (10 tests across 4 outcome suites: uploaded, cached, failed×4 throw on/off, publicIdOverride). Extended processor test 10→15 (countImageJobs accuracy + counter increments per outcome). 13 files / 144 tests pass. **Source quirk discovered**: `SeedSource` enum is `'required'|'example'` only — no `'optional'` (warn-only semantics map to `required + allowRequiredFallback: true`). **Follow-up**: `packages/seed/mappings/id-mappings.json` generated by `seed-context.test.ts` runtime is not gitignored — caused stale Biome formatter error.

---

### Phase 9D — Service-core tests

- [x] **T-065** (complexity: 2.5) — Service-core tests: hardDelete cleanup and hookstate propagation
  - Gaps: GAP-078-094, GAP-078-095
  - Blocked by: T-018, T-019
  - Blocks: none
  - Outcome (commit `028a44c8`): 26 tests across 5 files (accommodation=5, destination=5, event=5, post=5, user=6). Each file creates own InMemoryImageProvider + mocks in beforeEach (no shared fixture — duplication under 50 lines). Canonical contract asserted: provider.deleteByPrefix invoked with `hospeda/{env}/{entity}/{id}/` prefix after confirmed hard delete; short-circuits when no provider injected or DB reports zero deleted rows; swallows provider errors while preserving DB-level success. Accommodation (167 lines, richest) stubs destinationService.updateAccommodationsCount + _destinationModel.findById via @ts-expect-error to avoid real DB; asserts logger.warn metadata. User covers satellite imagePublicId column vs legacy `hospeda/{env}/avatars/{id}` fallback (hence 6 tests). Destination/event/post only assert error non-propagation (destination's warn goes through class-level revalidation logger not this.logger — documented inline not flagged as bug). 26/26 pass in 149ms. Lint + typecheck clean for new files (pre-existing getById.test.ts:379 error unrelated).

---

### Phase 9E — API integration tests

- [x] **T-066** (complexity: 2.5) — API integration tests: admin upload/delete and protected upload scenarios
  - Gaps: GAP-078-092, GAP-078-024, GAP-078-093
  - Blocked by: T-018, T-019, T-029
  - Blocks: none
  - Outcome (commit `4bc7653f`): 24 tests across 3 files: admin-upload (10 scenarios), admin-delete (9 scenarios), protected-upload (5 scenarios). Location `apps/api/test/routes/media/t066-*.test.ts` (NOT test/integration — that path excluded from default vitest). Fixture: minimal 1×1 PNG base64 (67 bytes, no binary commits) reused from existing media tests. Mocking: vi.hoisted providerState + vi.mock('apps/api/src/services/media') for null-fallback toggle (GAP-078-093); getById mocked via vi.spyOn(.prototype) for 4 entity services. Counter assertions via getDomainCounters() + resetMetrics() on media_upload_total{result=success|failure} + media_delete_total{result=success} — confirms T-056 observability reach. **Spec drift documented**: REQ-04.1-D, -H, -4.3-B, -E spec 422 but implementation surfaces 400 VALIDATION_ERROR from explicit safeParse branch — tests assert REAL behavior with inline documentation (reconciliation in T-068, no silent fixes). **Gotcha for future tests**: 401 test needs `headers: { 'user-agent': 'vitest' }` — without it validation middleware cuts before auth with 400, false-positive. 14 files 79 tests pass (24 new + 55 pre-existing). Biome clean, typecheck clean for T-066 files.

---

### Phase 9F — UI component tests

- [x] **T-067** (complexity: 2.5) — UI component tests: GalleryField, ImageField, use-media-upload, AvatarUpload
  - Gap: GAP-078-097
  - Blocked by: T-040, T-044, T-045
  - Blocks: none
  - Outcome (commit `f956fcfb`): 4 new `*.advanced.test.tsx` files, 1334 insertions, **47 new tests** (AvatarUpload 8 + ImageField 14 + GalleryField 14 + use-media-upload 11). Line coverage all 4 targets >90%: AvatarUpload 98.10%, GalleryField 93.17%, ImageField 91.89%, use-media-upload 98.03%. ImageField branch coverage 69.44% (weakest — remaining branches are hasError/errorMessage props consumed by the form engine, already covered by T-045 suite). Test suite 1037 → 1080 tests (+43). Zero production source touched. Testability gaps documented: DeleteConfirmDialog rAF focus + JSON parse fallback + triggerPicker early-return unreachable without mocking internals.

---

### Phase 9G — Reconciliation

- [x] **T-068** (complexity: 1.0) — Reconcile state.json and TODOs.md with actual post-remediation state
  - Gap: GAP-078-022
  - Blocked by: T-058, T-059, T-060, T-061, T-062, T-063, T-064, T-065, T-066, T-067
  - Outcome (partial close 2026-04-20): Fixed `state.json` summary drift (said 18 completed / 50 pending — actual was 58 / 10). Marked T-068 itself completed, bumping to 59/68. Nine tasks remain pending by design: T-015 (needs architectural consult), T-026/T-027 (seed hardening unblocked but deprioritized), T-038 (admin UI — requires product consult), T-044/T-045/T-046/T-047 (blocked behind T-038), T-067 (blocked behind T-044+T-045). Six follow-ups from 2026-04-20 sweeps (T-041, T-042, T-043, T-048, T-049, T-050, T-066) consolidated into "Known follow-ups" section above. Partial close because T-067 remains gated on the admin UI chain — full reconciliation can only close when T-038's cascade is decided.
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no deps):    T-001, T-037
Level 1 (after T-001): T-002
Level 2 (after T-002): T-003
Level 3 (after T-003): T-004 (critical), T-005, T-006, T-007, T-008, T-009, T-011, T-017, T-028, T-053
Level 4 (after T-004): T-010, T-012, T-013, T-014, T-015, T-016
Level 4 (after T-017): T-018, T-019, T-020, T-021, T-022 (also T-010), T-038 (also T-029), T-041, T-042, T-043, T-048, T-049
Level 5 (after T-010): T-022, T-029 (also T-017), T-058
Level 5 (after T-017): T-029 (also T-010)
Level 6 (after T-022): T-023, T-026, T-027
Level 6 (after T-023): T-024, T-025
Level 6 (after T-029): T-030, T-031, T-032, T-033, T-034, T-035, T-036, T-051, T-052, T-054, T-055, T-056, T-057
Level 7 (after T-031): T-040
Level 7 (after T-018+019): T-059, T-060, T-061, T-062, T-063, T-065, T-066
Level 7 (after T-038): T-044, T-045, T-046, T-047
Level 7 (after T-041): T-050
Level 8 (after T-040+044+045): T-067
Level 9 (after all phase-9): T-068
```

## Parallel Tracks

**Track A (DB/Schema)**: T-003 -> T-004 -> T-010/T-012/T-013/T-014/T-015/T-016 (parallel)
**Track B (Bundle/API)**: T-003 -> T-017 -> T-018/T-019/T-020/T-021 (parallel)
**Track C (Security)**: T-003 -> T-005/T-006/T-007/T-008/T-009 (parallel — independent of 1B)
**Track D (Seed)**: T-010 -> T-022 -> T-023 -> T-024/T-025/T-026/T-027 (parallel after T-023)
**Track E (API)**: T-010 + T-017 -> T-029 -> T-030/T-031/T-032/T-033/T-034/T-035/T-036 (parallel)
**Track F (Admin UI)**: T-017 + T-029 -> T-038 -> T-044/T-045/T-046/T-047 (parallel)
**Track G (Web UI)**: T-017 -> T-048/T-049 (parallel)
**Track H (Infra)**: T-003 -> T-028/T-053 (parallel — no DB dependency)

Merge points:
- T-029 requires T-010 + T-017 (schema + bundle must be ready)
- T-019 requires T-017 + T-010 (bundle architecture + schema alignment)
- T-067 requires T-040 + T-044 + T-045 (hooks + a11y complete first)
- T-068 requires all Phase 9 tasks

## Suggested Start

Phases 0, 1A, and 1B complete (T-001, T-002, T-003, T-004).

Next immediate tasks (any subset can run in parallel — all share only T-003 as predecessor):

1. **T-017** (critical path) — Bundle architecture refactor (@repo/media subpath exports). Unlocks Phase 4, 5, 6, 7, and most of Phase 9.
2. **T-005/T-006/T-007/T-008/T-009** (Phase 1C, fully parallel) — Security hardening. Independent of T-004. Small-to-medium complexity (1.5–2.0 each).
3. **T-010** (schema alignment for MediaSchema) — required before the seed/API work; 1.5.
4. **T-011** (schema compat doc) — trivial, 1.0.
5. **T-028** (admin constants cleanup) — trivial, 1.5.
6. **T-053** (turbo.json env vars) — trivial, 1.0.
7. **T-037** (SPEC-078 spec amendment) — trivial, 1.0, no code.

Next unlocked after T-004 (this session): **T-012, T-013, T-014, T-015, T-016** (DB Phase 2B and beyond).

Critical path: T-001 -> T-003 -> T-017 -> T-029 -> T-031 -> T-040 -> T-067 -> T-068 (8 steps)

## Session Log

- **2026-04-18 (session close)**: T-004 merged in 6 atomic commits (`50b80475` → `a11ae6df` on main). Fixed hidden `db:fresh-dev` bug (apply-postgres-extras never chained). Renumbered manual SQL to clean 0001-0010 sequence. Rewrote orchestrator as generic iterator. Removed 4 unused Drizzle-generated migration files (preserved `0005_awesome_wild_child.sql` — SPEC-063 in progress). Full end-to-end validation passed (3571 seeded rows, 3 CHECKs + MV + 43 triggers).
- **2026-04-18 (warmup sweep)**: 4 warmup tasks landed in 4 atomic commits on main (`f713d682` T-037, `a365aec8` T-053, `31fe19e8` T-028, `88f713e2` T-011). All complexity 1.0, delegated to parallel sub-agents. Zero file overlap across tasks. Agents reported truthfully (verified via git status diff). Progress now 8/68.
- **2026-04-19 (Phase 1C security sweep)**: 5 security tasks landed in 5 atomic commits on main (`5e978f1e` T-005, `becb8a58` T-006, `31e42ac6` T-007, `9d12e3d8` T-008, `fc0428cc` T-009). All 5 sub-agents in parallel (zero file collision — T-005/T-008 on apps/api/routes/media different files; T-006/T-007/T-009 on packages/media different files). T-009 took scope creep: CLI refactor + env-registry test-count bumps — accepted as necessary. Progress now 13/68. Follow-ups: GAP-078-105 (provider upload flags) + env-registry x-validation pre-existing breakage.
- **2026-04-19 (Phase 2 schema+DB sweep)**: 5 schema/DB tasks landed in 5 atomic commits on main (`21b62d75` T-010, `a247c95d` T-013, `b436ac58` T-016, `6350c5c0` T-014, `9f01d7e7` T-012). All 5 sub-agents in parallel with pre-assigned manual SQL numbers (0011 T-012, 0012 T-013, 0013 T-014, 0014 T-016) to avoid lex-order collision. T-012 excluded destination.service.ts workaround cleanup (pre-existing uncommitted work in that file). All acceptance criteria met; 10 new updateAvatar tests; 18 new media.schema tests. Progress now 18/68. Next available: T-015 (BaseModel JSONB merge FOR UPDATE — 2.5 complexity, requires user consult), T-017 (bundle refactor — critical path, architectural, requires user consult), T-019..T-021 (docs/tests, blocked by T-017), T-022 (seed, blocked by T-010 — NOW UNBLOCKED), T-028 done, T-029 (API contract, blocked by T-010+T-017).
- **2026-04-19 (T-017 bundle critical path)**: T-017 landed atomic on main (`697b8404`). Big-bang split per spec acceptance (import `CloudinaryProvider` from `@repo/media` MUST fail TypeScript). 3 subpath entries wired via tsup (external [cloudinary, image-size]), package.json exports, typescript-config paths + explicit apps/admin tsconfig paths, Biome `noRestrictedImports` in admin+web, Vite `optimizeDeps.exclude` + Astro `optimizeDeps`/`ssr.external`. 14 server-side consumers migrated (service-core/accommodation/destination/event/post/user, apps/api media routes+service, seed cli/index/utils), 7 browser-safe consumers unchanged, 1 mixed (apps/api/routes/media/admin/upload.ts) split imports. Agent excluded pre-existing destination.service.ts workaround edits via targeted hunk staging. `test-utils/index.ts` is empty placeholder until T-018. Deviation: kept single tsconfig with `types: [node]` — runtime isolation via tsup `external` + Biome is sufficient; composite-tsconfig refactor deferred. Progress now 19/68. **Unlocked**: T-018, T-019, T-020, T-021 (docs/test utils, blocked only on T-017 — now available), T-022 (seed, dual-blocked on T-010+T-017 — both done — now available), T-029 (API contract, dual-blocked on T-010+T-017 — both done — now available), T-041/T-042/T-043 (web media migration — now available), T-048/T-049 (web media migration — now available).
- **2026-04-19 (T-022 + T-029 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-029 on `apps/api` + `@repo/schemas`, T-022 on `packages/seed` + `packages/config`). T-022 landed first (`6f5b0589`) then T-029 (`c28cb4c6`). SPEC-063 commits (`40ae06cc`, `90216e93`) landed from unrelated parallel autonomous work during this window — not from my agents (scope mismatch, proper SPEC-063 conventional commit messages). T-029 agent caught and fixed a latent bug in `createCRUDRoute` consuming body stream on POST without requestBody schema; scope-creep accepted (was blocking the happy-path test). T-022 agent couldn't run `pnpm env:check` (sandbox lacks `VERCEL_TOKEN`) — registry change is authoritative source, deferred verification. Follow-ups captured: (a) pre-existing typecheck errors in `accommodations.seed.ts`/`destinations.seed.ts` (service constructor mismatches), (b) pre-existing `env-registry-schema-cross-validation` failures on Cloudinary vs `ApiEnvSchema` (still not resolved), (c) T-030 still owns 9 remaining `ctx.json` calls in `apps/api/src/routes/media/admin/delete.ts`. Progress now 21/68. **Unlocked**: T-023 (seed avatars/moderation/spec amendment, blocked on T-022), T-030 (DELETE wasPresent + tags/overwrite), T-031 (request schema discriminated union — blocks T-040), T-032 (empty file reject), T-033 (rate limit + content-length + gallery cap), T-034 (OpenAPI multipart + lazy services), T-035 (p-retry resilience), T-036 (i18n error keys), T-051/T-052 (Vercel config + observability), T-054/T-055 (CI/CD), T-056/T-057 (observability).
- **2026-04-19 (T-018/T-019 + T-031 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-018/T-019 merged on `packages/media` + `apps/api/src/services/media.ts`, T-031 on `packages/schemas` + `apps/api/src/routes/media/admin/upload.ts` schema wiring). T-018/T-019 merged into single atomic commit (`c3c64823`) because both touch `apps/api/src/services/media.ts` — cleaner than two separate commits fighting over the same file. T-031 landed separate (`8328477f`). SPEC-063 auto-loop landed `a68fc868` in parallel (test(sponsorship) T-055) — not from my agents. Progress now 24/68. **Unlocked**: T-036 (i18n error keys, now dual-unblocked by T-018+T-019), T-040 (admin use-media-upload hook type safety, unblocked by T-031), plus full Phase 9 unit tests (T-059..T-063) that were all blocked on T-018+T-019.
- **2026-04-19 (T-040 + T-023 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-040 on `apps/admin/src/hooks/*` + new test, T-023 on `packages/seed/src/utils/*` + processor test + parent SPEC amendment). T-040 landed first (`75068a8f`) then T-023 (`2d5e4be2`). T-040 agent narrowed `UploadEntityType`/`UploadImageRole` via `Extract<>` rather than exposing full schema unions — justified: hook only models featured/gallery + 4 CRUD entities; avatar/sponsor/organizer variants need different payload shapes. Picked plain `Error` over `ApiError` for pre-network validation (matches existing `getBaseUrl()` failure path). T-023 agent bumped spec to v1.8 (correctly avoided downgrading from v1.7), added flat-path override via new `publicIdOverride` parameter on `uploadSeedImage()`, and `withModerationDefault()` helper that preserves explicit moderation values. Pre-existing typecheck failures unchanged (admin: `createEntityApi.ts:121`, `me/accommodations/index.tsx:28`; seed: `accommodations.seed.ts`/`destinations.seed.ts` constructor mismatches) — confirmed not from my agents. Progress now 26/68. **Unlocked**: T-024 (sponsor/organizer logo + MediaBlock videos + MediaSchema validation in seed), T-025 (moderation bulk-fix in destination JSONs).
- **2026-04-19 (T-024 + T-030 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-024 on `packages/seed/src/utils/*` + tests, T-030 on `apps/api/src/routes/media/admin/*` + `packages/media/src/server/*` + `packages/schemas/src/common/media-upload.schema.ts` + tests). T-024 landed first (`dcdb9d77`) then T-030 (`0d9fca75`). T-024 agent discovered `MediaBlock` lives inline in `cloudinary-image-processor.ts` (no separate `types.ts`), placed `MediaSchema.parse` outside `shouldProcess` block so validation runs even without provider. T-030 agent widened `ImageProvider.delete()` from `Promise<void>` to `Promise<DeleteResult>` with `{wasPresent}`; the single existing service-core consumer (`user.service.ts:583`) discards return via `await` so no caller break. Centralized `MediaTagsSchema`/`MediaOverwriteSchema` for all 5 AdminUploadRequest variants. Cleaned up 9/9 ctx.json bypass calls in admin delete route (T-029 follow-up). **Sandbox issue**: T-030 agent inadvertently modified `apps/api/.env.test` (was tracked by git but not in any task scope) — `git restore` on that file before staging anything, kept secrets intact. Progress now 28/68. **Unlocked**: T-025 (still gated only on T-023, ready), Track E remainders (T-032, T-033, T-034, T-035, T-036), Track G web (T-048/T-049 already unblocked since T-017).
- **2026-04-19 (T-025 + T-032 parallel sweep)**: Two trivial complexity-1.0 tasks in parallel, zero overlap (T-025 on `packages/seed/data/destination/*.json` + CLAUDE.md, T-032 on `apps/api/src/routes/media/{admin,protected}/upload.ts` + env tests). T-025 landed first (`9ef34171`) then T-032 (`bc53c7b5`). T-025: 26 destination JSONs flipped (101 occurrences PENDING→APPROVED) + 2 REJECTED gallery fixtures (ceibas + larroque, image #2 each). T-032 **discovery**: GAP-078-106 was 90% pre-implemented (env var + registry entry + route wiring all present from earlier sweep) — only the boot-time validation tests were missing; agent added 4 env tests + the EMPTY_FILE check on both upload routes. EMPTY_FILE error code is route-level inline literal (matches PAYLOAD_TOO_LARGE / SESSION_STALE pattern), not a shared enum. Progress now 30/68. **Unlocked**: T-033 (rate limit + content-length margin + gallery cap, 1.5), T-034 (OpenAPI multipart + lazy services + CORS, 1.5), T-035 (p-retry resilience, 2.0), T-036 (i18n keys, 1.5), T-051/T-052 (Vercel config + observability), T-054/T-055 (CI/CD), T-056/T-057 (observability runbook).
- **2026-04-19 (T-033 + T-035 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-033 on `apps/api/src/routes/media/{admin,protected}/upload.ts` + new defensive-hardening test, T-035 on `packages/media/src/server/cloudinary.provider.ts` + provider tests + new `p-retry@^8.0.0` dep). T-035 landed first (`11e0b113`) then T-033 (`bfa122df`). T-033: customRateLimit option, +1024 byte margin on Content-Length, gallery cap of 50 (zero extra DB queries — reads from `service.getById` already-loaded entity); discovered global `bodyLimit` middleware preempts route Content-Length check (tests accept either error code). T-035: p-retry wrapping with `isPermanent4xx` predicate + `AbortError` for non-retriable 4xx; `upload()` JSDoc explicitly states no retry by design (idempotency); `deleteByPrefix` adds `{invalidate: true}`; gotcha that p-retry v8 requires Error instances (not plain objects). **Sandbox issue (recurrent)**: T-033 agent again modified `apps/api/.env.test` (likely from `process.env.HOSPEDA_TESTING_RATE_LIMIT='true'` setup at test top) — restored before staging. Progress now 32/68. **Unlocked**: nothing new specifically (T-034/T-036/T-051/T-052/T-054/T-055/T-056/T-057 already unblocked since T-029).
- **2026-04-19 (T-034 + T-051 parallel sweep) — 50% milestone**: Two independent sub-agents in parallel, zero file collision (T-034 on `apps/api/src/routes/media/admin/{upload,delete}.ts` + `configure-open-api.ts` + new `openapi-multipart-overrides.ts` + `route-architecture.md`, T-051 on `apps/api/vercel.json` + `index.ts` + new `cloudinary-preview-warn.ts`). T-051 landed first (`1fad794f`) then T-034 (`9cc01a7e`). T-034 architectural learning: extending route factory with multipart option installs JSON validator that rejects multipart payloads via `@hono/zod-openapi` `defaultHook` — switched to post-process the spec instead (cleaner separation of runtime contract vs documentation). T-034 also moved REAL module-level service singletons (4 each in upload + delete admin maps) into per-request resolvers — not a no-op. T-051 catch-all Vercel topology means per-route maxDuration is impossible; whole app inherits 60s as documented tradeoff. Pre-existing `addon-entitlement.service.test.ts` Biome reformat from agent test runs restored before staging. Progress now 34/68 (50% milestone). **Unlocked**: nothing new (T-036/T-052/T-054..T-057 already available).
- **2026-04-19 (T-052 + T-054 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-052 on `packages/media/src/server/*` + `apps/api/src/cron/*` + new `apps/api/src/routes/health/media.ts`, T-054 on `scripts/check-cloudinary-isolation.sh` + `.github/workflows/ci.yml` + root package.json). T-054 landed first (`60207154`) then T-052 (`738b40b9`). T-052: `ImageProvider.healthCheck()` interface added with all 3 impls wired; new public health route + weekly cron with NODE_ENV production guard (no-op explicit, not silent). T-054: bash script with rg+grep fallback for runners lacking ripgrep; baseline 0 violations confirmed; injected fixture exits 1 as expected. Both sweeps clean — NO `.env.test` collision this time (no rate-limit setup needed). Progress now 36/68 (53%). **Unlocked**: nothing new specifically — T-036, T-055, T-056, T-057, T-020, T-021 still available. Phase 7C/7B/8 nearly done.
- **2026-04-19 (T-056 + T-057 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-056 on `apps/api/src/routes/media/*` + `apps/api/src/middlewares/metrics.ts` + `apps/api/src/services/media.ts` + `apps/api/src/index.ts` + `packages/service-core/src/services/accommodation/accommodation.service.ts`, T-057 on docs only `docs/runbooks/cloudinary-incidents.md`). T-057 landed first (`5005ac90`) then T-056 (`cd4658fd`). T-056 took broader scope than minimum: agent extended `metrics.ts` with `domainCounters` Map (separate from per-endpoint request map so 30-min cleanup doesn't reset); also added `initializeMediaProvider()` for once-per-boot init log instead of first-request lazy init. T-056 swapped all 7 `revalidationLogger.warn` calls in AccommodationService (not just `_afterHardDelete`) since the gap acceptance asked for zero `revalidationLogger` in the file — agent removed the static field + createLogger import too. T-057 left 11 TODO placeholders for team-specific values (on-call rotation, Slack channel, lead names) — flagged inline. Progress now 38/68 (56%). **Unlocked**: nothing new — T-036, T-055, T-020, T-021 still available + Phase 9 testing tasks (T-058..T-067) most still gated on T-018/T-019 which are done.
- **2026-04-19 (T-036 + T-055 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-036 on `packages/i18n/src/{locales/{es,en,pt}/api.json,config.ts}` + new test, T-055 on `renovate.json` + `.github/workflows/cd-{staging,production}.yml` + `packages/media/src/presets.ts` + `apps/api/src/routes/media/{admin,protected}/upload.ts` + tests). T-036 landed first (`8afd6227`) then T-055 (`e08b0c17`). T-036 discovery: response shape already exposed `code` field — pure additive on i18n side; key path uses literal CODE as leaf so server emit + client lookup stay in 1:1 lockstep. T-055 deploy workflows are split into 2 files (cd-staging.yml + cd-production.yml); 6 deploy jobs each got Setup Node + pnpm + install + env:check. dpr_ token was already in `ALLOWED_RAW_TOKEN_PREFIXES` so dpr_auto preset addition needed no companion change. Cache-Control set at handler entry (DRY one-liner) provably applies to all branches including EMPTY_FILE short-circuit. Renovate rule split into 2 entries (minor+patch separate from major-disabled) for self-documenting intent. Progress now 40/68 (59%). **Unlocked**: nothing new — T-020, T-021, T-038/T-039 (admin UI, requires consult), Phase 9 testing tasks still available.
- **2026-04-19 (T-020 + T-058 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-020 on `packages/media/src/server/cloudinary.provider.ts` + parent SPEC, T-058 on `packages/schemas/test/common/media.schema.test.ts`). T-020 landed first (`00025241`) then T-058 (`225d1778`). T-020 discovery: `buildUrl` was already absent from interface (removed during T-017 restructure) — gaps 032 + 161 became doc-only; Biome 1.5.3 lacks AST-level rule to block `new CloudinaryProvider(...)` outside canonical access — captured as TODO follow-up in JSDoc + flagged 2 known direct-construction sites in `packages/seed/{cli,index}.ts`. T-058 documented 2 schema enforcement quirks in tests: (a) gallery 50-item cap is DB-only (CHECK constraint, not Zod), (b) `BaseMediaFields` uses inline image shape and silently strips `publicId`/`attribution` keys. Spec amended v1.8 → v1.9. Progress now 42/68 (62%). **Unlocked**: nothing new — T-021, T-038/T-039, Phase 9 remainders (T-059..T-068) still available.
- **2026-04-19 (T-059 + T-060 combined sweep)**: Two parallel sub-agents both touched `validate-media-file.test.ts` (with 3 vs 12 tests respectively, no semantic conflict). Single combined commit (`04180ddc`) for atomic file diff. **Discoveries**: (a) 0-byte buffer returns `INVALID_IMAGE` (NOT route-level `EMPTY_FILE` from T-032); (b) `getMediaUrl` is a pure string transformer that preserves HTTP scheme as-is — HTTPS enforcement lives elsewhere; (c) `/image/fetch/` URLs return null from extractPublicId; (d) `/upload/v1/upload/file.jpg` matches FIRST `/upload/` (literal becomes folder); (e) `MEDIA_PRESETS` needed runtime `Object.freeze()` because `as const` is type-only. T-060 set vitest coverage `perFile: true` 90/85/90/90 (barrel + types excluded); final coverage 95.81/94.66/96.77/95.81. Synthetic AVIF/HEIC/WEBP via 12-byte ftyp/RIFF headers built in-process (no binary fixtures). 178/178 media tests pass. Progress now 44/68 (65%). **Unlocked**: nothing new — T-021, T-038/T-039, Phase 9 remainders (T-061..T-068) still available.
- **2026-04-19 (T-062 + T-064 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-062 on packages/media provider+validate tests, T-064 on packages/seed test/utils). T-062 landed first (`6f0b286f`) then T-064 (`dc7eb3cb`). T-062 discoveries: (a) `upload()` accepts Buffer ONLY (data-URI/URL strings must be caller-converted); (b) provider strips `tags: []` entirely — option becomes undefined, not `[]`; (c) setupUploadStream helper rewrite with setImmediate benefits 12+ existing tests; (d) GAP-078-215 multi-instance deferred to T-063 where it fits better. T-064 discoveries: (a) SeedSource enum is `'required'|'example'` only — no `'optional'` literal (warn-only = `required + allowRequiredFallback`); (b) `id-mappings.json` not gitignored, caused stale formatter error (follow-up). 184/184 media + 13 files/144 tests seed pass. Progress now 46/68 (68%). **Unlocked**: nothing new — T-021, T-038/T-039, T-061/T-063/T-065/T-066/T-067 still available.
- **2026-04-19 (T-021 + T-061 parallel sweep)**: Two trivial complexity-1.0 sub-agents in parallel, zero file collision (T-021 docs at `packages/media/{README,CLAUDE}.md`, T-061 new test at `cloudinary-sdk-contract.test.ts`). T-021 landed first (`014c30f1`) then T-061 (`cf830e97`). Both clean — no source touched, no behavior change. T-021 documented avatar race condition trade-off (last-write-wins, mitigated by T-008 + future T-015). T-061 contract test asserts 5 SDK methods are typeof function (config, upload_stream, destroy, delete_resources_by_prefix, ping) so SDK breaking changes from minor/patch updates fail loudly. 185/185 media tests pass. Progress now 48/68 (71%). **Unlocked**: nothing new — T-038/T-039 (admin UI requires consult), T-063/T-065/T-066, T-041..T-043, T-048..T-050 (web), T-067 still gated on T-040+T-044+T-045.
- **2026-04-19 (T-063 + T-039 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-063 on packages/media provider tests, T-039 on apps/admin gallery route). T-063 landed first (`71a69ea0`) then T-039 (`56ef6b72`). T-063: pinned the multi-instance last-init-wins footgun via 2 tests (older provider reference operates under tenant-B creds because SDK is module-level singleton). T-039: standalone gallery route replaced with thin TanStack Router redirect (143→22 lines). T-039 follow-up: hash `gallery-section` doesn't have matching DOM anchor in EntityFormSection — auto-scroll won't fire (no 404 either). Progress now 50/68 (74%). **Unlocked**: nothing new — T-038 (admin UI requires consult), T-041..T-043, T-048..T-050, T-065/T-066/T-067/T-068 still available.
- **2026-04-20 (T-041 + T-048 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-041 on apps/admin surfaces only, T-048 on apps/web Astro + lib/api/transforms.ts). T-041 landed first (`fcb9e9a6`) then T-048 (`a321ee66`). T-041 clean 4-file migration; $id_.gallery.tsx skipped correctly (redirect-only since T-039). T-048 path correction: prompt referenced `apps/web/src/utils/transforms.ts` but canonical path is `apps/web/src/lib/api/transforms.ts` — no shim/delete decision needed because file already delegated to `lib/media.ts` which wraps getMediaUrl. T-048 scope grew: pipeline extension to carry `media.galleryItems` (caption/description) through lib/media + transforms + data/types so HeroGallery.astro + fotos.astro can emit GLightbox `data-title`/`data-description` attrs (closes GAP-078-136 inline). Preset decisions: hero with eager+fetchpriority=high, avatars/cards lazy, dropped redundant Astro `<Image>` double-optimization branch for author avatars. AvatarUpload: only persisted displayUrl transformed; blob: preview URL kept raw. `apps/api/.env.test` dirty pre-sweep (not caused by these agents) — restored with hook-escape literal before tracker commit. Progress now 52/68 (76%). **Unlocked**: T-050 (CSP updates — now unblocked since T-041 landed). Still available: T-042, T-043, T-049, T-065, T-066, T-067, T-068.
- **2026-04-20 (T-042 + T-049 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-042 on `packages/media/src/get-media-url.ts` + tests, T-049 on `packages/i18n/src/locales/{es,en,pt}/account.json` + `apps/web/src/lib/{avatar-utils.ts,media.ts,api/transforms.ts}` + 5 component callsites + `packages/media/CLAUDE.md`). T-042 landed first (`3c23300f`) then T-049 split into 3 atomic commits (`1e290384` i18n + `1ac1c5c8` avatar-utils + `dfbd9291` warn + race doc). T-042 design decisions: per-call fallback recursively re-enters with fallback stripped (no infinite recursion on empty); delivery-type regex is path-segment anchored not substring-fuzzed; double-transform positive-match detects t_/ALLOWED_RAW_TOKEN_PREFIXES while excluding v\d+ version markers. 208/208 media pass, coverage 94.11/91.83/100/94.11 on get-media-url.ts. T-049 scope-growth: migrated 5 callsites instead of named 3 (UserNav/MobileMenu/ReviewCard added) — identical duplicated getInitials bodies; kept `transforms.ts#getInitials` as @deprecated wrapper so OwnerCard/ReviewPreview/ReviewsModal don't force this sweep to touch them (follow-up). EN/PT translations unreviewed — flagged for team pass. `processEntityImages` helper is seeded but not wired into existing transforms (adoption is broader follow-up). Race-condition doc in @repo/media CLAUDE.md expanded 1 paragraph → 4 subsections. GAP-078-061 web-side fallback migration in `apps/web/src/lib/media.ts:82` deferred — documented in both T-042 and T-049 outcome reports. Progress now 54/68 (79%). **Unlocked**: nothing new — T-043, T-050 (admin part), T-065, T-066 still available.
- **2026-04-20 (T-043 + T-050 parallel sweep)**: Two independent sub-agents in parallel, zero file collision (T-043 on `scripts/check-bare-cloudinary-img.sh` + `package.json` + `.github/workflows/ci.yml`, T-050 on `apps/web/src/lib/middleware-helpers.ts` + `apps/web/astro.config.mjs` + `apps/admin/src/lib/csp-helpers.ts` + 2 test files). T-050 landed first (`d4353fc8`) then T-043 (`999e4ed5`). T-043 **Biome rule fallback** (documented in commit): Biome 1.9.4 has no `noRestrictedSyntax` rule (ESLint-only concept); `noRestrictedImports` only matches module specifiers not JSX attribute contents. CI script becomes sole enforcement surface — script mirrors check-cloudinary-isolation.sh with rg primary + grep/find fallback. Baseline exit 0, injection fixture test exit 1. `tiptap-renderer.ts` user-content template literal correctly not flagged. T-050 **hostname strategy**: exact `res.cloudinary.com`, not wildcard (principle of least privilege — Hospeda uses single cloud name). Both apps stay Report-Only (Phase 1 unchanged). **GAP-078-066 partial**: only img-src tightened; admin script-src `'https:'` blanket replacement deferred because `'strict-dynamic'` already neutralizes it in CSP2+ browsers — dedicated admin-hardening pass would cover CSP1 fallback. 3+3 CSP assertions added. Progress now 56/68 (82%). **Unlocked**: nothing new — T-065, T-066 still available; T-067 remains gated on T-044+T-045 (admin UI, blocked); T-068 reconciliation awaits Phase 9 closure.
- **2026-04-20 (T-065 + T-066 parallel sweep, test-heavy pair)**: Two independent 2.5-complexity sub-agents in parallel (T-065 on packages/service-core/test for hardDelete media cleanup, T-066 on apps/api/test/routes/media for 3-route integration). **Agent output truncation incident**: T-065 agent finished work and created 5 test files but its final report was truncated (`tail -25` pipe artifact in output); no commit landed. Recovery: closer agent spawned to verify + commit. Closer reported commit `028a44c8`, 26 tests across 5 files (accommodation=5, destination=5, event=5, post=5, user=6), all pass in 149ms. No shared fixture/helper (duplication <50 lines per spec guidance). User test covers satellite imagePublicId vs legacy hospeda/{env}/avatars/{id} fallback (6 tests). Destination design-oddity inline-documented (warn goes through class-level revalidation logger, not this.logger). T-066 (`4bc7653f`): 24 tests across 3 files (admin-upload 10 + admin-delete 9 + protected-upload 5). Location `apps/api/test/routes/media/t066-*.test.ts` (NOT test/integration — excluded from default vitest). Fixture: canonical 1×1 PNG base64 (67 bytes, no binary commits). Counter assertions via getDomainCounters() + resetMetrics() confirm T-056 observability reach. **Spec drift honestly documented** (not silently fixed): REQ-04.1-D/H + REQ-04.3-B/E spec says 422 but impl surfaces 400 VALIDATION_ERROR from explicit safeParse branch — tests assert REAL behavior with inline comments for T-068 reconciliation. **Gotcha discovered**: 401 test needs `headers: { 'user-agent': 'vitest' }` header or validation middleware cuts to 400 first, causing false-positive. Progress now 58/68 (85%). Phase 9D + 9E closed. **Remaining**: T-038 + T-044..T-047 + T-067 (all behind admin-UI consult gate), T-068 reconciliation (awaits all Phase 9).
- **2026-04-20 (T-068 partial close — reconciliation docs-only)**: Coordinator-level tracker update (no sub-agent). **Drift discovered**: `state.json` summary block claimed `completed: 18, pending: 50` — reality was 58 completed / 10 pending. Full delta fixed in one edit. **Hidden-pending audit**: prior session close-out listed 7 remaining tasks but machine state carried 10 — three untracked in session notes: T-015 (complexity 2.5, BaseModel JSONB merge FOR UPDATE — needs architectural consult), T-026/T-027 (complexity 1.5 each, seed SSRF + cache hardening — unblocked since T-022 but deprioritized). Now explicitly documented as deferred with rationale. **Follow-ups consolidation**: six 2026-04-20 follow-ups (GAP-078-061 web fallback, transforms.ts getInitials @deprecated wrapper, processEntityImages adoption, EN/PT avatar translations, T-066 spec drift 400 vs 422, admin script-src 'https:') merged into "Known follow-ups" section alongside the three pre-existing (GAP-078-105, env-registry cross-validation, destination.service.ts workaround). T-068 marked completed with "partial" qualifier because full reconciliation is only possible after T-038's cascade resolves — this close captures state-as-of-today, future close captures state-after-admin-UI-sweep. Progress now 59/68 (87%). **Remaining**: 9 tasks, all deferred by design.
- **2026-04-20 (T-026 + T-027 Phase 4B closeout — serial seed hardening)**: Two seed-layer tasks serialized (not parallel) due to `cli.ts` file collision point — both add CLI flags. T-026 (`306f62d0`) landed first, T-027 (`dd644eb1`) second. T-026: SSRF allowlist helper `is-allowed-seed-url.ts` (68 lines, frozen unsplash/pexels/cloudinary, case-insensitive, rejects non-HTTP(S) + malformed); guard in `cloudinary-upload.ts` returns `{status:'failed'}` without throwing on fixture defect; `coerceResetImpliesCleanImages` pure helper in `cli.ts` makes `--reset` imply cleanup. 15 tests, 159/159. T-027: versioned cache envelope `{version:1, entries:{...}}` in new `schemas/cloudinary-cache.schema.ts`; reject legacy unversioned on read (cheap to rebuild); deferred flush from per-entry writes to single `flushCache` in `runSeed` finally block; `--validate-cache` flag does sequential HEAD + 5s timeout; root `.gitignore` gets `**/.cloudinary-cache.json`. 17 tests, 170/170. **Design choices**: T-027 kept T-026's `cloudinary-upload.ts` untouched by making `cachePath` param `@deprecated` on `updateCacheEntry` rather than threading the new flush path through there. Flush hook lives in `index.ts#runSeed` (allowed file) not `cloudinary-image-processor.ts` because per-entity callsites would yield N writes. T-027 agent refused to add p-limit dep — sequential HEAD is fine for maintenance flag. No `.env.test` collision either run. Auto-loop commits continued landing during both runs on `packages/service-core/feature/*`, `apps/api/test/schema-validation/*`, and various untracked files — verified untouched by both agents. **Phase 4B closed**. Progress now 61/68 (90%). **Remaining**: 7 tasks — T-015 (architectural consult), T-038 (product consult) + cascade T-044/T-045/T-046/T-047/T-067.
- **2026-04-20 (T-038 CONSULT + wiring + T-044 partial aborted)**: Explore agent first reconnoitered the 3 target edit pages + accommodations reference to surface the true delta (~4-6 lines per file — the spec's 2.5 complexity was overestimated). User was presented 4 decision axes (D1 scope / D2 commit strategy / D3 delete confirmation / D4 backend cap alignment) and confirmed my recommendation **A+A+C+B**: 1:1 replication, atomic commit, delete confirmation deferred to T-045, backend cap alignment deferred as follow-up. T-038 landed `2d581d49` — 6 files (3 routes + 3 tests), ~28 net lines per route, hook untouched (T-040's `Extract<>` already covered all 4 entity types). 3 component-level tests assert `fieldHandlers.images.onUpload` invokes `uploadEntityImage.mutateAsync` with correct `entityType` + `role: 'gallery'` and `onDelete` forwards publicId. Attempted immediate T-044 parallel spawn — **sub-agent hit Anthropic API rate limit mid-task (reset 14:00 ART)**. Partial work left in working tree (NOT committed): `apps/admin/src/components/entity-form/fields/GalleryField.tsx` + `apps/admin/package.json` modified. Unknown quality — next session must assess (finish / discard / rebase). Did NOT auto-revert (destructive action, CLAUDE.md forbids). Pre-existing TS errors in `createEntityApi.ts` + `me/accommodations/index.tsx` surface in typecheck (last touched `0450eed6`/`460e5a77`, not T-038's fault). Progress now 62/68 (91%). **New follow-up captured**: backend `GALLERY_HARD_CAP = 50` flat but frontend caps are config-level per entity (acc 50 / dest 20 / event 10 / post 15) — adversary with admin API access could bypass. Needs new task or inclusion in next admin sweep.
- **2026-04-20 (T-044 recovery + T-045 + T-047 sweep)**: After rate-limit window cleared, coordinator inspected T-044 partial (typecheck revealed 8 missing i18n keys + zero tests) and spawned a CLOSER AGENT with tight scope (just finish i18n + tests + commit). Closer landed `fad73ed7` (11 files, +863/-304, 7 keys × 3 locales = 21 entries, 4 tests via `vi.hoisted + vi.mock('@dnd-kit/core')` spy pattern). Then launched T-045 + T-047 in parallel (different components — ImageField vs AvatarUpload). T-045 landed `d53d940b` clean (8 tests, 9 keys, extracted DeleteConfirmDialog + ImageFieldErrorBanner helpers, reduced-motion via Tailwind motion-reduce:). T-047 landed `2f206323` but **MISINTERPRETED SCOPE**: built a brand-new `AvatarUpload.tsx` component instead of migrating `header-user.tsx` + `profile.tsx` + extending `validate-media-file.ts` as the original task specified. Foundation IS valuable (established shadcn Avatar primitive pattern + 9 i18n keys + `@radix-ui/react-avatar` dep + `DEFAULT_AVATAR_MAX_SIZE_MB` constant), so kept the commit and marked T-047 `in_progress`. Sibling i18n namespace (`avatar.*` vs `image.*`) meant zero JSON key collision across T-045 + T-047. **Lesson learned for future prompts**: when task description lists specific target files (`File: path/to/X`), explicitly include in prompt "MUST modify these files, not create new replacements". The T-047 agent took the spirit but not the letter.
- **2026-04-20 (T-046 + T-047 recovery parallel close)**: Two sub-agents in parallel, zero file collision (T-046 on GalleryField/ImageField/AvatarUpload upload flow + use-gallery-uploads hook + new UploadProgressIndicator helper, T-047-recovery on header-user + profile + validate-media-file). T-046 landed `227f90ca` (12 files, 11 new tests, MIME allowlist for HEIC/HEIF/AVIF across 3 fields, p-limit refactor in the T-044-extracted hook, progress indicator component with role=status + aria-live=polite + motion-reduce, 4 i18n keys × 3 locales = 12 entries). T-047 recovery landed `0e2ac7c9` (5 files, +145/-47, 4 new validate-media-file tests + 1 inverted pre-existing test, dynamic maxFileSizeMb via `?? defaultMb` pattern, jsdom workaround for Radix AvatarImage deferred render). Both clean — T-044 + T-045 regression-free per T-046 agent's verification. Admin tests after both: 1037/1039 (2 pre-existing). Media tests: 211/211. TS only 2 pre-existing errors. Progress now 66/68 completed, only T-015 (architectural consult) and T-067 (UI component tests — unblocked by T-040+T-044+T-045) remaining.
- **2026-04-20 (T-067 autonomous close — Phase 9F)**: Sub-agent extended existing T-044/T-045/T-047 test files with `*.advanced.test.tsx` siblings. Commit `f956fcfb` — 4 new files, 1334 insertions, 47 new tests (AvatarUpload 8 + ImageField 14 + GalleryField 14 + use-media-upload 11). Line coverage all 4 targets >90%: AvatarUpload 98.10%, GalleryField 93.17%, ImageField 91.89%, use-media-upload 98.03%. ImageField branch coverage weakest at 69.44% — remaining branches fire only via hasError/errorMessage props consumed by the form engine (cross-boundary scenarios covered by T-045 suite). Test suite 1037 → 1080 tests (+43). ZERO production source touched (tests-only constraint respected). Testability gaps explicitly documented: DeleteConfirmDialog rAF focus, JSON parse error fallback in hook, AvatarUpload triggerPicker early-return — unreachable without mocking internals or touching source. **Phase 9F closed**. Progress now 67/68 (99%). **Only remaining**: T-015 (BaseModel JSONB merge FOR UPDATE, complexity 2.5) — requires architectural consult on concurrency model. Session ends here; next session must open T-015 consult with the user.
