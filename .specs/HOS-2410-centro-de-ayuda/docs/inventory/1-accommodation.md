# HOS-2410 inventory part A: accommodation (host)

Generated 2026-11-20 from the `spec/HOS-2410-docs` branch (cut from origin/staging).
Every row has `audiences = host`. A row marked `UNVERIFIED` says why. Line numbers
in `source` are exact. A range means the whole block was read, not a single
statement.

**130 rows:** 23 pages, 13 sections, 31 entitlements, 11 limits, 6 states, 1
activation, 11 crons, 15 emails, 17 tools, 1 notices component and 1 gap. They
feed **29 proposed articles** and **15 gaps**.

How the counts were taken:
- **Pages:** `git ls-files 'apps/web/src/pages/[lang]/mi-cuenta/propiedades' 'apps/web/src/pages/[lang]/publicar' | wc -l` gives 19 in scope. On top of that: `mi-cuenta/consultas-propietario` (2 files), `host-dashboard.astro` (1) and `comercio/nuevo` (2).
- **Editor sections:** 11 catalog sections (`packages/schemas/src/catalog/listing-sections.ts:299-436`), plus `politicas` (`apps/web/src/lib/editor/accommodation-editor-sections.ts:112`) and `preguntas-ia` (`:91`). That is 13 section pages, plus the hub.

## 1.1 Pages

| anchor | kind | what the owner sees | source | plannedArticle | exempt |
|---|---|---|---|---|---|
| page:publicar (no gate) | page | Landing "Convertí tu propiedad en un ingreso". It shows the mini-form, a signup CTA, or a precheck panel when a draft exists, plus a trial callout when eligible | `apps/web/src/pages/[lang]/publicar/index.astro:71-86,104,168-175` | create-listing | |
| page:publicar/nueva (no gate) | page | 301 redirect to `/publicar/`, keeping the query (`?create=1`) | `apps/web/src/pages/[lang]/publicar/nueva.astro:32` | create-listing | no-user-surface: redirect |
| page:mi-cuenta/comercio/nuevo (no gate) | page | 301 redirect to `/publicar/` | `apps/web/src/pages/[lang]/mi-cuenta/comercio/nuevo/index.astro:33-36` | create-listing | no-user-surface: redirect |
| page:mi-cuenta/comercio/nuevo/[vertical] (no gate) | page | 301 redirect to `/publicar/{vertical}/`. It has no accommodation part | `apps/web/src/pages/[lang]/mi-cuenta/comercio/nuevo/[vertical].astro:38` | — | no-user-surface: redirect, not accommodation |
| page:mi-cuenta/host-dashboard | page | "Panel del anfitrión" with: properties (Total / Publicadas / Borradores), "Tu suscripción" (Prueba gratuita / Activo / Inactivo / Sin plan), Mensajes, Acciones rápidas, analytics. A non-host is redirected to `mi-cuenta` | `apps/web/src/pages/[lang]/mi-cuenta/host-dashboard.astro:44`; `apps/web/src/components/host/HostDashboard.client.tsx:196-209,217-247,302-361` | host-dashboard | |
| page:mi-cuenta/propiedades | page | "Mis propiedades": cards with a status badge, the "N de M propiedades" badge with "Mejorar plan", the "Sos anfitrión en preparación" banner, and "Publicar otra" | `apps/web/src/pages/[lang]/mi-cuenta/propiedades/index.astro:88-163,222-235,271-288`; `packages/i18n/src/locales/es/host.json:200-213` | plan-limits-accommodation | |
| page:mi-cuenta/propiedades/[id]/editar | page | Editor hub: one row per section with a status line ("⚠ Falta la descripción", "⛔ Falta para publicar: …", "Hasta N huéspedes"), plus listing notices and the support-edit notice | `.../propiedades/[id]/editar/index.astro:34-137`; `host.json:703-722` | editor-overview | |
| page:…/editar/datos | page | "Información básica" | `…/editar/datos.astro:19-50` | basic-info | |
| page:…/editar/capacidad-precio | page | "Capacidad y precio" | `…/editar/capacidad-precio.astro` | capacity-price | |
| page:…/editar/ubicacion | page | "Ubicación", with the duplicate-address notice and the exception panel | `…/editar/ubicacion.astro:25-59` | location-address | |
| page:…/editar/servicios | page | "Servicios y comodidades" | `…/editar/servicios.astro` | amenities | |
| page:…/editar/politicas | page | "Políticas" | `…/editar/politicas.astro` | house-rules | |
| page:…/editar/fotos | page | "Fotos" and video | `…/editar/fotos.astro:24-74` | photos | |
| page:…/editar/preguntas | page | "Preguntas frecuentes" | `…/editar/preguntas.astro` | faqs | |
| page:…/editar/preguntas-ia | page | "Preguntas a la IA" (read-only log) | `…/editar/preguntas-ia.astro:22-55` | ai-questions | |
| page:…/editar/contacto | page | "Contacto y redes" | `…/editar/contacto.astro` | contact-social | |
| page:…/editar/seo | page | "Buscadores (Google)" | `…/editar/seo.astro` | seo-google | |
| page:…/editar/calendario | page | "Calendario"; a locked box with an upgrade CTA without `can_use_calendar` | `…/editar/calendario.astro:46-53` | calendar | |
| page:…/editar/traducciones | page | "Traducciones" | `…/editar/traducciones.astro:20-52` | translations | |
| page:…/editar/reputacion | page | "Reputación externa" | `…/editar/reputacion.astro`. UNVERIFIED: wrapper not read, only its component | external-reputation | |
| page:mi-cuenta/consultas-propietario | page | "Mensajes de huéspedes": an inbox with 20 per page; empty state "Todavía no tenés mensajes" | `apps/web/src/pages/[lang]/mi-cuenta/consultas-propietario/index.astro:34-44,62-76` | inquiries | |
| page:mi-cuenta/consultas-propietario/[conversationId] | page | The thread. Replying is possible only if the conversation is not CLOSED/BLOCKED and the listing still exists; otherwise read-only | `…/consultas-propietario/[conversationId].astro:51-54`; `apps/web/src/components/account/ConversationReply.client.tsx:37` | inquiries | |
| page:alojamientos/[slug] (no gate) | page | "Ver en el sitio" opens the public page, only while PUBLISHED | `apps/web/src/lib/host/property-card-actions.ts:70-79` | listing-states | |

