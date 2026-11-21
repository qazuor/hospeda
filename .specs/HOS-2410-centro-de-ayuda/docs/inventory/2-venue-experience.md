# HOS-2410 inventory part B: venue (gastronomy and nightlife) and experience

Generated 2026-11-20 from origin/staging @ 7e71508cce. Read-only inventory.

> **Plan values below are internal reference only.** Plan names and per-plan
> numbers (listing caps, AI chat quotas, promotions) appear here so the
> inventory can be verified. They come from `scripts/production-catalog/catalog.ts`,
> which is stale (gap 3), and from data-migrations. Articles must never copy them;
> they use `{{limit:…}}` / `{{link:plans:…}}` tokens (guard (d)).

**Path prefixes:**

- `E/` = `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/`
- `W/` = `apps/web/src/`
- `S/` = `packages/schemas/src/`
- `V/` = `packages/verticals/src/`
- `C/` = `scripts/production-catalog/catalog.ts`

**Counts:**

- 21 `.astro` files under `comercio/**`.
- 26 section rows: venue 14 + `preguntas-ia`; experience 10 + `preguntas-ia`.
- 130 rows in total, for 37 proposed articles.

**Business lines:**

- Venue has two lines:
  - `food` (urlSlug `gastronomia`): owns `menu` and `dailySpecials`.
  - `nightlife` (urlSlug `noche`): owns `nightInfo`.
- Experience has only `standard` (`S/catalog/business-lines.ts:24-47`).
- Type rules (`:74-90`):
  - RESTAURANT is food by default and may add nightlife.
  - CAFE, PARRILLA, HELADERIA, PANADERIA, ROTISERIA and FOOD_TRUCK are food only.
  - BAR, CERVECERIA and PUB can be both.
  - BOLICHE is nightlife only, with minAge 18 pre-filled.
- A section of a line the listing does not have is `absent`: its URL redirects to the hub and the data is kept (`V/listing-sections/resolve-listing-sections.ts:179-184`).

**Merge convention:**

- `page:` rows of section files go in the article's `covers`.
- `section:` anchors go in its `entryFor`.

## 1. Inventory

### 1.1 Pages

| anchor | kind | aud | what the owner sees | source | plannedArticle | exempt |
|---|---|---|---|---|---|---|
| page:mi-cuenta/comercio | page | venue, experience | «Mi comercio»: cards with state badge, «Editar», checklist, usage badge «X de Y», views widget, menu-QR widget, venue metrics panel, «+ Nuevo comercio». Role gate VENUE_OWNER/EXPERIENCE_OWNER or staff | W/pages/[lang]/mi-cuenta/comercio/index.astro:14,67,196,204,241,259,266,296 | listing-lifecycle | |
| page:mi-cuenta/comercio/nuevo | page | venue, experience | (no gate) 301 redirect to `/publicar/`, which is the accommodation page (gap 11) | W/pages/[lang]/mi-cuenta/comercio/nuevo/index.astro:22,33-40 | create-listing | |
| page:mi-cuenta/comercio/nuevo/[vertical] | page | venue, experience | (no gate) 301 redirect to `/publicar/comer-y-salir/` or `/publicar/experiencias/`; any other segment answers 404 | W/pages/[lang]/mi-cuenta/comercio/nuevo/[vertical].astro:22,34-45 | create-listing | |
| page:mi-cuenta/comercio/[vertical]/[id]/editar | page | venue, experience | Editor hub: identity chip, notices, support-edit notice, summary of sections hidden by business lines with «Vaciar», one row per section with its status | E/index.astro:16,127-170 | listing-locked-sections | |
| page:…/editar/datos | page | venue, experience | Name, category, summary, description | E/datos.astro:12 | listing-basic-info | |
| page:…/editar/ubicacion | page | venue | Address, duplicate warning, exception panel | E/ubicacion.astro:15,54-57 | venue-location | |
| page:…/editar/horarios | page | venue, experience | Weekly hours | E/horarios.astro:11 | opening-hours | |
| page:…/editar/precio | page | venue, experience | Price range (venue) or "price from" (experience) | E/precio.astro:12 | venue-price-range / experience-price | |
| page:…/editar/servicios | page | venue, experience | Services and rules panel | E/servicios.astro:12 | amenities | |
| page:…/editar/fotos | page | venue, experience | Cover, gallery, video (venue only) | E/fotos.astro:20 | photos | |
| page:…/editar/contacto | page | venue, experience | Phones, email, social networks, WhatsApp (venue only) | E/contacto.astro:12 | listing-contact | |
| page:…/editar/carta | page | venue | Menu manager | E/carta.astro:28 | venue-menu | |
| page:…/editar/menu-del-dia | page | venue | Daily specials | E/menu-del-dia.astro:24 | venue-daily-specials | |
| page:…/editar/eventos | page | venue | Agenda | E/eventos.astro:25 | venue-events | |
| page:…/editar/promociones | page | venue | Promotions | E/promociones.astro:2 | venue-promotions | |
| page:…/editar/preguntas | page | venue, experience | FAQ | E/preguntas.astro:14 | listing-faqs | |
| page:…/editar/de-noche | page | venue (nightlife) | Entry, minimum age, dress code | E/de-noche.astro:11 | venue-night-info | |
| page:…/editar/traducciones | page | venue, experience | Name, summary and description in es/en/pt | E/traducciones.astro:10 | listing-translations | |
| page:…/editar/punto-de-encuentro | page | experience | Meeting point, coordinates, directions | E/punto-de-encuentro.astro:13 | experience-meeting-point | |
| page:…/editar/datos-practicos | page | experience | Duration, what to bring, requirements | E/datos-practicos.astro:11 | experience-practical-info | |
| page:…/editar/preguntas-ia | page | venue, experience | «Preguntas a la IA» | E/preguntas-ia.astro:10 | listing-ai-chat | |
| page:publicar/comer-y-salir | page | venue | (no gate) Funnel and creation form | W/pages/[lang]/publicar/comer-y-salir/index.astro:19 | create-listing | |
| page:publicar/experiencias | page | experience | (no gate) Funnel and creation form | W/pages/[lang]/publicar/experiencias/index.astro:11 | create-listing | |
| page:mi-cuenta/publica | page | venue, experience | (no gate) Hub with the 3 verticals; «+ Nuevo comercio» leads here | W/pages/[lang]/mi-cuenta/publica/index.astro:9 | create-listing | |
| page:comer-y-salir/[slug] | page | venue | (no gate) Public page with the AI chat (signed-in visitors) | W/pages/[lang]/comer-y-salir/[slug].astro:13,548-562 | listing-ai-chat | |
| page:experiencias/[slug] | page | experience | (no gate) Public page with the AI chat | W/pages/[lang]/experiencias/[slug].astro:13,374-380 | listing-ai-chat | |

