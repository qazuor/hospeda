# SPEC-078-GAPS: Cloudinary Image Management — Gaps Remediation

## Progress: 21/68 tasks (31%)

**Average Complexity**: 1.7 / 2.5 (max)
**Completed from prior work**: 3 tasks (Phase 0 + Phase 1A) — see already-done.md
**Completed 2026-04-18 (previous session)**: 1 task (T-004 — Phase 1B migrations reconstruction)
**Completed 2026-04-18/19 (current session)**: 17 tasks — 4 warmups (T-011, T-028, T-037, T-053) + 5 Phase 1C security (T-005..T-009) + 5 schema/DB Phase 2 (T-010, T-012, T-013, T-014, T-016) + T-017 (bundle architecture critical path) + T-022 (seed refactor) + T-029 (API contract critical path)
**Splits applied**: 20 parent tasks split into 45 child tasks (68 total vs 47 original)

**Known follow-ups**:
- GAP-078-105 (Cloudinary upload_stream flags invalidate/exif/faces): lives in cloudinary.provider.ts, fell outside T-006 scope.
- env-registry-schema-cross-validation: 4 pre-existing failures on Cloudinary vars not yet in ApiEnvSchema (unrelated to any current task).
- destination.service.ts workaround cleanup (5-line dead code block post-DROP NOT NULL): left unstaged to avoid mixing with pre-existing uncommitted work in that file.

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

- [ ] **T-018** (complexity: 2.0) — Add InMemoryImageProvider and extractAllMediaPublicIds to @repo/media
  - Gaps: GAP-078-102, GAP-078-082, GAP-078-229
  - Blocked by: T-017
  - Blocks: T-036 (i18n), T-037 (spec amendment)

- [ ] **T-019** (complexity: 1.0) — Add resetMediaProviderForTesting export and test-utils subpath
  - Gaps: GAP-078-059, GAP-078-168
  - Blocked by: T-017, T-010
  - Blocks: T-036, T-037

---

### Phase 3C — Documentation and spec amendments

- [ ] **T-020** (complexity: 1.0) — Create packages/media JSDoc and interface cleanup documentation
  - Gaps: GAP-078-028, GAP-078-174, GAP-078-032, GAP-078-161
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-021** (complexity: 1.0) — Create packages/media README.md and CLAUDE.md
  - Gap: GAP-078-047
  - Blocked by: T-017
  - Blocks: none

---

### Phase 4A — Seed strategy refactor

- [x] **T-022** (complexity: 2.0) — Seed strategy refactor: seedSource required/example, processor counters, and resolveEnvironment
  - Gaps: GAP-078-036, GAP-078-116, GAP-078-007, GAP-078-037, GAP-078-039
  - Blocked by: T-010
  - Blocks: T-023
  - Outcome (commit `6f5b0589`): seedSource discriminator on SeedContext; `example` early-returns preserving raw URL + attribution. CLI flag `--allow-required-fallback` tolerates required failures with warn. Counters `{ uploaded, cached, failures, skippedExample }` emitted. `resolveEnvironment()` replaces 3 NODE env read sites (imported from `@repo/media/server` per T-017). Gallery role is template-literal `gallery/${index}`. env-registry adds `'seed'` to 4 Cloudinary entries. Refactor: `uploadSeedImage` returns discriminated `UploadSeedImageOutcome`. 9 new tests, 121/121 pass.

- [ ] **T-023** (complexity: 1.5) — Seed strategy: avatars path, moderation default, and spec amendment
  - Gaps: GAP-078-008, GAP-078-063, GAP-078-019
  - Blocked by: T-022
  - Blocks: T-024, T-025

- [ ] **T-024** (complexity: 2.0) — Seed strategy: sponsor/organizer logo handling, MediaBlock videos, and MediaSchema validation
  - Gaps: GAP-078-077, GAP-078-083, GAP-078-084
  - Blocked by: T-023
  - Blocks: none

- [ ] **T-025** (complexity: 1.0) — Seed data: moderation state bulk-fix in destination JSONs and CLAUDE.md doc
  - Gap: GAP-078-076
  - Blocked by: T-023
  - Blocks: none