## 1.2 Editor sections

| anchor | kind | what the owner can set / rules / on save | source | plannedArticle |
|---|---|---|---|---|
| section:accommodation.datos | section | Name 3-100 chars, short description 10-300, description 30-2000, type (13 types), destination (required on create). The rich description is gated by `can_use_rich_description` and the AI improver by `ai_text_improve`. If the listing is published, renaming keeps the slug unless "Cambiar igual la dirección web" is ticked | `apps/web/src/components/host/editor/BasicInfoSection.client.tsx:53-58,223,252,355`; `accommodation-edit-form.schema.ts:60-70`; `host.json:295-299,846-860` | basic-info |
| section:accommodation.capacidad-precio | section | Guests 1-200, bedrooms 0-100, bathrooms 1-100, min nights 1-365, max nights ≥ min and ≤ 365, price in whole pesos > 0, currency "ARS — Peso argentino". Guests, min nights, bedrooms and bathrooms are required to publish | `CapacitySection.client.tsx:79-80,100-101,121-122,142-143,164-165`; `accommodation-edit-form.schema.ts:108-121`; `host.json:314-315` | capacity-price |
| section:accommodation.ubicacion | section | Coordinates, street, number, floor. An address already used by another published listing of the same owner is rejected (409 DUPLICATE_LOCATION), which offers "Pedir una excepción" (reason 10-500 chars; an admin reviews it and the owner is emailed) | `LocationPicker.client.tsx:58-60`; `accommodation-edit-form.schema.ts:72-83`; `use-accommodation-section-form.ts:143`; `ubicacion.astro:29-31`; `packages/schemas/src/common/location-rule.schema.ts:28,112`; `listing.json:515-545` | location-address |
| section:accommodation.servicios | section | Amenities and features from a catalog grouped by category, each with "Detalles" (private/shared, all year round) | `packages/schemas/src/catalog/listing-sections.ts:343-351`; `accommodation-edit-form.schema.ts:244-252`; `host.json:758-780`. UNVERIFIED: ServicesForm limits | amenities |
| section:accommodation.politicas | section | Check-in/out times, payment methods, pets (admission, extra cost, note per language), smoking, events (max guests, amplified sound, end time, extra cost), deposit (required, %), languages. An empty control removes the key, which reads "No informado", never "No". **Accommodations have no cancellation policy** | `forms/PoliciesForm.client.tsx:20-35`; `lib/listing/listing-policies.ts:63-110,133-138`; `listing.json:631-634`; `PoliciesPanel.client.tsx:8-14` | house-rules |
| section:accommodation.fotos | section | Main image plus a gallery. JPG/PNG/WebP/HEIC up to 10 MB, resized in the browser, drag-and-drop reorder, alt text and attribution per photo. The gallery cap is `max_photos_per_accommodation`; before the trial a draft limit applies. Video links are gated by `can_embed_video` (hidden in public without it). The main image is required to publish | `PhotoSection.client.tsx:154-156,345-356`; `photo-section-helpers.ts:113-128`; `packages/media/src/limits.ts:37,48`; `pre-trial-draft-limit.ts`; `VideoSection.client.tsx:10` | photos |
| section:accommodation.preguntas | section | Add, edit, delete and reorder. Question 10-300 chars, answer 10-2000. Each change saves immediately. Two toggles: "Visible en la ficha pública" and "Usable por la IA". AI draft gated by `ai_faq_draft`. A FAQ hidden from the page but usable by the AI is NOT private | `FaqSection.client.tsx:17-18,807`; `packages/schemas/src/common/faq.schema.ts:19-31`; `host.json:438-470` | faqs |
| section:accommodation.preguntas-ia | section | Read-only, anonymous list of what visitors asked the AI chat; contact data is hidden. Kept 12 months, with a date filter up to 12 months back and unanswered questions first. Actions: "Agregar como pregunta frecuente" and "Sugerir respuesta con IA" | `preguntas-ia.astro:22-55`; `host.json:732-782`; `schedules.manifest.ts:317` | ai-questions |
| section:accommodation.contacto | section | Phone, WhatsApp, landline (Argentine format required), email, website and 6 social networks. Public | `accommodation-edit-form.schema.ts:123-160,259-272`; `host.json:322` | contact-social |
| section:accommodation.seo | section | Title 30-60 and description 70-160, both optional (empty means name plus summary). They apply only to the Spanish pages | `SeoSection.client.tsx:64-67,148,195`; `host.json:287-288` | seo-google |
| section:accommodation.calendario | section | Monthly grid: click start, click end, then "Bloquear" or "Liberar" with an optional note. Past dates cannot be changed. Synced days (Google, Airbnb, Booking, iCal) are read-only. Gated by `can_use_calendar`; sync by `can_sync_external_calendar` | `CalendarSection.client.tsx:7-40`; `calendario.astro:46-53`; `host.json:591-700` | calendar |
| section:accommodation.traducciones | section | Status per field in en/pt; "Generar traducciones faltantes" with AI (`ai_translate` plus a monthly quota) | `traducciones.astro:30-32`; `TranslationPanel.client.tsx`; `apps/api/src/routes/ai/protected/translate.ts:185-186`; `host.json:563-590` | translations |
| section:accommodation.reputacion | section | A "Mostrar sección de reputación externa" toggle. Profiles per platform (Google, Booking, Airbnb, other) with URL, showLink and showReviews. "Actualizar" is rate-limited. Review text only for Google | `ExternalReputationSection.client.tsx:53,80,96,676`; `external-reputation.json:37-47`. UNVERIFIED: entitlement gate | external-reputation |

