<!-- ============================================================================
  endpoint-gate-matrix.md
  MACHINE-PARSEABLE FILE — read by the route-snapshot guard test (T-145-19).

  Format rules for the snapshot guard:
  - The main table lives between the "## Route Gate Matrix" and the next "##" heading.
  - Every non-header, non-separator row is a route entry.
  - Columns (pipe-delimited, 0-indexed):
      0  Route (METHOD path)
      1  Handler file  (relative to apps/api/src/routes/)
      2  Decision      ∈ {gate, limit, gate+limit, none, reserved}
      3  Key(s)        — EntitlementKey / LimitKey value(s), or "-"
      4  Status        ∈ {wired, to-wire, reserved, n/a}
      5  Reason        — one-line justification

  Adding a new protected or admin route:
  1. Add a row here with the correct Decision / Status.
  2. If Decision = "none", write a clear Reason; the snapshot test requires it.
  3. If Decision = "gate" / "limit" / "gate+limit", set Status = "to-wire" and
     complete the wiring in the appropriate task (T-145-03 / T-145-05).
  4. Phantom / reserved entries go in the auxiliary sections, NOT this table.

  Spec reference: SPEC-145 §4 T-145-01
  See also: docs/billing/adding-an-entitlement.md (T-145-20)
============================================================================ -->

# Endpoint Gate Matrix

> **Single source of truth** for billing-gate decisions on every protected and
> admin route. Drives gate-wiring tasks T-145-03 through T-145-07 and is parsed
> by the route-snapshot CI guard (T-145-19).
>
> Authored: SPEC-145 T-145-01 (2026-06-05)

## Route Gate Matrix