### 1.2 Sections

Registry: `S/catalog/listing-sections.ts`. API slugs: `packages/portal-routes/src/portal-routes.ts:261-302`.
`carta` and `menu-del-dia` exist only with the `food` line, and `de-noche` only with `nightlife`.

| anchor | kind | aud | what the owner sees, sets, validates, gating, public | source | plannedArticle |
|---|---|---|---|---|---|
| section:venue.datos | section | venue | Name 2-100, summary 10-300, description 20-2000, rich description ≤5000 (no gate), category, city/destination, business lines (the last one cannot be unchecked; unchecking hides sections and never deletes). On a published listing the web address is kept unless the box is ticked. Public | S/common/listing-identity.schema.ts:39,57,66,77; W/components/listing/editor/BasicInfoSection.client.tsx:273-274; W/components/listing/editor/BusinessLinesField.client.tsx:7-33 | listing-basic-info; venue-business-lines |
| section:venue.ubicacion | section | venue | Street ≤50, number/floor/apartment ≤10, optional coordinates. City and neighborhood come from the destination. Public. One published listing per address; exception request (pending, approved, rejected with a reason) | W/components/listing/editor/VenueLocationSection.client.tsx:1-15,72-111; W/components/listing/LocationExceptionPanel.client.tsx:2-8 | venue-location |
| section:venue.horarios | section | venue | 7 days: closed, or ≥1 shift HH:MM. Closing earlier than opening crosses midnight; equal times are rejected. Required to publish. Feeds the «Abierto ahora» badge (HOS-2257) | S/common/opening-hours.schema.ts:30-47,96-146; S/common/listing-completeness.ts:335-338 | opening-hours |
| section:venue.precio | section | venue | BUDGET/MID/HIGH/PREMIUM. Required to publish | S/enums/price-range.enum.ts:10; W/components/listing/editor/PriceSection.client.tsx:104; S/common/listing-completeness.ts:339 | venue-price-range |
| section:venue.servicios | section | venue | Services and features, plus rules: payment methods, pets, smoking, events, reservations (required/recommended/not accepted, **informational only: there are no bookings**). Minimum age and dress code live in `de-noche`. No plan gate | W/components/listing/editor/section-renderers.tsx:80-100; S/entities/venue/subtypes/venue.policies.schema.ts:136 | amenities; listing-policies |
| section:venue.fotos | section | venue | Cover plus gallery, cap 30, JPG/PNG/WebP/HEIC ≤10 MB. Every action saves immediately; the cover is required. Video gated by `can_embed_video`, which **no venue plan grants today** | S/common/media-upload.schema.ts:32-39; W/components/listing/editor/MediaSection.client.tsx:326,860; packages/media/src/limits.ts:37; S/catalog/listing-sections.ts:65-77; E/fotos.astro:46-49 | photos |
| section:venue.contacto | section | venue | Phone, work phone, email, social networks, WhatsApp plus its visibility (default: shown nowhere; "Solo usuarios logueados" or "Público", which warns about exposure). At least one channel is required to publish | W/components/listing/editor/WhatsappControls.tsx:1-30; W/components/listing/editor/section-renderers.tsx:62-70; S/common/listing-completeness.ts:205-215 | listing-contact |
| section:venue.carta | section | venue (food) | Structured menu (≤30 sections, ≤100 dishes each, name ≤150, description ≤500, price 0..1,000,000 pesos), a photo or PDF of the menu, and an external link. Gated by `manage_venue_menu`. Traits: `menu_item_photos`, `multilingual_venue_menu`, `menu_qr_scan_metrics`. When locked the data stays visible, saving is disabled with the reason, and only «vaciar» works | S/entities/venue/subtypes/venue.menu.schema.ts:58-71,135-153; W/components/venue/VenueMenuManager.client.tsx:291; S/catalog/listing-sections.ts:90-105; W/components/venue/VenueSectionLockedPanel.client.tsx:1-15 | venue-menu |
| section:venue.menu-del-dia | section | venue (food) | ≤10 specials, title ≤150, description ≤500, price ≥0, `validFrom`/`validUntil` required, window ≤31 days; they expire on their own, and an empty list takes the section down. Gated by `manage_venue_daily_special` | S/entities/venue/subtypes/venue.daily-special.schema.ts:47,68,189-263; W/components/venue/VenueDailySpecialsManager.client.tsx:1-40 | venue-daily-specials |
| section:venue.eventos | section | venue | `once` (a date) or `weekly` (a weekday), title ≤150, description ≤500, optional https ticket link ≤2048 («Comprar entrada»), ≤30 current, ≤100 in total. A one-off with no end time stops showing at 06:00 the next day (Buenos Aires); past one-offs are deleted after 60 days, weekly ones never. Gated by `manage_venue_events` | S/entities/venue/subtypes/venue.event.schema.ts:55,65,138; S/entities/venue/subtypes/venue.event.lifecycle.ts:25,28; W/components/venue/VenueEventsManager.client.tsx:25-35 | venue-events |
| section:venue.promociones | section | venue | Title ≤200, description ≤1000; percentage, fixed amount or special offer; dates; optional weekly window (happy hour). Gated by `create_promotions` plus `max_active_promotions`. After a downgrade promotions stay in force; only create, edit and reactivate are blocked, and pause and delete always work | S/entities/ownerPromotion/owner-promotion.venue.schema.ts:21,80,93-133; apps/api/src/routes/venue/protected/promotion-access.ts:1-40; S/catalog/listing-sections.ts:126-141; packages/seed/src/data-migrations/0187-hos-2282-venue-promotions-grant.ts:28-49 | venue-promotions |
| section:venue.preguntas | section | venue | Question 10-300, answer 10-2000. "Sugerir con IA" needs `ai_faq_draft` and its quota | S/common/faq.schema.ts:23-31; W/components/listing/ListingFaqManager.client.tsx:822 | listing-faqs |
| section:venue.de-noche | section | venue (nightlife) | Entry free/paid/varies (+ price from), es/en/pt note ≤200, minimum age 13-30 with a scope (all day / from HH:MM / sector ≤60), dress code (casual, smart_casual, elegant, no_restrictions) + note ≤200. No gate | W/components/listing/editor/NightInfoSection.client.tsx:249-256,371; S/entities/venue/subtypes/venue.policies.schema.ts:11-30; S/enums/venue-dress-code.enum.ts:7; S/enums/venue-entry-kind.enum.ts:8 | venue-night-info |
| section:venue.traducciones | section | venue | Name, summary, description and rich description per language, typed by hand. **No AI translation here** | W/components/listing/ListingTranslationPanel.client.tsx:1-20 | listing-translations |
| section:venue.preguntas-ia | section | venue | Read-only list of questions and answers; unanswered first, with a button that opens the FAQ prefilled. Visible on any plan | W/lib/editor/listing-editor-registry.ts:104-115; W/components/listing/ai-questions/AiQuestionsPanel.client.tsx:1-15 | listing-ai-chat |
| section:experience.datos | section | experience | Same as venue, without business lines; 14 types | S/enums/experience-type.enum.ts:1-30; S/catalog/listing-sections.ts:184-205 | listing-basic-info |
| section:experience.punto-de-encuentro | section | experience | Place ≤300 chars, lat/lon typed by hand (optional). «Cómo llegar» (≤12 lines) gated by `manage_experience_directions`; without it, read-only | S/entities/experience/experience.schema.ts:44; W/components/experience/MeetingPointSection.client.tsx:1-45,234 | experience-meeting-point |
| section:experience.datos-practicos | section | experience | Duration (1 min to 30 days); «Qué llevar» and «Requisitos» (≤20 lines of ≤160 chars). No gate | S/entities/experience/experience.schema.ts:29,38,41; W/components/listing/editor/PracticalInfoSection.client.tsx:20-35 | experience-practical-info |
| section:experience.horarios | section | experience | Same editor; optional for publishing | S/common/listing-completeness.ts:335 | opening-hours |
| section:experience.precio | section | experience | «Precio a consultar», price from (pesos), unit per_day/per_hour/per_person/per_group. Publishing needs a price > 0 or on-request | S/common/listing-completeness.ts:369-372; W/components/listing/editor/PriceSection.client.tsx:135,168; S/enums/experience-price-unit.enum.ts | experience-price |
| section:experience.servicios | section | experience | Services plus rules: payment methods, pets, smoking, events, private groups, **cancellation policy** | W/components/listing/editor/section-renderers.tsx:90-100 | amenities; listing-policies |
| section:experience.fotos | section | experience | Cover plus gallery (30). No video | S/common/media-upload.schema.ts:38; S/catalog/listing-sections.ts:260-267 | photos |
| section:experience.contacto | section | experience | Phone, work phone, email, social networks. No WhatsApp. For publishing only work phone, mobile or work email count | S/common/listing-completeness.ts:205; W/components/listing/editor/section-renderers.tsx:62-70 | listing-contact |
| section:experience.preguntas | section | experience | Same as venue | W/components/listing/ListingFaqManager.client.tsx:822 | listing-faqs |
| section:experience.traducciones | section | experience | Same as venue | E/traducciones.astro:10 | listing-translations |
| section:experience.preguntas-ia | section | experience | Same as venue | E/preguntas-ia.astro:10 | listing-ai-chat |