## 1.3 Entitlement keys (accommodation-relevant)

Lines refer to `packages/schemas/src/catalog/key-enums.ts`.

| anchor | kind | what the owner sees | source | plannedArticle | exempt |
|---|---|---|---|---|---|
| entitlement:publish_accommodations | entitlement | Without a plan, "Publicar" leads to "Elegir plan de anfitrión" / "Ver planes", plus the "Sos anfitrión en preparación" banner | `:3`; `PublishButton.client.tsx:21-28`; `host.json:200-205,248-251` | publish-requirements | |
| entitlement:edit_accommodation_info | entitlement | Shown in the plan comparison; no UI gate found. UNVERIFIED: enforcement | `:6`; `plan-comparison-rows.ts:215-219` | plan-limits-accommodation | |
| entitlement:view_basic_stats | entitlement | The dashboard analytics block shows as locked without it | `:9`; `AnalyticsSection.client.tsx:152-154` | host-dashboard | |
| entitlement:view_advanced_stats | entitlement | Market comparison and favorites breakdown | `:10`; `AnalyticsSection.client.tsx:156,177-185` | host-dashboard | |
| entitlement:respond_reviews | entitlement | Marked `upcoming` in the comparison: replying to reviews does not exist | `:11`; `plan-comparison-rows.ts:221-225` | reviews | |
| entitlement:priority_support | entitlement | UNVERIFIED: no gate found | `:12` | — | no-user-surface: no gate found |
| entitlement:featured_listing | entitlement | A comment mentions a toggle in the hub, but the hub does not render one | `:13`; `accommodation-editor-sections.ts:59-62`; `index.astro:130-136`. UNVERIFIED | plan-limits-accommodation | |
| entitlement:custom_branding | entitlement | UNVERIFIED: no gate | `:14` | — | no-user-surface: no gate found |
| entitlement:create_promotions | entitlement | Gates `mi-cuenta/promociones` (another part) | `:15` | (part D) | |
| entitlement:can_use_rich_description | entitlement | Rich editor inside `PlanEntitlementGate` | `:16`; `BasicInfoSection.client.tsx:252`; `listing-sections.ts:329-333` | basic-info | |
| entitlement:can_embed_video | entitlement | Videos can be saved, but the public page hides them without it | `:17`; `VideoSection.client.tsx:10`; `listing-sections.ts:362-366` | photos | |
| entitlement:can_use_calendar | entitlement | Calendar page locked, with an upgrade CTA | `:18`; `calendario.astro:46-53`; `listing-sections.ts:367-374` | calendar | |
| entitlement:can_sync_external_calendar | entitlement | Sync shows "Función premium / Mejorar plan" | `:19`; `CalendarSyncLauncher.client.tsx:47`; `host.json:657-672` | calendar | |
| entitlement:can_contact_whatsapp_display | entitlement | Whether the guest sees the WhatsApp number (a tourist-side entitlement) | `:20`; `WhatsAppContact.client.tsx:8`; `plan-comparison-rows.ts:151` | contact-social | |
| entitlement:can_contact_whatsapp_direct | entitlement | Direct WhatsApp link for the guest | `:21`; `endpoints-protected.ts:2814-2817` | contact-social | |
| entitlement:has_verification_badge | entitlement | Gates showing `isVerified`; the owner cannot set it (an admin does) | `:22`; `listing-sections.ts:334-338` | basic-info | |
| entitlement:download_listing_pdf | entitlement | Brochure download on the public page | `:23`; `BrochureDownloadButton.client.tsx:22,42` | listing-states | |
| entitlement:multi_property_management | entitlement | UNVERIFIED: no use | `:33` | — | no-user-surface: no gate found |
| entitlement:consolidated_analytics | entitlement | UNVERIFIED: no use | `:34` | — | no-user-surface: no gate found |
| entitlement:centralized_booking | entitlement | No booking engine exists in code | `:35` | what-hospeda-doesnt-do | |
| entitlement:staff_management | entitlement | UNVERIFIED: no use | `:36` | — | no-user-surface: no gate found |
| entitlement:read_reviews | entitlement | Comparison-table row | `:39` | reviews | |
| entitlement:ai_text_improve | entitlement | "Mejorar con IA", hidden without it | `:50`; `BasicInfoSection.client.tsx:223,355`; `AiTextImprovePanel.client.tsx:42` | basic-info | |
| entitlement:ai_chat | entitlement | The listing's AI chat, which feeds "Preguntas a la IA". UNVERIFIED: gate in the chat | `:51`; `preguntas-ia.astro:6-9` | ai-questions | |
| entitlement:ai_support | entitlement | UNVERIFIED | `:53` | — | UNVERIFIED |
| entitlement:ai_translate | entitlement | Translation generation (entitlement plus monthly quota) | `:54`; `translate.ts:185-186` | translations | |
| entitlement:ai_accommodation_import | entitlement | "Importar desde una URL". A 402 shows "Tu plan no incluye la extracción de datos con IA" plus "Ver planes"; a new user gets 24 h of import without AI | `:55`; `ImportFromUrl.client.tsx:111,194-234,344`; `host.json:16-29` | import-from-url | |
| entitlement:ai_faq_draft | entitlement | "Sugerir respuesta con IA" in FAQs | `:56`; `FaqSection.client.tsx:807`; `ListingFaqManager.client.tsx:822` | faqs | |
| entitlement:recover_own_listing | entitlement | UNVERIFIED: gate not found | `:59` | listing-states | |
| entitlement:subscribe_to_plan | entitlement | Lets a user without a plan reach the checkout from "Publicar" | `:60`; `PublishButton.client.tsx:125-141`. UNVERIFIED | (part D) | |
| entitlement:activate_trial | entitlement | The trial starts on `listing_published`: "Al publicar arranca tu prueba gratis de N días. Sin tarjeta." | `:61`; `entitlement-keys.ts:80-84`; `host.json:225-226` | (part D: trial) | |

