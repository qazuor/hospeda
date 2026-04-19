# @repo/media

Media management primitives for the Hospeda platform: Cloudinary-backed image upload, transform URL building, file validation, and named transform presets. Split into three subpath exports so browser code never pulls in the Node-only Cloudinary SDK.

## Installation

This package is part of the Hospeda monorepo workspace. Add it as a dependency in your `package.json`:

```json
{
  "dependencies": {
    "@repo/media": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

## Subpath Exports

| Subpath | Use From | Bundles |
|---------|----------|---------|
| `@repo/media` | `apps/admin`, `apps/web`, any browser-safe code | URL builders, presets, ID parsing, gallery ID generation |
| `@repo/media/server` | `apps/api`, `packages/seed`, Node scripts | `CloudinaryProvider`, file-magic validation, env resolution |
| `@repo/media/test-utils` | Vitest specs only | `InMemoryImageProvider` for deterministic tests |

The browser-safe entrypoint pulls zero Node-only modules. The split is enforced at the Biome level in `apps/admin` and `apps/web` via `noRestrictedImports` (see SPEC-078-GAPS T-017).

## Quick Start

### Browser-safe transforms (admin / web)

```ts
import { getMediaUrl, MEDIA_PRESETS, extractPublicId } from '@repo/media';

// Build a URL with a named preset
const cardUrl = getMediaUrl({
  publicId: 'accommodations/abc123/cover',
  preset: 'card',
  cloudName: 'hospeda'
});

// Inspect a Cloudinary URL
const publicId = extractPublicId(
  'https://res.cloudinary.com/hospeda/image/upload/v1700000000/accommodations/abc123/cover.jpg'
);
// => 'accommodations/abc123/cover'

// All preset transform strings (frozen)
console.log(MEDIA_PRESETS.hero);
// => 'w_1200,h_600,c_fill,g_auto,q_auto,f_auto,dpr_auto'
```

### Server-side provider (API)

Always go through `getMediaProvider()` from `apps/api/src/services/media.ts`. Never instantiate `CloudinaryProvider` yourself anywhere else.

```ts
// apps/api: route handler
import { getMediaProvider } from '../services/media.js';
import { validateMediaFile } from '@repo/media/server';

const provider = getMediaProvider();
if (!provider) {
  return c.json({ error: 'media unavailable' }, 503);
}

const validation = await validateMediaFile({
  buffer: file.buffer,
  declaredMimeType: file.type,
  context: 'entity'
});
if (!validation.ok) {
  return c.json({ error: validation.code }, 400);
}

const result = await provider.upload({
  buffer: file.buffer,
  folder: 'accommodations/abc123',
  publicId: 'cover'
});
```

### Test utilities (vitest)

```ts
import { InMemoryImageProvider } from '@repo/media/test-utils';
import type { ImageProvider } from '@repo/media/server';