### 1.3 Entitlements

Keys are in `S/catalog/key-enums.ts`; plans in `C:569-1340`. The trial combines the entitlements of the highest plan with the limits of the lowest (`V/effective-set/trial-ratchet.ts:1-30`).

| anchor | kind | aud | gates / how shown | source | plannedArticle |
|---|---|---|---|---|---|
| entitlement:publish_venue | entitlement | venue | Publishing (every tier). Without a plan it asks for one or starts the trial | key-enums.ts:4; C:631 | publish-requirements |
| entitlement:publish_experience | entitlement | experience | Same | key-enums.ts:5; C:1023 | publish-requirements |
| entitlement:edit_venue_info | entitlement | venue | Editing (API PATCH) | key-enums.ts:7; apps/api/src/routes/venue/protected/patch.ts | listing-basic-info |
| entitlement:edit_experience_info | entitlement | experience | Same | key-enums.ts:8; apps/api/src/routes/experience/protected/patch.ts | listing-basic-info |
| entitlement:view_basic_stats | entitlement | venue, experience | Views widget (every tier); without a tier, an informative "locked" sentence | key-enums.ts:9; W/components/listing/ListingViewsWidget.client.tsx:1-25 | listing-stats |
| entitlement:view_advanced_stats | entitlement | venue | Click metrics panel, which **no plan grants yet** (not rendered); in progress in HOS-2261/2280 | key-enums.ts:10; W/components/venue/VenueListingStatsPanel.client.tsx:1-50; W/pages/[lang]/mi-cuenta/comercio/index.astro:172-179 | listing-stats |
| entitlement:create_promotions | entitlement | venue | Promotions (granted via migration 0187) | key-enums.ts:15; S/catalog/listing-sections.ts:136 | venue-promotions |
| entitlement:can_embed_video | entitlement | venue | Video, locked for everyone | key-enums.ts:17; S/catalog/listing-sections.ts:70-74 | photos |
| entitlement:download_listing_pdf | entitlement | venue, experience | PDF brochure on the published card, behind a locked link with a badge | key-enums.ts:23; W/components/listing/BrochureDownloadButton.client.tsx:20-30,87 | listing-brochure-qr |
| entitlement:manage_venue_menu | entitlement | venue | Carta | key-enums.ts:24; S/catalog/listing-sections.ts:94 | venue-menu |
| entitlement:menu_item_photos | entitlement | venue | Photo per dish | key-enums.ts:25; S/catalog/listing-sections.ts:98 | venue-menu |
| entitlement:manage_venue_daily_special | entitlement | venue | Menú del día | key-enums.ts:26; S/catalog/listing-sections.ts:110 | venue-daily-specials |
| entitlement:manage_venue_events | entitlement | venue | Eventos | key-enums.ts:27; S/catalog/listing-sections.ts:120 | venue-events |
| entitlement:multilingual_venue_menu | entitlement | venue | Dish names in en/pt; refused at «Guardar carta» with an upsell | key-enums.ts:28; W/components/venue/VenueMenuManager.client.tsx | venue-menu |
| entitlement:menu_qr_scan_metrics | entitlement | venue | Menu QR and scans widget (device and language only) | key-enums.ts:29; W/components/venue/VenueMenuQrWidget.client.tsx:1-50 | venue-menu-qr |
| entitlement:issue_experience_certificate | entitlement | experience | Certificates on the published card; a 403 shows an upsell; name ≤120 | key-enums.ts:30; W/components/experience/ExperienceCertificatePanel.client.tsx:1-30,283 | experience-certificate |
| entitlement:manage_experience_directions | entitlement | experience | «Cómo llegar» | key-enums.ts:31; S/catalog/listing-sections.ts:216-222 | experience-meeting-point |
| entitlement:manage_experience_private_galleries | entitlement | experience | No UI or route found (gap 6) | key-enums.ts:32; C:1288 | experience-plan-features |
| entitlement:ai_chat | entitlement | venue, experience | Chat on the public page; a 403 shows the "unavailable" copy | key-enums.ts:51; W/pages/[lang]/comer-y-salir/[slug].astro:548-556; packages/seed/src/catalog/next-version-entitlements.ts:37-62 | listing-ai-chat |
| entitlement:ai_faq_draft | entitlement | venue, experience | «Sugerir con IA» in FAQ | key-enums.ts:56; C:902,1285 | listing-faqs |
| entitlement:featured_listing | entitlement | venue | UNVERIFIED: only accommodation sync found | key-enums.ts:13; V/featured/sync-listing-featured.ts:14,61 | venue-plan-features |
| entitlement:respond_reviews | entitlement | venue, experience | UNVERIFIED: no route; MCP says reviews cannot be answered | key-enums.ts:11; apps/api/src/mcp/tools/review/list-reviews.ts:314 | reviews |
| entitlement:priority_support | entitlement | venue, experience | UNVERIFIED: only comparison rows | key-enums.ts:12; W/components/billing/plan-comparison-rows.ts | venue-plan-features |
| entitlement:custom_branding | entitlement | venue, experience | UNVERIFIED: only comparison rows | key-enums.ts:14 | venue-plan-features |
| entitlement:ai_translate | entitlement | venue, experience | UNVERIFIED: not used in the translation panel | key-enums.ts:54 | listing-translations |
| entitlement:ai_text_improve | entitlement | venue, experience | UNVERIFIED: not wired in these editors | key-enums.ts:50 | venue-plan-features |
| entitlement:recover_own_listing | entitlement | venue, experience | Floor/trial: read and recover one's own listing | key-enums.ts:59; C:1555-1560 | listing-lifecycle |
| entitlement:subscribe_to_plan | entitlement | venue, experience | Pre-trial and floor roles (part D) | key-enums.ts:60; C:1595-1610 | listing-quota |
| entitlement:activate_trial | entitlement | venue, experience | The trial starts on the first publish (part D) | key-enums.ts:61 | listing-lifecycle |

