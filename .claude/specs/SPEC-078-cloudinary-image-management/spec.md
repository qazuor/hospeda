---
id: SPEC-078
slug: cloudinary-image-management
title: Cloudinary Image Management System
status: draft
priority: high
created: 2026-04-13
---

# SPEC-078: Cloudinary Image Management System

## Revision History

| Revision | Date | Summary |
|----------|------|---------|
| v1.0 | 2026-04-13 | Initial draft |
| v1.1 | 2026-04-13 | Exhaustive review pass 1: added delete endpoint (REQ-04.3), configurable body size limit (REQ-03.3), billing entitlements for gallery limits (REQ-08.3), fixed seed folder paths (REQ-07), added `secure_url` mapping, referenced existing GalleryField component, added `image-size` dependency, clarified entity field nullability, added Zod validation constraints detail, referenced Hono multipart pattern, noted SDK snake_case mapping, added Content-Length pre-check, clarified web account settings page prerequisite, referenced exact media.ts functions, mentioned Pexels alongside Unsplash in seed data, added Cloudinary Admin API rate limit notes, updated acceptance criteria |
| v1.2 | 2026-04-14 | Exhaustive review pass 2: DELETE endpoint changed to query param (REQ-04.3), entity existence validation before upload (REQ-04.1), entity deletion cleanup added (REQ-12), avatar response expanded to include publicId/width/height (REQ-04.2), gallery index immutability clarified (REQ-08.2), extractPublicId() algorithm specified (REQ-01.5), HTTP 413/422 precedence clarified (REQ-03), path traversal protection added (REQ-04.1), Cloudinary response validation scenario added (REQ-04.1), corrupted cache handling (REQ-07), BaseMediaFields vs MediaSchema note added, GalleryField interface mapping documented, image-size package size corrected, test mocking guidance added, concurrent seed runs note, rate limiting deferred to SPEC-079, data flow diagram added |
| v1.3 | 2026-04-14 | Exhaustive review pass 3 (SDK verification against official Cloudinary docs v2.9.0): corrected upload() buffer handling (must use upload_stream() or data URI, NOT raw Buffer), documented destroy() response shape ({ result: "ok" | "not found" }), documented delete_resources_by_prefix() response shape, noted SDK is CJS-only (requires tsup interop), removed unverified 500/hr rate limit claim (replaced with "plan-dependent"), added invalidate:true CDN propagation delay note, specified SDK version as 2.9.0, added upload_stream() Promise wrapping requirement, fixed REQ-07.5 resetDatabase() integration (CLI flag, not function parameter), noted seed data has no local file references currently (REQ-07.2-D is forward-looking), added Cloudinary destroy() idempotent behavior note to REQ-04.3 |
| v1.4 | 2026-04-14 | Exhaustive review pass 4 (cross-verified SDK docs, codebase hooks, and seed data): corrected upload() to accept Buffer directly (official docs list "byte array buffer" as valid input), removed incorrect "CJS-only" SDK claim (SDK supports ESM imports natively), added concrete Admin API rate limits (500/hr free, 2000/hr paid), added X-FeatureRateLimit-Reset header reference, detailed REQ-12.3 implementation pattern using _beforeHardDelete + hookState (hooks verified in base.crud.hooks.ts lines 216-238), added seed data distribution detail (Pexels: 603 refs across 107 files, Unsplash: 169 refs across 80 files), confirmed Attraction entity excluded (no media field, icon-only) |
| v1.5 | 2026-04-14 | Exhaustive review pass 5 (full SDK re-verification against npm + official Cloudinary docs, full codebase audit with 34-point checklist): **REVERTED** upload() Buffer claim back to upload_stream()/data URI (official docs do NOT list raw Buffer as valid input for upload(), only for upload_stream()); clarified SDK is CJS-only natively (ESM import works via Node.js interop, not native exports); replaced galleryIndex with nanoid-based unique suffix (eliminates index assignment ambiguity); added avatar DB persistence flow mirroring entity pattern (upload is proxy-only, user profile PATCH persists URL); corrected Unsplash seed count (182 refs across 82 files, not 169/80); updated account settings page prerequisite (edit page exists at mi-cuenta/editar); added magic bytes validation note for MIME type spoofing; added REQ-04.2-FLOW for avatar persistence; 33/34 codebase claims verified accurate |

---

## Overview

Hospeda currently stores all entity images as hardcoded Unsplash/Pexels URLs in seed JSON files. There is no upload infrastructure, no optimization pipeline, and no consistent URL-building strategy. This spec defines a complete image management system backed by Cloudinary as the storage and CDN provider.

The system has five distinct concerns: (1) a provider-agnostic `packages/media` package that encapsulates all Cloudinary knowledge, (2) server-side upload and delete API endpoints for the admin panel and authenticated users, (3) a single `getMediaUrl()` function that all apps use to build optimized image URLs from stored base URLs, (4) a seed integration that uploads development images to Cloudinary with an intelligent cache, and (5) migration of existing image-rendering code to use `@repo/media`.

**No other package or app is permitted to import the Cloudinary SDK directly.** `@repo/media` is the single point of Cloudinary coupling.

---

## Goals

1. Replace raw Unsplash/Pexels URLs with Cloudinary-hosted images in all entities that carry `media` JSONB or an `image` text column.
2. Provide a reliable, validated upload flow through the API with appropriate authorization per consumer.
3. Deliver responsive, format-optimized images to the web and admin frontends via named transform presets with zero per-call configuration.
4. Allow seed runs to upload images once, cache the result, and skip re-uploads when the source has not changed.
5. Keep all vendor coupling inside `packages/media` so the provider can be swapped without touching apps.
6. Provide a delete flow to clean up Cloudinary assets when images are removed from entities, preventing orphaned assets.

---

## Entities with Images

| Entity | DB field | Type | Nullable | DB schema file |
|--------|----------|------|----------|----------------|
| Accommodation | `media` | `jsonb` .. `Media` | YES (optional) | `packages/db/src/schemas/accommodation/accommodation.dbschema.ts` |
| Destination | `media` | `jsonb` .. `Media` | NO (required, `.notNull()`) | `packages/db/src/schemas/destination/destination.dbschema.ts` |
| Event | `media` | `jsonb` .. `Media` | YES (optional) | `packages/db/src/schemas/event/event.dbschema.ts` |
| Post | `media` | `jsonb` .. `Media` | NO (required, `.notNull()`) | `packages/db/src/schemas/post/post.dbschema.ts` |
| User | `image` | `text` .. plain URL string | YES (optional) | `packages/db/src/schemas/user/user.dbschema.ts` |

**Note**: Accommodation and Event have optional `media` fields. Upload endpoints MUST handle the case where `media` is `null` (first image upload creates the JSONB structure). Destination and Post always have `media` populated (required by DB schema).

**Note**: The User entity uses a simple `text` column (`image`), NOT the `Media` JSONB structure. Avatar handling follows a different code path from entity media.

**Entities with image fields NOT in scope**: The following entities have image-related fields but are excluded from this spec's upload/management flow:
- `EventOrganizer` .. has `logo` (`text`) .. simple URL string, no upload UI needed (populated by seed/admin text input).
- `PostSponsor` .. has `logo` (`jsonb` .. `Image`) .. structured Image type, but sponsors manage their own logos externally.
- `Attraction` .. has `icon` (`text`) .. icon name reference, not an image URL.

These entities MAY be added to the upload flow in a future spec if needed. For now, `getMediaUrl()` will still work on their URLs if they happen to be Cloudinary URLs (passthrough for non-Cloudinary URLs per REQ-01.3-B).

### Type Definitions (from `@repo/schemas`)

The `Media` type is defined in `packages/schemas/src/common/media.schema.ts`:

```typescript
// MediaSchema
{
  featuredImage: ImageSchema,           // REQUIRED
  gallery: z.array(ImageSchema).optional(),
  videos: z.array(VideoSchema).optional()  // exists but out of scope for this spec
}

// ImageSchema
{
  moderationState: ModerationStatusEnumSchema,  // PENDING | APPROVED | REJECTED
  url: z.string().url(),                        // REQUIRED, must be valid URL
  caption: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(300).optional()
}
```

**Important**: The `videos` field exists on `MediaSchema` but is explicitly OUT OF SCOPE for this spec. This spec only handles image uploads. The `videos` field MUST NOT be modified by any image upload operation.

**Schema variants note**: The `media.schema.ts` file defines two related schemas:
- `MediaSchema` — used for API responses and display. Has `featuredImage` as **required**.
- `BaseMediaFields` — used as the base for entity CRUD input validation. Has `featuredImage` as **optional** (`.optional()`).

Entity PATCH endpoints validate against schemas derived from `BaseMediaFields`, meaning an entity can be saved with `media: { gallery: [...] }` without a `featuredImage`. The upload endpoint and admin UI should be aware of this: uploading a gallery image to an entity with no `featuredImage` is valid. The `MediaSchema` (with required `featuredImage`) is used for API response serialization, where the API ensures completeness.

---

## Requirements

RFC 2119 keywords apply throughout: MUST, SHALL, SHOULD, MAY.

---

### REQ-01: `packages/media` Package (`@repo/media`)

#### REQ-01.1: Provider Abstraction

The package MUST export an `ImageProvider` interface with the following method signatures (parameter names are illustrative; exact TypeScript types are an implementation concern):

- `upload({ file, folder, publicId?, tags?, overwrite? })` .. uploads a file (as a data URI string or via stream) and returns a result containing at minimum the base Cloudinary URL (HTTPS) and the public ID. The `file` parameter is a `Buffer` at the provider interface level.. the `CloudinaryProvider` internally converts it to a stream via `upload_stream()` (see Technical Notes).
- `delete({ publicId })` .. deletes a single asset by public ID.
- `deleteByPrefix({ prefix })` .. deletes all assets under a folder prefix.
- `buildUrl({ publicId, transforms? })` .. constructs a delivery URL with optional transform string insertion.

