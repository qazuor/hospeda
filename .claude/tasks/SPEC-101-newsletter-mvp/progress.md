# SPEC-101: Newsletter MVP — Task Progress Dashboard

**Spec status:** draft (pending implementation)
**Created:** 2026-05-11
**Total tasks:** 54
**Completed:** 0 / 54

---

## Summary by Phase

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 0: Cleanup | 3 | 0 | pending |
| Phase 1: Foundation | 17 | 0 | pending |
| Phase 2: Subscription flow | 10 | 0 | pending |
| Phase 3: Admin UI | 16 | 0 | pending |
| Phase 4: Dispatch engine | 5 | 0 | pending |
| Phase 5: Polish | 3 | 0 | pending |

---

## Complexity Histogram

| Complexity | Count | Tasks |
|------------|-------|-------|
| 1 | 9 | T-101-01, T-101-09, T-101-11, T-101-18 (partial), T-101-31, T-101-36, T-101-42, T-101-43, T-101-54 |
| 2 | 19 | T-101-02, T-101-03, T-101-04, T-101-05, T-101-18, T-101-19, T-101-20, T-101-21, T-101-22, T-101-23, T-101-24, T-101-26, T-101-27, T-101-32, T-101-33, T-101-35, T-101-37, T-101-41, T-101-45 |
| 3 | 17 | T-101-06, T-101-07, T-101-08, T-101-10, T-101-13, T-101-15, T-101-17, T-101-22, T-101-25 (partial), T-101-28, T-101-29, T-101-34, T-101-38, T-101-44, T-101-47, T-101-48 (partial), T-101-52, T-101-53 |
| 4 | 5 | T-101-12, T-101-14, T-101-16, T-101-25, T-101-40 |

No task exceeds complexity 4 (max per project rules).

---

## Phase 0: Cleanup (3 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-01 | Verify chore/vps-migration merged + audit prerequisites | infra | 1 | pending | — |
| T-101-02 | Fix buggy /me/newsletter/toggle endpoint | api | 2 | pending | — |
| T-101-03 | Create manual SQL for legacy opt-in migration (0029) | migration | 2 | pending | T-101-07 |

**Note:** T-101-01 is a hard blocker for Phase 1. T-101-02 is independent and can run in parallel.

---

## Phase 1: Foundation (17 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-04 | Create Drizzle schema: newsletter_subscribers | db | 2 | pending | T-101-01 |
| T-101-05 | Create Drizzle schema: newsletter_campaigns | db | 2 | pending | T-101-01 |
| T-101-06 | Create Drizzle schema: newsletter_campaign_deliveries + manual SQL | db/migration | 3 | pending | T-101-04, T-101-05 |
| T-101-07 | Run db:push + write DB integration tests | db/test | 3 | pending | T-101-04, T-101-05, T-101-06 |
| T-101-08 | Create Zod schemas for all 3 newsletter entities | schema | 3 | pending | T-101-04, T-101-05, T-101-06 |
| T-101-09 | Add NEWSLETTER permissions to PermissionEnum + seed | permissions | 2 | pending | T-101-07, T-101-08 |
| T-101-10 | Implement HMAC token helpers (verify + unsubscribe) | service | 3 | pending | T-101-08 |
| T-101-11 | Add NotificationCategory.NEWSLETTER + types | notifications | 2 | pending | T-101-08 |
| T-101-12 | Implement NewsletterSubscriberService | service | 4 | pending | T-101-09, T-101-10, T-101-11 |
| T-101-13 | Create newsletter email templates (verify, welcome, campaign) | notifications | 3 | pending | T-101-11 |
| T-101-14 | Implement NewsletterCampaignService | service | 4 | pending | T-101-09, T-101-12 |
| T-101-15 | Move tiptap-renderer to @repo/utils + create email-safe transformer | service | 3 | pending | T-101-08 |
| T-101-16 | Implement NewsletterDeliveryService + brevo-batch.ts | service | 4 | pending | T-101-15, T-101-14 |
| T-101-17 | Implement NewsletterTrackingService (Brevo webhook processor) | service | 3 | pending | T-101-16 |
| T-101-18 | Register env vars for newsletter in @repo/config | infra | 2 | pending | T-101-01 |
| T-101-19 | Add i18n keys for all subscription flow surfaces | i18n | 2 | pending | T-101-18 |

**Parallel tracks within Phase 1:**
- T-101-04 + T-101-05 can start together after T-101-01.
- T-101-10, T-101-11, T-101-15 can start in parallel after T-101-08.
- T-101-18 + T-101-19 are independent of the service chain.

---

## Phase 2: Subscription flow (10 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-20 | Protected API: POST /subscribe + GET /status | api | 3 | pending | T-101-12, T-101-10, T-101-18 |
| T-101-21 | Protected API: POST /resend-verification + DELETE /unsubscribe | api | 2 | pending | T-101-20 |
| T-101-22 | Public API: GET /verify (token + redirect) | api | 2 | pending | T-101-20 |
| T-101-23 | Public API: GET /unsubscribe (stable token, no auth) | api | 2 | pending | T-101-22 |
| T-101-24 | WhatsAppCTA component (env-gated, reusable) | web-ui | 2 | pending | T-101-19 |
| T-101-25 | NewsletterForm.client.tsx React island + AuthRequiredPopover | web-ui | 4 | pending | T-101-20, T-101-19 |
| T-101-33 | Wire NewsletterForm island into footer | web-ui | 2 | pending | T-101-25 |
| T-101-34 | Account preferences newsletter page | web-ui | 3 | pending | T-101-21, T-101-24, T-101-19 |
| T-101-35 | Web verification success page (/newsletter/confirmado/) | web-ui | 2 | pending | T-101-22, T-101-24, T-101-19 |
| T-101-36 | Web unsubscribe confirmation page (/newsletter/desuscripto/) | web-ui | 1 | pending | T-101-23, T-101-19 |
| T-101-37 | Web verification error page (/newsletter/error/) | web-ui | 2 | pending | T-101-22, T-101-19 |