### 1.4 Limits

| anchor | kind | aud | gates / how shown | source | plannedArticle |
|---|---|---|---|---|---|
| limit:max_venues | limit | venue | Venues per account; «X de Y» badge plus «Mejorar plan»; a surplus becomes UNPUBLISHED_BY_BILLING with a notice | key-enums.ts:67; C:667,794,941; W/pages/[lang]/mi-cuenta/comercio/index.astro:204-232 | listing-quota |
| limit:max_experiences | limit | experience | Same | key-enums.ts:68; C:1059,1183,1321 | listing-quota |
| limit:max_properties | limit | venue, experience | UNVERIFIED: no use found | key-enums.ts:69 | listing-quota |
| limit:max_photos_per_accommodation | limit | — | **Does not apply**: the gallery cap here is the constant 30 | key-enums.ts:70; S/common/media-upload.schema.ts:37-38 | photos |
| limit:max_active_promotions | limit | venue | The manager shows a limit notice with the plan that raises it | key-enums.ts:71; apps/api/src/routes/venue/protected/promotion-access.ts:1-40 | venue-promotions |
| limit:max_active_private_galleries | limit | experience | No UI (gap 6) | key-enums.ts:72; C:1334 | experience-plan-features |
| limit:max_ai_chat_venue_per_month | limit | venue | Monthly quota; `C:667-680` is stale (gap 3) | key-enums.ts:82; packages/seed/src/catalog/next-version-entitlements.ts:37-62; C:949 | listing-ai-chat |
| limit:max_ai_chat_experience_per_month | limit | experience | Monthly quota | key-enums.ts:83; C:1329 | listing-ai-chat |
| limit:max_ai_faq_draft_per_month | limit | venue, experience | Monthly quota | key-enums.ts:88; C:944,1324 | listing-faqs |

### 1.5 States and activation