No app or package outside `packages/media` MUST import from the Cloudinary SDK (`cloudinary`) directly.

**Scenario REQ-01.1-A .. Provider contract is respected:**
```
Given an ImageProvider implementation,
When upload() is called with a valid buffer and folder path,
Then it returns an object with at minimum { url: string, publicId: string, width: number, height: number }
  and the URL is a valid https:// URL pointing to the configured cloud
  and the URL is the BASE URL without any transform parameters.
```

**Scenario REQ-01.1-B .. Delete cleans up remote asset:**
```
Given an ImageProvider implementation and a known publicId,
When delete({ publicId }) is called,
Then the asset is removed from the storage backend
  and subsequent calls to that publicId's URL return a 404 (best-effort verification, not blocking).
```

**Scenario REQ-01.1-C .. Delete by prefix removes all matching assets:**
```
Given an ImageProvider implementation and a folder prefix "hospeda/dev/seed/",
When deleteByPrefix({ prefix }) is called,
Then ALL assets whose public ID starts with that prefix are removed.
```

#### REQ-01.2: CloudinaryProvider Implementation

The package MUST provide a `CloudinaryProvider` class that implements `ImageProvider`.

`CloudinaryProvider` MUST be configured with three values: `cloudName`, `apiKey`, `apiSecret`. These MUST come from environment variables .. the provider MUST NOT hardcode credentials.

**SDK mapping note**: The Cloudinary Node SDK uses snake_case for configuration (`cloud_name`, `api_key`, `api_secret`). The `CloudinaryProvider` constructor accepts camelCase TypeScript parameters and maps them internally when calling `cloudinary.config()`.

**SDK method mapping**:

| Provider method | Cloudinary SDK method | SDK namespace |
|----------------|----------------------|---------------|
| `upload()` | `cloudinary.uploader.upload()` | Upload API |
| `delete()` | `cloudinary.uploader.destroy()` | Upload API |
| `deleteByPrefix()` | `cloudinary.api.delete_resources_by_prefix()` | Admin API |

**Important**: `deleteByPrefix()` uses the Cloudinary **Admin API**, which is rate-limited (500 requests/hour on free plan, 2000/hour on paid plans; monitor via `X-FeatureRateLimit-Limit`, `X-FeatureRateLimit-Remaining`, and `X-FeatureRateLimit-Reset` response headers). This is acceptable for `--clean-images` usage but MUST NOT be called in hot paths (e.g., per-request).

**Upload response mapping**: The Cloudinary SDK returns both `url` (HTTP) and `secure_url` (HTTPS). The `CloudinaryProvider` MUST always use `secure_url` and map it to the `url` field in its return type. HTTP URLs (`url` field from SDK) MUST be discarded.

**Scenario REQ-01.2-A .. Provider initializes from environment:**
```
Given HOSPEDA_CLOUDINARY_CLOUD_NAME, HOSPEDA_CLOUDINARY_API_KEY,
  and HOSPEDA_CLOUDINARY_API_SECRET are set,
When CloudinaryProvider is instantiated,
Then it initializes without error
  and subsequent upload() calls succeed.
```

**Scenario REQ-01.2-B .. Missing credentials throw at initialization:**
```
Given HOSPEDA_CLOUDINARY_CLOUD_NAME is not set,
When CloudinaryProvider is instantiated,
Then it throws a descriptive ConfigurationError
  naming which variable is missing.
```

#### REQ-01.3: `getMediaUrl()` .. Single URL Entry Point

The package MUST export a `getMediaUrl(url, options?)` function. This is THE single function that all apps (web, admin) call to render any image URL.

**Critical**: `getMediaUrl()` does NOT require Cloudinary credentials. It is a pure string transformation that can run in any environment (browser, server, SSR). It MUST NOT import the Cloudinary SDK.

Behavior MUST be:

- **Cloudinary URL** (detected by `url.includes('res.cloudinary.com')`): insert the transform string from the named preset between `/upload/` and the version/path segment. Return the modified URL.
- **Non-Cloudinary URL** (Unsplash, Pexels, placeholder, any other host): return the URL unchanged.
- **Nullish or empty input**: return a designated fallback placeholder URL (configurable, defaults to a 1x1 transparent pixel or a generic placeholder hosted on the same Cloudinary account).

