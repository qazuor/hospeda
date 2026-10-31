# hospeda-valid-values.md

Valid values and defaults for Hospeda social drafts. Verified against the Zod schemas in
`@repo/schemas` and the seed in `packages/seed/src/required/socialAutomation.seed.ts`.

Behavior rules in the main Instructions always override this file. `getSocialCatalog` is
the live source of truth for slugs, hashtags and which format rows are `enabled`.

---

## Image formats — only two

| Format | Pixels | Use |
|---|---|---|
| **4:5** | 1080 x 1350 | Feed posts |
| **9:16** | 1080 x 1920 | Stories |

**Neither one is a default, and square is not a Hospeda format.** If the prompt does not
name one of the two, STOP and ask. Never infer it from the platform or from the catalog.

`platformFormats[].recommendedRatio` is guidance, not an order. Seed migration
`0060-social-formats-feed-ratio-4x5` sets `INSTAGRAM/FEED_POST` and `INSTAGRAM/CAROUSEL`
to `4:5` / `1080x1350`; until it runs on a given environment those rows still report
`1:1`. Facebook, X and LinkedIn text rows carry no value at all. **The format stated in
the prompt always wins over the catalog.**

---

## Targets

Each entry is `{ "platform": ..., "publishFormat": ..., "assets": [...] }`.

`platform` (5 values): `INSTAGRAM`, `FACEBOOK`, `X`, `LINKEDIN`, `TIKTOK`.

`publishFormat` (8 values): `FEED_POST`, `PHOTO_POST`, `TEXT_POST`, `IMAGE_POST`,
`VIDEO_POST`, `REEL`, `STORY`, `CAROUSEL`.

Only use a pair the catalog marks `enabled`. Currently enabled:

| Platform | Formats | Notes |
|---|---|---|
| `INSTAGRAM` | `FEED_POST` · `REEL` · `STORY` · `CAROUSEL` | caption up to 2200; STORY takes **0** |
| `FACEBOOK` | `FEED_POST` · `PHOTO_POST` · `VIDEO_POST` · `REEL` · `STORY` | caption up to 63206; REEL 2200; STORY **0** |
| `X` | `TEXT_POST` · `IMAGE_POST` · `VIDEO_POST` | caption up to 280 |
| `LINKEDIN` | `TEXT_POST` · `VIDEO_POST` | caption up to 3000 |
| `TIKTOK` | `VIDEO_POST` | caption up to 2200 |

Do not include `X`, `LINKEDIN` or `TIKTOK` unless explicitly asked.

**Stories carry no caption.** `maxCaptionLength` is `0` for `INSTAGRAM/STORY` and
`FACEBOOK/STORY`.

### Per-target media

A target may carry its own artwork through `assets`, an array of `{ image?, video? }`.
This is how one post serves a 4:5 feed image and a 9:16 story image at once:

```json
"targets": [
  { "platform": "INSTAGRAM", "publishFormat": "FEED_POST" },
  { "platform": "INSTAGRAM", "publishFormat": "STORY",
    "assets": [ { "image": { "mode": "public_url", "url": "https://...", "altText": "..." } } ] }
]
```

When `assets` is omitted the target falls back to the post-level `image`.

Video is `public_url` only — files are too large for the OpenAI file-injection path.

### Default targets

```json
"targets": [
  { "platform": "INSTAGRAM", "publishFormat": "FEED_POST" },
  { "platform": "FACEBOOK", "publishFormat": "FEED_POST" }
]
```

---

## Slugs

Verified against the live catalog on 2026-08-20. Always re-read it — the owner adds slugs.

`campaignSlug` (16) — default `institucional-hospeda`. Also: `verano-litoral-2026-27`,
`carnaval-gualeguaychu`, `semana-santa-litoral`, `vacaciones-invierno`,
`fiestas-fin-de-anio`, `dia-de-la-madre`, `escapadas-finde-largo`, `termas-del-litoral`,
`sabores-del-litoral`, `pesca-rio-uruguay`, `naturaleza-playas-litoral`,
`fiesta-nacional-artesania`, `fiesta-playa-rio`, `fiesta-nacional-lago`,
`fiesta-citricultura`.