| anchor | kind | aud | what the owner sees | source | plannedArticle |
|---|---|---|---|---|---|
| enum:PublicationStatus.DRAFT | state | venue, experience | «Borrador — incompleto» (with a checklist) or «Borrador — listo para publicar» plus «Publicar» | W/components/listing/ListingActions.client.tsx:198-269 | listing-lifecycle |
| enum:PublicationStatus.PUBLISHED | state | venue, experience | «Publicado», «Ver ficha pública», brochure, QR sheet (no gate), certificate (experience) | W/components/listing/ListingActions.client.tsx:98-174 | listing-lifecycle |
| enum:PublicationStatus.UNPUBLISHED_BY_BILLING | state | venue, experience | «Sin publicar por tu plan» plus «Publicar de nuevo»; SURPLUS / NOT_COVERED / QUOTA_FULL / FREE_SLOT notices | W/components/listing/ListingActions.client.tsx:176-217; S/common/listing-notices.schema.ts:13-23 | listing-lifecycle |
| enum:PublicationStatus.ARCHIVED | state | venue, experience | Notice with the deletion date. **No reactivate button on the web** (gap 1) | S/common/listing-notices.schema.ts:49-62; W/lib/host/property-card-actions.ts:81 | listing-archived-inactivity |
| enum:PublicationStatus.MODERATED | state | venue, experience | «Ficha moderada» with the reason and date; an admin lifts it | S/common/listing-notices.schema.ts:63-67 | fix-request |
| enum:PublicationStatus.PURGED | state | venue, experience | No actions, only the "deleted" notice | W/components/listing/ListingActions.client.tsx:94-96 | delete-listing |
| activation:venue | activation | venue | The first publish (`listing_published`) starts the trial; the confirmation shows the number of days | S/catalog/vertical-activation-event.ts:41-46; apps/api/src/services/listing-publication/listing-publication.service.ts:160-190; C:1563-1580 | listing-lifecycle |
| activation:experience | activation | experience | Same | S/catalog/vertical-activation-event.ts:41-46; C:1560-1640 | listing-lifecycle |

TrialStatus and SUBSCRIPTION_STATUSES belong to part D.
Trial email series: T-10/-5/-2/0, expired, then win-back emails at +1/+5/+15/+30/+60 days (`V/trial/trial-deadlines.ts:7-8`).

### 1.6 MCP tools (`apps/api/src/mcp/tools/registry.ts:33-55`)

| anchor | kind | aud | what it does for venue/experience | source | plannedArticle |
|---|---|---|---|---|---|
| tool:list_my_listings | tool | venue, experience | Lists the owner's listings across the 3 verticals | listing/list-my-listings.ts:242 | ai-assistants |
| tool:get_owner_summary | tool | venue, experience | Totals per state, views, items needing attention; leaves out stats without `view_basic_stats` | summary/get-owner-summary.ts:113 | ai-assistants |
| tool:get_my_plan | tool | venue, experience | Plan, status, what it includes, trial days left | plan/get-my-plan.ts:35 | ai-assistants |
| tool:get_listing | tool | venue, experience | Reads a listing | listing/get-listing.ts:332 | ai-assistants |
| tool:update_listing_basic | tool | venue, experience | Edits only description, openingHours, contactInfo, amenityIds and featureIds | listing/update-listing-basic.ts:327 | ai-assistants |
| tool:get_listing_amenities | tool | venue, experience | Reads services | registry:37 | ai-assistants |
| tool:update_listing_amenities | tool | venue, experience | Adds or removes services by category | listing/update-listing-amenities.ts:253 | ai-assistants |
| tool:set_listing_publication | tool | venue, experience | pause / resume (ARCHIVED needs two resumes; MODERATED is refused) | listing/set-listing-publication.ts:100-135,373 | pause-resume |
| tool:list_amenities_and_features | tool | venue, experience | Valid ids | registry:42 | ai-assistants |
| tool:get_listing_stats | tool | venue, experience | Views and reviews; requires basic stats | listing/get-listing-stats.ts:233 | listing-stats |
| tool:get_listing_creation_guide | tool | venue, experience | Steps, types, business lines and price units, drafts, quota | listing/get-listing-creation-guide.ts:214 | create-listing |
| tool:create_listing | tool | venue, experience | DRAFT in two steps | listing/create-listing.ts:279 | create-listing |
| tool:list_reviews | tool | venue, experience | Lists reviews; cannot reply | review/list-reviews.ts:312 | reviews |
| tool:get_help | tool | venue, experience | The help catalog | help/get-help.ts:189 | ai-assistants |
| tool:list_inquiries / get_inquiry / reply_inquiry | tool | — | **Accommodation only**: venues and experiences have no inquiries | inquiry/list-inquiries.ts:117; inquiry/reply-inquiry.ts:191 | listing-limitations |

UNVERIFIED: whether a venue owner reaches the 5 host-trade tools.

### 1.7 Emails (no email is specific to venues)

| anchor | kind | aud | subject / when | source | plannedArticle |
|---|---|---|---|---|---|
| email:verticals.listing-retention-before-archive | email | venue, experience | «Tu ficha de {name} se va a archivar por inactividad» | packages/notifications/src/services/outbox/listing-retention-renderers.tsx:73 | listing-archived-inactivity |
| email:verticals.listing-retention-before-deletion | email | venue, experience | «El contenido de tu ficha de {name} se va a borrar» | listing-retention-renderers.tsx:88 | listing-archived-inactivity |
| email:verticals.listing-archived | email | venue, experience | «Archivamos tu ficha de {vertical} por inactividad» | listing-archived-renderers.tsx:61 | listing-archived-inactivity |
| email:verticals.listing-purged | email | venue, experience | «Se borró tu ficha» | vertical-listing-renderers.tsx:309 | delete-listing |
| email:verticals.listing-moderated | email | venue, experience | «Tu ficha está moderada» | vertical-listing-renderers.tsx:323 | fix-request |
| email:verticals.listing-fix-requested | email | venue, experience | «Te pedimos un arreglo en tu ficha» | vertical-listing-renderers.tsx:341 | fix-request |
| email:verticals.listing-moderation-level-changed | email | venue, experience | «Cambió la moderación de tu ficha» | vertical-listing-renderers.tsx:393 | fix-request |
| email:verticals.listing-moderation-lifted | email | venue, experience | «Se levantó la moderación de tu ficha» | vertical-listing-renderers.tsx:414 | fix-request |
| email:verticals.listing-restitution | email | venue, experience | «Tus fichas volvieron a publicarse» | vertical-listing-renderers.tsx:437 | listing-lifecycle |
| email:verticals.listing-business-lines-changed | email | venue | «Soporte cambió los rubros de tu ficha» | packages/notifications/src/templates/verticals/listing-business-lines-changed.tsx:6 | venue-business-lines |
| email:verticals.listing-content-edited-by-support | email | venue, experience | «Soporte editó tu ficha» | vertical-listing-renderers.tsx:279 | fix-request |