## 1.4 Limit keys

| anchor | kind | what the owner sees | source | plannedArticle |
|---|---|---|---|---|
| limit:max_accommodations | limit | "N de M propiedades" (published only). "Mejorar plan" shows at the threshold. Surplus listings are unpublished, most recently published first | `key-enums.ts:66`; `propiedades/index.astro:156-159,271-288`; `host.json:207-213`; `listing.json:547-551` | plan-limits-accommodation |
| limit:max_properties | limit | UNVERIFIED: no use | `:69` | — |
| limit:max_photos_per_accommodation | limit | "Subí hasta N fotos" (the gallery only); the API checks `total + 1` | `:70`; `photo-section-helpers.ts:113-128`; `apps/api/src/utils/listing-access/photo-limit.ts:4-14`; `host.json:268-272` | photos |
| limit:max_active_promotions | limit | Promotions (part D) | `:71` | (part D) |
| limit:max_staff_accounts | limit | UNVERIFIED: no use | `:76` | — |
| limit:max_ai_text_improve_per_month | limit | Monthly quota for "Mejorar con IA" | `:79`; `ai-quota-catalog.ts:18` | basic-info |
| limit:max_ai_chat_per_month | limit | UNVERIFIED: consumer | `:80` | ai-questions |
| limit:max_ai_support_per_month | limit | UNVERIFIED | `:85` | — |
| limit:max_ai_translate_per_month | limit | Translation quota | `:86`; `translate.ts:186` | translations |
| limit:max_ai_accommodation_import_per_month | limit | AI import quota | `:87` | import-from-url |
| limit:max_ai_faq_draft_per_month | limit | AI FAQ draft quota | `:88` | faqs |

## 1.5 Publication states and activation

| anchor | kind | what the owner sees | source | plannedArticle |
|---|---|---|---|---|
| enum:PublicationStatus.DRAFT | state | "Borrador": Editar, Publicar, Eliminar | `publication-status.enum.ts:22`; `host.json:215`; `property-card-actions.ts:69` | listing-states |
| enum:PublicationStatus.PUBLISHED | state | "Publicada": Editar, Ver en el sitio, Despublicar (back to DRAFT; the trial keeps running), Eliminar, QR | `:23`; `property-card-actions.ts:70-79`; `unpublish-listing.ts` | pause-resume |
| enum:PublicationStatus.UNPUBLISHED_BY_BILLING | state | "Sin publicar por tu plan": "Publicar de nuevo", only with coverage and a free slot | `:24`; `property-card-actions.ts:80`; `publish-listing.ts:36-45` | listing-states |
| enum:PublicationStatus.ARCHIVED | state | "Archivada": hidden, content kept. Card offers only Editar, Eliminar and QR; **no web button brings it back to draft** | `:25`; `property-card-actions.ts:61-66,81`; `listing-notices.ts:195-222` | inactivity-archive |
| enum:PublicationStatus.MODERATED | state | "Moderada": hidden until an admin lifts it. The owner can view, export, edit and delete, but not publish | `:26`; `listing.json:587-594`; `property-card-actions.ts:82` | fix-request |
| enum:PublicationStatus.PURGED | state | "Eliminada": no actions | `:27`; `property-card-actions.ts:84` | delete-listing |
| activation:accommodation | activation | `listing_published`: the first publish starts the trial if eligible; unpublishing does not stop it | `vertical-activation-event.ts:15,44`; `host.json:225-226,237` | publish-requirements |

## 1.6 Crons