const provider: ImageProvider = new InMemoryImageProvider();
await provider.upload({ buffer: Buffer.from('fake'), folder: 'test', publicId: 'x' });
expect(await provider.healthCheck()).toEqual({ ok: true });
```

## Exports

### `@repo/media` (browser-safe)

| Symbol | Kind | Purpose |
|--------|------|---------|
| `getMediaUrl` | function | Builds a Cloudinary delivery URL with a preset transform |
| `GetMediaUrlOptions` | type | Options for `getMediaUrl` |
| `MEDIA_PRESETS` | const (frozen) | Named transform string lookup |
| `MediaPreset` | type | Union of valid preset keys |
| `extractPublicId` | function | Parses a Cloudinary URL back into its public ID |
| `generateGalleryId` | function | Generates a stable nanoid for new gallery items |

### `@repo/media/server`

| Symbol | Kind | Purpose |
|--------|------|---------|
| `CloudinaryProvider` | class | `ImageProvider` implementation backed by the Cloudinary SDK (`@internal` — never instantiate outside `apps/api/src/services/media.ts`) |
| `CloudinaryProviderConfig` | type | Constructor config (cloudName, apiKey, apiSecret) |
| `ConfigurationError` | class | Thrown when provider is misconfigured |
| `InvalidFolderError` | class | Thrown when an upload folder violates allowlist rules |
| `ImageProvider` | interface | Provider contract: `upload`, `delete`, `deleteByPrefix`, `healthCheck` |
| `UploadOptions`, `UploadResult`, `DeleteOptions`, `DeleteResult`, `DeleteByPrefixOptions`, `HealthCheckResult` | types | I/O shapes for the provider methods |
| `validateMediaFile` | function | Validates a buffer's magic bytes against declared MIME type and size |
| `AVATAR_ALLOWED_MIME_TYPES`, `ENTITY_ALLOWED_MIME_TYPES` | const | MIME allowlists per validation context |
| `ValidateMediaFileInput`, `ValidationContext`, `ValidationResult`, `ValidationSuccess`, `ValidationFailure`, `ValidationErrorCode` | types | Validator I/O shapes |
| `resolveEnvironment` | function | Reads and validates `HOSPEDA_CLOUDINARY_*` env vars |
| `MediaEnvironment` | type | Resolved env shape |
| `extractAllMediaPublicIds` | function | Walks an entity-like object and returns every Cloudinary public ID found |
| `EntityWithMedia`, `MediaAssetLike`, `MediaLike`, `ExtractAllMediaPublicIdsOptions` | types | Shapes accepted by `extractAllMediaPublicIds` |

### `@repo/media/test-utils`

| Symbol | Kind | Purpose |
|--------|------|---------|
| `InMemoryImageProvider` | class | In-memory `ImageProvider` for tests and dev fallback |
| `InMemoryImageProviderOptions`, `InMemoryImageRecord` | types | Configuration and record shapes |

## Presets

All presets include `q_auto`, `f_auto`, and `dpr_auto` so HiDPI displays are handled automatically (SPEC-078-GAPS T-055 / GAP-078-133).

| Preset | Transform | Use case |
|--------|-----------|----------|
| `thumbnail` | `w_200,h_200,c_thumb,g_auto,q_auto,f_auto,dpr_auto` | Small square thumbs in lists, search results |
| `card` | `w_400,h_300,c_fill,g_auto,q_auto,f_auto,dpr_auto` | Accommodation/destination/event cards in grids |
| `hero` | `w_1200,h_600,c_fill,g_auto,q_auto,f_auto,dpr_auto` | Top-of-page hero banners on detail screens |
| `gallery` | `w_800,q_auto,f_auto,dpr_auto` | Lightbox gallery images (width-constrained, no crop) |
| `avatar` | `w_150,h_150,c_thumb,g_face,q_auto,f_auto,dpr_auto` | User avatars (face-detection gravity) |
| `full` | `q_auto,f_auto,dpr_auto` | Original dimensions, only quality and format optimized |
| `og` | `w_1200,h_630,c_fill,q_auto,f_auto,dpr_auto` | Open Graph / Twitter card social previews |

## Environment Variables

Required for the server provider; consumed by `resolveEnvironment()` and the API's `env` object.

| Variable | Required | Purpose |
|----------|----------|---------|
| `HOSPEDA_CLOUDINARY_CLOUD_NAME` | yes (server) | Cloudinary cloud name |
| `HOSPEDA_CLOUDINARY_API_KEY` | yes (server) | Cloudinary API key |
| `HOSPEDA_CLOUDINARY_API_SECRET` | yes (server) | Cloudinary API secret (never expose to clients) |
| `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` | no (default 10) | Upload size cap enforced by `validateMediaFile` |
| `HOSPEDA_ALLOW_PROD_CLEANUP` | no (default false) | Gate for `deleteByPrefix` against production folders |

In `NODE_ENV=development`, missing Cloudinary credentials cause `getMediaProvider()` to fall back to `InMemoryImageProvider` instead of crashing.

## Operational Notes

- `delete` and `deleteByPrefix` are wrapped in `p-retry` with idempotent semantics (SPEC-078-GAPS T-035). Repeating a delete on a missing public ID is a no-op.
- `upload` is intentionally **not** retried at the provider level. Retries on uploads can produce duplicate assets when the first attempt actually succeeded but the response was lost. Callers that need retry semantics must implement them with their own dedup token.
- `healthCheck` performs a lightweight ping against Cloudinary and returns `{ ok: boolean, latencyMs?: number, error?: string }` (SPEC-078-GAPS T-052).

## Runbook

For incident response (auth failures, rate limits, accidental deletes), see [docs/runbooks/cloudinary-incidents.md](../../docs/runbooks/cloudinary-incidents.md).

## Related

- SPEC-078-GAPS — full Cloudinary remediation track
- ADRs under `docs/decisions/` for image-management decisions
- `apps/api/src/services/media.ts` — canonical provider singleton