`listing-fix-reported` (staff) and `price-alert-closed` (tourist) go in section 7.

### 1.8 Crons

| anchor | kind | aud | effect | source | plannedArticle |
|---|---|---|---|---|---|
| cron:listing-inactivity-archive | cron | venue, experience | Daily at 05:30. Archives a published or UNPUBLISHED_BY_BILLING listing after 90 days of inactivity, and a draft after 3 months | apps/api/src/cron/schedules.manifest.ts:59; packages/db/src/migrations/0148_cut_paso_3.sql:16-19; V/publication/retention-clock.ts:32-49 | listing-archived-inactivity |
| cron:listing-retention-pass | cron | venue, experience | Daily at 06:00. Sends two pre-notices and purges at day 180 | schedules.manifest.ts:83-88; V/publication/retention-notices.ts:11-14 | listing-archived-inactivity |
| cron:listing-coverage-reconciler | cron | venue, experience | Daily at 05:00. Takes down listings over the limit or without coverage | schedules.manifest.ts:66-72 | listing-quota |
| cron:listing-remote-deletion-retry | cron | venue, experience | Daily at 05:45. Retries removing photos and tokens of purged listings | schedules.manifest.ts:73-80 | delete-listing |
| cron:venue-events-past-cleanup | cron | venue | Deletes one-off events that ended more than 60 days ago | schedules.manifest.ts:341-346; S/entities/venue/subtypes/venue.event.lifecycle.ts:28 | venue-events |

Deadlines live in `vertical_deadline_version` (`0148_cut_paso_3.sql:15-26`), so articles use tokens, never literals. Creating or editing counts as activity (`packages/service-core/src/services/listing/listing-owner-act.ts:1-12`).

## 8. Proposed articles (part B)