`options` MAY include: `preset` (a named preset key), `width` and `height` overrides (which override the preset's width/height while keeping other transforms), and `raw` (a raw transform string that bypasses presets entirely).

`getMediaUrl()` MUST NOT make any network call. It is a pure string transformation.

**Scenario REQ-01.3-A .. Cloudinary URL with preset:**
```
Given a stored base URL
  "https://res.cloudinary.com/hospeda/image/upload/v1234/accommodations/abc/featured.jpg"
  and preset "card",
When getMediaUrl(url, { preset: 'card' }) is called,
Then the returned URL is
  "https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill,g_auto,q_auto,f_auto/v1234/accommodations/abc/featured.jpg".
```

**Scenario REQ-01.3-B .. Non-Cloudinary URL passes through unchanged:**
```
Given a stored URL "https://images.unsplash.com/photo-abc?w=800",
When getMediaUrl(url, { preset: 'card' }) is called,
Then the returned URL is exactly "https://images.unsplash.com/photo-abc?w=800"
  with no modification.
```

**Scenario REQ-01.3-C .. Nullish URL returns fallback:**
```
Given url is null, undefined, or an empty string,
When getMediaUrl(url, { preset: 'thumbnail' }) is called,
Then the returned URL is the configured fallback placeholder URL
  (not null, not undefined, not empty).
```

**Scenario REQ-01.3-D .. Width/height override:**
```
Given a stored Cloudinary URL and options { preset: 'card', width: 600 },
When getMediaUrl() is called,
Then the returned URL contains "w_600" and retains all other transforms
  from the "card" preset (h_300, c_fill, g_auto, q_auto, f_auto).
```

**Scenario REQ-01.3-E .. Raw transform string:**
```
Given a stored Cloudinary URL and options { raw: 'w_300,h_300,c_crop,g_center' },
When getMediaUrl() is called,
Then the returned URL inserts the raw string after /upload/
  and no preset is applied.
```

#### REQ-01.4: Named Transform Presets

The package MUST define the following named presets as a readonly constant. These are the ONLY approved presets; new presets MUST be added to `packages/media` and reviewed.

| Preset key | Cloudinary transform string | Primary use |
|------------|----------------------------|-------------|
| `thumbnail` | `w_200,h_200,c_thumb,g_auto,q_auto,f_auto` | Admin list views, small thumbnails |
| `card` | `w_400,h_300,c_fill,g_auto,q_auto,f_auto` | Listing cards in web |
| `hero` | `w_1200,h_600,c_fill,g_auto,q_auto,f_auto` | Hero sections, banners |
| `gallery` | `w_800,q_auto,f_auto` | Photo gallery items (height unconstrained) |
| `avatar` | `w_150,h_150,c_thumb,g_face,q_auto,f_auto` | User avatars (face-aware crop via `g_face`) |
| `full` | `q_auto,f_auto` | Full-size display (format + quality optimization only) |
| `og` | `w_1200,h_630,c_fill,q_auto,f_auto` | Open Graph / social sharing meta images (no `g_auto` .. center crop is intentional for OG predictability) |

**Transform syntax note**: All presets use comma-separated parameters in a single transformation component (e.g., `w_400,h_300,c_fill,g_auto,q_auto,f_auto`). Cloudinary processes these correctly in a single component. The alternative `/`-separated multi-component syntax is NOT used here because all parameters apply to the same transformation step.

**Scenario REQ-01.4-A .. Unknown preset name:**
```
Given options { preset: 'nonexistent' },
When getMediaUrl() is called,
Then it throws a TypeError with the message
  "Unknown media preset: nonexistent".
```

#### REQ-01.5: `extractPublicId()` .. Public ID Extraction from Cloudinary URLs

The package MUST export an `extractPublicId(url: string): string | null` function.

**Parsing algorithm**:
1. If the URL does not contain `res.cloudinary.com`, return `null`.
2. Find the `/upload/` segment in the URL path.
3. Split the remaining path after `/upload/` into segments by `/`.
4. Skip segments that match transform patterns (contain commas, e.g., `w_400,h_300,c_fill`).
5. Skip the version segment if present (matches pattern `v` followed by one or more digits, e.g., `v1234567890`).
6. Join the remaining segments with `/` to form the public ID.
7. Remove the file extension (e.g., `.jpg`, `.png`, `.webp`) from the last segment.
8. Return the resulting public ID string.

**Scenario REQ-01.5-A .. Standard URL with version:**
```
Given url = "https://res.cloudinary.com/hospeda/image/upload/v1234567890/hospeda/prod/accommodations/abc/featured.jpg",
When extractPublicId(url) is called,
Then it returns "hospeda/prod/accommodations/abc/featured".
```

**Scenario REQ-01.5-B .. URL with transforms and version:**
```
Given url = "https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill/v1234567890/hospeda/prod/accommodations/abc/featured.jpg",
When extractPublicId(url) is called,
Then it returns "hospeda/prod/accommodations/abc/featured"
  (transforms are skipped).
```

**Scenario REQ-01.5-C .. URL without version:**
```
Given url = "https://res.cloudinary.com/hospeda/image/upload/hospeda/prod/accommodations/abc/featured.jpg",
When extractPublicId(url) is called,
Then it returns "hospeda/prod/accommodations/abc/featured".
```

**Scenario REQ-01.5-D .. Non-Cloudinary URL:**
```
Given url = "https://images.unsplash.com/photo-abc",
When extractPublicId(url) is called,
Then it returns null.
```

**Scenario REQ-01.5-E .. Nullish input:**
```
Given url is null, undefined, or empty string,
When extractPublicId(url) is called,
Then it returns null.
```

---

### REQ-02: Cloudinary Folder Structure

Assets uploaded through the system MUST be stored under the following path convention:

```
hospeda/{env}/
├── accommodations/{entityId}/featured.{ext}
├── accommodations/{entityId}/gallery/{nanoid}.{ext}
├── destinations/{entityId}/featured.{ext}
├── destinations/{entityId}/gallery/{nanoid}.{ext}
├── events/{entityId}/featured.{ext}
├── events/{entityId}/gallery/{nanoid}.{ext}
├── posts/{entityId}/featured.{ext}
├── posts/{entityId}/gallery/{nanoid}.{ext}
├── avatars/{userId}.{ext}
└── seed/
    ├── accommodations/{entityId}/featured.{ext}
    ├── accommodations/{entityId}/gallery/{nanoid}.{ext}
    ├── destinations/{entityId}/...
    ├── events/{entityId}/...
    ├── posts/{entityId}/...
    └── avatars/{userId}.{ext}

`{nanoid}` is a server-generated unique identifier (10-character nanoid using the default alphabet). It is generated at upload time by the server.. the client does NOT provide it. This ensures gallery images have unique, collision-free public IDs without requiring the client to track indices.
```

`{env}` MUST be one of: `dev`, `test`, `preview`, `prod`. The value MUST be derived from `NODE_ENV` and the Vercel environment, not hardcoded. A single Cloudinary account is used for all environments; the folder prefix provides isolation.

**Env detection logic** (MUST be implemented as a pure function in `packages/media`):

| `VERCEL_ENV` | `NODE_ENV` | Resolved `{env}` |
|-------------|-----------|-------------------|
| `"production"` | any | `prod` |
| `"preview"` | any | `preview` |
| not set | `"test"` | `test` |
| not set | any other | `dev` |

Seed images MUST be stored under `hospeda/{env}/seed/` with the same sub-folder structure as real uploads. This isolation ensures `--clean-images` can remove all seed assets without affecting manually uploaded production images.

**Scenario REQ-02-A .. Upload goes to the correct folder:**
```
Given an accommodation with id "abc-123" uploading a featured image in the dev environment,
When the upload completes via the admin upload endpoint,
Then the Cloudinary public ID is "hospeda/dev/accommodations/abc-123/featured"
  (extension determined by Cloudinary based on the uploaded file format).
```

**Scenario REQ-02-B .. Seed upload goes to the seed folder:**
```
Given an accommodation with id "abc-123" being seeded in the dev environment,
When the seed process uploads its featured image,
Then the Cloudinary public ID is "hospeda/dev/seed/accommodations/abc-123/featured"
  (note the "seed/" segment between env and entity type).
```

---

### REQ-03: File Validation

The API MUST reject uploads that fail validation BEFORE calling Cloudinary. Validation MUST happen in `packages/media` (as a standalone `validateMediaFile()` function) so it can be reused in tests without an HTTP context.

#### REQ-03.1: General Images (all entities except avatars)

| Constraint | Value |
|-----------|-------|
| Maximum file size | Configurable via `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` env var (default: `10`) |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/avif` |
| Maximum dimensions | 8000 x 8000 pixels |

#### REQ-03.2: Avatars (User `image` field)

| Constraint | Value |
|-----------|-------|
| Maximum file size | 5 MB (fixed, not configurable .. avatars are always small) |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Maximum dimensions | 4000 x 4000 pixels |

#### REQ-03.3: Configurable Body Size Limit

The maximum upload file size MUST be configurable via the `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` environment variable. Default is `10` (megabytes).

**Vercel plan consideration**: Vercel Functions on the Hobby plan have a 4.5 MB request body limit. On the Pro plan, the limit is 100 MB. If `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` exceeds 4.5, the Vercel Function configuration MUST set `maxBodySize` accordingly, which requires the Pro plan. This MUST be documented in the env var registry entry as a comment.

#### REQ-03.4: Content-Length Pre-Check

The upload route handler MUST check the `Content-Length` request header BEFORE parsing the multipart body. If `Content-Length` exceeds the configured maximum, the request MUST be rejected with HTTP 413 immediately, without buffering any data. This follows the existing pattern in `apps/api/src/routes/feedback/public/submit.ts` (line ~129).

**Validation precedence**: The Content-Length pre-check (HTTP 413) fires FIRST, before any multipart body is parsed. If the `Content-Length` header is absent, understated, or not provided by the client, the file size validation after multipart parsing (HTTP 422) serves as the safety net. Both layers are intentional: 413 is a bandwidth-saving optimization, 422 is the authoritative validation.

**Scenario REQ-03-A .. File too large:**
```
Given a user submits a JPEG file of 12 MB via the admin upload endpoint
  and HOSPEDA_MEDIA_MAX_FILE_SIZE_MB is set to 10,
When the API processes the request,
Then the API rejects it with HTTP 422
  and a body containing { error: "FILE_TOO_LARGE", maxBytes: 10485760 }
  and Cloudinary is never called.
```

**Scenario REQ-03-B .. Disallowed MIME type:**
```
Given a user submits a GIF file (image/gif),
When the API processes the request,
Then the API rejects it with HTTP 422
  and a body containing { error: "INVALID_FILE_TYPE", allowedTypes: [...] }
  and Cloudinary is never called.
```

**Scenario REQ-03-C .. Avatar size limit:**
```
Given an authenticated user uploads a PNG avatar of 6 MB,
When the API processes the request,
Then the API rejects it with HTTP 422
  and a body containing { error: "FILE_TOO_LARGE", maxBytes: 5242880 }
  and the user's avatar is unchanged.
```

**Scenario REQ-03-D .. Valid file passes validation:**
```
Given a user submits a WebP file of 2 MB with dimensions 1920x1080,
When the API processes the request,
Then validation passes
  and the file is forwarded to Cloudinary for upload.
```

**Scenario REQ-03-E .. Content-Length pre-check rejects oversized request:**
```
Given a request with Content-Length header indicating 50 MB,
When the request arrives at the upload endpoint,
Then the API responds with HTTP 413 BEFORE parsing the multipart body
  and no data is buffered.
```

**Scenario REQ-03-F .. Dimension validation rejects oversized image:**
```
Given a user submits a JPEG file of 5 MB with dimensions 10000x10000,
When the API processes the request,
Then the API rejects it with HTTP 422
  and a body containing { error: "IMAGE_TOO_LARGE", maxWidth: 8000, maxHeight: 8000 }
  and Cloudinary is never called.
```

#### REQ-03.5: MIME Type Validation Strategy

MIME type validation MUST check the `Content-Type` header of the uploaded file part (as provided by the browser/client). Additionally, the `image-size` package call (for dimension validation) serves as a secondary validation: if `image-size` cannot parse the buffer, the file is not a valid image regardless of the declared MIME type. The `validateMediaFile()` function MUST handle `image-size` parse failures as an invalid file type error.

**Note**: Full magic-bytes validation (reading file headers to verify actual format) is NOT required. The combination of declared MIME type + `image-size` header parsing provides sufficient validation. Since Cloudinary itself validates and re-encodes uploads, a spoofed MIME type would be caught by Cloudinary or `image-size` before any harm occurs.

**Scenario REQ-03.5-A .. File with spoofed MIME type:**
```
Given a user submits a file with Content-Type "image/jpeg" but the actual content is a text file,
When validateMediaFile() runs and image-size cannot parse dimensions,
Then the API rejects it with HTTP 422
  and a body containing { error: "INVALID_IMAGE", message: "Unable to determine image dimensions" }
  and Cloudinary is never called.
```

---

### REQ-04: Upload and Delete API Endpoints

#### REQ-04.1: Admin Upload Endpoint

**Route**: `POST /api/v1/admin/media/upload`

This endpoint MUST require an authenticated admin session.

Request: `multipart/form-data` with fields:
- `file` (required) .. the image binary
- `entityType` (required) .. one of: `accommodation`, `destination`, `event`, `post`
- `entityId` (required) .. UUID string of the entity
- `role` (required) .. one of: `featured`, `gallery`

When `role` is `gallery`, the server generates a unique suffix (10-character nanoid) for the Cloudinary public ID. The client does NOT provide an index or identifier for gallery images.

**Multipart parsing**: Use Hono's native `ctx.req.formData()` API (no external multipart middleware). This is the established pattern in the codebase (see `apps/api/src/routes/feedback/public/submit.ts`).

Response on success (HTTP 200):
```json
{
  "url": "https://res.cloudinary.com/hospeda/image/upload/v.../hospeda/prod/accommodations/abc/featured.jpg",
  "publicId": "hospeda/prod/accommodations/abc/featured",
  "width": 1920,
  "height": 1080
}
```

The `url` returned MUST be the **base URL** (from Cloudinary's `secure_url` response field) without any transform parameters. The caller (admin UI) stores this URL in the DB.

**Scenario REQ-04.1-A .. Unauthenticated request is rejected:**
```
Given a request to POST /api/v1/admin/media/upload without a valid admin session,
When the request is received,
Then the API responds with HTTP 401
  and the file is not stored.
```

**Scenario REQ-04.1-B .. Successful entity image upload:**
```
Given an admin is authenticated and submits a valid JPEG (3 MB) with
  entityType="accommodation", entityId="abc-123", role="featured",
When the API processes the request,
Then HTTP 200 is returned
  and the response body contains { url, publicId, width, height }
  and the url starts with "https://" (never "http://")
  and the url contains "hospeda/{env}/accommodations/abc-123/featured"
  and the url contains NO transform parameters (no w_, h_, c_, etc. segments)
  and Cloudinary has the asset stored at that path.
```

**Scenario REQ-04.1-C .. Gallery upload with server-generated ID:**
```
Given an admin submits a valid PNG with role="gallery",
When the API processes the request,
Then the server generates a unique nanoid suffix (e.g., "a7x3kB9m2p")
  and the publicId is "hospeda/{env}/accommodations/abc-123/gallery/a7x3kB9m2p"
  and the response includes the generated publicId for the client to store.
```

**Scenario REQ-04.1-D .. Missing required field:**
```
Given an admin submits a valid file but omits entityType,
When the API processes the request,
Then HTTP 422 is returned with a validation error body
  and Cloudinary is never called.
```

**Scenario REQ-04.1-E .. Cloudinary unreachable:**
```
Given the Cloudinary API is not reachable (network timeout or 5xx),
When the API attempts to upload,
Then the API responds with HTTP 502
  and a body containing { error: "UPSTREAM_ERROR", message: "..." }
  and no partial state is stored.
```

**Scenario REQ-04.1-G .. Entity does not exist:**
```
Given an admin submits a valid file with entityType="accommodation", entityId="nonexistent-uuid",
When the API processes the request,
Then the API verifies the entity exists via a DB lookup
  and returns HTTP 404 with { error: "ENTITY_NOT_FOUND", entityType: "accommodation", entityId: "nonexistent-uuid" }
  and Cloudinary is never called.
```

**Scenario REQ-04.1-H .. Path traversal protection:**
```
Given an admin submits a request with entityId="../../../malicious",
When the API processes the request,
Then entityId is validated as a UUID v4 format (via Zod `z.string().uuid()`)
  and entityType is validated against an allowlist enum (accommodation | destination | event | post)
  and HTTP 422 is returned because entityId is not a valid UUID
  and Cloudinary is never called.
```

**Security note**: The combination of UUID validation on `entityId` and enum validation on `entityType` inherently prevents path traversal attacks in Cloudinary folder paths. No additional sanitization is needed because UUIDs cannot contain `/`, `..`, or other path metacharacters.

**Scenario REQ-04.1-I .. Cloudinary returns unexpected response:**
```
Given Cloudinary upload() returns a response missing `secure_url` or `public_id`,
When the API processes the Cloudinary response,
Then the API responds with HTTP 502
  and a body containing { error: "UPSTREAM_ERROR", message: "Cloudinary returned an incomplete response" }
  and no partial state is stored.
```

#### REQ-04.1-FLOW: Upload-to-DB Data Flow

The upload endpoint (`POST /api/v1/admin/media/upload`) is a **Cloudinary proxy only**. It does NOT modify any entity record in the database. The complete data flow is:

1. Admin UI selects a file and calls `POST /api/v1/admin/media/upload` with the file + metadata.
2. The upload endpoint validates the file, verifies the entity exists (see REQ-04.1-G), uploads to Cloudinary, and returns `{ url, publicId, width, height }`.
3. The admin UI receives the URL and updates the local form state (e.g., sets `media.featuredImage.url` to the returned URL).
4. When the admin saves the entity form, the admin UI calls the entity's PATCH endpoint (e.g., `PATCH /api/v1/admin/accommodations/:id`) with the updated `media` JSONB.
5. The entity's PATCH endpoint validates and persists the updated media to the database.

**The upload endpoint MUST NOT write to the database.** This separation ensures that:
- Upload failures don't leave partial DB state.
- The admin can upload an image, preview it, and choose not to save (the Cloudinary asset exists but the DB is unchanged — acceptable orphan, cleaned up by future audit job).
- Entity validation (required fields, business rules) is handled by the entity's own PATCH endpoint, not duplicated in the upload endpoint.

#### REQ-04.2: Protected Avatar Upload Endpoint

**Route**: `POST /api/v1/protected/media/upload`

This endpoint MUST require an authenticated user session (any role). The `entityId` is inferred from the session .. users MUST NOT upload to another user's avatar path.

Request: `multipart/form-data` with fields:
- `file` (required) .. the image binary

Response on success (HTTP 200):
```json
{
  "url": "https://res.cloudinary.com/hospeda/image/upload/v.../hospeda/prod/avatars/user-id.jpg",
  "publicId": "hospeda/prod/avatars/user-id",
  "width": 800,
  "height": 800
}
```

The upload MUST use `overwrite: true` so that the same public ID is reused for the user's avatar. This means the previous avatar is replaced in Cloudinary, not duplicated.

**Scenario REQ-04.2-A .. Authenticated user uploads avatar:**
```
Given an authenticated user with id "user-xyz" submits a valid JPEG avatar (1 MB),
When the API processes the request,
Then HTTP 200 is returned
  and the response body contains { url, publicId, width, height }
  and the url contains "hospeda/{env}/avatars/user-xyz"
  and the url starts with "https://"
  and the previous avatar at that path is replaced (same publicId, overwrite: true).
```

**Scenario REQ-04.2-B .. Unauthenticated request is rejected:**
```
Given a request without a valid user session,
When the request hits POST /api/v1/protected/media/upload,
Then HTTP 401 is returned.
```

#### REQ-04.2-FLOW: Avatar Upload-to-DB Data Flow

The avatar upload endpoint follows the same "Cloudinary proxy only" principle as the admin upload (REQ-04.1-FLOW). It does NOT modify the user's `image` field in the database. The complete data flow is:

1. User selects a new avatar and calls `POST /api/v1/protected/media/upload` with the file.
2. The upload endpoint validates the file, uploads to Cloudinary with `overwrite: true`, and returns `{ url, publicId, width, height }`.
3. The client (web app avatar component) receives the URL and calls a user profile update endpoint (e.g., `PATCH /api/v1/protected/users/me`) with `{ image: returnedUrl }`.
4. The user profile PATCH endpoint validates and persists the updated `image` field to the database.

**Prerequisite**: A `PATCH /api/v1/protected/users/me` endpoint (or equivalent) MUST exist for the avatar flow to complete end-to-end. If this endpoint does not exist at implementation time, it MUST be created as part of this spec's implementation. The endpoint only needs to accept `{ image: string }` for this use case (other profile fields are out of scope).

#### REQ-04.3: Admin Delete Endpoint

**Route**: `DELETE /api/v1/admin/media?publicId={urlEncodedPublicId}`

This endpoint MUST require an authenticated admin session.

Request: query parameter:
- `publicId` (required) .. URL-encoded Cloudinary public ID (e.g., `hospeda/prod/accommodations/abc-123/gallery/a7x3kB9m2p`)

The endpoint validates that:
1. `publicId` is a non-empty string.
2. `publicId` starts with `hospeda/` (prevents deleting assets outside the Hospeda namespace).

Response on success (HTTP 200):
```json
{
  "deleted": true,
  "publicId": "hospeda/prod/accommodations/abc-123/gallery/a7x3kB9m2p"
}
```

**Design rationale**: The publicId is passed as a query parameter instead of a request body because many HTTP proxies and CDNs may strip or ignore the body of DELETE requests. Query parameters are universally supported.

**Purpose**: When an admin removes an image from an entity's gallery or replaces a featured image, the client SHOULD call this endpoint to delete the old Cloudinary asset. This prevents orphaned assets from accumulating in Cloudinary storage.

**Scenario REQ-04.3-A .. Successful delete:**
```
Given an admin is authenticated and sends
  DELETE /api/v1/admin/media?publicId=hospeda%2Fprod%2Faccommodations%2Fabc-123%2Fgallery%2Fa7x3kB9m2p,
When the API processes the request,
Then the Cloudinary asset is deleted via provider.delete()
  and HTTP 200 is returned with { deleted: true, publicId: "hospeda/prod/accommodations/abc-123/gallery/a7x3kB9m2p" }.
```

**Scenario REQ-04.3-B .. Reject publicId outside namespace:**
```
Given an admin sends a delete request with publicId=some-other-account%2Fimage,
When the API processes the request,
Then HTTP 422 is returned with an error indicating the publicId must start with "hospeda/".
```

**Scenario REQ-04.3-C .. Cloudinary returns not found:**
```
Given the publicId does not exist in Cloudinary,
When the API attempts to delete it,
Then Cloudinary's destroy() returns { result: "not found" } (it does NOT throw)
  and the API responds with HTTP 200 (idempotent delete .. no error)
  and the response body is { deleted: true, publicId: "..." }
  (the API treats "not found" the same as "ok" for idempotency).
```

**Scenario REQ-04.3-D .. Unauthenticated request is rejected:**
```
Given a request without a valid admin session,
When the request hits DELETE /api/v1/admin/media,
Then HTTP 401 is returned.
```

**Scenario REQ-04.3-E .. Missing publicId parameter:**
```
Given an admin sends DELETE /api/v1/admin/media without a publicId query parameter,
When the API processes the request,
Then HTTP 422 is returned with a validation error indicating publicId is required.
```

---

### REQ-05: URL Storage Convention

The base Cloudinary URL (without any transform parameters) MUST be the value stored in the database. Transform parameters are NEVER stored.

Example of a valid stored value:
```
https://res.cloudinary.com/hospeda/image/upload/v1234567890/hospeda/prod/accommodations/abc-123/featured.jpg
```

Example of an INVALID stored value (transforms included .. MUST NOT be stored):
```
https://res.cloudinary.com/hospeda/image/upload/w_400,h_300,c_fill/v1234567890/accommodations/abc/featured.jpg
```

All rendering code in `apps/web` and `apps/admin` MUST call `getMediaUrl(storedUrl, { preset })` and use the result as the `src` attribute. Direct use of stored URLs as `src` values MUST be treated as a bug.

**Scenario REQ-05-A .. Stored URL is clean:**
```
Given an upload completes successfully,
When the API response url is stored in the DB as accommodation.media.featuredImage.url,
Then the stored value contains no transform parameters
  (i.e., the path segment after "/upload/" begins with "v" or the public ID, not a transform string)
  and the stored value starts with "https://".
```

---

### REQ-06: Environment Variables

The following environment variables MUST be defined in `packages/config` (file: `packages/config/src/env-registry.hospeda.ts`) and validated via the existing Zod env schema:

| Variable | Required in | Description | Secret |
|----------|-------------|-------------|--------|
| `HOSPEDA_CLOUDINARY_CLOUD_NAME` | `apps/api`, `packages/seed` | Cloudinary account cloud name | No |
| `HOSPEDA_CLOUDINARY_API_KEY` | `apps/api`, `packages/seed` | Cloudinary API key | Yes |
| `HOSPEDA_CLOUDINARY_API_SECRET` | `apps/api`, `packages/seed` | Cloudinary API secret | Yes |
| `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` | `apps/api` | Maximum upload file size in MB. Default: `10`. Values above `4.5` require Vercel Pro plan (body size limit). | No |

**Registry entry pattern** (follow existing format in `env-registry.hospeda.ts`):
```typescript
{
    name: 'HOSPEDA_CLOUDINARY_CLOUD_NAME',
    description: 'Cloudinary account cloud name for image storage',
    type: 'string',
    required: false, // API starts with degraded mode if missing (REQ-06-B)
    secret: false,
    exampleValue: 'hospeda',
    apps: ['api'],
    category: 'integrations'
}
```

These variables MUST NOT be present in `apps/admin` or `apps/web` .. those apps do not communicate with Cloudinary directly. `getMediaUrl()` does not need credentials (pure string transformation).

**Scenario REQ-06-A .. Web app starts without Cloudinary vars:**
```
Given HOSPEDA_CLOUDINARY_CLOUD_NAME, _API_KEY, and _API_SECRET are absent from the environment,
When apps/web starts,
Then it starts successfully
  and getMediaUrl() on non-Cloudinary URLs returns them unchanged
  and no error is thrown at startup.
```

**Scenario REQ-06-B .. API starts without Cloudinary vars:**
```
Given HOSPEDA_CLOUDINARY_CLOUD_NAME is not set when apps/api starts,
When the API server boots,
Then it starts successfully (does NOT throw at startup)
  and upload/delete endpoints return HTTP 503 with { error: "CLOUDINARY_NOT_CONFIGURED" }
  and a warning is logged at startup: "[media] Cloudinary not configured - upload endpoints disabled"
  and all other API endpoints work normally.
```

---

### REQ-07: Seed Integration

The seed system MUST support uploading seed images to Cloudinary and caching results to avoid redundant uploads on subsequent runs.

**Current seed data context**: Seed JSON files in `packages/seed/src/data/` reference images from multiple sources (Unsplash: `images.unsplash.com`, Pexels: `images.pexels.com`). The seed system downloads these URLs and re-uploads them to Cloudinary under the `seed/` folder prefix.

#### REQ-07.1: Cache File

The cache MUST be stored at `packages/seed/.cloudinary-cache.json`. The format MUST be:

```json
{
  "hospeda/dev/seed/accommodations/abc-123/featured": {
    "originalUrl": "https://images.unsplash.com/...",
    "cloudinaryUrl": "https://res.cloudinary.com/hospeda/image/upload/v.../hospeda/dev/seed/accommodations/abc-123/featured.jpg",
    "uploadedAt": "2026-04-13T12:00:00.000Z",
    "fileModifiedAt": null
  }
}
```

The cache key MUST be the Cloudinary public ID (including the `seed/` prefix). For URL-sourced images, `fileModifiedAt` MUST be `null`. For local-file-sourced images, `fileModifiedAt` MUST be the ISO 8601 timestamp of the file's last modification date.

The cache file MUST be in `.gitignore` and MUST NOT be committed to the repository.

#### REQ-07.2: Cache Hit and Miss Logic

On each seed run, for every image entry in the seed JSON:

- **Source is a URL**: if the cache entry exists AND `originalUrl` matches the current seed JSON value, use the cached `cloudinaryUrl`. Otherwise, fetch the URL, upload to Cloudinary under `hospeda/{env}/seed/{entityType}/{entityId}/{role}`, and update the cache.
- **Source is a local file path**: if the cache entry exists AND the file's current last-modified timestamp matches `fileModifiedAt`, use the cached `cloudinaryUrl`. Otherwise, upload and update the cache.

After a successful upload, the cache MUST be updated atomically before proceeding to the next image (partial cache writes are acceptable .. the cache is advisory, not transactional).

**Scenario REQ-07.2-A .. First seed run uploads all images:**
```
Given no cache file exists
  and the seed JSON references 20 image URLs (from Unsplash and Pexels),
When the seed runs with Cloudinary vars configured,
Then each URL is fetched and uploaded to Cloudinary under hospeda/{env}/seed/...
  and the cache file is created with 20 entries
  and each DB record stores the Cloudinary URL (not the original Unsplash/Pexels URL).
```

**Scenario REQ-07.2-B .. Second seed run uses cache:**
```
Given the cache file exists with 20 entries
  and none of the source URLs in seed JSON have changed,
When the seed runs again,
Then Cloudinary upload() is NOT called for any image
  and each DB record stores the same Cloudinary URLs from the cache
  and the total seed time is significantly reduced.
```

**Scenario REQ-07.2-C .. Source URL changed:**
```
Given the cache has an entry for "hospeda/dev/seed/accommodations/abc/featured"
  with originalUrl="https://images.unsplash.com/old",
  and the seed JSON now contains originalUrl="https://images.unsplash.com/new" for that entry,
When the seed runs,
Then the new URL is fetched and re-uploaded to Cloudinary
  and the cache entry is updated with the new originalUrl and cloudinaryUrl
  and the DB record stores the new Cloudinary URL.
```

**Scenario REQ-07.2-D .. Local file changed:**
```
Given the cache has an entry with fileModifiedAt="2026-01-01T00:00:00.000Z"
  and the referenced local file now has a last-modified timestamp of "2026-04-01T10:00:00.000Z",
When the seed runs,
Then the file is re-uploaded to Cloudinary
  and the cache entry fileModifiedAt is updated to "2026-04-01T10:00:00.000Z".
```

**Scenario REQ-07.2-E .. Corrupted cache file:**
```
Given the cache file exists but contains invalid JSON (e.g., truncated due to process kill mid-write),
When the seed process starts and attempts to read the cache,
Then it logs a warning: "[seed] Cache file corrupted, starting fresh"
  and deletes the corrupt cache file
  and proceeds as if no cache exists (re-uploads all images)
  and a new valid cache file is created during the run.
```

#### REQ-07.3: Missing Cloudinary Env Vars Fallback

When Cloudinary env vars are not set, the seed MUST continue without error. In this case:

- Each image field in the seeded DB record retains the original URL from the seed JSON (Unsplash/Pexels URL, local placeholder, etc.).
- A single warning is printed at seed start: `[seed] Cloudinary env vars not configured -- images will use original URLs`.
- The cache file is neither read nor written.

**Scenario REQ-07.3-A .. Graceful degradation:**
```
Given HOSPEDA_CLOUDINARY_CLOUD_NAME is not set,
When the seed runs,
Then it completes without error
  and accommodation records contain the original Unsplash/Pexels URLs
  and no cache file is created or modified.
```

#### REQ-07.4: Seed Cleanup Flag

The seed CLI MUST support a `--clean-images` flag (added to the existing args parsing in `packages/seed/src/cli.ts`). This flag:

1. Deletes all assets under the `hospeda/{env}/seed/` prefix from Cloudinary using `deleteByPrefix()`.
2. Deletes the local cache file at `packages/seed/.cloudinary-cache.json`.

**Scenario REQ-07.4-A .. Clean removes remote and local cache:**
```
Given Cloudinary is configured and the cache file exists,
When `pnpm seed --clean-images` is run,
Then the Cloudinary seed folder is deleted via deleteByPrefix("hospeda/{env}/seed/")
  and the local cache file is deleted
  and subsequent seed runs behave as if running for the first time.
```

**Scenario REQ-07.4-B .. Clean without Cloudinary configured:**
```
Given Cloudinary env vars are not set,
When `pnpm seed --clean-images` is run,
Then a warning is printed that Cloudinary is not configured
  and the local cache file is deleted (if it exists)
  and no error is thrown.
```

#### REQ-07.5: `resetDatabase()` Integration via CLI

The existing `resetDatabase()` utility in `packages/seed/src/utils/dbReset.ts` has signature `resetDatabase(exclude: string[] = [])` and handles database table cleanup only. It MUST NOT be modified to accept image cleanup flags.

Instead, the CLI layer (`packages/seed/src/cli.ts`) MUST handle image cleanup as a **separate step** when the `--clean-images` flag is passed alongside database reset operations (e.g., `pnpm seed --reset --clean-images`). The image cleanup (REQ-07.4) runs as a distinct operation before or after `resetDatabase()`, not inside it. This keeps concerns separated: `resetDatabase()` handles DB, the CLI orchestrates both DB and Cloudinary cleanup.

#### REQ-07.6: Concurrent Seed Runs

Concurrent seed runs (e.g., two developers running `pnpm seed` simultaneously against the same Cloudinary account) are NOT supported and may result in cache file corruption or duplicate uploads. Since the cache is advisory (worst case is redundant re-uploads, not data loss), no locking mechanism is required. A warning SHOULD be logged if the cache file is locked or being written to by another process, but this is a best-effort check, not a hard requirement.

---

### REQ-08: Admin Panel Upload UI

The admin panel MUST provide upload UI components for entity image fields.

**Existing component context**: The admin panel already has a `GalleryField` component at `apps/admin/src/components/entity-form/fields/GalleryField.tsx` that supports drag-and-drop, file validation, and preview. This component currently validates file type (JPEG, PNG, WebP) and file size (5 MB default). The implementation MUST extend this existing component rather than building from scratch.

**Interface mapping note**: The existing `GalleryField` component uses a local `GalleryImage` interface with fields `{ id, url, caption?, description?, alt?, order }`. The `@repo/schemas` `ImageSchema` defines `{ moderationState, url, caption?, description? }`. The mapping is:
- `GalleryImage.id` → generated client-side for React keys and drag-and-drop tracking (not stored in DB)
- `GalleryImage.url` → maps to `ImageSchema.url`
- `GalleryImage.caption` → maps to `ImageSchema.caption`
- `GalleryImage.description` → maps to `ImageSchema.description`
- `GalleryImage.alt` → not present in `ImageSchema`; stored as part of the admin form state but not in the `media` JSONB
- `GalleryImage.order` → implicit from array position in `media.gallery` (Cloudinary public IDs use nanoid suffixes, not array indices)
- `ImageSchema.moderationState` → not editable in `GalleryField`; defaults to `APPROVED` for admin uploads

The `GalleryField` component transforms between these interfaces when loading/saving data.

#### REQ-08.1: General Requirements

- The upload UI MUST extend the existing `GalleryField` component (or follow its established patterns for new components).
- The `GalleryField.onUpload` callback prop (`onUpload?: (file: File) => Promise<string>`) MUST be wired to call the admin upload endpoint (`POST /api/v1/admin/media/upload`).
- The component MUST support drag-and-drop and click-to-browse file selection (already implemented in `GalleryField`).
- The component MUST display a preview of the current image (if a URL is provided) and the newly selected file (before upload, using `URL.createObjectURL()`).
- The component MUST show upload progress via a progress indicator while the request is in flight.
- The component MUST display a clear error message when the API returns a validation error or upstream error.
- On successful upload, the component MUST call `onUpload(file)` and use the returned URL string to update the form state. The `onUpload` prop signature is `(file: File) => Promise<string>` — it receives the File, internally calls the upload API, and returns the Cloudinary URL.
- Client-side validation MUST match server-side limits: file type (JPEG, PNG, WebP, HEIC, AVIF), file size (from `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`, provided as a prop or fetched from config).
- **Update needed**: The existing `GalleryField` has a 5 MB default size limit. This MUST be updated to match the configurable `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` value (default 10 MB) for entity images.

**Scenario REQ-08.1-A .. File selected and uploaded:**
```
Given an admin opens an accommodation edit form,
When they drag a valid JPEG onto the featured image field,
Then a preview of the image is shown immediately (using URL.createObjectURL())
  and a "Upload" button or auto-upload begins
  and a progress indicator is shown during the upload
  and on success the preview updates to reflect the saved image
  and the onUpload callback is called with the new URL.
```

**Scenario REQ-08.1-B .. File rejected by client-side validation:**
```
Given an admin selects a 15 MB file and the configured limit is 10 MB,
When the file is selected (before any network call),
Then the component displays "File exceeds maximum size of 10 MB"
  and no upload request is sent.
```

**Scenario REQ-08.1-C .. Upload fails:**
```
Given an admin submits a valid file,
When the API responds with HTTP 502 (upstream error),
Then the component displays an error message
  and the previous image URL is not changed
  and the admin can retry.
```

**Scenario REQ-08.1-D .. Empty state (no current image):**
```
Given an entity has no featured image set (media is null or featuredImage is missing),
When the admin views the image field,
Then the field shows a placeholder illustration with "Click or drag to upload"
  and the absence of an image is visually clear.
```

#### REQ-08.2: Gallery Management

Admin gallery fields MUST support adding, reordering, and removing images.

**Scenario REQ-08.2-A .. Add gallery image:**
```
Given an accommodation has 2 gallery images,
When an admin uploads a new image to the gallery,
Then the new image appears as the third gallery item
  and the server generates a unique nanoid for the Cloudinary public ID
  and the client does NOT specify any index or identifier.
```

**Scenario REQ-08.2-B .. Remove gallery image with Cloudinary cleanup:**
```
Given an accommodation has 3 gallery images,
When an admin removes the second image,
Then the gallery shows 2 images
  and the admin UI calls DELETE /api/v1/admin/media with the removed image's publicId
    (publicId is extracted from the stored Cloudinary URL)
  and the admin can save the entity with the updated gallery.
```

**Scenario REQ-08.2-C .. Replace featured image:**
```
Given an accommodation already has a featured image at publicId "hospeda/prod/accommodations/abc-123/featured",
When an admin uploads a new featured image for the same entity,
Then the upload uses the same publicId "hospeda/prod/accommodations/abc-123/featured"
  and Cloudinary overwrites the existing asset in-place (same publicId, overwrite: true by default)
  and no separate delete call is needed for the old featured image
  and the returned URL may have a different version number (v{new_version}).
```

**Note**: Unlike gallery images (which have unique index-based publicIds), featured images always use the same publicId path. Cloudinary's default `overwrite: true` behavior for signed uploads handles replacement automatically. The version number in the URL changes, so the admin UI MUST save the new URL returned by the upload endpoint to ensure CDN cache busting.

**Gallery public ID note**: Each gallery image gets a unique nanoid-based public ID (e.g., `gallery/a7x3kB9m2p`) generated at upload time by the server. This ID is an immutable identifier.. it does NOT represent display order. Display order is determined by the array position in the entity's `media.gallery` JSONB array. When an image is removed from the gallery and remaining items are reordered in the UI, the Cloudinary public IDs are NOT renamed or re-uploaded. The public ID serves as a stable reference, not an ordinal position.

For example: gallery images with public IDs `gallery/a7x3k`, `gallery/b9m2p`, `gallery/c4j8q` may be reordered in the JSONB array as `[gallery/c4j8q, gallery/a7x3k]` after removing the second image. The Cloudinary assets remain unchanged.

**Note on publicId extraction**: To call the delete endpoint, the admin UI needs the `publicId`. This can be extracted from a Cloudinary URL using `extractPublicId()` from `@repo/media` (see REQ-01.5). Returns `null` for non-Cloudinary URLs.

#### REQ-08.3: Gallery Size Limits

The maximum number of gallery images per entity MUST NOT be hardcoded in the upload UI or API. Instead, the limit is enforced by the existing billing entitlements/limits system. The upload endpoint and gallery component MUST check the entity's current entitlements to determine if more gallery images can be added.

**If the billing system does not yet expose a gallery limit entitlement**, the upload endpoint MUST allow unlimited gallery images (no artificial cap). The billing integration for gallery limits is out of scope for this spec .. it will be added when the entitlement is defined.

---

### REQ-09: Web App Avatar Upload

The web app MUST provide an avatar upload flow within the user account settings page.

**Prerequisite**: An account settings page must exist in `apps/web`. Account-related components exist (`AccountSectionCards.astro`, `AccountStatsGrid.astro`) and an account edit page exists at `apps/web/src/pages/[lang]/mi-cuenta/editar/index.astro`. The avatar upload UI MUST be implemented as a React island component placed on this edit page (or on a dedicated profile section within it).

**Scenario REQ-09-A .. User uploads avatar:**
```
Given an authenticated user navigates to their profile/account settings,
When they click "Change avatar" and select a valid PNG file,
Then a preview is shown
  and on confirmation the file is uploaded to POST /api/v1/protected/media/upload
  and on success the new avatar URL is displayed
  and the page reflects the update without a full reload (React island handles state).
```

**Scenario REQ-09-B .. User uploads invalid avatar type:**
```
Given an authenticated user selects a GIF file for their avatar,
When the file is selected,
Then the UI displays "Only JPEG, PNG, and WebP files are supported for avatars"
  and no upload request is sent.
```

---

### REQ-10: Migration of Existing Image Rendering

#### REQ-10.1: `apps/web/src/lib/media.ts`

The existing `media.ts` utility in the web app MUST be refactored to delegate all URL building to `getMediaUrl()` from `@repo/media`.

**Current state**: `media.ts` exports two functions:
- `extractFeaturedImageUrl(item, fallback)` .. extracts the featured image URL from an entity's media object with fallback chain (media.featuredImage.url > item.featuredImage > item.heroImage > item.image > fallback).
- `extractGalleryUrls(item)` .. extracts gallery image URLs as a string array.

**Migration approach**: These functions MUST be updated to:
1. Extract the raw URL using the existing fallback logic.
2. Pass the extracted URL through `getMediaUrl(url, { preset })` before returning.
3. Accept an optional `preset` parameter (defaulting to `'card'` for featured images, `'gallery'` for gallery items).

The file MUST NOT contain its own URL transformation logic after this migration. It MAY retain the extraction/fallback logic (that's its purpose), but all URL optimization MUST go through `@repo/media`.

**Scenario REQ-10.1-A .. Migration does not break existing images:**
```
Given accommodation pages were rendering Unsplash/Pexels URLs via the old media.ts,
When media.ts is updated to use getMediaUrl(),
Then non-Cloudinary URLs continue to render unchanged (REQ-01.3-B applies)
  and the visual output on existing pages is identical to before.
```

#### REQ-10.2: Admin Image Display

All `<img>` elements in admin list views and detail forms that display entity images MUST use `getMediaUrl(storedUrl, { preset: 'thumbnail' })` for list views and an appropriate preset for detail views.

**Current state**: Admin components use raw `<img src={url} />` with URLs directly from the API (e.g., in `apps/admin/src/routes/_authed/accommodations/$id_.gallery.tsx`). These MUST be updated to use `getMediaUrl()`.

---

### REQ-11: `packages/media` Package Constraints

- The package MUST be a pure TypeScript package with no framework dependencies (no React, no Hono, no Astro).
- The package MUST follow the established package structure pattern: `tsup` build, ESM + CJS output, `"type": "module"`, standard scripts (build, dev, test, typecheck, lint, format, check, clean). Reference `packages/icons/package.json` for the exact template.
- The package MUST export: `ImageProvider` (interface), `CloudinaryProvider` (class), `getMediaUrl` (function), `MEDIA_PRESETS` (readonly constant), `validateMediaFile` (function), `extractPublicId` (function), `resolveEnvironment` (function), `generateGalleryId` (function .. wraps nanoid(10) for gallery public ID suffixes), and all related types.
- The package MUST have comprehensive unit tests with at least 90% line coverage.
- `CloudinaryProvider` tests MUST mock the Cloudinary SDK .. they MUST NOT make real network calls.
- `getMediaUrl` tests MUST NOT require any Cloudinary credentials (it is pure string transformation).
- `validateMediaFile` tests MUST cover all constraint combinations (size, type, dimensions) for both general images and avatars.
- Dimension validation MUST use the `image-size` npm package to read dimensions from buffer headers without decoding the full image.

---

### REQ-12: Entity Deletion Image Cleanup

When an entity (accommodation, destination, event, or post) is deleted (soft delete or hard delete), its associated Cloudinary images SHOULD be cleaned up to prevent orphaned assets.

#### REQ-12.1: Cleanup on Hard Delete

When an entity is **hard deleted**, the delete handler MUST call `deleteByPrefix()` with the entity's Cloudinary folder path to remove all associated images (featured + gallery).

The folder path follows REQ-02: `hospeda/{env}/{entityType}/{entityId}/`.

**Important**: This uses the Cloudinary Admin API (`deleteByPrefix`), which is rate-limited. For bulk entity deletion (e.g., purging test data), the cleanup calls MUST be throttled or batched. For individual entity deletion (the common case), a single `deleteByPrefix` call per entity is acceptable.

#### REQ-12.2: Cleanup on Soft Delete

When an entity is **soft deleted** (marked as deleted but retained in DB), Cloudinary cleanup MUST NOT happen immediately. The images may be needed if the entity is restored. Cleanup of soft-deleted entity images is deferred to a periodic audit job (out of scope for this spec).

#### REQ-12.3: Implementation Location

Image cleanup logic MUST be implemented using the existing lifecycle hooks in `BaseCrudService` (defined in `packages/service-core/src/base/base.crud.hooks.ts`).

**Hook pattern** (two-step using `hookState`):

1. Override `_beforeHardDelete(id, actor, ctx)` in each entity service (accommodation, destination, event, post). This hook receives the entity `id` as its first parameter. Store the `id` and `entityType` in `ctx.hookState` for use in the after-hook:
   ```typescript
   async _beforeHardDelete(id: string, actor: Actor, ctx: ServiceContext): Promise<string> {
     ctx.hookState.deletedEntityId = id;
     ctx.hookState.entityType = 'accommodations'; // entity-specific
     return super._beforeHardDelete(id, actor, ctx);
   }
   ```

2. Override `_afterHardDelete(result, actor, ctx)` to perform the Cloudinary cleanup using the `id` stored in `hookState`:
   ```typescript
   async _afterHardDelete(result: { count: number }, actor: Actor, ctx: ServiceContext): Promise<{ count: number }> {
     if (result.count > 0 && ctx.hookState.deletedEntityId) {
       const env = resolveEnvironment();
       const prefix = `hospeda/${env}/${ctx.hookState.entityType}/${ctx.hookState.deletedEntityId}/`;
       try {
         await this.mediaProvider.deleteByPrefix({ prefix });
       } catch (error) {
         logger.warn(`[media] Failed to clean up Cloudinary assets for ${prefix}: ${error}`);
         // Best-effort: do not re-throw, entity delete already succeeded
       }
     }
     return super._afterHardDelete(result, actor, ctx);
   }
   ```

**Why this pattern**: The `_afterHardDelete` hook receives only `{ count: number }`, not the entity ID. The `_beforeHardDelete` hook receives the `id` parameter. The `hookState` object on `ServiceContext` is the established mechanism for passing data between before/after hooks (it is initialized as `{}` in `BaseCrudWrite` before each operation).

**Existing hook signatures** (from `base.crud.hooks.ts` lines 216-238):
- `_beforeHardDelete(id: string, _actor: Actor, _ctx: ServiceContext): Promise<string>`
- `_afterHardDelete(result: { count: number }, _actor: Actor, _ctx: ServiceContext): Promise<{ count: number }>`

For **user avatar cleanup**, override `_afterHardDelete` in the user service to call `provider.delete({ publicId })` with the single avatar public ID (not `deleteByPrefix`, since avatars are single files).

**Scenario REQ-12-A .. Hard delete triggers cleanup:**
```
Given an accommodation with id "abc-123" has images in Cloudinary at "hospeda/prod/accommodations/abc-123/",
When the accommodation is hard deleted via the admin API,
Then deleteByPrefix("hospeda/prod/accommodations/abc-123/") is called
  and all Cloudinary assets under that path are removed.
```

**Scenario REQ-12-B .. Soft delete does NOT trigger cleanup:**
```
Given an accommodation with id "abc-123" has images in Cloudinary,
When the accommodation is soft deleted,
Then no Cloudinary delete call is made
  and the images remain accessible.
```

**Scenario REQ-12-C .. Cleanup failure does not block delete:**
```
Given Cloudinary is unreachable when an entity is hard deleted,
When the delete handler attempts cleanup,
Then a warning is logged: "[media] Failed to clean up Cloudinary assets for {entityType}/{entityId}: {error}"
  and the entity deletion proceeds (Cloudinary cleanup is best-effort, not transactional)
  and the orphaned assets can be cleaned up manually or by a future audit job.
```

**Scenario REQ-12-D .. User deletion cleans up avatar:**
```
Given a user with id "user-xyz" has an avatar in Cloudinary at "hospeda/prod/avatars/user-xyz",
When the user account is hard deleted,
Then provider.delete({ publicId: "hospeda/prod/avatars/user-xyz" }) is called
  (single asset delete, not deleteByPrefix, since avatars are single files).
```

---

## Acceptance Criteria

The overall feature is considered complete when ALL of the following are true:

1. `packages/media` exists as a valid pnpm workspace package (`@repo/media`) that builds without errors, following the `tsup` package template.
2. `getMediaUrl()` correctly transforms Cloudinary URLs with all 7 named presets and passes through non-Cloudinary URLs unchanged.
3. `extractPublicId()` correctly parses Cloudinary URLs and returns `null` for non-Cloudinary URLs.
4. `POST /api/v1/admin/media/upload` is accessible to admin-authenticated users and returns a valid Cloudinary HTTPS URL.
5. `POST /api/v1/protected/media/upload` is accessible to any authenticated user and correctly scopes uploads to the session user's avatar path with `overwrite: true`.
6. `DELETE /api/v1/admin/media` is accessible to admin-authenticated users and deletes assets from Cloudinary, with namespace validation.
7. File validation rejects oversized files and disallowed MIME types with HTTP 422 before any Cloudinary call is made.
8. Content-Length pre-check rejects oversized requests with HTTP 413 before buffering.
9. Dimension validation rejects images exceeding the maximum pixel dimensions.
10. The seed system uploads images to Cloudinary under the `seed/` prefix when credentials are configured, populates the cache, and reuses the cache on subsequent runs.
11. `pnpm seed --clean-images` removes the Cloudinary seed folder and local cache.
12. The admin panel entity edit forms include functional drag-and-drop image upload fields (extending existing `GalleryField`) with preview, progress, and error states.
13. Gallery image removal in admin triggers a delete call to clean up the Cloudinary asset.
14. `apps/web/src/lib/media.ts` delegates to `@repo/media` and does not contain proprietary transform logic.
15. No app or package other than `packages/media` imports from the `cloudinary` SDK.
16. All 4 environment variables are registered and validated in `packages/config`.
17. Upload endpoints return HTTP 503 when Cloudinary is not configured (graceful degradation).
18. Unit test coverage for `packages/media` is at or above 90%.
19. Upload endpoints validate entity existence in the database before uploading to Cloudinary (HTTP 404 for non-existent entities).
20. Entity hard delete triggers Cloudinary asset cleanup via `deleteByPrefix()` (best-effort, non-blocking).
21. Soft delete does NOT trigger Cloudinary cleanup.
22. `extractPublicId()` correctly parses Cloudinary URLs with and without transforms/versions, and returns `null` for non-Cloudinary URLs.
23. `DELETE /api/v1/admin/media` accepts `publicId` as a query parameter (not request body).
24. Avatar upload endpoint returns `{ url, publicId, width, height }` consistent with admin upload endpoint.

---

## Technical Notes

These notes are non-binding hints for the implementer. They do not form part of the acceptance criteria.

- **Cloudinary SDK**: The `cloudinary` npm package (v2.9.0, latest v2.x) is the official Node.js SDK. Configuration uses `cloudinary.config({ cloud_name, api_key, api_secret })` with snake_case parameter names. The SDK is **CJS-only natively** (package.json has only `"main": "cloudinary.js"`, no `"type"`, `"module"`, or `"exports"` fields). The ESM `import { v2 as cloudinary } from 'cloudinary'` syntax works through **Node.js CJS interop** (Node can import CJS modules using `import` syntax), not because the package ships native ESM. Since `packages/media` uses `tsup` with ESM+CJS output, the interop works transparently.. no special configuration is needed.
- **Upload method**: The SDK provides `cloudinary.uploader.upload()` which accepts file path, remote URL, or base64 data URI string. It does **NOT** accept a raw `Buffer` directly. The SDK also provides `cloudinary.uploader.upload_stream()` which returns a Node.js writable stream (callback-based, not async/await native). For this use case (files under 10 MB, already buffered by Hono's multipart parser), two approaches are available: (1) convert the Buffer to a data URI string (`data:image/jpeg;base64,${buffer.toString('base64')}`) and pass to `upload()` .. adds ~33% memory overhead from base64 encoding but is simpler; (2) use `upload_stream()`, call `.end(buffer)` on the returned stream, wrap in a Promise .. avoids base64 overhead, preferred for files approaching the size limit. **Recommended**: use `upload_stream()` wrapped in a Promise for correctness and memory efficiency. Example pattern:
  ```typescript
  function uploadBuffer(buffer: Buffer, options: object): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      });
      stream.end(buffer);
    });
  }
  ```
- **Upload response fields**: A successful upload returns an object with many fields. The relevant ones are: `secure_url` (HTTPS URL .. use this, NOT `url` which is HTTP), `public_id`, `width`, `height`, `format`, `bytes`.
- **Delete method**: `cloudinary.uploader.destroy(publicId, options)`. Returns `{ result: "ok" }` on success or `{ result: "not found" }` when the asset does not exist. **It does NOT throw an error for missing assets** .. check the `result` field. The `invalidate: true` option purges the CDN cache for that asset but has **async propagation** (seconds to minutes for CDN edges to clear). Whether to pass it is an implementation decision .. it adds latency but ensures the old image is eventually not served from CDN cache.
- **Overwrite**: `overwrite: true` is the default for signed (server-side) uploads. For unsigned uploads the default is `false`. Since all uploads in this spec go through the API (server-side, signed), the default is correct. Explicitly passing it for avatar uploads makes the intent clear.
- **Prefix delete**: `cloudinary.api.delete_resources_by_prefix(prefix)` is an Admin API call. Rate limits: **500 requests/hour on free plan, 2000 requests/hour on paid plans**. Monitor usage via response headers: `X-FeatureRateLimit-Limit`, `X-FeatureRateLimit-Remaining`, and `X-FeatureRateLimit-Reset`. Returns `{ deleted: { [public_id]: "deleted" | "not_found" }, deleted_counts: {...}, partial: boolean }`. This is fine for `--clean-images` which is run occasionally, but MUST NOT be used in request-handling paths.
- **Dimension validation**: The `image-size` package can read image dimensions from the buffer header without decoding the full image. It's lightweight (~370 KB unpacked, reads only headers) and faster than `sharp` for this specific purpose.
- **Seed cache atomicity**: `JSON.parse`/`JSON.stringify` with atomic write (write to temp file, rename) is preferred over direct write to avoid corrupt cache on process kill mid-write.
- **Seed folder structure**: Seed images go under `hospeda/{env}/seed/{entityType}/{entityId}/{role}`. For seed gallery images, a deterministic suffix (e.g., based on array position in seed JSON) is used instead of nanoid to ensure cache stability across runs. This mirrors the real upload structure but with the `seed/` prefix for isolation.
- **Seed data sources**: Current seed JSON files use only remote URLs (Unsplash: `images.unsplash.com`, Pexels: `images.pexels.com`). Distribution: Pexels dominates with ~603 references across 107 files (primarily accommodations: 102 files), Unsplash has ~182 references across 82 files (destinations: 26, events: 24, posts: 18, users: 6, eventOrganizers: 5, accommodations: 1, others: 2). There are no local file references in the current seed data. The local file cache logic (REQ-07.2-D) is forward-looking for future seed entries that may reference local images.
- **Env detection**: The `resolveEnvironment()` function in `packages/media` uses `VERCEL_ENV` and `NODE_ENV` to determine the `{env}` segment. Mapping: `VERCEL_ENV=production` -> `prod`, `VERCEL_ENV=preview` -> `preview`, `NODE_ENV=test` -> `test`, else -> `dev`.
- **Hono multipart**: Use `ctx.req.formData()` (native Hono API). Extract files via `formData.get('file')`, which returns a `File` object. Convert to `ArrayBuffer` via `file.arrayBuffer()`, then to `Buffer` via `Buffer.from(arrayBuffer)` for buffer-based operations (e.g., `image-size`, data URI conversion).
- **No `packages/media` exists yet**: This is a net-new package. Follow the structure of `packages/icons/package.json` for the package template.
- **resetDatabase() integration**: The existing `resetDatabase()` in `packages/seed/src/utils/dbReset.ts` has signature `resetDatabase(exclude: string[] = [])`. It does NOT accept CLI flags directly. The `--clean-images` flag is parsed by the CLI layer (`packages/seed/src/cli.ts`) and triggers the Cloudinary cleanup as a separate step before or after `resetDatabase()` runs.
- **Test mocking strategy for CloudinaryProvider**: Mock `cloudinary.uploader.upload_stream`, `cloudinary.uploader.destroy`, and `cloudinary.api.delete_resources_by_prefix` using `vi.mock('cloudinary')`. The mock for `upload_stream` should return a mock writable stream whose callback receives an object matching the SDK response shape: `{ secure_url: 'https://...', public_id: '...', width: 1920, height: 1080, format: 'jpg', bytes: 123456 }`. The mock for `destroy` should return `{ result: 'ok' }`. Test both success and error (throw) paths. For `getMediaUrl()` tests, no mocking is needed .. it is a pure string transformation that requires no SDK or credentials.

---

## Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| `cloudinary` npm package (v2.9.0) | New, `packages/media` only | Cloudinary Node SDK (CJS-only natively, works via Node.js ESM interop). No other workspace member may depend on it |
| `image-size` npm package | New, `packages/media` only | Reads image dimensions from buffer headers without full decode |
| `nanoid` npm package | New, `packages/media` only | Generates unique IDs for gallery image public IDs (10-char default alphabet). Already ESM-native. Used server-side only |
| `packages/config` | Existing | Add 4 new env var declarations (3 Cloudinary + 1 body size) |
| `packages/schemas` | Existing | Reuse `Image`/`Media` types, add upload request schemas |
| `packages/service-core` | None | No service-core changes required |
| `packages/db` | None | No schema changes required .. existing `media` JSONB and `image` text columns are sufficient |
| `apps/api` | Existing | Add 3 new route files (admin upload, protected upload, admin delete) |
| `apps/admin` | Existing | Extend existing `GalleryField` component, wire upload/delete to API endpoints |
| `apps/web` | Existing | Refactor `media.ts`, add avatar upload React island to account settings |
| `packages/seed` | Existing | Add Cloudinary upload + cache logic, `--clean-images` flag |
| Entity services (accommodation, destination, event, post) | Existing | Add post-delete hooks for Cloudinary cleanup (REQ-12) |
| User profile endpoint | New or Existing | `PATCH /api/v1/protected/users/me` for avatar URL persistence (REQ-04.2-FLOW). Create if it does not exist |

---

## Out of Scope

The following are explicitly excluded from this spec:

| Item | Reason |
|------|--------|
| Video upload | Separate concern. Different validation rules, Cloudinary video pipeline, and player integration. The `videos` field on `MediaSchema` is untouched. Deferred to a future spec. |
| Image moderation workflow | The `moderationState` field already exists in the `Image` type. Implementing a review workflow (queue, approve/reject UI) is a separate feature. |
| Bulk entity image upload (multiple files at once) | The admin can upload images one at a time per field. Batch upload adds significant UI complexity for marginal gain. |
| In-browser image cropping UI | Cloudinary handles cropping at delivery time via transform presets. A client-side crop tool before upload is a UX enhancement, not a core requirement. |
| CDN cache purge automation | Cloudinary's CDN invalidation on delete (`invalidate: true`) is optional per Technical Notes. Automated purge on entity update is out of scope. |
| Signed Cloudinary upload URLs (client-side direct upload) | All uploads go through the API. Direct browser-to-Cloudinary upload bypasses server validation and is explicitly excluded. |
| Image alt text auto-generation via AI | The `caption` and `description` fields on `Image` are populated manually or by the uploader. Automatic generation is a future enhancement. |
| Gallery size limits via billing entitlements | Gallery image count limits will be enforced by the billing entitlements system when that entitlement is defined. This spec does not add a hardcoded gallery limit. |
| Minimum image dimension validation | No minimum dimensions are enforced. Very small images (e.g., 1x1) are allowed .. Cloudinary handles scaling. |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Cloudinary credentials exposed in frontend bundle | High if not prevented | Critical | Enforce at package level: `CloudinaryProvider` (which holds credentials) MUST NOT be imported in any client-side bundle. Only `getMediaUrl()`, `extractPublicId()`, and `MEDIA_PRESETS` are safe for client-side use. API route ownership of credentials is the architectural safeguard. |
| Seed uploading many images in CI | Medium | High (slow CI, Cloudinary rate limits) | Seed Cloudinary upload is opt-in (requires env vars). CI runs without Cloudinary vars fall back to original URLs. The Upload API (used for seed uploads) is not rate-limited, but is subject to plan-specific monthly bandwidth and storage quotas. |
| Cache file becoming stale across branches | Medium | Low (extra re-uploads, not data loss) | Cache is advisory. Stale cache worst case is a redundant upload and an updated cache entry. |
| Cloudinary free tier limits exceeded during development | Low | Medium | Single account, environment isolation via folder prefix keeps dev/prod separate. Monitor usage dashboard. |
| `getMediaUrl()` misused in server-side rendering with non-Cloudinary URLs before migration complete | Medium | Low | Non-Cloudinary passthrough (REQ-01.3-B) is a safety net. Pages continue working until full migration. |
| Breaking change in Cloudinary SDK major version | Low | Medium | SDK is isolated to `packages/media`. A version bump is a single-package change. |
| Vercel body size limit blocks uploads on Hobby plan | Medium | High | `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` env var allows configuring the limit. Documented that values > 4.5 MB require Pro plan. |
| Orphaned Cloudinary assets from old code paths | Medium | Low (storage cost, not functionality) | Delete endpoint (REQ-04.3) prevents new orphans. Existing orphans can be cleaned up manually or via a future audit job. |
| Admin API rate limit hit during aggressive cleanup | Low | Low | `deleteByPrefix` is only used by `--clean-images` (occasional) and entity hard delete (REQ-12). Not used in hot request paths. Rate limits: 500/hr free, 2000/hr paid; monitor via `X-FeatureRateLimit-*` response headers. |
| Upload endpoint abuse (no rate limiting) | Low | Medium | Rate limiting is deferred to SPEC-079. Current mitigation: admin endpoints require authenticated admin session, avatar endpoint requires authenticated user session. |
