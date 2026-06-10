# SPEC-190 Baseline Bundle Snapshot

**Date:** 2026-06-10
**Commit:** (pre-change baseline)
**Tool:** `ls -lh` + `gzip` on `.output/public/assets/*.js` (TanStack Start client output)
**Build:** `pnpm build` (no ANALYZE flag — clean production build)

## Key Chunks (client-side, pre-gzip → gzip)

| Chunk | Raw | Gzip | Notes |
|-------|-----|------|-------|
| **components-entity** | **4044.4 KB** | **1129.1 KB** | Target chunk — tiptap, leaflet, upload, entity-* over-grouped |
| lib-utils | 558.4 KB | 184.8 KB | Out of scope (separate concern) |
| components-ui | 412.1 KB | 112.5 KB | Shadcn UI wrapper components |
| main | 210.9 KB | 54.9 KB | App entry |
| vendor-react | 175.0 KB | 55.9 KB | React + ReactDOM |
| vendor | 122.3 KB | 42.5 KB | Other vendor deps |
| feature-accommodations | 61.3 KB | 16.0 KB | Largest feature chunk |

## Total Client Bundle

- **Raw:** 6.40 MB
- **Gzip:** 1.83 MB

## Notes

- The spec's earlier claim of "~401 KB" for `components-entity` was **incorrect** — that was likely an SSR chunk measurement. The actual client-side chunk is **4.0 MB raw / 1.1 MB gzip**.
- The original "4 MB" concern from BETA-74 is **validated** — the chunk really is that large.
- Icons are a secondary contributor; the primary weight comes from tiptap, leaflet, and image/video upload components.
- The `manualChunks` rule `id.includes('/components/entity-')` collapses entity-list, entity-form, and entity-pages into one chunk with no code-split seams.