---

## Phase 3: Admin UI (16 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-26 | Admin API: subscriber list + stats | api | 3 | pending | T-101-14, T-101-09 |
| T-101-27 | Admin API: campaign CRUD (list, create, get, update, delete) | api | 3 | pending | T-101-14 |
| T-101-28 | Admin API: test-send, send, cancel, metrics, errors | api | 3 | pending | T-101-27 |
| T-101-29 | Install TipTap extensions + create RichTextEditor component | admin-ui | 3 | pending | T-101-15 |
| T-101-30 | TanStack Query hooks for newsletter admin | admin-ui | 2 | pending | T-101-26, T-101-27, T-101-28 |
| T-101-31 | Add i18n keys for admin newsletter UI | i18n | 1 | pending | T-101-19 |
| T-101-32 | Brevo webhook endpoint (POST /public/webhooks/brevo) | webhook | 2 | pending | T-101-17 |
| T-101-38 | Admin subscribers list page | admin-ui | 3 | pending | T-101-26, T-101-30, T-101-31 |
| T-101-39 | Admin campaigns list page | admin-ui | 2 | pending | T-101-27, T-101-30, T-101-31 |
| T-101-40 | Admin campaign editor page (new + edit) | admin-ui | 4 | pending | T-101-28, T-101-29, T-101-30, T-101-31 |
| T-101-41 | Campaign metrics panel (with auto-refresh polling) | admin-ui | 2 | pending | T-101-28, T-101-30 |
| T-101-42 | Add beforeLoad permission guards for all admin newsletter routes | admin-ui | 1 | pending | T-101-38, T-101-39, T-101-40 |
| T-101-43 | PHASE GATE: pnpm typecheck && lint && test (phases 0-3) | test | 1 | pending | T-101-03, T-101-19, T-101-25, T-101-32, T-101-34–T-101-42 |

---

## Phase 4: Dispatch engine (5 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-44 | Add bullmq + create BullMQ newsletter dispatch worker | worker | 3 | pending | T-101-16, T-101-43 |
| T-101-45 | Integrate worker startup + graceful shutdown into apps/api | infra | 2 | pending | T-101-44 |
| T-101-46 | Connect RetryService to Redis (remove redis=null) | service | 1 | pending | T-101-45 |
| T-101-47 | Implement close-campaigns cron job (*/5 * * * *) | worker | 2 | pending | T-101-14, T-101-45 |
| T-101-48 | PHASE GATE: dispatch integration tests | test | 2 | pending | T-101-46, T-101-47, T-101-32 |

---

## Phase 5: Polish (3 tasks)

| ID | Title | Layer | Complexity | Status | Depends On |
|----|-------|-------|------------|--------|-----------|
| T-101-52 | E2E tests: subscribe flow + verify flow (Playwright) | test | 3 | pending | T-101-48 |
| T-101-53 | E2E tests: admin send campaign flow (Playwright) | test | 3 | pending | T-101-48 |
| T-101-54 | ADR: newsletter dispatch architecture (BullMQ + Brevo batch) | docs | 1 | pending | T-101-48 |

---

## Critical Path (27 tasks, ~26 complexity units)

```
T-101-01 → T-101-04 → T-101-06 → T-101-07 → T-101-08 → T-101-09
         → T-101-10 → T-101-12 → T-101-14 → T-101-15 → T-101-16
         → T-101-20 → T-101-25 → T-101-26 → T-101-27 → T-101-28
         → T-101-29 → T-101-30 → T-101-40 → T-101-43 → T-101-44
         → T-101-45 → T-101-48 → T-101-52
```

Tasks on the critical path should be prioritized. All other tasks have float.

---

## Open Items / Notes

- **T-101-01 is a hard blocker.** If chore/vps-migration is not merged, no Phase 1 work can start.
- **T-101-02** (bug fix) is independent of the critical path and can be done on day 1 in parallel.
- **T-101-03** (migration SQL) depends on T-101-07 because the newsletter_subscribers table must exist first.
- **TipTap (@tiptap/react, @tiptap/starter-kit):** T-101-29 must confirm these are already installed before adding extensions. If missing, the complexity jumps to 4 and may need a split.
- **Brevo webhook header name:** tech-analysis notes Brevo may have renamed X-Sib-Webhook-Token in past releases. Verify against current Brevo docs before implementing T-101-32.
- **Brevo messageVersions field name:** verify against Brevo v3 API before implementing T-101-16 brevo-batch.ts.
- **ADR number:** check existing docs/decisions/ to confirm ADR-021 is available before writing T-101-54.
- **T-101-03 note:** the migration SQL file is numbered 0029 — verify 0027 and 0028 are not already taken in packages/db/src/migrations/manual/.