| anchor | kind | what the owner sees | source | plannedArticle |
|---|---|---|---|---|
| cron:listing-inactivity-archive | cron | Daily at 05:30 UTC. **Only when not covered** by a plan or trial: PUBLISHED or UNPUBLISHED_BY_BILLING listings archive after 90 days, DRAFT after 3 months. With coverage the clock resets. Initial values; the live values are versioned in the DB (UNVERIFIED) | `schedules.manifest.ts:59-64`; `archive-inactive-listing.ts:72-98`; `listing-retention-schedule.model.ts:12-27`; `0148_cut_paso_3.sql:19-20` | inactivity-archive |
| cron:listing-retention-pass | cron | Daily at 06:00 UTC: two notices (15 days before archive, 15 before deletion) and the purge at deletion (initially 180 days) | `schedules.manifest.ts:82-87`; `0148_cut_paso_3.sql:19-20`; `retention-clock.ts` | inactivity-archive |
| cron:listing-coverage-reconciler | cron | Daily at 05:00 UTC: unpublishes listings left without coverage or over the limit, and republishes them when coverage returns | `schedules.manifest.ts:66-72`; `listing.json:547-560` | plan-limits-accommodation |
| cron:listing-remote-deletion-retry | cron | Daily at 05:45 UTC: retries removing photos and calendar tokens of deleted listings | `schedules.manifest.ts:74-80` | delete-listing |
| cron:trial-machine-expiry | cron | Every 15 min: expires trials | `schedules.manifest.ts:130-135` | (part D: trial) |
| cron:calendar-sync-google | cron | Every 6 h | `schedules.manifest.ts:301-307` | calendar |
| cron:calendar-sync-ical | cron | Every 6 h (Airbnb, Booking, other) | `schedules.manifest.ts:309-315` | calendar |
| cron:ai-listing-questions-retention | cron | Daily at 03:45 UTC: deletes questions older than 12 months | `schedules.manifest.ts:317-323` | ai-questions |
| cron:ai-questions-weekly-digest | cron | Mondays at 09:00 UTC: weekly email of unanswered questions; skipped when empty or when opted out | `schedules.manifest.ts:349-354` | ai-questions |
| cron:refresh-external-reputation | cron | Mondays at 02:00 UTC | `schedules.manifest.ts:447-453` | external-reputation |
| cron:conversation-notification | cron | Every 5 min: email 30 min after an unread message, then at 24 h and 72 h; new activity resets the sequence | `conversation-notification.job.ts:4-13`; `schedules.manifest.ts:273` | inquiries |

## 1.7 Emails and notices

| anchor | kind | what the owner sees | source | plannedArticle |
|---|---|---|---|---|
| email:listing-archived | email | "Archivamos tu ficha de alojamiento": nothing was deleted, here is the deletion date, recurring featured keeps being billed, and "podés pasarla a borrador sin pagar" (see gap 2) | `packages/notifications/src/templates/listing/listing-archived.tsx:43-60` | inactivity-archive |
| email:listing-retention-before-archive | email | "Tu ficha de alojamiento se va a archivar" | `…/listing/listing-retention-notice.tsx:34` | inactivity-archive |
| email:listing-retention-before-deletion | email | "El contenido de tu ficha se va a borrar" (texts, photos, FAQs, hours; cannot be recovered) | `…/listing/listing-retention-notice.tsx:51-60` | inactivity-archive |
| email:listing-moderated | email | "Tu ficha está moderada" | `…/verticals/listing-moderated.tsx:24` | fix-request |
| email:listing-moderation-lifted | email | "Se levantó la moderación de tu ficha" | `…/verticals/listing-moderation-lifted.tsx:29` | fix-request |
| email:listing-moderation-level-changed | email | "Cambió la moderación de tu ficha". UNVERIFIED: trigger | `…/verticals/listing-moderation-level-changed.tsx:45` | fix-request |
| email:listing-fix-requested | email | "Te pedimos un arreglo en tu ficha". The listing stays visible, and the owner presses "Ya lo corregí" in the notices | `…/verticals/listing-fix-requested.tsx:28`; `listing.json:596-603` | fix-request |
| email:listing-content-edited-by-support | email | Support edited the content | `…/verticals/listing-content-edited-by-support.tsx:22` | fix-request |
| email:listing-purged | email | "Se borró tu ficha" | `…/verticals/listing-purged.tsx:20` | delete-listing |
| email:listing-restitution | email | "Tus fichas volvieron a publicarse" | `…/verticals/listing-restitution.tsx:26` | plan-limits-accommodation |
| email:conversation_new_message | email | "Nuevo mensaje de {name} — Hospeda" (30 min, 24 h, 72 h) | `…/conversation/conversation-new-message.tsx:65`; `conversations.json:16` | inquiries |
| email:accommodation_calendar_feed_broken | email | A broken calendar feed risks double bookings; transactional, always sent | `packages/notifications/src/types/notification.types.ts:150-161` | calendar |
| email:ai_questions_weekly_digest | email | Weekly digest linking to "Preguntas a la IA" (can be turned off) | `notification.types.ts:285-294` | ai-questions |
| email:listing_location_exception_approved | email | Address exception approved | `notification.types.ts:296-302` | location-address |
| email:listing_location_exception_rejected | email | Exception rejected, with the reason | `notification.types.ts:303-308` | location-address |
| page:mi-cuenta/propiedades (ListingNotices) | page | Hub and list banners: ARCHIVED, MODERATED, FIX_REQUESTED ("Ya lo corregí"), MODERATION_LIFTED, surplus, restitution, BUSINESS_LINES_CHANGED | `apps/web/src/lib/listing/listing-notices.ts:195-298`; `listing.json:577-640` | fix-request |

Section 7 pointers:
- **Not an owner recipient:** `conversation-new-message-anon` (it goes to the guest).
- **UNVERIFIED recipient:** `listing-fix-reported` and `listing-notice-shared`.
- **No owner email for a new review.** `HOST_TRADE_REVIEW_RECEIVED` exists only for providers (`notification.types.ts:168`).

## 1.8 MCP tools (host)