`batchSlug` (8) — default `hospeda-launch-2026-06`. Also: `verano-enero-2027`,
`verano-febrero-2027`, `finde-largo-carnaval-2027`, `vacaciones-invierno-julio-2027`,
`serie-destinos-litoral`, `alojamientos-destacados`, `sabores-litoral-2027`.

`audienceSlug` (12) — `turistas`, `familias`, `parejas`, `aventureros`,
`grupos-de-amigos`, `viajeros-solos`, `adultos-mayores`, `con-mascotas`,
`turismo-termal`, `pescadores`, `contingentes-empresas`, `egresados`.

`baseHashtagSetSlug` (18) — `general-hospeda`, `turistas`, `destinos`, `alojamientos`,
`gastronomia`, `servicios-turisticos`, `x-corto`, `termas`, `carnaval`, `playas-rio`,
`pesca`, `naturaleza-ecoturismo`, `familias`, `parejas-romantico`, `finde-largo`,
`vacaciones-invierno`, `fiestas-fin-de-anio`, `fiestas-litoral`.

`footerSlug` (6) — default `hospeda`. Also: `hospeda-instagram`, `hospeda-facebook`,
`hospeda-x`, `hospeda-tiktok`, `hospeda-verano`.

> **A campaign or batch slug that does not exist gets CREATED, not rejected.** The
> response reports `isNew: true`. So an invented slug silently pollutes the catalog
> instead of failing loudly. Only send slugs read from `getSocialCatalog` or given by the
> operator. Audience, footer and hashtag-set slugs are NOT auto-created: an unknown one
> falls back to null with a warning.

---

## Content pillars

Free text. Preferred: `Lanzamiento`, `Turistas`, `Alojamientos`, `Gastronomía`,
`Servicios turísticos`, `Destinos`, `Institucional`, `Eventos`, `Comunidad`.

---

## Hashtags

Per draft: exactly one `baseHashtagSetSlug`, 3 to 6 `curatedHashtags` (fewer for X), 0 to
3 `customHashtagSuggestions`.

Take `curatedHashtags` only from `hashtags[].hashtag` — never invent them. Unknown
entries are dropped with a warning. Respect `defaults.maxHashtagsPerPlatform` (currently
INSTAGRAM 30, FACEBOOK 10, X 5) — going over returns **400 `HASHTAG_LIMIT_EXCEEDED`** and
nothing is saved. No `null` inside arrays.

For X targets prefer the `x-corto` set, at most 5 hashtags, and a short caption.

---

## Image

`openaiFileIdRefs` is a TOP-LEVEL field, a sibling of `image` — never inside it.

```json
"image": { "mode": "openai_file_refs", "altText": "short description" },
"openaiFileIdRefs": []
```

```json
"image": { "mode": "public_url", "url": "https://...", "altText": "short description" }
```

ChatGPT fills `openaiFileIdRefs` at call time. It must end up non-empty when
`image.mode` is `openai_file_refs`, or validation fails. `image.mimeType` is optional.

---

## Draft ID

```text
hospeda-{pillar-slug}-{yyyy-mm}-{topic-slug}-{short-id}
```

Lowercase, hyphens, `short-id` of 4 to 6 random lowercase letters or digits. Never reuse
an example literally. On a 409, generate a new one and ask before retrying.

Examples: `hospeda-alojamientos-2026-08-vidriera-litoral-a7k3`

---

## Schedule and status

Drafts are created without a schedule; operators schedule later in the admin. Default
timezone `America/Argentina/Cordoba`. Do not invent dates.

Every draft is `NEEDS_REVIEW` / `PENDING`, forced by the backend. Never send an
approved, scheduled or published state.

---

## Do not invent

Slugs, platforms, formats, hashtags, record IDs, accommodation names, destinations or
prices. Use only what came from the operator, this Knowledge, or `getSocialCatalog`.
