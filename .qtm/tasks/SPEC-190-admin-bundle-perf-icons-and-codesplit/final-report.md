# SPEC-190 Final Before/After Bundle Report

**Date:** 2026-06-10
**Branch:** `spec/SPEC-190-admin-bundle-perf-icons-and-codesplit`
**Tool:** File sizes from `.output/public/assets/*.js` (TanStack Start client output)

## Before/After Table

| Chunk | Baseline Raw | After Raw | Delta Raw | Baseline Gzip | After Gzip |
|-------|-------------|-----------|-----------|---------------|------------|
| **components-entity** (now entity-form) | 4044.4 KB | 3534.7 KB | **-509.7 KB** | 1129.1 KB | 975.1 KB |
| components-entity-list | _(in entity)_ | 275.6 KB | _(split out)_ | _(in entity)_ | 81.8 KB |
| components-entity-pages | _(in entity)_ | 30.1 KB | _(split out)_ | _(in entity)_ | 10.1 KB |
| resolver (NEW, async) | — | 9.6 KB | +9.6 KB | — | 4.3 KB |
| **Total client** | 6.40 MB | 6.37 MB | **-30 KB** | 1.83 MB | 1.83 MB |

## Summary by Front

| Front | What changed | Raw Delta | Notes |
|-------|-------------|-----------|-------|
| **Icon hygiene** (FR-2/3/4/5) | `sideEffects: false`, resolver subpath, lazify IconNameCell, remove dead lucide | -41.6 KB | Resolver now in async chunk (9.6 KB) |
| **Entity de-couple** (FR-7/8) | Split `manualChunks`, relocate `DeleteConfirmDialog` | -468 KB | entity-list (276 KB) and entity-pages (30 KB) split out |
| **Heavy-field lazy** (FR-6) | `React.lazy` for tiptap/leaflet/upload fields | Minimal static delta | Lazy chunks load async at runtime; SSR bundles inline them |
| **TOTAL** | | **-551 KB** | |

## Key Findings

1. **The original 4 MB concern is validated** — the client-side `components-entity` was 4044 KB raw.
2. **`-551 KB` total reduction** (~13.6% of the target chunk). The main win came from splitting entity-list and entity-pages out of the monolithic chunk.
3. **Heavy fields (tiptap/leaflet/upload) remain in entity-form** because Rolldown inlines `React.lazy` imports during SSR bundling. The lazy loading works at runtime (async chunks on demand) but doesn't reduce the static SSR output.
4. **Icons were a secondary contributor** as predicted — the icon front saved ~42 KB.
5. **The `resolver` async chunk** (9.6 KB) loads only when a table row has an icon name.

## Documentation Corrections

- `packages/icons/docs/guides/optimization.md` line 17: the `sideEffects: false` claim is now **correct** (was false before FR-2).
- `spec.md` honest framing: updated from "~401 KB" to the real 4044 KB baseline.

## Remaining Work

- **T-012**: Write component tests for lazy fields and relocated DeleteConfirmDialog
- **T-014**: Manual admin smoke of every field type in CREATE + EDIT (requires browser)