| Route (METHOD path) | Handler file | Decision | Key(s) | Status | Reason |
|---|---|---|---|---|---|
| **ACCOMMODATION — PROTECTED** | | | | | |
| `POST /api/v1/protected/accommodations` | `accommodation/protected/create.ts` | gate+limit | `publish_accommodations`, `max_accommodations` | wired | requireEntitlement(PUBLISH_ACCOMMODATIONS) before enforceAccommodationLimit() (SPEC-145 T-004) |
| `POST /api/v1/protected/accommodations/draft` | `accommodation/protected/createDraft.ts` | gate+limit | `publish_accommodations`, `max_accommodations` | wired | requireEntitlement(PUBLISH_ACCOMMODATIONS) before enforceAccommodationLimit() (SPEC-145 T-004) |
| `POST /api/v1/protected/host-onboarding/start` | `host-onboarding/protected/start.ts` | limit | `max_accommodations` | wired | Funnel exception: tourist-free users may enter onboarding without `publish_accommodations`; first-publish starts the owner trial. `enforceAccommodationLimit()` still prevents over-cap hosts from creating extra drafts. |
| `GET /api/v1/protected/accommodations` | `accommodation/protected/list.ts` | none | - | n/a | Read own data only; auth-only sufficient |
| `GET /api/v1/protected/accommodations/{id}` | `accommodation/protected/getById.ts` | none | - | n/a | Read own data only; auth + ownership check in handler |
| `PUT /api/v1/protected/accommodations/{id}` | `accommodation/protected/update.ts` | gate | `edit_accommodation_info` | wired | requireEntitlement(EDIT_ACCOMMODATION_INFO) middleware wired (SPEC-145 T-004) |
| `PATCH /api/v1/protected/accommodations/{id}` | `accommodation/protected/patch.ts` | gate+limit | `edit_accommodation_info`, `can_use_rich_description`, `can_embed_video` | wired | requireEntitlement(EDIT_ACCOMMODATION_INFO) + gateRichDescription + gateVideoEmbed (SPEC-145 T-004) |
| `DELETE /api/v1/protected/accommodations/{id}` | `accommodation/protected/softDelete.ts` | none | - | n/a | Deletion is ungated; soft-delete own resource |
| `POST /api/v1/protected/accommodations/{id}/unpublish` | `accommodation/protected/unpublish.ts` | none | - | n/a | Unpublish (ACTIVE → INACTIVE) is a basic lifecycle action ungated across all plan tiers; ownership enforced via route factory (SPEC-208 PR2) |
| `GET /api/v1/protected/accommodations/{id}/contact` | `accommodation/protected/contact.ts` | none | - | n/a | Read-only resolved contact info; auth-only sufficient |
| `GET /api/v1/protected/accommodations/{id}/faqs` | `accommodation/protected/getFaqs.ts` | none | - | n/a | Read own data; auth-only sufficient |
| `POST /api/v1/protected/accommodations/{id}/faqs` | `accommodation/protected/addFaq.ts` | gate | `edit_accommodation_info` | wired | requireEntitlement(EDIT_ACCOMMODATION_INFO) middleware wired (SPEC-145 T-004) |
| `PUT /api/v1/protected/accommodations/{id}/faqs/{faqId}` | `accommodation/protected/updateFaq.ts` | gate | `edit_accommodation_info` | wired | requireEntitlement(EDIT_ACCOMMODATION_INFO) middleware wired (SPEC-145 T-004) |
| `DELETE /api/v1/protected/accommodations/{id}/faqs/{faqId}` | `accommodation/protected/removeFaq.ts` | none | - | n/a | Deletion ungated; removing own content is always allowed |
| `GET /api/v1/protected/accommodations/my/favorites-breakdown` | `accommodation/protected/hostFavoritesBreakdown.ts` | gate | `view_advanced_stats` | wired | requireEntitlement(VIEW_ADVANCED_STATS) middleware wired (SPEC-145 T-006) |
| `GET /api/v1/protected/accommodations/my/market-comparison` | `accommodation/protected/hostMarketComparison.ts` | gate | `view_advanced_stats` | wired | requireEntitlement(VIEW_ADVANCED_STATS) middleware wired (SPEC-145 T-006) |
| **ACCOMMODATION REVIEWS — PROTECTED** | | | | | |
| `POST /api/v1/protected/accommodations/{id}/reviews` | `accommodation/reviews/protected/create.ts` | gate | `write_reviews` | wired | requireEntitlement(WRITE_REVIEWS) middleware wired (SPEC-145 T-005). **Owner decision 2026-06-05:** ALL host-tier plans (owner-basico, owner-pro, owner-complex) intentionally lack WRITE_REVIEWS — hosts must not review competitors (conflict-of-interest policy). Hosts keep RESPOND_REVIEWS only. |
| **DESTINATION REVIEWS — PROTECTED** | | | | | |
| `POST /api/v1/protected/destinations/{id}/reviews` | `destination/reviews/protected/create.ts` | gate | `write_reviews` | wired | requireEntitlement(WRITE_REVIEWS) middleware wired (SPEC-145 T-005). **Owner decision 2026-06-05:** ALL host-tier plans intentionally lack WRITE_REVIEWS (same conflict-of-interest policy as accommodation reviews). |
| **USER BOOKMARKS — PROTECTED** | | | | | |
| `POST /api/v1/protected/user-bookmarks` | `user-bookmark/protected/create.ts` | gate+limit | `save_favorites`, `max_favorites` | wired | gateFavorites() + assertFavoritesLimitOrThrow() wired (toggle handler; limit checked only on toggle-ON per BETA-42) — T-145-05 audit: confirmed |
| `DELETE /api/v1/protected/user-bookmarks/{id}` | `user-bookmark/protected/delete.ts` | none | - | n/a | Removal ungated per BETA-42: users at cap must still be able to free up slots — T-145-05 |
| `GET /api/v1/protected/user-bookmarks` | `user-bookmark/protected/list.ts` | none | - | n/a | Read own data; auth-only sufficient — T-145-05 |
| `GET /api/v1/protected/user-bookmarks/check` | `user-bookmark/protected/check.ts` | none | - | n/a | Read own data; auth-only sufficient — T-145-05 |
| `POST /api/v1/protected/user-bookmarks/check-bulk` | `user-bookmark/protected/check-bulk.ts` | none | - | n/a | Read own data (bulk hydration); auth-only sufficient — T-145-05 |
| `GET /api/v1/protected/user-bookmarks/count` | `user-bookmark/protected/count.ts` | none | - | n/a | Read own data; auth-only sufficient — T-145-05 |
| `PATCH /api/v1/protected/user-bookmarks/{id}` | `user-bookmark/protected/update.ts` | none | - | n/a | Metadata-only update (name/notes) on own bookmark; cap-freeing op; ungated per BETA-42 — T-145-05 |
| **BOOKMARK COLLECTIONS — PROTECTED** | | | | | |
| `POST /api/v1/protected/user-bookmark-collections` | `user-bookmark-collection/protected/create.ts` | none | - | n/a | Collection management ungated per ADR-026; quota enforced inside service (QUOTA_EXCEEDED, not LimitKey) — T-145-05 |
| `DELETE /api/v1/protected/user-bookmark-collections/{id}` | `user-bookmark-collection/protected/delete.ts` | none | - | n/a | Removal ungated per BETA-42 + ADR-026 — T-145-05 |
| `GET /api/v1/protected/user-bookmark-collections` | `user-bookmark-collection/protected/list.ts` | none | - | n/a | Read own data; auth-only sufficient — T-145-05 |
| `GET /api/v1/protected/user-bookmark-collections/{id}` | `user-bookmark-collection/protected/getById.ts` | none | - | n/a | Read own data; auth-only sufficient — T-145-05 |
| `PATCH /api/v1/protected/user-bookmark-collections/{id}` | `user-bookmark-collection/protected/update.ts` | none | - | n/a | Metadata update on own collection; cap-freeing op; ungated — T-145-05 |
| `POST /api/v1/protected/user-bookmark-collections/{id}/bookmarks/{bookmarkId}` | `user-bookmark-collection/protected/addBookmark.ts` | none | - | n/a | Collection management ungated per ADR-026 — T-145-05 |
| `DELETE /api/v1/protected/user-bookmark-collections/{id}/bookmarks/{bookmarkId}` | `user-bookmark-collection/protected/removeBookmark.ts` | none | - | n/a | Removal ungated per BETA-42 + ADR-026 — T-145-05 |
| **OWNER PROMOTIONS — PROTECTED** | | | | | |
| `GET /api/v1/protected/owner-promotions` | `owner-promotion/protected/list.ts` | none | - | n/a | Read own promotions (all lifecycle states); auth-only sufficient — SPEC-205 |
| `GET /api/v1/protected/owner-promotions/{id}` | `owner-promotion/protected/get.ts` | none | - | n/a | Read own promotion by id; auth-only sufficient — SPEC-205 |
| `POST /api/v1/protected/owner-promotions` | `owner-promotion/protected/create.ts` | gate+limit | `create_promotions`, `max_active_promotions` | wired | requireEntitlement(CREATE_PROMOTIONS) before enforcePromotionLimit() (SPEC-145 T-005) |
| `PATCH /api/v1/protected/owner-promotions/{id}` | `owner-promotion/protected/patch.ts` | gate | `create_promotions` | wired | requireEntitlement(CREATE_PROMOTIONS) middleware wired (SPEC-145 T-005) |
| `PUT /api/v1/protected/owner-promotions/{id}` | `owner-promotion/protected/update.ts` | gate | `create_promotions` | wired | requireEntitlement(CREATE_PROMOTIONS) middleware wired (SPEC-145 T-005) |
| `DELETE /api/v1/protected/owner-promotions/{id}` | `owner-promotion/protected/softDelete.ts` | none | - | n/a | Deletion ungated; removing own promotion always allowed |
| **MEDIA — PROTECTED** | | | | | |
| `POST /api/v1/protected/media/upload` | `media/protected/upload.ts` | limit | `max_photos_per_accommodation` | wired | Inline photo-limit check already in handler (SPEC-143 Finding #15) |
| `POST /api/v1/protected/media/upload-entity` | `media/protected/upload-entity.ts` | limit | `max_photos_per_accommodation` | wired | Ownership-checked entity image upload; same limit as avatar upload (SPEC-208 Phase B) |
| `DELETE /api/v1/protected/media/delete-entity` | `media/protected/delete-entity.ts` | none | - | n/a | Auth + ownership check in handler (entity.ownerId === actor.id); deletion itself is ungated — no entitlement required to clean up your own media (SPEC-208 Fix A) |
| **CONVERSATIONS — PROTECTED** | | | | | |
| `POST /api/v1/protected/conversations/initiate` | `conversations/protected/initiate.ts` | none | - | n/a | Core messaging feature; no plan restriction on sending a message |
| `GET /api/v1/protected/conversations` | `conversations/protected/list.ts` | none | - | n/a | Read own inbox; auth-only sufficient |
| `GET /api/v1/protected/conversations/{id}` | `conversations/protected/thread.ts` | none | - | n/a | Read own thread; auth + ownership check in handler |
| `POST /api/v1/protected/conversations/{id}/messages` | `conversations/protected/reply.ts` | none | - | n/a | Core messaging; no plan restriction on replying |
| `PATCH /api/v1/protected/conversations/{id}/archive` | `conversations/protected/archive.ts` | none | - | n/a | Archive toggle on own conversation; no plan restriction |
| `GET /api/v1/protected/conversations/unread-count` | `conversations/protected/unread-count.ts` | none | - | n/a | Read own inbox badge; auth-only sufficient |
| `GET /api/v1/protected/conversations/me/response-rate` | `conversations/protected/response-rate.ts` | gate | `view_basic_stats` | wired | requireEntitlement(VIEW_BASIC_STATS) middleware wired (SPEC-145 T-006) |
| `GET /api/v1/protected/conversations/me/monthly-inquiries` | `conversations/protected/monthly-inquiries.ts` | gate | `view_basic_stats` | wired | requireEntitlement(VIEW_BASIC_STATS) middleware wired (SPEC-145 T-006) |
| **CONVERSATIONS OWNER — PROTECTED (SPEC-206)** | | | | | |
| `GET /api/v1/protected/conversations/owner` | `conversations/protected/owner/list.ts` | none | - | n/a | Owner inbox; auth + ownership scoping via accommodation IDs |
| `GET /api/v1/protected/conversations/owner/{id}` | `conversations/protected/owner/thread.ts` | none | - | n/a | Owner thread read; auth + ownership check in handler |
| `POST /api/v1/protected/conversations/owner/{id}/messages` | `conversations/protected/owner/reply.ts` | none | - | n/a | Owner reply; auth + ownership check in handler |
| `GET /api/v1/protected/conversations/owner/unread-count` | `conversations/protected/owner/unread-count.ts` | none | - | n/a | Owner unread badge; auth + ownership scoping via accommodation IDs |
| **HOST DASHBOARD — PROTECTED (SPEC-205)** | | | | | |
| `GET /api/v1/protected/host/dashboard` | `host/protected/dashboard.ts` | gate | `view_basic_stats` | wired | requireEntitlement(VIEW_BASIC_STATS) middleware wired (SPEC-205) — aggregator for property counts, plan info, unread conversations |
| **VIEWS — PROTECTED (SPEC-159)** | | | | | |
| `GET /api/v1/protected/views/accommodations/me` | `views/protected/accommodations-me.ts` | gate | `view_basic_stats` | wired | View stats feed HOST Card G alongside ratings/response-rate, all VIEW_BASIC_STATS-gated — views must match (SPEC-159) |
| `GET /api/v1/protected/views/accommodations/me/daily-series` | `views/protected/daily-series.ts` | gate | `view_basic_stats` | wired | Per-host daily view totals time-series for the HOST dashboard trend chart (SPEC-207); same VIEW_BASIC_STATS gate as the views list, owner-scoped via findIdsByOwnerId |
| `GET /api/v1/protected/views/posts` | `views/protected/posts.ts` | none | - | n/a | Editor staff dashboard read; permission-gated via POST_VIEW_ALL, editors are not billing customers |
| `GET /api/v1/protected/views/events` | `views/protected/events.ts` | none | - | n/a | Editor staff dashboard read; permission-gated via EVENT_VIEW_ALL, editors are not billing customers |
| **GEOCODING — PROTECTED (SPEC-208)** | | | | | |
| `GET /api/v1/protected/geocoding/autocomplete` | `geocoding/protected/index.ts` | none | - | n/a | Protected geocoding proxy; auth-only — any logged-in user can geocode, no billing gate needed |
| `GET /api/v1/protected/geocoding/reverse` | `geocoding/protected/index.ts` | none | - | n/a | Protected geocoding proxy; auth-only — any logged-in user can reverse-geocode, no billing gate needed |
| **AI — PROTECTED (SPEC-198)** | | | | | |
| `POST /api/v1/protected/ai/text-improve` | `ai/protected/text-improve.ts` | gate+limit | `ai_text_improve`, `max_ai_text_improve_per_month` | wired | createAiQuotaMiddleware('text_improve') enforces entitlement + monthly quota + billing-outage guard; mounted at /api/v1/protected/ai via routes/ai/protected/index.ts (SPEC-198 T-004) |
| `POST /api/v1/protected/ai/chat` | `ai/protected/chat.ts` | gate+limit | `ai_chat`, `max_ai_chat_per_month` | wired | createAiQuotaMiddleware('chat') enforces entitlement + monthly quota + billing-outage guard; mounted at /api/v1/protected/ai via routes/ai/protected/index.ts (SPEC-200 T-005) |
| `POST /api/v1/protected/ai/search-chat` | `ai/protected/search-chat.ts` | none | - | n/a | Platform feature (SPEC-211 §7.7 / SPEC-212): auth + per-user/IP rate-limit only, NO billing entitlement or quota gate. The USD cost ceiling is enforced inside the AI engine. Mounted at /api/v1/protected/ai via routes/ai/protected/index.ts. Supersedes the retired /ai/search-intent route (SPEC-199, removed in SPEC-212 T-013). |
| `POST /api/v1/protected/ai/translate` | `ai/protected/translate.ts` | gate+limit | `ai_translate`, `max_ai_translate_per_month` | wired | createAiQuotaMiddleware('translate') enforces entitlement + monthly quota + billing-outage guard; entitlementMiddleware + per-user/IP rate-limit applied first; mounted at /api/v1/protected/ai via routes/ai/protected/index.ts (SPEC-212 T-006). Note: one quota pre-check covers the fields×locales AI calls fanned out per request; per-call cost is still metered in ai_usage. |
| **AI — ADMIN (SPEC-212)** | | | | | |
| `POST /api/v1/admin/ai/translate` | `ai/admin/translate.ts` | none | - | n/a | Admin single-entity translate ("Translate now" in the admin TranslationSection); gated by adminAuthMiddleware([AI_SETTINGS_MANAGE]). Staff bypass entitlements (INV-6) so there is no billing gate. Mounted at /api/v1/admin/ai/translate via routes/index.ts (SPEC-212). |
| `POST /api/v1/admin/ai/translate/batch` | `ai/admin/translate.ts` | none | - | n/a | Admin batch translation; gated by adminAuthMiddleware([AI_SETTINGS_MANAGE]). Staff bypass entitlements (INV-6) so there is no billing gate. Mounted at /api/v1/admin/ai/translate via routes/index.ts (SPEC-212 T-009). |
| `PUT /api/v1/admin/ai/translate/override` | `ai/admin/translate.ts` | none | - | n/a | Admin manual translation override; gated by adminAuthMiddleware([AI_SETTINGS_MANAGE]); no billing gate (SPEC-212 T-010). |
| **AUTH — PROTECTED / PUBLIC** | | | | | |
| `GET /api/v1/public/auth/me` | `auth/me.ts` | none | - | n/a | Session identity read; no entitlement needed |
| `POST /api/v1/protected/auth/change-password` | `auth/change-password.ts` | none | - | n/a | Account management; auth-only sufficient |
| `POST /api/v1/protected/auth/signout` | `auth/signout.ts` | none | - | n/a | Session termination; no entitlement needed |
| `GET /api/v1/protected/auth/cache/stats` | `auth/cache-stats.ts` | none | - | n/a | Diagnostic endpoint; auth-only sufficient |
| `GET /api/v1/public/auth/reset-password/check` | `auth/reset-password-check.ts` | none | - | n/a | Public token-check endpoint; no auth needed |
| `POST /api/v1/public/auth/signup-as-host` | `auth/signup-as-host.ts` | none | - | n/a | Registration endpoint; no entitlement gate |
| `GET /api/v1/public/auth/status` | `auth/status.ts` | none | - | n/a | Public auth readiness check |
| **USER — PROTECTED** | | | | | |
| `GET /api/v1/protected/users/me/entitlements` | `user/protected/entitlements.ts` | none | - | n/a | Returns the caller's own entitlements; always accessible |
| `GET /api/v1/protected/users/{id}` | `user/protected/getById.ts` | none | - | n/a | Read own profile; auth-only sufficient |
| `POST /api/v1/protected/users/me/newsletter/toggle` | `user/protected/newsletter.ts` | none | - | n/a | Newsletter preference; no plan gate |
| `PATCH /api/v1/protected/users/{id}` | `user/protected/patch.ts` | none | - | n/a | Update own profile; auth-only sufficient |
| `GET /api/v1/protected/users/me/reviews` | `user/protected/reviews.ts` | none | - | n/a | Read own reviews; auth-only sufficient |
| `GET /api/v1/protected/users/me/stats` | `user/protected/stats.ts` | none | - | n/a | Basic own-stats; auth-only sufficient |
| `GET /api/v1/protected/users/me/subscription` | `user/protected/subscription.ts` | none | - | n/a | Subscription self-read; always accessible |
| `PATCH /api/v1/protected/users/me/tour-progress` | `user/protected/tourProgress.ts` | none | - | n/a | Onboarding tour state; no plan gate |
| `PUT /api/v1/protected/users/{id}` | `user/protected/update.ts` | none | - | n/a | Update own profile; auth-only sufficient |
| `PATCH /api/v1/protected/users/me/whats-new-seen` | `user/protected/whatsNewSeen.ts` | none | - | n/a | Seen-state for release notes; no plan gate |
| **PROFILE — PROTECTED** | | | | | |
| `POST /api/v1/protected/profile/complete` | `profile/protected/complete.ts` | none | - | n/a | Profile completion flow; no plan gate |
| `POST /api/v1/protected/profile/set-password` | `profile/protected/set-password.ts` | none | - | n/a | Account setup; no plan gate |
| `POST /api/v1/protected/profile/skip-set-password` | `profile/protected/skip-set-password.ts` | none | - | n/a | Account setup skip; no plan gate |
| `GET /api/v1/protected/profile/status` | `profile/protected/status.ts` | none | - | n/a | Profile completion status read; auth-only sufficient |
| **NEWSLETTER — PROTECTED** | | | | | |
| `POST /api/v1/protected/newsletter/subscribe` | `newsletter/protected/subscribe.ts` | none | - | n/a | Newsletter subscription; no plan gate |
| `DELETE /api/v1/protected/newsletter/unsubscribe` | `newsletter/protected/unsubscribe.ts` | none | - | n/a | Unsubscription always allowed |
| `PATCH /api/v1/protected/newsletter/preferences` | `newsletter/protected/preferences.ts` | none | - | n/a | Preference management; no plan gate |
| `GET /api/v1/protected/newsletter/status` | `newsletter/protected/status.ts` | none | - | n/a | Read own newsletter status; auth-only sufficient |
| `POST /api/v1/protected/newsletter/resend-verification` | `newsletter/protected/resend.ts` | none | - | n/a | Resend verification email; no plan gate |
| **WHAT'S NEW — PROTECTED** | | | | | |
| `GET /api/v1/protected/whats-new` | `whats-new/protected/getWhatsNew.ts` | none | - | n/a | Role-filtered release notes; auth-only sufficient |
| **BILLING — PROTECTED (QZPay built-in routes)** | | | | | |
| `GET /api/v1/protected/billing/customers` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/customers` | `billing/index.ts (qzpay)` | none | - | n/a | Customer creation; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/customers/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `PUT /api/v1/protected/billing/customers/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `DELETE /api/v1/protected/billing/customers/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/subscriptions` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/subscriptions` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/subscriptions/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `PUT /api/v1/protected/billing/subscriptions/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `DELETE /api/v1/protected/billing/subscriptions/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Cancel own subscription; always allowed |
| `GET /api/v1/protected/billing/plans` | `billing/index.ts (qzpay)` | none | - | n/a | Plan catalog read; always accessible |
| `POST /api/v1/protected/billing/plans` | `billing/index.ts (qzpay)` | none | - | n/a | Plan management; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/plans/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Plan catalog read; always accessible |
| `PUT /api/v1/protected/billing/plans/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Plan management; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `DELETE /api/v1/protected/billing/plans/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Plan management; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/invoices` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/invoices` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/invoices/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/invoices/{id}/pay` | `billing/index.ts (qzpay)` | none | - | n/a | Pay own invoice; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/invoices/{id}/void` | `billing/index.ts (qzpay)` | none | - | n/a | Void own invoice; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/payments` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/payments` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/payments/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/payments/{id}/refund` | `billing/index.ts (qzpay)` | none | - | n/a | Refund own payment; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/entitlements` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/entitlements` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `GET /api/v1/protected/billing/entitlements/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `DELETE /api/v1/protected/billing/entitlements/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Self-billing access; PermissionEnum.BILLING_VIEW_OWN + ownership middleware |
| `POST /api/v1/protected/billing/checkout` | `billing/index.ts (qzpay)` | none | - | n/a | Checkout initiation; no entitlement gate (payment entry point) |
| `GET /api/v1/protected/billing/checkout/{id}` | `billing/index.ts (qzpay)` | none | - | n/a | Checkout status read; always accessible |
| `POST /api/v1/protected/billing/webhooks` | `billing/index.ts (qzpay)` | none | - | n/a | Webhook receiver; signature-verified |
| **BILLING — PROTECTED (custom routes)** | | | | | |
| `POST /api/v1/protected/billing/subscriptions/start-paid` | `billing/start-paid.ts` | none | - | n/a | Checkout initiation; no entitlement gate (payment entry point) |
| `GET /api/v1/protected/billing/trial/status` | `billing/trial.ts` | none | - | n/a | Trial status self-read; always accessible |
| `POST /api/v1/protected/billing/trial/start` | `billing/trial.ts` | none | - | n/a | Trial activation; no entitlement gate |
| `POST /api/v1/protected/billing/trial/extend` | `billing/trial.ts` | none | - | n/a | Trial extension; no entitlement gate |
| `POST /api/v1/protected/billing/trial/reactivate` | `billing/trial.ts` | none | - | n/a | Reactivation after trial-expiry; no entitlement gate |
| `GET /api/v1/protected/billing/addons` | `billing/addons.ts` | none | - | n/a | Addon catalog read; always accessible |
| `GET /api/v1/protected/billing/addons/{slug}` | `billing/addons.ts` | none | - | n/a | Addon detail read; always accessible |
| `POST /api/v1/protected/billing/addons/{slug}/purchase` | `billing/addons.ts` | none | - | n/a | Addon purchase; no entitlement gate (payment entry point) |
| `GET /api/v1/protected/billing/addons/my` | `billing/addons.ts` | none | - | n/a | Own addon list; auth-only sufficient |
| `POST /api/v1/protected/billing/addons/{id}/cancel` | `billing/addons.ts` | none | - | n/a | Cancel own addon; always allowed |
| `GET /api/v1/protected/billing/subscriptions/downgrade-preview` | `billing/downgrade-preview.ts` | none | - | n/a | Read-only informational downgrade preview; no entitlement/limit gate |
| `POST /api/v1/protected/billing/subscriptions/change-plan` | `billing/plan-change.ts` | none | - | n/a | Plan change initiation; no entitlement gate |
| `POST /api/v1/protected/billing/subscriptions/{id}/cancel` | `billing/subscription-cancel.ts` | none | - | n/a | User self-service soft-cancel (SPEC-147); behind `HOSPEDA_USER_CANCEL_ENABLED` flag, ownership enforced server-side; no entitlement gate |
| `GET /api/v1/protected/billing/promo-codes` | `billing/promo-codes.ts` | none | - | n/a | Promo-code self-management; PermissionEnum-gated |
| `POST /api/v1/protected/billing/promo-codes` | `billing/promo-codes.ts` | none | - | n/a | Promo-code self-management; PermissionEnum-gated |
| `GET /api/v1/protected/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Promo-code self-management; PermissionEnum-gated |
| `PUT /api/v1/protected/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Promo-code self-management; PermissionEnum-gated |
| `DELETE /api/v1/protected/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Promo-code self-management; PermissionEnum-gated |
| `POST /api/v1/protected/billing/promo-codes/validate` | `billing/promo-codes.ts` | none | - | n/a | Promo-code validation; no entitlement gate |
| `POST /api/v1/protected/billing/promo-codes/apply` | `billing/promo-codes.ts` | none | - | n/a | Promo-code apply; no entitlement gate |
| `GET /api/v1/protected/billing/settings` | `billing/settings.ts` | none | - | n/a | Self-billing settings read; PermissionEnum.BILLING_VIEW_OWN |
| `PATCH /api/v1/protected/billing/settings` | `billing/settings.ts` | none | - | n/a | Self-billing settings update; PermissionEnum.BILLING_VIEW_OWN |
| `POST /api/v1/protected/billing/settings/reset` | `billing/settings.ts` | none | - | n/a | Self-billing settings reset; PermissionEnum.BILLING_VIEW_OWN |
| `POST /api/v1/protected/billing/me/subscription-pause` | `billing/subscription-pause.ts` | none | - | n/a | Self-service pause; no entitlement gate |
| `POST /api/v1/protected/billing/me/subscription-resume` | `billing/subscription-pause.ts` | none | - | n/a | Self-service resume; always allowed |
| `GET /api/v1/protected/billing/subscriptions/{localId}/status` | `billing/subscription-status.ts` | none | - | n/a | Subscription status poll; auth + ownership sufficient |
| `GET /api/v1/protected/billing/usage` | `billing/usage.ts` | none | - | n/a | Own usage summary; auth-only sufficient |
| `GET /api/v1/protected/billing/usage/{limitKey}` | `billing/usage.ts` | none | - | n/a | Own per-limit usage; auth-only sufficient |
| `GET /api/v1/protected/billing/metrics` | `billing/metrics.ts` | none | - | n/a | Own metrics summary; auth-only sufficient |
| `GET /api/v1/protected/billing/metrics/activity` | `billing/metrics.ts` | none | - | n/a | Own activity metrics; auth-only sufficient |
| `GET /api/v1/protected/billing/metrics/system-usage` | `billing/metrics.ts` | none | - | n/a | Own system-usage metrics; auth-only sufficient |
| `GET /api/v1/protected/billing/metrics/approaching-limits` | `billing/metrics.ts` | none | - | n/a | Own approaching-limits alert; auth-only sufficient |
| `POST /api/v1/protected/billing/notifications/cleanup` | `billing/notifications.ts` | none | - | n/a | Notification cleanup; auth-only sufficient |
| **AMENITY — PROTECTED** | | | | | |
| `POST /api/v1/protected/amenities` | `amenity/protected/create.ts` | none | - | n/a | Staff/owner contributor feature; auth + ACCOMMODATION_CREATE permission sufficient |
| `PATCH /api/v1/protected/amenities/{id}` | `amenity/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/amenities/{id}` | `amenity/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/amenities/{id}` | `amenity/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **ATTRACTION — PROTECTED** | | | | | |
| `POST /api/v1/protected/attractions` | `attraction/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/attractions/{id}` | `attraction/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/attractions/{id}` | `attraction/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/attractions/{id}` | `attraction/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **HOST-TRADE — PROTECTED** | | | | | |
| `GET /api/v1/protected/host-trades` | `host-trade/protected/list.ts` | none | - | n/a | Host perk, gated by HOST_TRADE_VIEW permission only — no billing entitlement |
| **DESTINATION — PROTECTED** | | | | | |
| `POST /api/v1/protected/destinations` | `destination/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/destinations/{id}` | `destination/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/destinations/{id}` | `destination/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/destinations/{id}` | `destination/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **EVENT — PROTECTED** | | | | | |
| `POST /api/v1/protected/events` | `event/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/events/{id}` | `event/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/events/{id}` | `event/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/events/{id}` | `event/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `POST /api/v1/protected/events/{eventId}/comments` | `event/comments/protected/create.ts` | none | - | n/a | Community feature; no plan restriction on event comments |
| **EVENT-LOCATION — PROTECTED** | | | | | |
| `POST /api/v1/protected/event-locations` | `event-location/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/event-locations/{id}` | `event-location/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/event-locations/{id}` | `event-location/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/event-locations/{id}` | `event-location/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **EVENT-ORGANIZER — PROTECTED** | | | | | |
| `POST /api/v1/protected/event-organizers` | `event-organizer/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/event-organizers/{id}` | `event-organizer/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/event-organizers/{id}` | `event-organizer/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/event-organizers/{id}` | `event-organizer/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **FEATURE — PROTECTED** | | | | | |
| `POST /api/v1/protected/features` | `feature/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/features/{id}` | `feature/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/features/{id}` | `feature/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/features/{id}` | `feature/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| **POST (BLOG) — PROTECTED** | | | | | |
| `POST /api/v1/protected/posts` | `post/protected/create.ts` | none | - | n/a | Content contributor; auth + PermissionEnum-gated |
| `PATCH /api/v1/protected/posts/{id}` | `post/protected/patch.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `PUT /api/v1/protected/posts/{id}` | `post/protected/update.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `DELETE /api/v1/protected/posts/{id}` | `post/protected/softDelete.ts` | none | - | n/a | Auth + PermissionEnum-gated |
| `POST /api/v1/protected/posts/{id}/like` | `post/protected/like.ts` | none | - | n/a | Community engagement; no plan restriction |
| `DELETE /api/v1/protected/posts/{id}/like` | `post/protected/unlike.ts` | none | - | n/a | Community engagement; removal always allowed |
| `POST /api/v1/protected/posts/{postId}/comments` | `post/comments/protected/create.ts` | none | - | n/a | Community feature; no plan restriction on post comments |
| **COMMENT — PROTECTED** | | | | | |
| `DELETE /api/v1/protected/comments/{commentId}` | `comment/protected/delete.ts` | none | - | n/a | Delete own comment; auth + ownership sufficient |
| **SPONSORSHIP — PROTECTED** | | | | | |
| `POST /api/v1/protected/sponsorships` | `sponsorship/protected/create.ts` | none | - | n/a | Sponsorship request; auth + PermissionEnum-gated |
| `PUT /api/v1/protected/sponsorships/{id}` | `sponsorship/protected/update.ts` | none | - | n/a | Auth + ownership sufficient |
| `DELETE /api/v1/protected/sponsorships/{id}` | `sponsorship/protected/softDelete.ts` | none | - | n/a | Auth + ownership sufficient |
| `GET /api/v1/protected/sponsorships` | `sponsorship/protected/list.ts` | none | - | n/a | Read own sponsorships; auth-only sufficient |
| `GET /api/v1/protected/sponsorships/{id}` | `sponsorship/protected/getById.ts` | none | - | n/a | Read own sponsorship; auth + ownership sufficient |
| `GET /api/v1/protected/sponsorships/{id}/analytics` | `sponsorship/protected/getAnalytics.ts` | none | - | n/a | Own sponsorship analytics; auth + ownership sufficient |
| **ACCOMMODATION — ADMIN** | | | | | |
| `GET /api/v1/admin/accommodations` | `accommodation/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated (ACCOMMODATION_VIEW_ANY) |
| `POST /api/v1/admin/accommodations` | `accommodation/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/accommodations/{id}` | `accommodation/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/accommodations/{id}` | `accommodation/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/accommodations/{id}` | `accommodation/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/accommodations/{id}` | `accommodation/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/accommodations/{id}/hard` | `accommodation/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/{id}/restore` | `accommodation/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/batch` | `accommodation/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| `GET /api/v1/admin/accommodations/options` | `accommodation/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/accommodations/{id}/faqs` | `accommodation/admin/getFaqs.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/{id}/faqs` | `accommodation/admin/addFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PUT /api/v1/admin/accommodations/{id}/faqs/{faqId}` | `accommodation/admin/updateFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/accommodations/{id}/faqs/{faqId}` | `accommodation/admin/removeFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/{id}/faqs/reorder` | `accommodation/admin/reorderFaqs.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **ACCOMMODATION REVIEWS — ADMIN** | | | | | |
| `GET /api/v1/admin/accommodations/{id}/reviews` | `accommodation/reviews/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/accommodations/{id}/reviews/{reviewId}` | `accommodation/reviews/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/accommodations/{id}/reviews/{reviewId}` | `accommodation/reviews/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/accommodations/{id}/reviews/{reviewId}` | `accommodation/reviews/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/accommodations/{id}/reviews/{reviewId}/hard` | `accommodation/reviews/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/{id}/reviews/{reviewId}/restore` | `accommodation/reviews/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/accommodations/{id}/reviews/{reviewId}/moderate` | `accommodation/reviews/admin/moderate.ts` | none | - | n/a | Admin moderation — PermissionEnum-gated (SPEC-166; ACCOMMODATION_REVIEW_MODERATE) |
| **DESTINATION — ADMIN** | | | | | |
| `GET /api/v1/admin/destinations` | `destination/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/destinations` | `destination/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}` | `destination/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/destinations/{id}` | `destination/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/destinations/{id}` | `destination/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/destinations/{id}` | `destination/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/destinations/{id}/hard` | `destination/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/{id}/restore` | `destination/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/batch` | `destination/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/options` | `destination/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}/faqs` | `destination/admin/getFaqs.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/{id}/faqs` | `destination/admin/addFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PUT /api/v1/admin/destinations/{id}/faqs/{faqId}` | `destination/admin/updateFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/destinations/{id}/faqs/{faqId}` | `destination/admin/removeFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/{id}/faqs/reorder` | `destination/admin/reorderFaqs.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}/ancestors` | `destination/admin/getAncestors.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}/children` | `destination/admin/getChildren.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}/descendants` | `destination/admin/getDescendants.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **DESTINATION REVIEWS — ADMIN** | | | | | |
| `GET /api/v1/admin/destinations/{id}/reviews` | `destination/reviews/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/destinations/{id}/reviews/{reviewId}` | `destination/reviews/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/destinations/{id}/reviews/{reviewId}` | `destination/reviews/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/destinations/{id}/reviews/{reviewId}` | `destination/reviews/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/destinations/{id}/reviews/{reviewId}/hard` | `destination/reviews/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/{id}/reviews/{reviewId}/restore` | `destination/reviews/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/destinations/{id}/reviews/{reviewId}/moderate` | `destination/reviews/admin/moderate.ts` | none | - | n/a | Admin moderation — PermissionEnum-gated (SPEC-166; DESTINATION_REVIEW_MODERATE) |
| **EVENT — ADMIN** | | | | | |
| `GET /api/v1/admin/events` | `event/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/events` | `event/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/events/{id}` | `event/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/events/{id}` | `event/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/events/{id}` | `event/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/events/{id}` | `event/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/events/{id}/hard` | `event/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/events/{id}/restore` | `event/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/events/batch` | `event/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| `GET /api/v1/admin/events/options` | `event/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **EVENT COMMENTS — ADMIN** | | | | | |
| `GET /api/v1/admin/events/{eventId}/comments` | `event/comments/public/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **AMENITY — ADMIN** | | | | | |
| `GET /api/v1/admin/amenities` | `amenity/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/amenities` | `amenity/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/amenities/{id}` | `amenity/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/amenities/{id}` | `amenity/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/amenities/{id}` | `amenity/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/amenities/{id}` | `amenity/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/amenities/{id}/hard` | `amenity/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/amenities/{id}/restore` | `amenity/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/amenities/batch` | `amenity/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| **FEATURE — ADMIN** | | | | | |
| `GET /api/v1/admin/features` | `feature/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/features` | `feature/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/features/{id}` | `feature/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/features/{id}` | `feature/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/features/{id}` | `feature/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/features/{id}` | `feature/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/features/{id}/hard` | `feature/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/features/{id}/restore` | `feature/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/features/batch` | `feature/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| **ATTRACTION — ADMIN** | | | | | |
| `GET /api/v1/admin/attractions` | `attraction/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/attractions` | `attraction/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/attractions/{id}` | `attraction/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/attractions/{id}` | `attraction/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/attractions/{id}` | `attraction/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/attractions/{id}` | `attraction/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/attractions/{id}/hard` | `attraction/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/attractions/{id}/restore` | `attraction/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/attractions/batch` | `attraction/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| **HOST-TRADE — ADMIN** | | | | | |
| `GET /api/v1/admin/host-trades` | `host-trade/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/host-trades` | `host-trade/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/host-trades/{id}` | `host-trade/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/host-trades/{id}` | `host-trade/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/host-trades/{id}` | `host-trade/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/host-trades/{id}` | `host-trade/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/host-trades/{id}/hard` | `host-trade/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/host-trades/{id}/restore` | `host-trade/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| **EVENT-LOCATION — ADMIN** | | | | | |
| `GET /api/v1/admin/event-locations` | `event-location/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/event-locations` | `event-location/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/event-locations/{id}` | `event-location/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/event-locations/{id}` | `event-location/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/event-locations/{id}` | `event-location/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/event-locations/{id}` | `event-location/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/event-locations/{id}/hard` | `event-location/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/event-locations/{id}/restore` | `event-location/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `GET /api/v1/admin/event-locations/options` | `event-location/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **EVENT-ORGANIZER — ADMIN** | | | | | |
| `GET /api/v1/admin/event-organizers` | `event-organizer/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/event-organizers` | `event-organizer/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/event-organizers/{id}` | `event-organizer/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/event-organizers/{id}` | `event-organizer/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/event-organizers/{id}` | `event-organizer/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/event-organizers/{id}` | `event-organizer/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/event-organizers/{id}/hard` | `event-organizer/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/event-organizers/{id}/restore` | `event-organizer/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `GET /api/v1/admin/event-organizers/options` | `event-organizer/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **POST (BLOG) — ADMIN** | | | | | |
| `GET /api/v1/admin/posts` | `post/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/posts` | `post/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/posts/{id}` | `post/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/posts/{id}` | `post/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/posts/{id}` | `post/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/posts/{id}` | `post/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/posts/{id}/hard` | `post/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/posts/{id}/restore` | `post/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/posts/batch` | `post/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| `GET /api/v1/admin/posts/{id}/seo` | `post/admin/getSeo.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/posts/{id}/seo` | `post/admin/updateSeo.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/posts/{id}/trend` | `post/admin/trend.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **POST-TAG — ADMIN** | | | | | |
| `GET /api/v1/admin/posts/tags` | `tag/post-tag/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/posts/tags` | `tag/post-tag/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/posts/tags/{id}` | `tag/post-tag/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `DELETE /api/v1/admin/posts/tags/{id}` | `tag/post-tag/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/posts/tags/{id}` | `tag/post-tag/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/posts/tags/{id}/impact` | `tag/post-tag/admin/impact.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/posts/{postId}/tags` | `tag/post-tag/admin/setPostTags.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/posts/{postId}/tags/{tagId}` | `tag/post-tag/admin/removePostTag.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **USER-TAG — ADMIN** | | | | | |
| `POST /api/v1/admin/tags/internal` | `tag/user-tag/admin/internal/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/internal` | `tag/user-tag/admin/internal/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PATCH /api/v1/admin/tags/internal/{id}` | `tag/user-tag/admin/internal/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/tags/internal/{id}` | `tag/user-tag/admin/internal/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/internal/{id}` | `tag/user-tag/admin/internal/get.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/tags/internal/{id}/impact` | `tag/user-tag/admin/internal/impact.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/tags/system` | `tag/user-tag/admin/system/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/system` | `tag/user-tag/admin/system/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PATCH /api/v1/admin/tags/system/{id}` | `tag/user-tag/admin/system/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/tags/system/{id}` | `tag/user-tag/admin/system/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/system/{id}` | `tag/user-tag/admin/system/get.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/tags/system/{id}/impact` | `tag/user-tag/admin/system/impact.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/tags/own` | `tag/user-tag/admin/own/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/own` | `tag/user-tag/admin/own/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PATCH /api/v1/admin/tags/own/{id}` | `tag/user-tag/admin/own/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/tags/own/{id}` | `tag/user-tag/admin/own/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/tags/own/{id}/impact` | `tag/user-tag/admin/own/impact.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/tags/own/quota` | `tag/user-tag/admin/own/quota.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/tags/user` | `tag/user-tag/admin/user-moderation.ts` | none | - | n/a | Admin moderation read; PermissionEnum-gated |
| `POST /api/v1/admin/entities/{type}/{id}/tags` | `tag/user-tag/admin/entities/add.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/entities/{type}/{id}/tags/own` | `tag/user-tag/admin/entities/list-own.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `DELETE /api/v1/admin/entities/{type}/{id}/tags/{tagId}` | `tag/user-tag/admin/entities/remove.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/entities/{type}/{id}/tags` | `tag/user-tag/admin/entity-attribution.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **COMMENT — ADMIN** | | | | | |
| `GET /api/v1/admin/comments` | `comment/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/comments/{id}` | `comment/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `DELETE /api/v1/admin/comments/{id}` | `comment/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/comments/{id}/hard` | `comment/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/comments/{id}/restore` | `comment/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/comments/{id}/moderate` | `comment/admin/moderate.ts` | none | - | n/a | Admin moderation; PermissionEnum-gated |
| `GET /api/v1/admin/comments/recent` | `comment/admin/recent.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **USER — ADMIN** | | | | | |
| `GET /api/v1/admin/users` | `user/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/users` | `user/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/users/{id}` | `user/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/users/{id}` | `user/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/users/{id}` | `user/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/users/{id}` | `user/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/users/{id}/hard` | `user/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/users/{id}/restore` | `user/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| `POST /api/v1/admin/users/batch` | `user/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated |
| `GET /api/v1/admin/users/options` | `user/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/users/stats` | `user/admin/stats.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/users/{id}/permissions` | `user/admin/permissions.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **OWNER PROMOTION — ADMIN** | | | | | |
| `GET /api/v1/admin/owner-promotions` | `owner-promotion/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/owner-promotions` | `owner-promotion/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/owner-promotions/{id}` | `owner-promotion/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/owner-promotions/{id}` | `owner-promotion/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/owner-promotions/{id}` | `owner-promotion/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/owner-promotions/{id}` | `owner-promotion/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/owner-promotions/{id}/hard` | `owner-promotion/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/owner-promotions/{id}/restore` | `owner-promotion/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| **POST-SPONSOR — ADMIN** | | | | | |
| `GET /api/v1/admin/post-sponsors` | `postSponsor/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/post-sponsors` | `postSponsor/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/post-sponsors/{id}` | `postSponsor/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/post-sponsors/{id}` | `postSponsor/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PATCH /api/v1/admin/post-sponsors/{id}` | `postSponsor/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/post-sponsors/{id}` | `postSponsor/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/post-sponsors/{id}/hard` | `postSponsor/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated |
| `POST /api/v1/admin/post-sponsors/{id}/restore` | `postSponsor/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated |
| **SPONSORSHIP — ADMIN** | | | | | |
| `GET /api/v1/admin/sponsorships` | `sponsorship/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/sponsorships` | `sponsorship/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PUT /api/v1/admin/sponsorships/{id}` | `sponsorship/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/sponsorships/{id}` | `sponsorship/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/sponsorship-levels` | `sponsorship-level/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/sponsorship-levels` | `sponsorship-level/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PUT /api/v1/admin/sponsorship-levels/{id}` | `sponsorship-level/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/sponsorship-levels/{id}` | `sponsorship-level/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/sponsorship-packages` | `sponsorship-package/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/sponsorship-packages` | `sponsorship-package/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `PUT /api/v1/admin/sponsorship-packages/{id}` | `sponsorship-package/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/sponsorship-packages/{id}` | `sponsorship-package/admin/delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **MEDIA — ADMIN** | | | | | |
| `POST /api/v1/admin/media` | `media/admin/upload.ts` | limit | `max_photos_per_accommodation` | wired | Inline photo-limit check in handler (SPEC-143 Finding #15) |
| `DELETE /api/v1/admin/media` | `media/admin/delete.ts` | none | - | n/a | Admin media delete; PermissionEnum.MEDIA_DELETE gated |
| **CONVERSATIONS — ADMIN** | | | | | |
| `GET /api/v1/admin/conversations` | `conversations/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum.CONVERSATION_VIEW_ALL gated |
| `GET /api/v1/admin/conversations/{id}` | `conversations/admin/thread.ts` | none | - | n/a | Admin read; PermissionEnum.CONVERSATION_VIEW_OWN or ANY gated |
| `POST /api/v1/admin/conversations/{id}/messages` | `conversations/admin/reply.ts` | none | - | n/a | Owner-side reply; PermissionEnum.CONVERSATION_REPLY_OWN or ANY gated |
| `PATCH /api/v1/admin/conversations/{id}/status` | `conversations/admin/status.ts` | none | - | n/a | Status lifecycle; PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN gated |
| `PATCH /api/v1/admin/conversations/{id}/archive` | `conversations/admin/archive.ts` | none | - | n/a | Archive toggle; PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN gated |
| `DELETE /api/v1/admin/conversations/{id}` | `conversations/admin/delete.ts` | none | - | n/a | Admin soft-delete; PermissionEnum-gated |
| `GET /api/v1/admin/conversations/unread-count` | `conversations/admin/unread-count.ts` | none | - | n/a | Owner inbox badge; PermissionEnum.CONVERSATION_VIEW_OWN gated |
| **BILLING — ADMIN** | | | | | |
| `GET /api/v1/admin/billing/usage/{customerId}` | `billing/admin/usage.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/settings` | `billing/settings.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `PATCH /api/v1/admin/billing/settings` | `billing/settings.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `POST /api/v1/admin/billing/settings/reset` | `billing/settings.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/notifications` | `billing/admin/notifications.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `POST /api/v1/admin/billing/notifications/cleanup` | `billing/notifications.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/customer-addons` | `billing/admin/customer-addons.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `POST /api/v1/admin/billing/customer-addons/{id}/expire` | `billing/admin/customer-addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `POST /api/v1/admin/billing/customer-addons/{id}/activate` | `billing/admin/customer-addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/metrics` | `billing/admin/metrics.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/metrics/activity` | `billing/admin/metrics.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/metrics/system-usage` | `billing/admin/metrics.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/metrics/approaching-limits` | `billing/admin/metrics.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/metrics/lifecycle` | `billing/admin/metrics.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/subscriptions/{id}/events` | `billing/admin/subscription-events.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/addons` | `billing/admin/addons.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/addons/{id}` | `billing/admin/addons.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `POST /api/v1/admin/billing/addons` | `billing/admin/addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `PUT /api/v1/admin/billing/addons/{id}` | `billing/admin/addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `PATCH /api/v1/admin/billing/addons/{id}` | `billing/admin/addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `DELETE /api/v1/admin/billing/addons/{id}` | `billing/admin/addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `POST /api/v1/admin/billing/addons/{id}/restore` | `billing/admin/addons.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `DELETE /api/v1/admin/billing/addons/{id}/hard` | `billing/admin/addons.ts` | none | - | n/a | Admin hard-delete; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/plans` | `billing/admin/plans.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `GET /api/v1/admin/billing/plans/{id}` | `billing/admin/plans.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `POST /api/v1/admin/billing/plans` | `billing/admin/plans.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `PUT /api/v1/admin/billing/plans/{id}` | `billing/admin/plans.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `PATCH /api/v1/admin/billing/plans/{id}` | `billing/admin/plans.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `DELETE /api/v1/admin/billing/plans/{id}` | `billing/admin/plans.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `POST /api/v1/admin/billing/plans/{id}/restore` | `billing/admin/plans.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `DELETE /api/v1/admin/billing/plans/{id}/hard` | `billing/admin/plans.ts` | none | - | n/a | Admin hard-delete; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/promo-codes` | `billing/promo-codes.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `POST /api/v1/admin/billing/promo-codes` | `billing/promo-codes.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `GET /api/v1/admin/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Admin read; PermissionEnum.BILLING_READ_ALL gated |
| `PUT /api/v1/admin/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `DELETE /api/v1/admin/billing/promo-codes/{id}` | `billing/promo-codes.ts` | none | - | n/a | Admin write; PermissionEnum.BILLING_MANAGE gated |
| `POST /api/v1/admin/billing/customer-entitlements/grant` | `billing/admin/customer-entitlements.ts` | none | - | n/a | Admin mutation; PermissionEnum.BILLING_MANAGE gated; mutates billing_customer_entitlements |
| `POST /api/v1/admin/billing/customer-entitlements/revoke` | `billing/admin/customer-entitlements.ts` | none | - | n/a | Admin mutation; PermissionEnum.BILLING_MANAGE gated; mutates billing_customer_entitlements; POST (not DELETE) because route-factory skips body parsing for DELETE |
| `* /api/v1/admin/billing/* (qzpay-admin)` | `billing/admin/index.ts (qzpay)` | none | - | n/a | QZPay admin tier: subscriptions/payments/invoices/entitlements/limits; PermissionEnum.BILLING_READ_ALL + BILLING_MANAGE gated via adminBillingAuthMiddleware |
| **NEWSLETTER — ADMIN** | | | | | |
| `GET /api/v1/admin/newsletter` | `newsletter/admin/subscribers.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/newsletter/subscribers-by-preference` | `newsletter/admin/subscribers-by-preference.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/newsletter/campaigns` | `newsletter/admin/campaigns.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `POST /api/v1/admin/newsletter/campaigns` | `newsletter/admin/campaigns.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **CRON — ADMIN** | | | | | |
| `GET /api/v1/admin/cron/runs` | `cron-admin/runs.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **APP-LOGS — ADMIN** | | | | | |
| `GET /api/v1/admin/logs` | `app-logs/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **GEOCODING — ADMIN** | | | | | |
| `GET /api/v1/admin/geocoding/autocomplete` | `geocoding/admin/index.ts` | none | - | n/a | Admin geocoding proxy; PermissionEnum-gated |
| `GET /api/v1/admin/geocoding/forward` | `geocoding/admin/index.ts` | none | - | n/a | Admin geocoding proxy; PermissionEnum-gated |
| `GET /api/v1/admin/geocoding/reverse` | `geocoding/admin/index.ts` | none | - | n/a | Admin geocoding proxy; PermissionEnum-gated |
| **MODERATION — ADMIN** | | | | | |
| `GET /api/v1/admin/moderation/pending-count` | `moderation/admin/pending-count.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/moderation/reviews/pending-count` | `moderation/admin/reviews-pending-count.ts` | none | - | n/a | Admin moderation — OR-gated (ACCOMMODATION_REVIEW_MODERATE or DESTINATION_REVIEW_MODERATE; SPEC-166 §7) |
| **CONTENT MODERATION — ADMIN** | | | | | |
| `GET /api/v1/admin/content-moderation/health` | `content-moderation/admin/health.ts` | none | - | n/a | Admin ops read; PermissionEnum-gated (MODERATION_TERM_VIEW) — no billing entitlement on provider/cache telemetry |
| `GET /api/v1/admin/content-moderation/terms` | `content-moderation/admin/terms/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated (MODERATION_TERM_VIEW) |
| `GET /api/v1/admin/content-moderation/terms/{id}` | `content-moderation/admin/terms/get-by-id.ts` | none | - | n/a | Admin read; PermissionEnum-gated (MODERATION_TERM_VIEW) |
| `POST /api/v1/admin/content-moderation/terms` | `content-moderation/admin/terms/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated (MODERATION_TERM_CREATE) |
| `PUT /api/v1/admin/content-moderation/terms/{id}` | `content-moderation/admin/terms/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated (MODERATION_TERM_UPDATE) |
| `PATCH /api/v1/admin/content-moderation/terms/{id}` | `content-moderation/admin/terms/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated (MODERATION_TERM_UPDATE) |
| `DELETE /api/v1/admin/content-moderation/terms/{id}` | `content-moderation/admin/terms/soft-delete.ts` | none | - | n/a | Admin write; PermissionEnum-gated (MODERATION_TERM_DELETE) |
| `DELETE /api/v1/admin/content-moderation/terms/{id}/hard` | `content-moderation/admin/terms/hard-delete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated (MODERATION_TERM_HARD_DELETE) |
| `POST /api/v1/admin/content-moderation/terms/{id}/restore` | `content-moderation/admin/terms/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated (MODERATION_TERM_RESTORE) |
| `POST /api/v1/admin/content-moderation/terms/batch` | `content-moderation/admin/terms/batch.ts` | none | - | n/a | Admin batch import; PermissionEnum-gated (MODERATION_TERM_CREATE) |
| `GET /api/v1/admin/content-moderation/thresholds` | `content-moderation/admin/thresholds/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated (MODERATION_THRESHOLD_VIEW) |
| `GET /api/v1/admin/content-moderation/thresholds/{id}` | `content-moderation/admin/thresholds/get-by-id.ts` | none | - | n/a | Admin read; PermissionEnum-gated (MODERATION_THRESHOLD_VIEW) |
| `PATCH /api/v1/admin/content-moderation/thresholds/{id}` | `content-moderation/admin/thresholds/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated (MODERATION_THRESHOLD_UPDATE) |
| `GET /api/v1/admin/content-moderation/thresholds/resolved` | `content-moderation/admin/thresholds/get-resolved.ts` | none | - | n/a | Admin read; PermissionEnum-gated (MODERATION_THRESHOLD_VIEW) |
| **SYSTEM — ADMIN** | | | | | |
| `GET /api/v1/admin/system/health` | `system/admin/health.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **PLATFORM-SETTINGS — ADMIN** | | | | | |
| `GET /api/v1/admin/platform-settings/{key}` | `platform-settings/admin/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PATCH /api/v1/admin/platform-settings/{key}` | `platform-settings/admin/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| **REVALIDATION — ADMIN** | | | | | |
| `POST /api/v1/admin/revalidation/revalidate/manual` | `revalidation/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/revalidation/revalidate/entity` | `revalidation/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/revalidation/revalidate/type` | `revalidation/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/revalidation/config` | `revalidation/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PATCH /api/v1/admin/revalidation/config/{id}` | `revalidation/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/revalidation/logs` | `revalidation/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/revalidation/stats` | `revalidation/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/revalidation/health` | `revalidation/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **EXCHANGE-RATES — ADMIN** | | | | | |
| `POST /api/v1/admin/exchange-rates` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `DELETE /api/v1/admin/exchange-rates/{id}` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `POST /api/v1/admin/exchange-rates/fetch-now` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/exchange-rates/config` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `PUT /api/v1/admin/exchange-rates/config` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin write; PermissionEnum-gated |
| `GET /api/v1/admin/exchange-rates/history` | `exchange-rates/admin/index.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **WEBHOOKS — ADMIN** | | | | | |
| `GET /api/v1/admin/webhooks/dead-letter` | `webhooks/admin/dead-letter.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| `GET /api/v1/admin/webhooks/events` | `webhooks/admin/events.ts` | none | - | n/a | Admin read; PermissionEnum-gated |
| **METRICS — ADMIN** | | | | | |
| `GET /api/v1/admin/metrics` | `metrics/index.ts` | none | - | n/a | Admin/ops metrics; PermissionEnum-gated |
| **AUTH — ADMIN** | | | | | |
| `* /api/v1/admin/auth/*` | `auth/index.ts (admin)` | none | - | n/a | Admin auth monitoring; PermissionEnum-gated |
| **VIEW STATS — ADMIN** | | | | | |
| `GET /api/v1/admin/views/summary` | `views/admin/summary.ts` | none | - | n/a | admin-tier route; gated by ANALYTICS_VIEW permission, no billing gate needed |
| `GET /api/v1/admin/views/batch` | `views/admin/batch.ts` | none | - | n/a | admin-tier route; gated by ANALYTICS_VIEW permission, no billing gate needed |
| `GET /api/v1/admin/views/top` | `views/admin/top.ts` | none | - | n/a | admin-tier route; gated by ANALYTICS_VIEW permission, no billing gate needed |
| `GET /api/v1/admin/views/daily-series` | `views/admin/daily-series.ts` | none | - | n/a | admin-tier route; gated by ANALYTICS_VIEW permission, no billing gate needed |
| **GASTRONOMY — PROTECTED** | | | | | |
| `GET /api/v1/protected/gastronomies/{id}` | `gastronomy/protected/getById.ts` | none | - | n/a | Read own listing; auth + ownership check in handler (SPEC-239) |
| `PATCH /api/v1/protected/gastronomies/{id}` | `gastronomy/protected/patch.ts` | none | - | n/a | Owner-scoped edit; auth + ownership check. Commerce-subscription gating deferred to SPEC-239 billing API (T-048+) |
| `POST /api/v1/protected/gastronomies/{id}/faqs` | `gastronomy/protected/addFaq.ts` | none | - | n/a | Owner-scoped FAQ write; auth + ownership check (SPEC-239) |
| `PUT /api/v1/protected/gastronomies/{id}/faqs/{faqId}` | `gastronomy/protected/updateFaq.ts` | none | - | n/a | Owner-scoped FAQ write; auth + ownership check (SPEC-239) |
| `DELETE /api/v1/protected/gastronomies/{id}/faqs/{faqId}` | `gastronomy/protected/removeFaq.ts` | none | - | n/a | Deletion ungated; removing own FAQ always allowed (SPEC-239) |
| `PUT /api/v1/protected/gastronomies/{id}/faqs/reorder` | `gastronomy/protected/reorderFaqs.ts` | none | - | n/a | Owner-scoped FAQ reorder; auth + ownership check (SPEC-239) |
| `POST /api/v1/protected/gastronomies/{gastronomyId}/reviews` | `gastronomy/protected/createReview.ts` | none | - | n/a | Public-user review submission; auth-only, moderation enforced in service (SPEC-239) |
| **GASTRONOMY — ADMIN** | | | | | |
| `GET /api/v1/admin/gastronomies` | `gastronomy/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `POST /api/v1/admin/gastronomies` | `gastronomy/admin/create.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_CREATE) |
| `GET /api/v1/admin/gastronomies/{id}` | `gastronomy/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `PUT /api/v1/admin/gastronomies/{id}` | `gastronomy/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `PATCH /api/v1/admin/gastronomies/{id}` | `gastronomy/admin/patch.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `DELETE /api/v1/admin/gastronomies/{id}` | `gastronomy/admin/delete.ts` | none | - | n/a | Admin soft-delete; PermissionEnum-gated (COMMERCE_DELETE) |
| `DELETE /api/v1/admin/gastronomies/{id}/hard` | `gastronomy/admin/hardDelete.ts` | none | - | n/a | Admin hard-delete; PermissionEnum-gated (COMMERCE_DELETE) |
| `POST /api/v1/admin/gastronomies/{id}/restore` | `gastronomy/admin/restore.ts` | none | - | n/a | Admin restore; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `POST /api/v1/admin/gastronomies/batch` | `gastronomy/admin/batch.ts` | none | - | n/a | Admin batch; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `GET /api/v1/admin/gastronomies/options` | `gastronomy/admin/options.ts` | none | - | n/a | Admin read; PermissionEnum-gated (ACCESS_PANEL_ADMIN) |
| `GET /api/v1/admin/gastronomies/{id}/faqs` | `gastronomy/admin/getFaqs.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `POST /api/v1/admin/gastronomies/{id}/faqs` | `gastronomy/admin/addFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `PUT /api/v1/admin/gastronomies/{id}/faqs/{faqId}` | `gastronomy/admin/updateFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `DELETE /api/v1/admin/gastronomies/{id}/faqs/{faqId}` | `gastronomy/admin/removeFaq.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `PATCH /api/v1/admin/gastronomies/{id}/faqs/reorder` | `gastronomy/admin/reorderFaqs.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `POST /api/v1/admin/gastronomies/{id}/assign-owner` | `gastronomy/admin/assignOwner.ts` | none | - | n/a | Admin owner-provisioning; PermissionEnum-gated (COMMERCE_EDIT_ALL) (SPEC-239 T-046) |
| **GASTRONOMY REVIEWS — ADMIN** | | | | | |
| `GET /api/v1/admin/gastronomies/reviews` | `gastronomy/reviews/admin/list.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `GET /api/v1/admin/gastronomies/reviews/{id}` | `gastronomy/reviews/admin/getById.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) |
| `PUT /api/v1/admin/gastronomies/reviews/{id}` | `gastronomy/reviews/admin/update.ts` | none | - | n/a | Admin write; PermissionEnum-gated (COMMERCE_EDIT_ALL) |
| `DELETE /api/v1/admin/gastronomies/reviews/{id}` | `gastronomy/reviews/admin/delete.ts` | none | - | n/a | Admin review removal; PermissionEnum-gated (COMMERCE_MODERATE_REVIEW) |
| `POST /api/v1/admin/gastronomies/reviews/{id}/moderate` | `gastronomy/reviews/admin/moderate.ts` | none | - | n/a | Admin moderation; PermissionEnum-gated (COMMERCE_MODERATE_REVIEW) (SPEC-239 T-046) |
| **COMMERCE LEADS — ADMIN** | | | | | |
| `GET /api/v1/admin/commerce/leads` | `commerce/admin/list-leads.ts` | none | - | n/a | Admin read; PermissionEnum-gated (COMMERCE_VIEW_ALL) (SPEC-239 T-047) |
| `POST /api/v1/admin/commerce/leads/{id}/handle` | `commerce/admin/mark-handled.ts` | none | - | n/a | Admin lead handling + owner-provisioning; PermissionEnum-gated (COMMERCE_EDIT_ALL) (SPEC-239 T-047) |

