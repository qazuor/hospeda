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
| `billing_checkout_started` | Subscription row committed as pending authorization | api | `billing-subscription/index.ts (startSubscription)` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `plan_version_id`, `billing_option_id`, `cycle`, `amount_minor`, `currency` | `is_succession` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_checkout_abandoned` | Pending authorization row becomes abandoned | api | `expire-authorization-windows.service.ts, cancel-pending-attempt.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `reason` | `seconds_in_pending` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_subscription_activated` | Subscription activation committed | api | `after-activation-commit.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `plan_version_id`, `billing_option_id`, `cycle`, `amount_minor`, `currency` | `trial_active_at_activation` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_plan_changed` | Activation replaces a predecessor subscription | api | `after-activation-commit.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `from_plan_version_id`, `to_plan_version_id`, `from_cycle`, `to_cycle`, `direction` | `from_amount_minor`, `to_amount_minor` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_charge_succeeded` | Payment credited after commit | api | `credit-payment.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `payment_id`, `amount_minor`, `currency`, `is_first_charge`, `cycle` | `plan_version_id`, `promo_applied` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_charge_declined` | Rejected charge recorded | api | `record-charge-fact.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `payment_id`, `amount_minor`, `currency`, `is_first_charge`, `next_state` | `has_retry_window` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_grace_entered` | Grace period transition committed | api | `enter-grace.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `grace_ends_at` | `days_of_grace` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_subscription_suspended` | Subscription suspended for arrears | api | `suspend-for-arrears.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `trigger` | `days_in_grace` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_subscription_recovered` | Subscription recovered after payment | api | `exit-grace.service.ts, reactivate-suspended.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `recovered_from`, `payment_id` | `days_in_state` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_cancel_scheduled` | Cancellation scheduled | api | `cancel-active-subscription.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `service_ends_at`, `basis` | `reason` | no | Suscripciones (a rehacer, HOS-1878) |
| `billing_subscription_cancelled` | Subscription cancellation committed | api | `end-scheduled-services.service.ts, cancel-direct-subscription.service.ts, revoke-subscription.service.ts` | backend | `vertical`, `subscription_class`, `subscription_id`, `actor_kind`, `cancelled_by`, `path`, `was_scheduled` | `lifetime_days`, `reason` | no | Suscripciones (a rehacer, HOS-1878) |
| `trial_started` | Trial starts when a listing is published | api | `listing-publication.service.ts` | backend | `vertical`, `actor_kind`, `activation_event` | `trial_days` | no | Suscripciones (a rehacer, HOS-1878) |
| `trial_converted` | Trial converts through T2, T5 or T8 | api | `trial-coverage-listener.ts` | backend | `vertical`, `actor_kind`, `transition`, `trial_state_before` | `days_into_trial`, `days_since_expiry` | no | Suscripciones (a rehacer, HOS-1878) |
| `trial_expired` | Trial expires in the expiry job | api | `trial-machine-expiry.job.ts` | backend | `vertical`, `actor_kind`, `trial_days` | `had_paid_intent` | no | Suscripciones (a rehacer, HOS-1878) |
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