| anchor | kind | what the owner sees | source | plannedArticle |
|---|---|---|---|---|
| tool:list_my_listings | tool | All listings, in any state | `apps/api/src/mcp/tools/listing/list-my-listings.ts:242` | assistant-manage-listings |
| tool:get_owner_summary | tool | Totals per state | `…/summary/get-owner-summary.ts:113` | assistant-manage-listings |
| tool:get_my_plan | tool | Plan per vertical and what it includes | `…/plan/get-my-plan.ts:35` | assistant-manage-listings |
| tool:get_listing | tool | One listing; public URL only when published | `…/listing/get-listing.ts:332` | assistant-manage-listings |
| tool:update_listing_basic | tool | Accommodation: summary, description, phone, website, amenityIds, featureIds. Sets are REPLACED | `…/listing/update-listing-basic.ts:327-330` | assistant-manage-listings |
| tool:get_listing_amenities | tool | Catalog by category, with selected flags | `…/listing/get-listing-amenities.ts:147` | assistant-manage-listings |
| tool:update_listing_amenities | tool | Adds or removes within ONE category | `…/listing/update-listing-amenities.ts:253` | assistant-manage-listings |
| tool:set_listing_publication | tool | pause (to draft) and resume (draft or UNPUBLISHED_BY_BILLING to published; ARCHIVED goes to draft on the first resume and is published on the second). Needs a plan or trial and a free slot | `…/listing/set-listing-publication.ts:373-377` | pause-resume |
| tool:list_amenities_and_features | tool | Ids, slugs and names | `…/listing/list-amenities-and-features.ts:79` | assistant-manage-listings |
| tool:get_listing_stats | tool | Views over 7/30/90 days (kept 120 days); reviews; favorites and inquiries. Refused without basic stats | `…/listing/get-listing-stats.ts:233-235` | host-dashboard |
| tool:get_listing_creation_guide | tool | Steps, fields and limits for creating a listing | `…/listing/get-listing-creation-guide.ts:214` | create-listing |
| tool:create_listing | tool | Creates a DRAFT in two steps; never publishes | `…/listing/create-listing.ts:279` | create-listing |
| tool:list_reviews | tool | Reviews with moderationState; no reply | `…/review/list-reviews.ts:312-314` | reviews |
| tool:get_help | tool | Answers from the help catalog | `…/help/get-help.ts:189` | assistant-manage-listings |
| tool:list_inquiries | tool | Inquiries, filter PENDING_OWNER | `…/inquiry/list-inquiries.ts:115-117` | inquiries |
| tool:get_inquiry | tool | Messages of one inquiry | `…/inquiry/get-inquiry.ts:121` | inquiries |
| tool:reply_inquiry | tool | Reply in two steps with the exact user text | `…/inquiry/reply-inquiry.ts:191-193` | inquiries |

## 1.9 Creation form (covered by `page:publicar`)

- **Fields:** name ≥ 3, short description ≥ 10, type, destination (`host.json:831-835`).
- **Flow:** step 1 of 2. It creates a DRAFT and takes you to the panel (`host.json:841-864`).
- **Existing draft:** "Tenés un borrador sin publicar / Continuar borrador / Empezar de cero" (`host.json:184-188`).
- **Import:** from a URL, with a legal checkbox (`host.json:2-7`).
- **Source:** `apps/web/src/components/host/CreatePropertyMiniForm.client.tsx`.

## 1.10 Publication rules (verified)

- **Six required fields:** description (not the placeholder), max guests, min nights, bedrooms, bathrooms, main image (`packages/schemas/src/entities/accommodation/accommodation.publish-requirements.ts:161-199`). The same list feeds the server, the hub (`index.astro:86-97`) and the button (`host.json:723-730,252`).
- **Plan:** publishing needs coverage (a plan or the trial) and a free slot. The refusal codes are `LIMIT_REACHED`, `TRIAL_LIMIT_REACHED` and `NEW_PAID_SIGNUPS_FROZEN` (`publish-listing.ts:15-24`).
- **Address:** one address per published listing, unless an exception is approved.
- **Despublicar:** goes to DRAFT, and the trial keeps running (`host.json:243-244`).
- **Eliminar:** a definitive purge. The preview first lists the add-ons that will be lost (`DeleteButton.client.tsx:10,110,149`).
- **Archivo:** only without coverage.
- **Moderación:** only an admin can apply or lift it. The owner can edit and delete, but not publish.

## 8. Proposed articles (part A)