---

## Reserved — Phantom Gates (Route Pending)

These middleware functions exist in the codebase but the routes they are intended
to protect **have not been built yet**. They are tagged
`// PHANTOM-GATE (SPEC-145): route not built yet, see endpoint-gate-matrix.md`
and are **excepted** from the snapshot guard (T-145-12).

Do NOT delete them and do NOT build the routes without a spec. When a route is
eventually built, move its entry from this section to the main table.

| Gate function | Intended EntitlementKey | Source file | Spec |
|---|---|---|---|
| `gateAlerts` | `price_alerts` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateComparator` | `can_compare_accommodations` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateReviewPhotos` | `can_attach_review_photos` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateSearchHistory` | `can_view_search_history` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateRecommendations` | `can_view_recommendations` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateExclusiveDeals` | `exclusive_deals` | `middlewares/tourist-entitlements.ts` | SPEC-145 T-145-06 |
| `gateCalendarAccess` | `can_use_calendar` | `middlewares/accommodation-entitlements.ts` | SPEC-145 T-145-06 |
| `gateExternalCalendarSync` | `can_sync_external_calendar` | `middlewares/accommodation-entitlements.ts` | SPEC-145 T-145-06 |
| `gateWhatsAppDisplay` | `can_contact_whatsapp_display` | `middlewares/accommodation-entitlements.ts` | SPEC-145 T-145-06 |
| `gateWhatsAppDirect` | `can_contact_whatsapp_direct` | `middlewares/accommodation-entitlements.ts` | SPEC-145 T-145-06 |
| `gateReviewResponse` | `respond_reviews` | `middlewares/accommodation-entitlements.ts` | SPEC-145 T-145-06 |

---

## Reserved — Limit Stubs (Counter Pending)

These `LimitKey` values exist and are referenced by `requireLimit`, but the
`currentCount` implementation is a **hardcoded `0` stub**. They will never
trigger until wired to a real service call.

The snapshot guard excepts them explicitly. When the owning service exists,
update the counter logic and set `Status = wired` in the main table.

| LimitKey | Stub location | Blocking dependency | Spec |
|---|---|---|---|
| `max_properties` | `middlewares/limit-enforcement.ts:620` | Multi-property management service (not yet built) | SPEC-145 T-145-04 |
| `max_staff_accounts` | `middlewares/limit-enforcement.ts:726` | Staff accounts management service (not yet built) | SPEC-145 T-145-04 |

---

## Summary

| Decision | Count | Notes |
|---|---|---|
| `gate` | 11 | All `to-wire` (T-145-03); `PATCH /accommodations/{id}` partially wired (rich-desc + video) |
| `limit` | 5 | 4 `wired` (MAX_ACCOMMODATIONS ×3, MAX_PHOTOS ×2), 1 in `gate+limit` |
| `gate+limit` | 3 | Bookmark create (wired), owner-promotion create (partially wired), accommodation patch (partially wired) |
| `none` | ~320 | Admin PermissionEnum-gated or pure auth-sufficient reads |
| `reserved` | 14 | 12 phantom gates + 2 limit stubs |

### Routes to wire (feeds T-145-03 through T-145-05)

| Route | Gate/Limit | Task |
|---|---|---|
| `PUT /api/v1/protected/accommodations/{id}` | `edit_accommodation_info` | T-145-03 |
| `PATCH /api/v1/protected/accommodations/{id}` | `edit_accommodation_info` (add; video+rich already wired) | T-145-03 |
| `POST /api/v1/protected/accommodations/{id}/faqs` | `edit_accommodation_info` | T-145-03 |
| `PUT /api/v1/protected/accommodations/{id}/faqs/{faqId}` | `edit_accommodation_info` | T-145-03 |
| `GET /api/v1/protected/accommodations/my/favorites-breakdown` | `view_advanced_stats` | T-145-03 |
| `GET /api/v1/protected/accommodations/my/market-comparison` | `view_advanced_stats` | T-145-03 |
| `POST /api/v1/protected/accommodations/{id}/reviews` | `write_reviews` | T-145-03 |
| `POST /api/v1/protected/destinations/{id}/reviews` | `write_reviews` | T-145-03 |
| `POST /api/v1/protected/owner-promotions` | `create_promotions` (entitlement; limit already wired) | T-145-03 |
| `PATCH /api/v1/protected/owner-promotions/{id}` | `create_promotions` | T-145-03 |
| `PUT /api/v1/protected/owner-promotions/{id}` | `create_promotions` | T-145-03 |
| `GET /api/v1/protected/conversations/me/response-rate` | `view_basic_stats` | T-145-03 |
| `GET /api/v1/protected/conversations/me/monthly-inquiries` | `view_basic_stats` | T-145-03 |