---

### Phase 4B — Seed hardening

- [ ] **T-026** (complexity: 1.5) — Seed hardening: SSRF allowlist and --reset / --clean-images flag integration
  - Gaps: GAP-078-030, GAP-078-006, GAP-078-078
  - Blocked by: T-022
  - Blocks: none

- [ ] **T-027** (complexity: 1.5) — Seed hardening: cache flush, --validate-cache, cache schema Zod validation, and .gitignore
  - Gaps: GAP-078-033, GAP-078-079, GAP-078-120, GAP-078-074
  - Blocked by: T-022
  - Blocks: none

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

- [ ] **T-030** (complexity: 1.0) — API response contract: DELETE wasPresent flag and tags/overwrite forwarding
  - Gaps: GAP-078-154, GAP-078-155
  - Blocked by: T-029
  - Blocks: none

---

### Phase 5B — Request schemas

- [ ] **T-031** (complexity: 1.5) — Request schema refinements: discriminatedUnion role and ENTITY_FOLDER_MAP
  - Gaps: GAP-078-153, GAP-078-055
  - Blocked by: T-029
  - Blocks: T-040

- [ ] **T-032** (complexity: 1.0) — Request schema refinements: empty file reject and env-configurable max size
  - Gaps: GAP-078-148, GAP-078-106
  - Blocked by: T-029
  - Blocks: none

---

### Phase 5C — Defensive route hardening

- [ ] **T-033** (complexity: 1.5) — Defensive route hardening: rate limit, Content-Length margin, and gallery cap
  - Gaps: GAP-078-068, GAP-078-021, GAP-078-071
  - Blocked by: T-029
  - Blocks: none

- [ ] **T-034** (complexity: 1.5) — Defensive route hardening: OpenAPI multipart schema, lazy services, and CORS doc
  - Gaps: GAP-078-072, GAP-078-060, GAP-078-150
  - Blocked by: T-029
  - Blocks: none

---

### Phase 5D — Resilience

- [ ] **T-035** (complexity: 2.0) — Add p-retry resilience to provider delete/deleteByPrefix
  - Gaps: GAP-078-087, GAP-078-054
  - Blocked by: T-029
  - Blocks: none

---

### Phase 5E — i18n error keys

- [ ] **T-036** (complexity: 1.5) — Add i18n error keys for media error codes
  - Gap: GAP-078-139
  - Blocked by: T-029
  - Blocks: none

---

### Phase 5F — Spec amendment: /users/me convention

- [x] **T-037** (complexity: 1.0) — Amend SPEC-078 v1.6: /users/me convention documentation fix
  - Gap: GAP-078-009
  - Blocked by: none
  - Blocks: none
  - Outcome: SPEC-078-cloudinary-image-management/spec.md v1.6: REQ-04.2-FLOW uses PATCH /api/v1/protected/users/${userId} + ownership check; /me adoption deferred to dedicated SPEC

---

### Phase 6A — Admin UI: wiring upload/delete for all 4 entities

- [ ] **T-038** (complexity: 2.5) — Admin UI: wire upload/delete for destinations, events, posts entity edit pages
  - Gaps: GAP-078-004, GAP-078-005, GAP-078-018
  - Blocked by: T-017, T-029
  - Blocks: none

- [ ] **T-039** (complexity: 1.5) — Delete accommodations gallery tab and add TanStack Router redirect
  - Gap: GAP-078-073
  - Blocked by: T-017, T-029
  - Blocks: none

---

### Phase 6B — Admin hooks type safety

- [ ] **T-040** (complexity: 1.5) — Admin hooks type safety: use-media-upload with MediaEntityType/MediaRole and schema validation
  - Gap: GAP-078-052
  - Blocked by: T-031
  - Blocks: none

---

### Phase 6C — Raw <img> to getMediaUrl() migration

- [ ] **T-041** (complexity: 1.5) — Migrate raw <img> to getMediaUrl() in admin components: profile, SEO, header, GalleryField
  - Gaps: GAP-078-015, GAP-078-016, GAP-078-042, GAP-078-043, GAP-078-137
  - Blocked by: T-017
  - Blocks: T-050 (CSP)