| id | title | summary | public | covers | entryFor | related | crossPartLinks |
|---|---|---|---|---|---|---|---|
| create-listing (reuse) | Crear mi alojamiento en Hospeda | Cómo dar de alta un alojamiento en dos pasos y qué pasa con el borrador. | true | page:publicar/nueva; page:mi-cuenta/comercio/nuevo; tool:get_listing_creation_guide; tool:create_listing; activation:accommodation | page:publicar | publish-requirements, import-from-url, editor-overview, plan-limits-accommodation | trial, subscription |
| import-from-url | Importar mi alojamiento desde un link | Cargá los datos desde la URL de otra plataforma y revisá lo que se importó. | true | entitlement:ai_accommodation_import; limit:max_ai_accommodation_import_per_month | — | create-listing, basic-info, capacity-price, location-address | change-plan |
| publish-requirements (reuse) | Qué hace falta para publicar y por qué no me deja | Los seis datos obligatorios, el plan activo y la dirección única. | true | entitlement:publish_accommodations; entitlement:activate_trial | — | create-listing, capacity-price, photos, location-address, plan-limits-accommodation | trial, subscription |
| pause-resume (reuse) | Pausar y volver a publicar mi alojamiento | Despublicá sin perder nada y volvé a publicar cuando quieras. | false | enum:PublicationStatus.PUBLISHED; tool:set_listing_publication | — | listing-states, delete-listing, publish-requirements, inactivity-archive | trial, addons |
| delete-listing (reuse) | Eliminar mi alojamiento | Qué se borra, qué complementos se pierden y por qué no hay vuelta atrás. | false | enum:PublicationStatus.PURGED; cron:listing-remote-deletion-retry; email:listing-purged | — | pause-resume, listing-states, inactivity-archive | addons |
| listing-states | Estados de mi publicación | Qué significan borrador, publicada, sin publicar por tu plan, archivada, moderada y eliminada. | true | enum:PublicationStatus.DRAFT; enum:PublicationStatus.UNPUBLISHED_BY_BILLING; page:alojamientos/[slug]; entitlement:download_listing_pdf; entitlement:recover_own_listing | page:mi-cuenta/propiedades | pause-resume, inactivity-archive, fix-request, plan-limits-accommodation, delete-listing | subscription |
| inactivity-archive | Por qué archivaron mi alojamiento y cuándo se borra | Los plazos de archivo y borrado, los avisos y cómo evitarlos. | false | enum:PublicationStatus.ARCHIVED; cron:listing-inactivity-archive; cron:listing-retention-pass; email:listing-archived; email:listing-retention-before-archive; email:listing-retention-before-deletion | — | listing-states, pause-resume, delete-listing, plan-limits-accommodation | subscription, trial |
| fix-request (reuse) | Mi alojamiento fue moderado o me pidieron un arreglo | Qué hacer ante una moderación, un pedido de arreglo o una edición de soporte. | false | enum:PublicationStatus.MODERATED; ListingNotices; email:listing-moderated; email:listing-moderation-lifted; email:listing-moderation-level-changed; email:listing-fix-requested; email:listing-content-edited-by-support | — | listing-states, editor-overview, publish-requirements | — |
| editor-overview | Cómo funciona el editor de mi alojamiento | Las secciones, qué se guarda y cuándo, y qué marca cada estado. | true | entitlement:edit_accommodation_info | page:mi-cuenta/propiedades/[id]/editar | basic-info, photos, publish-requirements, faqs | change-plan |
| basic-info | Nombre, descripción y tipo de mi alojamiento | Información básica, la descripción enriquecida y el asistente de texto. | false | section:accommodation.datos; entitlement:can_use_rich_description; entitlement:ai_text_improve; entitlement:has_verification_badge; limit:max_ai_text_improve_per_month | section:accommodation.datos | seo-google, translations, capacity-price, editor-overview | change-plan, ai-assistants |
| capacity-price | Capacidad, precio y estadía mínima | Huéspedes, habitaciones, baños, precio en pesos enteros y noches mínimas y máximas. | false | section:accommodation.capacidad-precio | section:accommodation.capacidad-precio | publish-requirements, house-rules, calendar, what-hospeda-doesnt-do | — |
| location-address | Ubicación y la regla de una dirección por publicación | Fijá la dirección en el mapa y pedí una excepción si ya está en uso. | false | section:accommodation.ubicacion; email:listing_location_exception_* | section:accommodation.ubicacion | publish-requirements, editor-overview, create-listing | — |
| amenities (reuse) | Servicios y comodidades | Elegí comodidades y características, con sus detalles. | false | section:accommodation.servicios; tool:get_listing_amenities; tool:update_listing_amenities; tool:list_amenities_and_features | section:accommodation.servicios | house-rules, editor-overview, assistant-manage-listings | ai-assistants |
| house-rules | Políticas de la casa | Check-in y check-out, mascotas, fumar, eventos, seña e idiomas, y qué no hay (cancelación). | true | section:accommodation.politicas | section:accommodation.politicas | what-hospeda-doesnt-do, capacity-price, faqs | — |
| photos (reuse) | Subir y ordenar fotos y videos | Formatos, tamaño, orden, foto principal y el tope de tu plan. | false | section:accommodation.fotos; limit:max_photos_per_accommodation; entitlement:can_embed_video | section:accommodation.fotos | publish-requirements, plan-limits-accommodation, editor-overview | change-plan |
| faqs | Preguntas frecuentes de mi ficha | Agregá, ordená y decidí qué se ve y qué usa la IA. | false | section:accommodation.preguntas; entitlement:ai_faq_draft; limit:max_ai_faq_draft_per_month | section:accommodation.preguntas | ai-questions, house-rules, editor-overview | ai-assistants |
| ai-questions | Qué le preguntan los visitantes a la IA de mi ficha | Leé las preguntas, sumalas como frecuentes y recibí el resumen semanal. | false | section:accommodation.preguntas-ia; entitlement:ai_chat; limit:max_ai_chat_per_month; cron:ai-listing-questions-retention; cron:ai-questions-weekly-digest; email:ai_questions_weekly_digest | section:accommodation.preguntas-ia | faqs, editor-overview | ai-assistants |
| contact-social | Contacto y redes de mi alojamiento | Qué datos se muestran, el formato del teléfono y WhatsApp. | false | section:accommodation.contacto; entitlement:can_contact_whatsapp_display; entitlement:can_contact_whatsapp_direct | section:accommodation.contacto | inquiries, what-hospeda-doesnt-do | — |
| seo-google | Cómo aparece mi alojamiento en Google | Título y descripción para buscadores, los largos permitidos y que hoy solo aplican en español. | true | section:accommodation.seo | section:accommodation.seo | basic-info, translations | — |
| calendar (reuse) | Calendario de ocupación y sincronización | Bloqueá fechas, conectá Google, Airbnb o Booking, y qué aviso llega si la sincronización falla. | false | section:accommodation.calendario; entitlement:can_use_calendar; entitlement:can_sync_external_calendar; cron:calendar-sync-*; email:accommodation_calendar_feed_broken | section:accommodation.calendario | what-hospeda-doesnt-do, capacity-price, plan-limits-accommodation | change-plan |
| translations | Traducciones de mi alojamiento | Generá traducciones al inglés y al portugués con IA, y cómo cuenta el cupo. | false | section:accommodation.traducciones; entitlement:ai_translate; limit:max_ai_translate_per_month | section:accommodation.traducciones | basic-info, seo-google | ai-assistants |
| external-reputation | Reputación externa (Google, Booking, Airbnb) | Mostrá el puntaje y los enlaces de otras plataformas, y cada cuánto se actualizan. | false | section:accommodation.reputacion; cron:refresh-external-reputation | section:accommodation.reputacion | reviews, editor-overview | — |
| reviews (reuse) | Reseñas de mi alojamiento | Qué reseñas se muestran, y que todavía no se pueden responder. | true | entitlement:respond_reviews; entitlement:read_reviews; tool:list_reviews | — | external-reputation, inquiries, host-dashboard | — |
| inquiries (reuse) | Consultas de huéspedes: responder y avisos | Dónde llegan las consultas, cuándo te avisa el mail y cómo se responden. | true | tool:list_inquiries; tool:get_inquiry; tool:reply_inquiry; cron:conversation-notification; email:conversation_new_message | page:mi-cuenta/consultas-propietario; page:mi-cuenta/consultas-propietario/[conversationId] | contact-social, what-hospeda-doesnt-do, host-dashboard | account-notifications |
| host-dashboard | Panel del anfitrión y estadísticas | Qué muestra cada bloque, las visitas, la comparación con el mercado y por qué algo aparece bloqueado. | false | entitlement:view_basic_stats; entitlement:view_advanced_stats; tool:get_listing_stats; tool:get_owner_summary | page:mi-cuenta/host-dashboard | inquiries, reviews, plan-limits-accommodation | subscription, change-plan |
| plan-limits-accommodation | Cuántos alojamientos puedo publicar y qué incluye mi plan | El tope de publicadas, qué pasa si lo pasás y cómo mejorar el plan. | true | limit:max_accommodations; entitlement:featured_listing; cron:listing-coverage-reconciler; email:listing-restitution | page:mi-cuenta/propiedades (shared with listing-states: pick one) | listing-states, publish-requirements, photos, inactivity-archive | change-plan, subscription, addons |
| what-hospeda-doesnt-do | Qué no hace Hospeda (reservas, pagos, cancelaciones) | Hospeda muestra tu alojamiento y te conecta con huéspedes; no gestiona reservas ni cobros. | true | entitlement:centralized_booking | — | inquiries, calendar, house-rules, capacity-price, reviews | — |
| assistant-manage-listings | Manejar mis publicaciones desde un asistente de IA | Qué le podés pedir a un asistente y qué no. | true | tool:list_my_listings; tool:get_owner_summary; tool:get_my_plan; tool:get_listing; tool:update_listing_basic; tool:get_listing_amenities; tool:update_listing_amenities; tool:list_amenities_and_features; tool:get_help | — | pause-resume, create-listing, amenities, inquiries | ai-assistants |
| listing-emails | Qué emails te mandamos sobre tu alojamiento | Índice de los avisos de estado, calendario, consultas y el resumen semanal. | false | — | — | inactivity-archive, fix-request, inquiries, calendar | account-notifications |

