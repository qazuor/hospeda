# hospeda-action-payload-reference.md

How to build the `saveSocialDraft` request body. Verified against
`CreateSocialDraftSchema` in `@repo/schemas` and the route in
`apps/api/src/routes/ai/social/drafts.ts`.

Behavior rules in the main Instructions always override this file. All field names are
camelCase and must match exactly.

## Endpoints

- `getSocialCatalog` — GET, no body. Returns `data` with `hashtags`, `hashtagSets`,
  `footers`, `platformFormats`, `campaigns`, `batches`, `audiences`, `defaults`.
- `saveSocialDraft` — POST. Body below.

Call `getSocialCatalog` before saving.

## Required

- `operatorPin` (string) — never repeat it back.
- `draftId` (string) — unique, lowercase, hyphenated.
- `title` (string) — short internal title.
- `captionBase` (string) — caption body, WITHOUT hashtags and WITHOUT footer.
- `targets` (array, at least 1).

## Optional

`pillar` · `campaignSlug` · `batchSlug` · `audienceSlug` · `baseHashtagSetSlug` ·
`curatedHashtags` · `customHashtagSuggestions` · `footerSlug` · `image` · `notes` ·
`openaiFileIdRefs`.

## Example

```json
{
  "operatorPin": "____",
  "draftId": "hospeda-alojamientos-2026-08-vidriera-litoral-a7k3",
  "title": "Llevá tu alojamiento a la vidriera",
  "captionBase": "Publicá tu alojamiento y que te encuentren los viajeros del Litoral...",
  "pillar": "Alojamientos",
  "campaignSlug": "institucional-hospeda",
  "batchSlug": "hospeda-launch-2026-06",
  "audienceSlug": "turistas",
  "baseHashtagSetSlug": "alojamientos",
  "curatedHashtags": ["#Hospeda", "#EntreRios", "#LitoralArgentino"],
  "customHashtagSuggestions": [],
  "footerSlug": "hospeda",
  "targets": [
    { "platform": "INSTAGRAM", "publishFormat": "FEED_POST" },
    { "platform": "FACEBOOK", "publishFormat": "FEED_POST" }
  ],
  "image": { "mode": "openai_file_refs", "altText": "Placa con el título sobre fondo claro" },
  "openaiFileIdRefs": []
}
```

`openaiFileIdRefs` is a TOP-LEVEL field (sibling of `image`), NOT inside it. ChatGPT
populates it at call time with the approved image attached in the conversation.

## Media

After image + copy approval and the PIN, choose by priority.

### 1. Image from this chat — preferred

```json
"image": { "mode": "openai_file_refs", "altText": "short description" },
"openaiFileIdRefs": []
```

You never write the file URL yourself. Set `image.mode` and make sure exactly one
approved image is attached. If the array ends up empty the request fails validation
(422). The backend downloads the file and uploads it to Cloudinary.

### 2. Public URL

```json
"image": { "mode": "public_url", "url": "https://...", "altText": "short description" }
```

`image.mimeType` is optional on both modes and helps the backend infer the media type.

### 3. Per-target media

Each `targets[]` entry accepts an optional `assets` array of `{ image?, video? }`, so one
post can carry different artwork per format:

```json
"targets": [
  { "platform": "INSTAGRAM", "publishFormat": "FEED_POST" },
  { "platform": "INSTAGRAM", "publishFormat": "STORY",
    "assets": [ { "image": { "mode": "public_url", "url": "https://...", "altText": "..." } } ] }
]
```

Omit `assets` and the target falls back to the post-level `image`.

Video uses the same shape but supports `mode: "public_url"` ONLY — video files are too
large for the OpenAI file-injection path.

### 4. Nothing available

Do not invent a URL and do not omit an approved image. Ask the operator for a public
URL, then use `public_url`.

## Hashtags

`baseHashtagSetSlug` from `hashtagSets[].slug`; `curatedHashtags` only from
`hashtags[].hashtag`. Never invent curated hashtags. No `null` inside arrays. Respect
`defaults.maxHashtagsPerPlatform` — exceeding it returns 400 and saves nothing. Unknown
hashtags are dropped with a warning rather than failing.

## Response

```json
{ "success": true, "data": {
  "postId": "...", "draftId": "...",
  "status": "NEEDS_REVIEW", "approvalStatus": "PENDING",
  "targetsCreated": 2,
  "campaignResolution": { "id": "...", "slug": "...", "isNew": false },
  "batchResolution": { "id": "...", "slug": "...", "isNew": false },
  "assetStatus": "uploaded", "warnings": [] } }
```

- Report `postId`, `targetsCreated`, `assetStatus` and every warning.
- `assetStatus` `pending` or `none` → the media still needs manual upload.
- **`isNew: true` on `campaignResolution` or `batchResolution` means a new campaign or
  batch was just CREATED** by this call. Say it out loud — the operator probably meant to
  reuse an existing one.

## Errors

| Status | Code | Meaning |
|---|---|---|
| 401 | — | Bad or missing API key. The action is misconfigured. |
| 403 | `FORBIDDEN` | Wrong `operatorPin`. |
| 400 | `HASHTAG_LIMIT_EXCEEDED` | Over the platform hashtag limit. `details` lists the violations. |
| 409 | `CONFLICT` | `draftId` already used. Generate a new one and ask before retrying. |
| 422 | `VALIDATION_ERROR` | Schema failure, or zero targets matched an enabled platform-format row. |
| 500 | `INTERNAL_ERROR` | Server error. |

On any failure: say the draft was NOT saved and show the error. Never say a post was
published or approved for publication.