- [ ] **T-042** (complexity: 2.0) — Migrate getMediaUrl() API extensions: fallback override, regex anchor, delivery-type detection
  - Gaps: GAP-078-061, GAP-078-069, GAP-078-166, GAP-078-211, GAP-078-218, GAP-078-179
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-043** (complexity: 1.5) — Add Biome noRestrictedSyntax rule and CI script for bare <img> Cloudinary URL detection
  - Gap: GAP-078-099
  - Blocked by: T-017
  - Blocks: none

---

### Phase 6D — Accessibility + UX

- [ ] **T-044** (complexity: 2.0) — Admin accessibility: GalleryField dnd-kit drag-and-drop refactor
  - Gaps: GAP-078-048, GAP-078-144
  - Blocked by: T-017, T-038
  - Blocks: none

- [ ] **T-045** (complexity: 2.0) — Admin accessibility: ImageField error state, delete confirmation dialog, reduced-motion, and aria-describedby
  - Gaps: GAP-078-046, GAP-078-138, GAP-078-141, GAP-078-142, GAP-078-143
  - Blocked by: T-017, T-038
  - Blocks: none

- [ ] **T-046** (complexity: 2.0) — Admin UX: HEIC/AVIF accept, p-limit parallel upload, and progress indicator
  - Gaps: GAP-078-152, GAP-078-127, GAP-078-140
  - Blocked by: T-017, T-038
  - Blocks: none

- [ ] **T-047** (complexity: 1.5) — Admin UX: shadcn Avatar component refactor and validateMediaFile maxFileSizeMb prop
  - Gaps: GAP-078-145, GAP-078-176
  - Blocked by: T-017, T-038
  - Blocks: none

---

### Phase 6E — Web component media migration

- [ ] **T-048** (complexity: 2.0) — Web media migration: transforms.ts and Astro component raw img replacements
  - Gaps: GAP-078-017, GAP-078-041, GAP-078-044, GAP-078-045, GAP-078-136
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-049** (complexity: 2.0) — Web media migration: i18n avatar keys, moderationState cleanup, avatar-utils, and race condition doc
  - Gaps: GAP-078-040, GAP-078-064, GAP-078-070, GAP-078-118, GAP-078-145 (web part), GAP-078-194
  - Blocked by: T-017
  - Blocks: none

---

### Phase 6F — CSP updates

- [ ] **T-050** (complexity: 2.0) — CSP updates: web img-src Cloudinary, admin CSP explicit allowlist, Astro remotePatterns
  - Gaps: GAP-078-065, GAP-078-228, GAP-078-066, GAP-078-125, GAP-078-227
  - Blocked by: T-041
  - Blocks: none

---

### Phase 7A — Vercel config

- [ ] **T-051** (complexity: 1.0) — Vercel config: upload route maxDuration per-route and preview env Cloudinary warning
  - Gaps: GAP-078-222, GAP-078-223, GAP-078-134
  - Blocked by: T-003, T-029
  - Blocks: none

- [ ] **T-052** (complexity: 2.0) — Vercel observability: /health/media endpoint and orphan cleanup cron
  - Gaps: GAP-078-232, GAP-078-231
  - Blocked by: T-003, T-029
  - Blocks: none

---

### Phase 7B — Turbo config

- [x] **T-053** (complexity: 1.0) — Turbo globalEnv: add Cloudinary vars and VERCEL_ENV cache keys
  - Gaps: GAP-078-220, GAP-078-221, GAP-078-233
  - Blocked by: T-003
  - Blocks: none
  - Outcome: turbo.json globalEnv adds HOSPEDA_CLOUDINARY_{CLOUD_NAME,API_KEY,API_SECRET}, HOSPEDA_MEDIA_MAX_FILE_SIZE_MB, VERCEL_ENV

---

### Phase 7C — CI/CD and tooling

- [ ] **T-054** (complexity: 1.5) — CI/CD: Cloudinary isolation script and CI jobs
  - Gaps: GAP-078-038, GAP-078-225, GAP-078-224
  - Blocked by: T-017, T-029
  - Blocks: none