## 9. Gaps and bugs

1. **The dashboard's messages links go to the wrong inbox.** "Mensajes / Ver todos" and the "Mensajes" quick action point to `mi-cuenta/consultas` (`HostDashboard.client.tsx:87,323`), which is the guest's inbox. The host's inbox is `consultas-propietario` (`navigation.ts:219`).
2. **An archived listing cannot be returned to draft from the web.** The email and the notice both promise it (`listing-archived.tsx:50`, `listing.json:584`), and the API route exists (`apps/api/src/routes/accommodation/protected/reactivate.ts`), but nothing in `apps/web/src` calls it. Only the MCP `resume` can do it.
3. **The delete confirmation understates what happens.** It says "Se quitará de tu listado y del sitio", but the action is a definitive purge.
4. **The featured-listing toggle exists only in a comment.** `accommodation-editor-sections.ts:59-62` describes it; the hub does not render it.
5. **The translations tab is documented as conditional but is always shown** (`traducciones.astro:6-10`; `transforms.ts:2283-2298`).
6. **SEO applies only to Spanish.** The section description does not say so (`host.json:288`).
7. **Accommodations have no cancellation policy.** The FAQ copy suggests putting the cancellation terms in a FAQ (`host.json:468`).
8. **Owners cannot reply to reviews or read them on the web.** `respond_reviews` is marked upcoming, and no web page lists the reviews of one's own listings; only the MCP can read them. There is also no owner email for a new review. The repo never mentions HOS-2199.
9. **A stale comment in `presentacion/alojamientos/index.astro:15-29`.** It speaks of `lifecycleState` and of no restitution, while the code today does restore listings. UNVERIFIED.
10. **The calendar text overstates its effect.** "No aparecerán disponibles en las búsquedas" holds only when the search sets both dates (`accommodation-search-filters.ts:366-369`).
11. **Phone and WhatsApp accept only the Argentine format.** Hosts with foreign numbers are blocked.
12. **Inactivity archive never applies while the owner has coverage.** The 90 / 180 / 3-month / 15-day values come from the initial migration and live in the DB, so they may have changed (UNVERIFIED).
13. **Keys with no gate found:** `custom_branding`, `multi_property_management`, `consolidated_analytics`, `centralized_booking`, `staff_management`, `max_properties`, `max_staff_accounts`, `priority_support`. If a plans page promises any of them, that promise has nothing behind it in code.
14. **Unverified recipients:** `listing-fix-reported` and `listing-notice-shared`.
15. **The photo limit before the first publish comes from the DB** (`pre-trial-draft-limit.ts`). UNVERIFIED.
