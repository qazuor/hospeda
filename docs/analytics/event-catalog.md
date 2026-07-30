# Event Catalog

## Convenciones

- Fuente de verdad: `packages/analytics/src/catalog.ts`
- Formato: `snake_case`
- IDs: siempre estables, nunca emails ni nombres

| Event | Description | Application | Trigger location | Source | Required properties | Optional properties | Contains PII | Dashboard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `destination_viewed` | Destination detail viewed | web | `DestinationViewTracker.client.tsx` | frontend | `destination_id`, `destination_slug` | `locale`, `source_page` | no | Descubrimiento, Adquisición |
| `accommodation_viewed` | Accommodation detail viewed | web | `AccommodationViewTracker.client.tsx` | frontend | `accommodation_id`, `accommodation_slug` | `accommodation_type`, `destination_id`, `is_featured`, `locale`, `source_page` | no | Resumen, Descubrimiento |
| `event_viewed` | Event detail viewed | web | `EntityViewTracker.client.tsx` | frontend | `event_id`, `event_slug` | `locale`, `source_page` | no | Descubrimiento |
| `post_viewed` | Post detail viewed | web | `EntityViewTracker.client.tsx` | frontend | `post_id`, `post_slug` | `locale`, `source_page` | no | Descubrimiento, Adquisición |
| `search_performed` | Search submitted from the public UI | web | `SearchBar.client.tsx` | frontend | `search_type` | `destination_id`, `destination_slug`, `adult_count`, `child_count`, `filter_count`, `locale`, `source_page` | no | Descubrimiento |
| `contact_owner_started` | User started a contact flow with an accommodation owner | web | `ContactHost.client.tsx` | frontend | `accommodation_id`, `contact_method`, `is_authenticated` | `destination_id`, `owner_id`, `locale`, `source_page` | no | Resumen, Descubrimiento |
| `contact_owner_completed` | Contact flow completed and conversation/request was created | web, api | `ContactHost.client.tsx`, `conversations/*/initiate.ts` | frontend + backend | `accommodation_id`, `contact_method`, `conversation_flow`, `is_authenticated` | `destination_id`, `owner_id`, `locale` | no | Resumen, Descubrimiento, Adquisición |
| `contact_owner_failed` | Contact flow failed for a business-relevant reason | web, api | `ContactHost.client.tsx`, `conversations/*/initiate.ts` | frontend + backend | `failure_reason` | `accommodation_id`, `destination_id`, `owner_id`, `contact_method`, `is_authenticated`, `locale` | no | Calidad |
| `sign_up_started` | Signup flow started | web | `SignUp.client.tsx` | frontend | `auth_method` | `locale`, `source_page` | no | Resumen, Adquisición, Owners |
| `sign_up_completed` | Account created successfully | api | `auth-signup-analytics.ts` | backend | `auth_method` | `role`, `user_type` | no | Resumen, Adquisición, Owners |
| `sign_in_completed` | Session created successfully | api | `auth.ts` session hook | backend | none | `role`, `user_type` | no | Calidad, Owners |
| `onboarding_started` | Host onboarding flow started | api | `host-onboarding/protected/start.ts` | backend | `onboarding_type` | `draft_source` | no | Owners |
| `accommodation_draft_saved` | Draft accommodation created/saved in onboarding | api | `host-onboarding/protected/start.ts` | backend | `accommodation_id` | `creation_source`, `accommodation_type`, `destination_id`, `import_source` | no | Owners |
| `accommodation_import_started` | Import-from-URL flow started | web, api | `CreatePropertyMiniForm.client.tsx`, `import-from-url.ts` | frontend + backend | none | `import_mode`, `import_source` | no | Owners |
| `accommodation_import_completed` | Import completed with usable extracted data | web, api | `CreatePropertyMiniForm.client.tsx`, `import-from-url.ts` | frontend + backend | none | `accommodation_id`, `import_source`, `partial`, `prefilled_field_count` | no | Owners, Calidad |
| `accommodation_import_failed` | Import failed or yielded no source/data | web, api | `CreatePropertyMiniForm.client.tsx`, `import-from-url.ts` | frontend + backend | none | `import_source`, `failure_reason` | no | Owners, Calidad |
| `accommodation_published` | Accommodation successfully published | api | `accommodation/protected/publish.ts` | backend | `accommodation_id` | `accommodation_type`, `destination_id`, `owner_id`, `is_first_publication` | no | Resumen, Owners |
| `subscription_checkout_started` | Paid subscription checkout started | api | `billing/start-paid.ts` | backend | `plan_slug`, `billing_period` | `amount`, `currency`, `promotion_code` | no | Resumen, Suscripciones |
| `subscription_created` | Checkout created a local subscription outcome | api | `billing/start-paid.ts` | backend | `plan_slug`, `billing_period` | `subscription_id`, `checkout_outcome`, `trial_granted`, `promotion_code`, `promotion_code_ignored`, `amount`, `currency` | no | Resumen, Suscripciones |
| `subscription_payment_succeeded` | Confirmed recurring or checkout payment succeeded | api | `payment-logic.ts` | backend | `payment_provider` | `amount`, `currency`, `payment_method`, `payment_kind`, `source` | no | Resumen, Suscripciones |
| `subscription_payment_failed` | Confirmed payment failed | api | `payment-logic.ts` | backend | `payment_provider` | `amount`, `currency`, `failure_reason`, `failure_category`, `source` | no | Calidad, Suscripciones |
| `trial_converted_to_paid` | Trial converted into a paid subscription | api | `reactivation-supersession-complete.ts` | backend | none | `plan_slug`, `intended_billing_period`, `converted_billing_period`, `amount`, `currency`, `superseded_subscription_id`, `new_subscription_id`, `trigger_source`, `source` | no | Suscripciones |
| `newsletter_subscribed` | Newsletter subscription succeeded | web | `NewsletterForm.client.tsx` | frontend | none | `source_page`, `locale`, `is_authenticated` | no | Adquisición |
| `favorite_added` | Entity added to favorites | web | `FavoriteButton.client.tsx` | frontend | `entity_type`, `entity_id` | `assigned_collection` | no | Descubrimiento |
| `favorite_removed` | Entity removed from favorites | web | `FavoriteButton.client.tsx` | frontend | `entity_type`, `entity_id` | `assigned_collection` | no | Descubrimiento |
| `review_submitted` | Review submitted successfully | web | `ReviewSidebarCard.client.tsx` | frontend | `accommodation_id` | `average_rating`, `has_title`, `has_content` | no | Descubrimiento |
| `contribution_banner_clicked` | Contribution CTA clicked | web | `ContributionBanner.astro` | frontend | `source_page`, `contribution_variant` | none | no | Adquisición |
| `contribution_report_submitted` | Destination report contribution submitted | web | `ContributionForm.client.tsx` | frontend | none | `destination_slug`, `locale` | no | Adquisición |
| `contribution_photo_submitted` | Photo contribution submitted | web | `ContributionForm.client.tsx` | frontend | none | `locale` | no | Adquisición |
| `contribution_editor_submitted` | Editor contribution submitted | web | `ContributionForm.client.tsx` | frontend | none | `locale` | no | Adquisición |
| `admin_tour_shown` | Admin product tour shown | admin | `tour-context.tsx` | frontend | `tour_id` | `role`, `source` | no | Calidad |
| `admin_tour_completed` | Admin product tour completed | admin | `tour-context.tsx` | frontend | `tour_id` | `role` | no | Calidad |
| `admin_tour_skipped` | Admin product tour skipped | admin | `tour-context.tsx` | frontend | `tour_id` | `role`, `source` | no | Calidad |
| `admin_whats_new_panel_opened` | Admin what's new panel opened | admin | `WhatsNewPanel.tsx` | frontend | none | `unseen_count`, `role` | no | Calidad |
| `admin_whats_new_modal_shown` | Admin what's new modal shown | admin | `WhatsNewModal.tsx` | frontend | `entry_count` | `role` | no | Calidad |
| `admin_whats_new_modal_closed` | Admin what's new modal closed | admin | `WhatsNewModal.tsx` | frontend | `entry_count` | none | no | Calidad |

## Notas

- `apps/web` usa aliases de compatibilidad en `src/lib/analytics/events.ts` para evitar romper todos los call sites de una sola vez.
- Los eventos de AI siguen existiendo en el catálogo compartido, pero no forman parte del dashboard ejecutivo principal de negocio.