- [ ] **T-055** (complexity: 1.5) — CI/CD: Renovate pin, pnpm env:check pre-deploy, dpr_auto presets, and Cache-Control header
  - Gaps: GAP-078-226, GAP-078-230, GAP-078-133, GAP-078-135
  - Blocked by: T-017, T-029
  - Blocks: none

---

### Phase 8 — Observability + operations

- [ ] **T-056** (complexity: 2.0) — Observability: structured logs, Sentry capture, and metrics counters
  - Gaps: GAP-078-050, GAP-078-128, GAP-078-129, GAP-078-014, GAP-078-056
  - Blocked by: T-029
  - Blocks: none

- [ ] **T-057** (complexity: 1.0) — Observability: create Cloudinary incidents runbook
  - Gap: GAP-078-158
  - Blocked by: T-029
  - Blocks: none

---

### Phase 9A — Schema tests

- [ ] **T-058** (complexity: 1.5) — Schema tests: ImageSchema, VideoSchema, MediaSchema, BaseMediaFields coverage
  - Gap: GAP-078-101
  - Blocked by: T-010
  - Blocks: none

---

### Phase 9B — @repo/media unit tests

- [ ] **T-059** (complexity: 2.0) — Unit tests: extractPublicId and validate-media-file edge cases
  - Gaps: GAP-078-013, GAP-078-088, GAP-078-206, GAP-078-207, GAP-078-090, GAP-078-213, GAP-078-212
  - Blocked by: T-018, T-019
  - Blocks: none

- [ ] **T-060** (complexity: 2.0) — Unit tests: MEDIA_PRESETS frozen check, environment.test.ts, and coverage thresholds
  - Gaps: GAP-078-089, GAP-078-091, GAP-078-202, GAP-078-203, GAP-078-098, GAP-078-204, GAP-078-205, GAP-078-214
  - Blocked by: T-018, T-019
  - Blocks: none

- [ ] **T-061** (complexity: 1.0) — Unit tests: @repo/media contract test (cloudinary SDK shape)
  - Gap: GAP-078-100
  - Blocked by: T-018, T-019
  - Blocks: none

- [ ] **T-062** (complexity: 2.0) — Unit tests: CloudinaryProvider upload edge cases and mock patterns
  - Gaps: GAP-078-085, GAP-078-210, GAP-078-215, GAP-078-217, GAP-078-219
  - Blocked by: T-018, T-019
  - Blocks: none

- [ ] **T-063** (complexity: 2.0) — Unit tests: CloudinaryProvider delete paths, multi-instance, and avatar boundary
  - Gaps: GAP-078-086, GAP-078-031, GAP-078-208, GAP-078-209, GAP-078-216
  - Blocked by: T-018, T-019
  - Blocks: none

---

### Phase 9C — Seed tests

- [ ] **T-064** (complexity: 2.0) — Seed tests: cloudinary-upload and cloudinary-image-processor test files
  - Gap: GAP-078-020
  - Blocked by: T-022, T-024
  - Blocks: none

---

### Phase 9D — Service-core tests

- [ ] **T-065** (complexity: 2.5) — Service-core tests: hardDelete cleanup and hookstate propagation
  - Gaps: GAP-078-094, GAP-078-095
  - Blocked by: T-018, T-019
  - Blocks: none

---

### Phase 9E — API integration tests

- [ ] **T-066** (complexity: 2.5) — API integration tests: admin upload/delete and protected upload scenarios
  - Gaps: GAP-078-092, GAP-078-024, GAP-078-093
  - Blocked by: T-018, T-019, T-029
  - Blocks: none

---

### Phase 9F — UI component tests

- [ ] **T-067** (complexity: 2.5) — UI component tests: GalleryField, ImageField, use-media-upload, AvatarUpload
  - Gap: GAP-078-097
  - Blocked by: T-040, T-044, T-045
  - Blocks: none

---

### Phase 9G — Reconciliation

- [ ] **T-068** (complexity: 1.0) — Reconcile state.json and TODOs.md with actual post-remediation state
  - Gap: GAP-078-022
  - Blocked by: T-058, T-059, T-060, T-061, T-062, T-063, T-064, T-065, T-066, T-067
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