| id | title | summary | audiences | public | covers | entryFor | related | crossPartLinks | note |
|---|---|---|---|---|---|---|---|---|---|
| create-listing (reuse) | Crear mi comercio o experiencia | Cómo crear la ficha de un comercio o una experiencia desde Publicar, y qué cargar primero. | venue, experience | true | page:mi-cuenta/comercio/nuevo, page:…/nuevo/[vertical], page:publicar/comer-y-salir, page:publicar/experiencias, page:mi-cuenta/publica, tool:create_listing, tool:get_listing_creation_guide | page:mi-cuenta/publica | publish-requirements, listing-basic-info, venue-business-lines, listing-lifecycle, listing-quota | subscription | Se crea con nombre, categoría, resumen y descripción, y el resto se completa en el editor. La ficha no se publica sola. |
| listing-basic-info | Nombre, categoría y descripción | Cómo editar el nombre, la categoría, el resumen y la descripción. | venue, experience | false | section:*.datos, edit_*_info | section:venue.datos, section:experience.datos | venue-business-lines, listing-translations, photos, publish-requirements | create-listing | Resumen de 10 a 300 caracteres, descripción de 20 a 2000 y descripción ampliada de hasta 5000. Si la ficha ya está publicada, la dirección web se mantiene salvo que lo marques. Acá no hay IA de redacción. |
| venue-business-lines | Gastronomía y noche: qué rubros elegir | Qué secciones aparecen según elijas gastronomía, noche o las dos. | venue | true | section:venue.datos (rubros), email:verticals.listing-business-lines-changed | — | venue-night-info, venue-menu, venue-daily-specials, listing-locked-sections, listing-basic-info | — | Gastronomía suma la carta y el menú del día; noche suma «De noche». Tipos posibles según el rubro. Quitar un rubro oculta sus secciones y no borra los datos. Si soporte cambia tus rubros, te avisa por email. |
| venue-location | Dirección y excepción de dirección repetida | Cómo cargar la dirección del local y qué hacer si ya tenés otra ficha en esa misma dirección. | venue | false | section:venue.ubicacion | section:venue.ubicacion | publish-requirements, listing-basic-info, listing-contact | — | La dirección se muestra en público. Solo puede haber una ficha publicada por dirección; si necesitás otra, pedís una excepción. |
| opening-hours | Horarios de atención | Horarios por día, con turnos partidos y turnos que pasan la medianoche. | venue, experience | false | section:*.horarios | section:venue.horarios, section:experience.horarios | publish-requirements, venue-events, experience-practical-info | — | Son obligatorios para publicar un comercio y opcionales para una experiencia. Alimentan el cartel «Abierto ahora». |
| venue-price-range | Rango de precios del comercio | Elegí el rango de precios que se muestra en tu ficha. | venue | false | section:venue.precio | section:venue.precio | publish-requirements, venue-menu, venue-night-info | — | Hay cuatro niveles y es obligatorio para publicar. No es el precio de la carta. |
| experience-price | Precio de la experiencia | Cargá el precio «desde» con su unidad, o marcá «a consultar». | experience | false | section:experience.precio | section:experience.precio | publish-requirements, experience-practical-info, experience-meeting-point | — | Unidades: por día, por hora, por persona o por grupo. Para publicar hace falta un precio mayor a cero o la opción «a consultar». |
| amenities (reuse) | Servicios y comodidades | Tildá los servicios que ofrecés. | venue, experience | false | section:*.servicios | section:venue.servicios, section:experience.servicios | listing-policies, listing-basic-info, listing-locked-sections | — | No depende del plan. |
| listing-policies | Reglas del lugar: pagos, mascotas, cancelación | Qué reglas podés declarar y dónde se muestran. | venue, experience | false | servicios (panel de reglas) | — | amenities, venue-night-info, listing-limitations, experience-practical-info | — | El campo «reservas» es solo informativo: Hospeda no toma reservas. Las experiencias suman grupos privados y política de cancelación. |
| photos (reuse) | Fotos y video de mi ficha | La foto de portada, la galería y qué pasa con el video. | venue, experience | true | section:*.fotos, can_embed_video | section:venue.fotos, section:experience.fotos | publish-requirements, listing-basic-info, listing-brochure-qr, venue-menu | — | Hasta 30 fotos; cada acción se guarda al instante. El video existe solo en comercios y hoy está bloqueado para todos. |
| listing-contact | Contacto y redes de mi ficha | Qué contactos cargar y cuáles cuentan para poder publicar. | venue, experience | false | section:*.contacto | section:venue.contacto, section:experience.contacto | publish-requirements, venue-location, listing-ai-chat | — | WhatsApp existe solo en comercios y por defecto no se muestra. Las experiencias no tienen WhatsApp. |
| venue-menu | La carta del comercio | Cargá la carta con platos, una foto o PDF, o un link. | venue | true | section:venue.carta, manage_venue_menu, menu_item_photos, multilingual_venue_menu | section:venue.carta | venue-menu-qr, venue-daily-specials, venue-plan-features, listing-locked-sections | change-plan | Disponible solo con el rubro gastronomía. Si está bloqueada, ves lo que cargaste y solo podés vaciarla. No hay pedidos online. |
| venue-menu-qr | QR de la carta y métricas de escaneo | Mirá el QR de tu carta y cuántas veces lo escanearon. | venue | false | menu_qr_scan_metrics | — | venue-menu, listing-stats, listing-brochure-qr, venue-plan-features | change-plan | Muestra solo dispositivo e idioma. No es el QR de la puerta. |
| venue-daily-specials | Menú del día | Platos del día con fecha de vencimiento. | venue | false | section:venue.menu-del-dia, manage_venue_daily_special | section:venue.menu-del-dia | venue-menu, venue-events, listing-locked-sections | — | Hasta 10 platos, con una ventana de hasta 31 días. Vence solo. |
| venue-events | Agenda de eventos del local | Eventos únicos o semanales, con link de entradas. | venue | false | section:venue.eventos, manage_venue_events, cron:venue-events-past-cleanup | section:venue.eventos | venue-promotions, venue-night-info, opening-hours, listing-locked-sections | — | Hospeda no vende entradas ni maneja listas de invitados. Un evento pasado se borra a los 60 días. |
| venue-promotions | Promociones y happy hour | Promociones con vigencia y franja horaria semanal. | venue | true | section:venue.promociones, create_promotions, max_active_promotions | section:venue.promociones | venue-events, venue-plan-features, listing-quota, listing-locked-sections | change-plan, addons | Si bajás de plan, las promociones siguen vigentes. Solo se bloquea crear, editar y reactivar. |
| venue-night-info | Información de noche | Entrada, edad mínima y vestimenta. | venue | true | section:venue.de-noche | section:venue.de-noche | venue-business-lines, venue-events, listing-policies | — | Disponible solo con el rubro noche. Un boliche viene con +18 cargado. |
| listing-faqs | Preguntas frecuentes de mi ficha | Preguntas y respuestas, con un borrador hecho por IA. | venue, experience | false | section:*.preguntas, ai_faq_draft | section:venue.preguntas, section:experience.preguntas | listing-ai-chat, listing-basic-info, listing-translations | ai-assistants | Lo que cargás acá alimenta las respuestas del chat. |
| listing-ai-chat | El chat con IA de mi ficha y sus preguntas | Qué es el chat de tu ficha pública, el cupo de tu plan y qué te preguntan. | venue, experience | true | section:*.preguntas-ia, public pages, ai_chat, ai chat limits | section:venue.preguntas-ia, section:experience.preguntas-ia | listing-faqs, listing-contact, venue-plan-features, experience-plan-features | ai-assistants, change-plan | Solo pueden usarlo visitantes con sesión. Sin cupo, el chat aparece como «no disponible». |
| listing-translations | Traducciones de mi ficha | Nombre y descripciones en inglés y portugués. | venue, experience | false | section:*.traducciones | section:venue.traducciones, section:experience.traducciones | listing-basic-info, listing-faqs, venue-menu | — | Se escriben a mano: acá no hay traducción automática. |
| experience-meeting-point | Punto de encuentro y cómo llegar | Dónde empieza la experiencia y cómo se llega. | experience | false | section:experience.punto-de-encuentro, manage_experience_directions | section:experience.punto-de-encuentro | experience-practical-info, experience-plan-features, publish-requirements | change-plan | Las coordenadas se cargan a mano. «Cómo llegar» depende del plan. |
| experience-practical-info | Duración, qué llevar y requisitos | Duración y las listas de qué llevar y requisitos. | experience | false | section:experience.datos-practicos | section:experience.datos-practicos | experience-meeting-point, experience-price, listing-policies | — | — |
| experience-certificate | Certificados de la experiencia | Emití certificados con el nombre de cada participante. | experience | false | issue_experience_certificate | — | experience-plan-features, listing-brochure-qr, listing-lifecycle | change-plan | Solo con la ficha publicada. |
| listing-brochure-qr | Folleto en PDF y QR de mi ficha | Descargá el folleto y el QR para imprimir. | venue, experience | false | download_listing_pdf | — | venue-menu-qr, photos, listing-lifecycle | change-plan | El QR de la puerta no depende del plan; el folleto sí. |
| listing-stats | Visitas y métricas de mi ficha | Qué estadísticas ves y cuáles dependen del plan. | venue, experience | false | view_basic_stats, view_advanced_stats, tool:get_listing_stats | — | venue-menu-qr, listing-lifecycle, ai-assistants | change-plan | Las métricas de clics todavía no están en ningún plan. |
| publish-requirements (reuse) | Qué hace falta para publicar | Qué datos se exigen y por qué no te deja publicar. | venue, experience | true | publish_venue, publish_experience | — | create-listing, photos, listing-contact, opening-hours, venue-price-range, experience-price | trial, subscription | La lista cambia entre comercio y experiencia. En comercios rige una dirección por ficha. |
| listing-lifecycle | Estados de mi ficha | Qué significa cada estado de la ficha. | venue, experience | true | states, activations, restitution, recover/activate_trial, page:mi-cuenta/comercio | page:mi-cuenta/comercio | pause-resume, listing-archived-inactivity, listing-quota, fix-request, publish-requirements | trial, subscription | La primera publicación arranca la prueba. En el portal no hay botón «Despublicar». |
| pause-resume (reuse) | Pausar y volver a publicar | Sacá tu ficha del sitio y volvé a ponerla. | venue, experience | true | tool:set_listing_publication | — | listing-lifecycle, delete-listing, listing-quota, ai-assistants | ai-assistants | En el portal no hay botón: se le pide al asistente. |
| delete-listing (reuse) | Eliminar una ficha | Cómo eliminar una ficha. | venue, experience | true | PURGED, email:verticals.listing-purged, cron:listing-remote-deletion-retry | — | pause-resume, listing-archived-inactivity, listing-lifecycle | contact | En el portal no hay botón: se pide por el formulario de contacto. Es definitivo. |
| listing-archived-inactivity | Archivado por inactividad | Cuándo se archiva, cuándo se borra y cómo reactivar. | venue, experience | true | ARCHIVED, crons de retención, emails de retención | — | listing-lifecycle, pause-resume, delete-listing | ai-assistants, subscription | Crear o editar la ficha cuenta como actividad. En la web no hay botón para reactivar. |
| fix-request | Me pidieron un arreglo o moderaron mi ficha | Qué hacer ante un pedido de arreglo o una moderación. | venue, experience | false | MODERATED, emails de moderación | — | listing-lifecycle, delete-listing, listing-basic-info | contact | «Ya lo corregí» le avisa al equipo, pero no cierra el pedido. |
| reviews (reuse) | Ver las reseñas de mi ficha | Cómo ver las reseñas que recibiste. | venue, experience | false | tool:list_reviews, respond_reviews | — | listing-stats, ai-assistants | — | No hay una pantalla para verlas ni se pueden responder. |
| listing-quota | Cuántos comercios o experiencias puedo publicar | El tope de tu plan y qué pasa si lo superás. | venue, experience | true | max_venues, max_experiences, max_properties, coverage reconciler, subscribe_to_plan | — | listing-lifecycle, venue-plan-features, experience-plan-features, create-listing | change-plan, subscription | Lo que exceda el tope queda «Sin publicar por tu plan». |
| listing-locked-sections | Secciones bloqueadas o que no aparecen | Por qué una sección tiene candado o directamente no aparece. | venue, experience | true | page:…/editar (hub) | page:mi-cuenta/comercio/[vertical]/[id]/editar | venue-business-lines, venue-menu, venue-events, venue-promotions | change-plan | Con candado: tu plan no la incluye. Ausente: tu rubro no la usa. |
| venue-plan-features | Qué incluye cada plan para Comer y salir | Lo que trae cada plan para un comercio. | venue | true | featured_listing, priority_support, custom_branding, ai_text_improve | — | venue-menu, venue-events, venue-promotions, listing-ai-chat, listing-quota | change-plan, subscription | Los valores van con tokens. |
| experience-plan-features | Qué incluye cada plan para experiencias | Lo que trae cada plan para una experiencia. | experience | true | private galleries | — | experience-meeting-point, experience-certificate, listing-ai-chat, listing-quota | change-plan, subscription | Las galerías privadas no tienen pantalla. |
| listing-limitations | Qué no hace Hospeda por ahora en comercios y experiencias | Reservas, pedidos, consultas y calendario. | venue, experience | true | inquiry tools | — | listing-policies, venue-events, venue-promotions, reviews | ai-assistants | No hay reservas, pedidos, delivery ni venta de entradas. Las consultas son solo para alojamientos. No hay calendario ni respuesta a reseñas. |

