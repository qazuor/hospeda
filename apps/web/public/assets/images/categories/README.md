# Category tile placeholder images

These are minimal 8x8 WebP placeholders used by the homepage `CategoryTiles`
component (see `apps/web/src/components/CategoryTiles.astro` and the
`categoryTiles` data in `apps/web/src/pages/[lang]/index.astro`).

They exist so the image wiring is production-safe (no broken image requests,
no console warnings) while marketing-approved imagery is produced.

## Files

- `cabins.webp`
- `culture.webp`
- `gastronomy.webp`
- `hotels.webp`
- `houses.webp`
- `music.webp`
- `posts.webp`

## Replacement

Replace each file with marketing-approved imagery before public launch.
Recommended specs:

- Format: WebP (with JPEG/PNG fallback if needed)
- Aspect ratio: 16:9 or similar landscape (the visual area is 140px tall)
- Min resolution: 800x450 (to look sharp on retina displays)
- File size budget: < 60 KB per image

No code changes are required when swapping the assets — only the binaries.