## 9. Gaps and bugs

1. **No pause, delete or reactivate on the web.** The API routes exist (`unpublish.ts`, `purge.ts`, `reactivate.ts`) and the MCP can pause and resume.
2. **`can_embed_video` and `view_advanced_stats` are in no venue plan** (HOS-2258/2261/2280).
3. **`production-catalog/catalog.ts` is stale.** It shows AI chat 0 for the two lower plans, while migrations 0156 and 0187 set different values.
4. **The trial semantics need agreeing with billing.** The code uses the top plan's entitlements with the bottom plan's limits, but several comments say otherwise.
5. **The pre-notice lead time is unverified.** `retention-notices.ts` names `ret:-90d`/`ret:-180d`, but deadline key 4 says 15 days.
6. **Private galleries have no UI.**
7. **`respond_reviews`, `priority_support`, `custom_branding` and `featured_listing` appear only in the comparison rows.**
8. **`policies.reservations` reads like a booking feature but is only informational.**
9. **The public contact on a venue page is UNVERIFIED** (HOS-924, `VenueContactBlock.astro`).
10. **HOS-2252 is partly on staging and partly in flight.** No article may promise what is still in progress (events cap, tourist notices, VIP promos, guest lists, reservations, featured event, add-on packs).
11. **`nuevo/index.astro:36` redirects to the accommodation publish page.**
12. **`SectionUnpublishedNotice` in a locked section with data** needs its copy checked before it is quoted.
