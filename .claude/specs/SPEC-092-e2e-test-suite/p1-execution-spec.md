# P1 Execution Spec — Tolerable-Risk Validation

> **Companion to**: `pre-beta-test-coverage-checklist.md` (full coverage map) and `p0-execution-spec.md` (P0 expansions).
> **Scope**: the 34 P1 items — concrete steps, acceptance criteria, mitigation strategy, and escalation triggers.
> **Created**: 2026-04-27
> **Status**: draft

While P0 items block beta launch, **P1 items are tolerable failures during beta as long as a documented mitigation exists**. This spec captures both: how to validate them when there is time, and what to do operationally if they fail in production with real users.

---

## Differences from P0 spec

P1 items use the **same skeleton** as P0 (Mode, Effort, Preconditions, Steps, Acceptance criteria) **plus two extra fields**:

- **`mitigation`** — what the operator does during beta if this item is broken in prod. Should be runnable without a deploy.
- **`escalation trigger`** — the concrete signal that promotes this P1 to P0 mid-beta and forces a hotfix.

Steps and acceptance criteria are kept **shorter** than in P0 (typically 4-6 steps, 3-5 criteria). Notes/gotchas only when something is genuinely non-obvious.

---

## Item template

```text
### N: title

> **Mode**: owner-manual | auto-runnable-CI | agent-runnable
> **Estimated effort**: time for one execution
> **Source**: checklist item #N

**Preconditions**:
- ...

**Steps**:
1. Action → expected immediate observation
...

**Acceptance criteria**:
- [ ] criterion A
...

**Mitigation if broken in beta**:
- what the operator does manually to unblock affected users

**Escalation trigger** (P1 → P0 if):
- concrete signal that forces a hotfix instead of manual workaround
```

---

## A. Authentication and session (2 P1 items)

### 5: Cross-app session

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min
> **Source**: checklist item #5

**Preconditions**:

- An ADMIN user account that also has access to both the admin panel (port 3000) and the web app (port 4321) in the same browser profile.
- Both apps deployed (or running locally with the same Better Auth backend on the API).
- Awareness of the cookie domain configuration (`.hospeda.com.ar` parent domain vs subdomain-scoped cookies).

**Steps**:

1. Sign in to the admin panel (`/admin` or its subdomain) → session cookie set, dashboard renders.
2. In the same browser, open the web app `/mi-cuenta` → observe whether the user is recognized as logged-in or prompted to sign in again.
3. If recognized in both: sign out from one app → verify the session is invalidated in the other on next request.
4. If NOT recognized: confirm by inspecting cookies in dev tools that the cookie scope is intentional (subdomain-scoped) and document this as the chosen design.
5. Record the observed behaviour in the operations runbook so support knows what to expect.

**Acceptance criteria**:

- [ ] The behavior (shared session vs separate session per app) is intentional and documented.
- [ ] Logout from one app does not silently leave a stale session active in the other app.
- [ ] Cookie `Domain` attribute matches the chosen design (parent domain if shared; per-subdomain if separate).
- [ ] No token leakage between apps (e.g., admin session token not visible to web JS via `document.cookie`).

**Mitigation if broken in beta**:

- If users complain about being logged out unexpectedly across apps, document the behaviour in the FAQ and instruct them to log in separately to each. The beta cohort is small enough that this is tolerable.

**Escalation trigger** (P1 → P0 if):

- Stale session in one app allows a user to bypass logout in the other (security implication).
- Users repeatedly complain that they cannot stay logged in across apps and abandonment increases.

---

### 6: Account deletion / GDPR

> **Mode**: `owner-manual` (manual via admin/email during beta)
> **Estimated effort**: ~15min for a single deletion request walkthrough
> **Source**: checklist item #6

**Preconditions**:

- A test user account with at least one accommodation, one review, and one conversation (SPEC-085) so the deletion path exercises orphan handling.
- Access to the admin panel as an ADMIN with `USER_DELETE` permission (or equivalent).
- The legal page describing how to request deletion (item #91) exists and includes the support email.

**Steps**:

1. As the test user, send a deletion request to the support email defined in `/legal/privacidad`.
2. As ADMIN, locate the user in `/admin/users`.
3. Decide policy outcome for the user's accommodations: cascade-delete, transfer to a placeholder user, or archive in-place. Apply that operation manually via the admin UI.
4. Anonymize the user's reviews (rename author to "Usuario anónimo", strip personal text fields if required).
5. Anonymize conversations (keep messages, rename author, redact email if exposed).
6. Soft-delete or hard-delete the user record per policy. Verify the audit log captures the action with `actorId` and `targetId`.
7. Confirm via API that the user no longer authenticates.
8. Send confirmation email to the requesting user (if their email is still reachable; otherwise document acknowledgment in audit log).

**Acceptance criteria**:

- [ ] Deletion completes within the legal SLA (typically 30 days under GDPR; document the chosen SLA).
- [ ] User cannot authenticate post-deletion.
- [ ] Reviews and conversations remain visible but with anonymized author info.
- [ ] Accommodations were handled per the documented policy (cascade / transfer / archive) without orphan rows.
- [ ] Audit log entry created with `action: USER_DELETED`, `actorId`, `targetUserId`, `metadata: { policy: "..." }`.
- [ ] Legally required data (billing records, invoices) is preserved with justification noted in audit log.

**Mitigation if broken in beta**:

- If automated deletion is not yet wired, the entire flow runs manually via SQL + admin actions per this spec. Document the runbook.
- For each request, generate the data export manually before deletion (item #88) so the user has access to their data.

**Escalation trigger** (P1 → P0 if):

- A regulator complaint forces a documented automated deletion flow.
- A user account leaks PII after deletion (e.g., reviews still show the original name) — this becomes a breach.
- The deletion SLA cannot be met because the manual process takes too long with growing user base.

---

## B. Authorization and permissions (1 P1 item)

### 10: Web app never calls admin endpoints

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~10s in CI (grep pass)
> **Source**: checklist item #10

**Preconditions**:

- `apps/web/src/lib/api/` exists and contains the web API client code.
- CI pipeline can run a grep or lint rule over the web app source tree.

**Steps**:

1. Run `grep -r "/admin/" apps/web/src/` in CI → verify zero matches except the known exception `/api/v1/public/auth/me`.
2. Optionally add a Biome/ESLint custom rule or a pre-commit hook that rejects any new `"/admin/"` string literal introduced in `apps/web/`.
3. Confirm the one documented exception (`/api/v1/public/auth/me`) is present and correctly using the public route prefix.
4. Review the output of the grep against the documented exception list — any unrecognized match fails.

**Acceptance criteria**:

- [ ] No file under `apps/web/src/` contains a literal string `/admin/` other than the documented exception.
- [ ] The grep step runs as a CI check and fails the build on any new violation.
- [ ] The exception for `/api/v1/public/auth/me` is documented in `CLAUDE.md` or `apps/api/docs/route-architecture.md`.

**Mitigation if broken in beta**:

- If a web page accidentally calls an admin endpoint, the API returns 403 to all non-admin users — end users see an error but data is not compromised. Support can acknowledge the display error while the fix is queued.

**Escalation trigger** (P1 → P0 if):

- Any admin endpoint is reachable from the web app WITHOUT the 403 guard (would be a P0 authorization failure), even if only returning empty data.

---

## C. Host onboarding (1 P1 item)

### 16: Unpublish / republish / archive

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #16

**Preconditions**:

- A HOST account with at least one `ACTIVE` accommodation in the web app.
- Awareness of `lifecycleState` transitions: `ACTIVE → INACTIVE → ARCHIVED` (and the reverse for republish).

**Steps**:

1. Sign in as HOST, navigate to `/mi-cuenta/propiedades` → accommodation shows as `ACTIVE`.
2. Click "Unpublish" (or equivalent) → accommodation transitions to `INACTIVE` → public detail page returns 404 or "no disponible" message.
3. Attempt to find the accommodation via `/alojamientos` search → it does not appear in results.
4. Click "Republish" → accommodation returns to `ACTIVE` → public detail page serves the property again within ISR revalidation window.
5. Click "Archive" → accommodation enters `ARCHIVED` state → cannot be republished without admin intervention; public page returns 404.

**Acceptance criteria**:

- [ ] `INACTIVE` property is hidden from all public listing endpoints and search results.
- [ ] `ACTIVE` property becomes public again within the ISR revalidation window after republish (< 60s on staging).
- [ ] `ARCHIVED` property is not accessible from the web app and requires admin action to restore.
- [ ] Each state transition is reflected in the audit log with `actorId` and `lifecycleState` values.

**Mitigation if broken in beta**:

- If a host cannot unpublish via the UI, an admin can manually PATCH the `lifecycleState` field via the admin panel (`/admin/accommodations/[id]`) while the bug is queued.

**Escalation trigger** (P1 → P0 if):

- A host's request to unpublish is ignored and their property remains publicly visible against their will (legal / privacy implication, especially if they have personal information on the listing).

---

## D. Public browsing (3 P1 items)

### 20: Full-text search and by destination

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #20

**Preconditions**:

- Seed data loaded with at least 10 accommodations across multiple destinations and types.
- Search index (materialized view or Postgres full-text) applied via `apply-postgres-extras.sh`.

**Steps**:

1. Navigate to the web app search bar, type a term that matches at least one seed accommodation by name → autocomplete suggestions appear within 500ms.
2. Submit the search → results page loads with correct matches; irrelevant items are absent.
3. Type a term with no matches → "no results" state renders without error.
4. Navigate directly to a destination slug (e.g., `/destinos/concepcion-del-uruguay`) → accommodations filtered to that destination appear in the listing.
5. Combine destination filter with a text search → results are the intersection of both constraints.

**Acceptance criteria**:

- [ ] Autocomplete API responds within 500ms under normal load.
- [ ] Zero-results state is shown with a user-friendly message (not a blank page or 500 error).
- [ ] LIKE wildcard injection characters (`%`, `_`) in the search term do not expand — `safeIlike()` is used in the query path (verified by existing CI grep, spot-checked at runtime here).
- [ ] Destination filter combines correctly with text search without throwing a server error.

**Mitigation if broken in beta**:

- If full-text search is broken, instruct beta users to browse by destination hierarchy as a fallback. Both are distinct navigation paths in the web app.

**Escalation trigger** (P1 → P0 if):

- Search throws unhandled 500 errors in production affecting more than 10% of search requests (would degrade the primary discovery path).

---

### 22: Events by destination and upcoming

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #22

**Preconditions**:

- Seed data includes at least 3 events on future dates linked to existing destinations (SPEC-089 Track B; SPEC-095 FK cleanup applied).
- Destination hierarchy seeded correctly (province → department → city).

**Steps**:

1. Navigate to `/destinos/[slug]/eventos` for a destination that has seeded events → events list renders with date, title, and link.
2. Navigate to the upcoming events page (e.g., `/eventos`) → events sorted chronologically, future dates only.
3. Click an event → detail page renders with location, description, and parent destination breadcrumb.
4. Navigate to a destination with no events → empty state renders without a server error.

**Acceptance criteria**:

- [ ] Events are filtered by `destinationId` FK (post SPEC-095 cleanup) and only `ACTIVE` / not-deleted events appear.
- [ ] Events with past dates do not appear on the "upcoming" page.
- [ ] Empty-destination events page shows a user-friendly "no events" message.
- [ ] Event detail page has correct JSON-LD markup (or is documented as post-beta if not yet implemented).

**Mitigation if broken in beta**:

- If the events pages are broken, add a notice on the destination page pointing users to the admin-maintained social media or manual event listing. Events are supplementary content for beta.

**Escalation trigger** (P1 → P0 if):

- The events listing page throws 500 errors for any destination (not just empty ones) — a systematic API failure affecting a public route.

---

### 23: Blog/Posts

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #23

**Preconditions**:

- Seed data includes at least 3 published blog posts in different categories and linked to at least one destination.

**Steps**:

1. Navigate to the blog listing page → posts render with title, excerpt, category badge, and publication date.
2. Click a post → detail page renders with full content, related posts section, and breadcrumb.
3. Filter by a category that has posts → list narrows correctly; filter by a category with no posts → empty state renders.
4. Navigate to a destination page → associated posts appear in the "related posts" or "articles about this destination" section.

**Acceptance criteria**:

- [ ] Blog listing renders at least the seeded posts without a server error.
- [ ] Detail page includes correct `<title>`, `og:description`, and canonical link (SEO basics).
- [ ] Category and destination filters do not throw 500 errors even for empty result sets.
- [ ] Related posts section does not show posts from unrelated destinations.

**Mitigation if broken in beta**:

- If blog pages are broken, disable the nav link to the blog temporarily and add a "coming soon" placeholder. Blog is supplementary to the core accommodation-search flow.

**Escalation trigger** (P1 → P0 if):

- Blog pages throw server errors that spread to shared layout components and break navigation on accommodation pages.

---

## E. User account (2 P1 items)

### 24: Bookmarks

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #24

**Preconditions**:

- A logged-in test user with no existing bookmarks.
- Seed data with at least one accommodation, one event, and one post.

**Steps**:

1. As the test user, navigate to an accommodation detail page → click the bookmark/heart icon → icon state changes to "active".
2. Navigate to `/mi-cuenta/favoritos` → the bookmarked accommodation appears in the list.
3. Remove the bookmark from the favorites page → item disappears from the list immediately; navigating back to the detail page shows the icon in the inactive state.
4. Add a bookmark in Browser A (same user), then open Browser B (same user, different session) and navigate to `/mi-cuenta/favoritos` → bookmark appears in Browser B on reload.

**Acceptance criteria**:

- [ ] Bookmark add/remove persists to the database (not just UI state).
- [ ] Favorites page lists bookmarks across entity types (accommodations at minimum; events and posts if implemented).
- [ ] Removing a bookmark reflects on the source detail page within the same session.
- [ ] A non-authenticated user attempting to bookmark is redirected to sign-in.

**Mitigation if broken in beta**:

- Bookmark sync across devices failing is tolerable; instruct users that bookmarks may not sync across sessions during beta. The favorite list is user-convenience only and does not affect core flows.

**Escalation trigger** (P1 → P0 if):

- Bookmarking a soft-deleted accommodation causes a foreign-key error or 500 on the favorites page, breaking the entire account page for affected users.

---

### 25: Reviews / comments

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #25

**Preconditions**:

- A logged-in USER who has previously viewed at least one accommodation.
- Admin account with moderation permissions if pre-publication review is enforced.

**Steps**:

1. As the USER, navigate to an accommodation detail page → locate the "Leave a review" section.
2. Submit a rating of 1-5 stars and a comment → form submits without error; review appears as "pending" (or immediately published if moderation is disabled for beta).
3. Submit a rating with an empty comment → validate whether the comment is optional or required; error message appears in Spanish if required.
4. If moderation is enabled: as ADMIN, approve the review → it becomes visible on the detail page.
5. Verify a user cannot submit a second review for the same accommodation without editing or replacing the first.

**Acceptance criteria**:

- [ ] Rating accepts values 1-5 only; values outside range are rejected server-side.
- [ ] Review text (if required) enforces a minimum/maximum length as defined in the Zod schema.
- [ ] After approval (or direct publish), the average rating on the accommodation updates.
- [ ] A user cannot submit duplicate reviews for the same accommodation.

**Mitigation if broken in beta**:

- If the review system is broken, document "reviews coming soon" on the detail page and disable the form UI. Reviews are social proof but do not block accommodation discovery or contact.

**Escalation trigger** (P1 → P0 if):

- A user can submit reviews for accommodations they have never visited, or a malicious user submits reviews that cannot be moderated or removed via the admin panel.

---

## F. Billing (2 P1 items)

### 32: Addon purchase

> **Mode**: `owner-manual`
> **Estimated effort**: ~25min (MP sandbox)
> **Source**: checklist item #32

**Preconditions**:

- A HOST with an active subscription (plan already purchased).
- MP sandbox configured with a test card (APRO scenario).
- At least one addon available (e.g., "Featured listing 30 days") in the billing plans.

**Steps**:

1. As HOST, navigate to `/mi-cuenta/suscripcion` → locate the addons section and click "Buy addon".
2. Select the "Featured listing" addon → MP checkout opens with correct price and description.
3. Complete payment with APRO test card → MP webhook fires; addon entitlement is created with correct `expiresAt` date.
4. Verify the accommodation appears "featured" in the public listing page.
5. Inspect `billing_subscription_addons` table → one row with correct `planId`, `hostId`, and `expiresAt`; no `livemode` or `deletedAt` columns (known schema constraint).

**Acceptance criteria**:

- [ ] Addon entitlement activates within 30 seconds of MP webhook delivery.
- [ ] `expiresAt` is set to today + addon duration (e.g., 30 days) in UTC.
- [ ] The featured badge/placement appears on the public listing within ISR revalidation window.
- [ ] A compensating event `ADDON_PURCHASE_FAILED` is queued if webhook processing fails (verified via Sentry or audit log).

**Mitigation if broken in beta**:

- If addon purchase fails after payment, the admin can manually insert the `billing_subscription_addons` row via the admin panel while the webhook issue is debugged. Document the manual activation runbook.

**Escalation trigger** (P1 → P0 if):

- Payment is collected by MP but the entitlement is never created and no compensating event is logged — money is taken without service delivered, which is a billing integrity failure.

---

### 33: Promo codes

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~40s in CI
> **Source**: checklist item #33

**Preconditions**:

- Seed or fixture data with at least: one valid active promo code, one expired code, and one code that has been fully redeemed.

**Steps**:

1. During checkout (plan selection), enter a valid promo code → discount is reflected in the price preview before submission.
2. Enter an expired promo code → error message "código expirado" (or equivalent) shown; checkout price unchanged.
3. Enter a fully-used promo code → error shown, checkout blocked.
4. Attempt to apply the same valid promo code twice in the same checkout session → second application is rejected or ignored (not double-applied).

**Acceptance criteria**:

- [ ] Valid code applies the correct discount (percentage or fixed amount) to the checkout total.
- [ ] Expired and exhausted codes are rejected with a user-facing error before payment is initiated.
- [ ] Promo code validation is server-side; a client-side bypass does not apply the discount without server confirmation.
- [ ] Admin promo codes page shows correct `active`/`expired` filter state (status filter maps correctly as per memory: `active`/`expired` not internal enum values).

**Mitigation if broken in beta**:

- If promo codes are broken at checkout, the admin can manually honor the discount by applying a one-time price override or issuing a partial refund after payment. Document the support runbook.

**Escalation trigger** (P1 → P0 if):

- A valid promo code can be applied multiple times without limit, allowing discount exploitation (revenue integrity failure).

**Notes / gotchas**:

- The admin promo-codes page had a prior bug where `status` filter was passed as `active`/`expired` on the client but the API expected different values — verify both sides align after any recent admin billing fixes.

---

## G. Admin panel — content moderation (3 P1 items)

### 35: Approve/reject pending accommodation

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #35

**Preconditions**:

- An accommodation in `PENDING` (awaiting moderation) state created by a HOST.
- An ADMIN account with accommodation moderation permissions.
- Transactional email (Resend) configured and working.

**Steps**:

1. As ADMIN, navigate to `/admin/accommodations` → filter by `status=PENDING` → pending accommodation appears.
2. Click into the accommodation → review details; click "Approve" → `lifecycleState` changes to `ACTIVE`.
3. Verify the accommodation appears on the public web listing within ISR revalidation window.
4. Repeat with a different accommodation but click "Reject" with a rejection reason → `lifecycleState` changes to `REJECTED`.
5. Verify the HOST receives an email notification for both approve and reject outcomes.

**Acceptance criteria**:

- [ ] Approved accommodation becomes publicly visible; rejected accommodation does not appear publicly.
- [ ] HOST receives email notification within 2 minutes for each outcome.
- [ ] Audit log entry created: `action: ACCOMMODATION_APPROVED` / `ACCOMMODATION_REJECTED`, `actorId`, `targetId`, `metadata: { reason }`.
- [ ] The pending queue count updates immediately after the moderation action.

**Mitigation if broken in beta**:

- If the approve/reject UI is broken, the admin can PATCH the `lifecycleState` directly via the API (`/api/v1/admin/accommodations/[id]`). Send the host a manual email as the notification fallback.

**Escalation trigger** (P1 → P0 if):

- Rejected accommodations still appear in public search results (any moderation decision that leaks content publicly).

---

### 37: Hard delete

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #37

**Preconditions**:

- A SUPER_ADMIN account (highest privilege level).
- A test accommodation that has been soft-deleted (eligible for hard delete).
- Awareness that hard delete cascades: amenities M2M, bookmarks, reviews, photos must be removed.

**Steps**:

1. As SUPER_ADMIN, navigate to the accommodation in `/admin/accommodations` with `includeDeleted=true` filter → soft-deleted accommodation appears.
2. Click "Hard delete" → a mandatory confirmation dialog appears (with typed name or checkbox); dismiss it → nothing happens.
3. Confirm the deletion → accommodation row is removed from the database.
4. Verify via DB query or admin query that M2M rows (amenities, bookmarks, reviews) are also removed (cascade).
5. Confirm the action appears in the audit log with `action: HARD_DELETE`, `actorId`, and the accommodation ID preserved in `metadata`.

**Acceptance criteria**:

- [ ] Hard delete is only accessible to `SUPER_ADMIN` role (a regular ADMIN cannot perform it).
- [ ] A mandatory confirmation step (dialog with explicit confirmation) is required before executing.
- [ ] All cascading M2M rows are removed atomically within a single DB transaction.
- [ ] The deleted record ID is preserved in the audit log metadata for traceability.

**Mitigation if broken in beta**:

- If hard delete fails (transaction error), the accommodation remains soft-deleted (no data loss). The support team can retry or escalate to a DB query via `pnpm db:studio`.

**Escalation trigger** (P1 → P0 if):

- Hard delete is accessible to non-SUPER_ADMIN accounts (privilege escalation), or a partial delete leaves orphan rows that cause FK violations on subsequent queries.

---

### 38: Batch operations

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #38

**Preconditions**:

- An ADMIN account with `ACCOMMODATION_BULK_ACTION` permission (or equivalent).
- At least 5 accommodations in various states for testing selection.

**Steps**:

1. Navigate to `/admin/accommodations` → select 3 accommodations via checkboxes → bulk action menu appears.
2. Choose "Bulk archive" → confirm dialog → all 3 transition to `ARCHIVED` atomically.
3. Navigate to a fresh set, select 3, choose "Bulk delete" (soft) → all 3 are soft-deleted in one operation.
4. If one record fails mid-batch (simulate by making one record ineligible) → verify the entire batch rolls back, not a partial commit.

**Acceptance criteria**:

- [ ] Batch operation is atomic: all succeed or all fail, no partial commits.
- [ ] After a successful batch, the listing updates immediately to reflect the new states.
- [ ] The audit log records one entry per affected record (not one entry for the entire batch without detail).
- [ ] A non-admin user cannot trigger batch operations via a direct API call (403 check).

**Mitigation if broken in beta**:

- If batch operations fail, the admin can perform the same actions individually on each record. With a small beta cohort, individual moderation is feasible until the batch bug is fixed.

**Escalation trigger** (P1 → P0 if):

- A batch operation commits partially (some records updated, some not) leaving the dataset in an inconsistent state that cannot be identified without a DB audit.

---

## H. Admin panel — user and billing management (2 P1 items)

### 41: Sponsorships and promo codes admin

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #41

**Preconditions**:

- An ADMIN account with sponsorship management permissions.
- The exchange-rate and billing admin pages verified working (items #40, #42).

**Steps**:

1. Navigate to `/admin/billing/sponsorships` → existing sponsorships list renders with correct `active`/`expired` filter.
2. Create a new sponsorship with a level, package, and expiration date → row appears in the list.
3. Navigate to `/admin/billing/promo-codes` → promo codes list renders; verify `status` filter works (active/expired).
4. Create a promo code with a usage limit and expiration → code appears in the list.
5. Edit an existing promo code to reduce the usage limit → change persists on reload.

**Acceptance criteria**:

- [ ] Sponsorships list paginates correctly (uses `page` + `pageSize`, not `limit`).
- [ ] Promo code `status` filter correctly maps to the API's expected values (active/expired mapping verified per admin billing fix history).
- [ ] CRUD operations (create, edit, delete) complete without 400/500 errors.
- [ ] Expired sponsorships appear in the "expired" filter only, not in the "active" list.

**Mitigation if broken in beta**:

- If sponsorship CRUD is broken, sponsorships can be managed temporarily via direct DB access (`pnpm db:studio`). Promo codes can be communicated manually to users if the creation UI fails.

**Escalation trigger** (P1 → P0 if):

- A promo code that is supposed to be expired/disabled is still accepted at checkout (revenue loss).

**Notes / gotchas**:

- Prior admin billing fixes (2026-02-25) changed `limit` to `pageSize` in sponsorship hooks. Verify no regression from more recent changes.

---

### 42: Exchange rates admin

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #42

**Preconditions**:

- An ADMIN account with exchange rate management permissions.
- The exchange rate admin page mounted at `/admin/exchange-rates` (route added during admin billing fix session).
- At least one currency configured (ARS/USD as baseline for Argentine market).

**Steps**:

1. Navigate to `/admin/exchange-rates` → current rates display for ARS, USD, EUR, BRL.
2. Edit the ARS/USD rate → save → refreshed rate persists on page reload.
3. Click "Manual refresh" to fetch rates from the external source → new values populate within 5 seconds.
4. If external source is unavailable (test by temporarily setting an invalid URL): verify the page shows the last known rate with a "last updated" timestamp and does not throw a 500.

**Acceptance criteria**:

- [ ] Exchange rate GET `/config` endpoint returns the current rates without error.
- [ ] Manual edit persists to the database and is reflected in billing calculations.
- [ ] Fallback behavior on external source failure is graceful (last-known rate used, warning displayed).
- [ ] Rate changes are logged in the audit log with `actorId` and old/new values.

**Mitigation if broken in beta**:

- If the exchange rate UI is broken, rates can be manually updated via `pnpm db:studio` targeting the exchange rate config table. Billing calculations will use whatever value is in the DB.

**Escalation trigger** (P1 → P0 if):

- A stale or incorrect exchange rate causes billing amounts to be computed incorrectly and users are charged the wrong amount in ARS (financial impact).

---

## I. Crons and background processes (2 P1 items)

### 44: Conversation cleanup cron (SPEC-085)

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI (with time-mocked DB fixtures)
> **Source**: checklist item #44

**Preconditions**:

- At least one test conversation in `OPEN` state with a `lastMessageAt` timestamp older than the configured inactivity threshold (e.g., 30 days — use a seeded fixture with a backdated timestamp).
- Cron endpoint protected by `HOSPEDA_CRON_SECRET`.

**Steps**:

1. Trigger the conversation cleanup cron via `POST /api/v1/cron/conversation-cleanup` with the correct `HOSPEDA_CRON_SECRET` header → response is 200.
2. Query the conversation table → the backdated-inactive conversation has transitioned to `CLOSED` or `ARCHIVED` state.
3. Verify a `SYSTEM` message is appended to the conversation indicating it was closed by inactivity cron.
4. Verify active (recently-messaged) conversations are NOT affected.

**Acceptance criteria**:

- [ ] Only conversations exceeding the inactivity threshold are closed.
- [ ] A SYSTEM message is written to the conversation timeline on auto-close.
- [ ] The cron is idempotent: running it twice does not double-close or add duplicate SYSTEM messages.
- [ ] Audit log entry created with `action: CONVERSATION_AUTO_CLOSED`, `conversationId`, and trigger metadata.

**Mitigation if broken in beta**:

- If the cleanup cron fails, conversations accumulate in OPEN state indefinitely. An admin can manually close conversations from the admin panel or via PATCH API. With a small beta cohort this is tolerable for a few days.

**Escalation trigger** (P1 → P0 if):

- Conversations with GDPR-sensitive PII are never auto-closed, meaning retention policy cannot be enforced — regulatory risk if this persists beyond 30 days of beta.

---

### 45: Host onboarding reminder cron

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min (verify in staging with real email)
> **Source**: checklist item #45

**Preconditions**:

- At least one USER with an incomplete draft accommodation (autosave record exists, not yet published).
- The user's `createdAt` on the draft is older than the reminder threshold (e.g., 3 days — use a backdated fixture or staging manipulation).
- Resend configured for staging.

**Steps**:

1. Trigger the onboarding reminder cron manually via the cron endpoint with the correct secret.
2. Verify the cron processes the backdated draft and marks it as "reminder sent" (or equivalent flag to prevent re-sending).
3. Check the staging inbox → reminder email received with a direct link back to the draft.
4. Trigger the cron a second time → the already-reminded draft does NOT generate a second email (idempotent).

**Acceptance criteria**:

- [ ] Email sent to the user with the draft incomplete.
- [ ] Reminder is not re-sent on subsequent cron runs for the same draft (de-duplication via flag or timestamp).
- [ ] Users without incomplete drafts do not receive the reminder.
- [ ] The cron runs and completes without unhandled errors even if no eligible users exist.

**Mitigation if broken in beta**:

- If the reminder cron is broken, the support team can manually send reminder emails to users who started registration but did not finish. With a small beta cohort, a weekly manual sweep is feasible.

**Escalation trigger** (P1 → P0 if):

- The cron sends duplicate reminder emails to the same user more than once per day (spam-level repetition that damages user trust and risks Resend sender reputation).

---

## J. Cross-cutting security (1 P1 item)

### 53: Path traversal in uploads

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #53

**Preconditions**:

- A HOST account authenticated with a valid session.
- Photo upload endpoint available (`/api/v1/protected/uploads` or equivalent).

**Steps**:

1. As HOST, submit an upload request with `filename: "../../etc/passwd"` in the multipart body → verify the API rejects or sanitizes the filename before passing to Cloudinary.
2. Submit a filename with a null byte (`"photo\x00.jpg"`) → verify rejection or sanitization.
3. Submit a valid photo with an oversized filename (>255 chars) → verify it is truncated or rejected cleanly, not causing a DB or Cloudinary error.
4. Confirm Cloudinary receives a sanitized public_id with no path segments that could escape the configured folder prefix.

**Acceptance criteria**:

- [ ] Path traversal characters in filenames are stripped or the upload is rejected with a 400 before reaching Cloudinary.
- [ ] Null byte injection does not cause a 500 or expose any server-side path information.
- [ ] Cloudinary public_id is always scoped to the configured folder prefix (e.g., `hospeda/accommodations/[id]/`).
- [ ] No server-side file system path is exposed in any error response.

**Mitigation if broken in beta**:

- Cloudinary itself handles path safety for its storage layer — a traversal in the filename does not directly reach the server filesystem. The risk is limited to potential public_id collisions or folder escaping in Cloudinary's namespace. Monitor Cloudinary usage logs for anomalous folder paths.

**Escalation trigger** (P1 → P0 if):

- A traversal payload causes a Cloudinary upload to succeed outside the designated folder prefix, potentially overwriting another host's media assets.

---

## K. Performance and observability (2 P1 items)

### 55: LCP / Core Web Vitals

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~2min in CI (Lighthouse CI)
> **Source**: checklist item #55

**Preconditions**:

- Web app deployed to staging or a preview URL accessible to Lighthouse.
- Seed data with realistic photos (Cloudinary URLs, not placeholder images).
- Lighthouse CI configured in the pipeline (or run via `@lhci/cli` in CI).

**Steps**:

1. Run Lighthouse against the home page on mobile preset → capture LCP, CLS, FID/INP scores.
2. Run Lighthouse against an accommodation listing page → capture same metrics.
3. Run Lighthouse against an accommodation detail page (with Cloudinary gallery) → capture LCP specifically (gallery image is typically the LCP element).
4. Compare scores against thresholds: LCP < 2.5s, CLS < 0.1, INP < 200ms.

**Acceptance criteria**:

- [ ] Home page LCP < 2.5s on mobile Lighthouse preset (simulated throttling).
- [ ] Accommodation listing LCP < 3s (acceptable P1 threshold; P0 threshold is 2.5s on home).
- [ ] CLS < 0.1 on all three pages (layout shift from image loading or banner appearance).
- [ ] Images use Cloudinary responsive URLs with `srcset` and `sizes` attributes (lazy-load below fold).

**Mitigation if broken in beta**:

- If LCP fails thresholds, identify the largest element (usually a Cloudinary hero image) and add explicit `width`/`height` + `fetchpriority="high"` to the LCP element. This can be done without a full deploy by adjusting the Astro component and redeploying the web app only.

**Escalation trigger** (P1 → P0 if):

- LCP on the home page exceeds 4s on mobile during beta, as measured by real user monitoring (CrUX data from Search Console or Vercel Speed Insights) — at that point it materially affects SEO ranking and user abandonment.

---

### 57: ISR cache hit/miss

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #57

**Preconditions**:

- Web app on Vercel (production or staging) with ISR enabled on accommodation pages.
- An ADMIN account to make a content change.
- Access to Vercel logs or response headers to observe cache status.

**Steps**:

1. Load an accommodation detail page → inspect `X-Vercel-Cache` response header → expect `HIT` after initial build.
2. As ADMIN, edit the accommodation's price or description → save.
3. Reload the public detail page within 5 seconds → may still show `HIT` (cache not yet invalidated).
4. After the ISR revalidation window (configured `revalidate` seconds), reload → page shows updated content; header shows `MISS` or `REVALIDATED`.
5. Subsequent loads return `HIT` with the new content.

**Acceptance criteria**:

- [ ] Updated content appears on the public page within the configured ISR revalidation window (target: < 60s).
- [ ] `X-Vercel-Cache` transitions from `HIT` → `MISS`/`REVALIDATED` → `HIT` as expected.
- [ ] ISR revalidation does not cause a 500 or serve a stale error page during the revalidation request.
- [ ] The configured `revalidate` value is documented in code and matches the operational runbook.

**Mitigation if broken in beta**:

- If ISR fails to revalidate, an admin can manually trigger an on-demand revalidation via Vercel's API or the Astro revalidation endpoint. Document the manual revalidation runbook.

**Escalation trigger** (P1 → P0 if):

- ISR serves permanently stale content (cache never refreshes) after a price change, causing users to see incorrect prices — financial misinformation requiring an immediate hotfix.

---

## L. i18n and SEO (2 P1 items)

### 60: Language switch es/en/pt

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #60

**Preconditions**:

- `@repo/i18n` locale files present for `es`, `en`, and `pt` with at least the navigation and home page keys translated.
- Language switcher component present in the web app layout.

**Steps**:

1. Navigate to the home page as a GUEST → default locale is `es` (Argentine market default).
2. Switch language to `en` → page re-renders or navigates with English labels for nav, headings, and CTAs; URL reflects locale if using path-based i18n.
3. Switch to `pt` → Portuguese labels appear.
4. Navigate to an accommodation listing page in `en` → verify all user-facing strings are translated (not falling back to `es` key names).
5. Switch back to `es` → language preference persists via cookie or URL segment; on the next visit, `es` is loaded by default.

**Acceptance criteria**:

- [ ] All three locales render without missing translation keys (no raw key names visible in the UI).
- [ ] Language preference persists across navigation within the same session.
- [ ] Fallback to `es` occurs if a locale file is missing a specific key (not a 500 error).
- [ ] `hreflang` attributes in `<head>` reference all supported locales for the current page.

**Mitigation if broken in beta**:

- If language switching is broken for `en` or `pt`, the default `es` locale still works correctly for the Argentine target market. Document that `en`/`pt` are partial for beta and add a language-switcher notice.

**Escalation trigger** (P1 → P0 if):

- The default `es` locale throws 500 errors due to a missing i18n key — any locale failure that affects the primary Argentine market audience.

---

### 61: URL routing with locales

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #61

**Preconditions**:

- Astro i18n routing configured (if using path-based locales like `/es/`, `/en/`).
- Sitemap per locale generated or planned.

**Steps**:

1. Navigate to `/es/alojamientos` → accommodation listing renders in Spanish.
2. Navigate to `/en/accommodations` (if path-based slug translation is implemented) → English listing renders; if not implemented, document as post-beta.
3. Inspect `<head>` → `hreflang` tags reference all supported locale variants of the current page.
4. Inspect `<link rel="canonical">` → canonical points to the correct locale URL, not a duplicate.
5. Check that search engine bots (User-Agent: Googlebot) can access locale URLs without redirect loops.

**Acceptance criteria**:

- [ ] Primary Spanish route (`/es/alojamientos` or `/alojamientos` with `es` as default) serves content without error.
- [ ] `hreflang` attributes are present and reference valid alternate locale URLs.
- [ ] Canonical link is unique per page and locale combination.
- [ ] No redirect loop between locale-prefixed and non-prefixed routes.

**Mitigation if broken in beta**:

- If locale routing is misconfigured (e.g., `hreflang` missing), SEO impact is gradual and does not affect immediate user experience. Document the gap for post-beta SEO audit.

**Escalation trigger** (P1 → P0 if):

- A redirect loop causes the home page or listing page to be inaccessible (HTTP 301/302 loop that blocks all users from reaching the site).

---

## N. Edge cases and resilience (2 P1 items)

### 68: Concurrent edit (host edits while admin edits)

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #68

**Preconditions**:

- A HOST account and an ADMIN account both authenticated.
- A published accommodation accessible to both.
- Two browser windows or tabs open simultaneously.

**Steps**:

1. In Window A (HOST), open the accommodation edit form `/mi-cuenta/propiedades/[id]/editar`.
2. In Window B (ADMIN), simultaneously open the admin edit view for the same accommodation.
3. In Window A (HOST), change the price and submit → success.
4. In Window B (ADMIN), change the description (without reloading first) and submit → observe behavior: last-wins, merge conflict error, or stale data warning.
5. Reload both windows → verify the final state in the DB reflects a coherent outcome (not a partially merged corrupt state).

**Acceptance criteria**:

- [ ] The final state in the DB is coherent (no field-level corruption from simultaneous writes).
- [ ] The chosen policy (last-wins or optimistic lock) is implemented consistently and documented.
- [ ] No 500 error is thrown in either window during the concurrent edit scenario.
- [ ] If optimistic locking is used, the second submitter receives a user-friendly conflict message.

**Mitigation if broken in beta**:

- Document the known "last-wins" behavior in the operations runbook. Instruct admins to check if the HOST recently edited before making admin edits. With a small beta cohort, true concurrent edits are rare.

**Escalation trigger** (P1 → P0 if):

- Concurrent edits produce a DB state where required fields are null or FK references are broken (data corruption, not just stale data).

---

### 69: Network failure mid-form

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #69

**Preconditions**:

- A USER in the middle of filling the host onboarding form (`/publicar`) with autosave enabled.
- Browser DevTools with network throttling (or airplane mode simulation).

**Steps**:

1. Fill several sections of the publish form → autosave fires (observe the "Saved" indicator).
2. Disable network (DevTools → Offline or disconnect Wi-Fi) → continue filling the next section.
3. Attempt to autosave → observe the failure feedback (spinner, error toast, or retry indicator).
4. Re-enable network → verify the app retries the autosave automatically or prompts the user to retry.
5. Close and reopen the form → "Continue draft" banner appears with the data saved up to the last successful autosave.

**Acceptance criteria**:

- [ ] A user-facing message appears when autosave fails (not a silent failure).
- [ ] Data entered before the network failure is not lost (up to the last successful autosave point).
- [ ] The app retries the autosave automatically after network recovery without requiring a page refresh.
- [ ] No unhandled JS exception is thrown during the offline period.

**Mitigation if broken in beta**:

- If autosave fails silently, instruct users in the onboarding tooltip to click "Save draft" manually every few minutes. Add a warning banner if autosave is unavailable.

**Escalation trigger** (P1 → P0 if):

- Network failure during autosave causes the draft to be deleted or corrupted, forcing the user to start the entire 8-section form from scratch (high abandonment rate).

---

## O. Accessibility (3 P1 items)

### 71: Full keyboard navigation

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #71

**Preconditions**:

- Web app and admin panel accessible in a desktop browser (Chrome or Firefox).
- No mouse use during this test.

**Steps**:

1. Open the web app home page → press Tab repeatedly → verify focus moves through all interactive elements (nav links, search, CTA buttons) in logical DOM order with a visible focus ring.
2. Open a modal or dropdown → press Escape → modal closes and focus returns to the trigger element.
3. Navigate the accommodation listing → Tab to a card → Enter activates the link to the detail page.
4. Open the admin panel → Tab through the sidebar navigation and table rows → verify no focus traps outside modals.

**Acceptance criteria**:

- [ ] All interactive elements receive focus via Tab in logical order.
- [ ] Focus ring is visible on all focused elements (no `outline: none` without an equivalent visible indicator).
- [ ] Escape closes any open modal and returns focus to the trigger.
- [ ] No "focus trap" outside of intentional modal contexts.

**Mitigation if broken in beta**:

- Document known keyboard navigation gaps in a public accessibility statement. Prioritize fixes for the most-used flows (search, accommodation detail, contact host form).

**Escalation trigger** (P1 → P0 if):

- A keyboard-only user cannot complete the core flow (sign up → browse → contact host) at all — which would constitute a WCAG 2.1 Level A failure (not just AA) and could attract accessibility complaints.

---

### 73: Color contrast

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~60s in CI (axe-core via Playwright)
> **Source**: checklist item #73

**Preconditions**:

- Playwright + axe-core configured in `apps/e2e` or `apps/web` test suite.
- Web app running with seed data so real content is rendered (not empty pages).

**Steps**:

1. Run `axe-core` scan on the home page → collect contrast violations.
2. Run `axe-core` scan on the accommodation listing page (filters visible, cards rendered).
3. Run `axe-core` scan on the accommodation detail page (gallery, price, CTA button visible).
4. For each violation found: manually verify hover state and disabled state (often missed by automated scanners).

**Acceptance criteria**:

- [ ] Zero `color-contrast` violations reported by axe-core on the three pages above at the WCAG AA level (4.5:1 for normal text, 3:1 for large text/UI).
- [ ] Hover and focus states maintain the same contrast ratio as the default state.
- [ ] Disabled form inputs meet at least 3:1 contrast (note: WCAG 2.1 exempts some disabled elements — document the policy).

**Mitigation if broken in beta**:

- Add contrast violations to a known-issues list in the accessibility statement. For critical CTAs (e.g., "Contact host" button), fix contrast immediately as these directly affect the core flow.

**Escalation trigger** (P1 → P0 if):

- A regulatory accessibility complaint is filed citing specific contrast failures (WCAG non-compliance formal complaint).

---

### 74: Accessible forms

> **Mode**: `owner-manual`
> **Estimated effort**: ~25min
> **Source**: checklist item #74

**Preconditions**:

- Web app with the contact host form (SPEC-085), host onboarding form, and sign-in form accessible.
- Browser with DevTools accessibility panel (Chrome or Firefox).

**Steps**:

1. Open the sign-in form → inspect each input with DevTools accessibility panel → verify each has an associated `<label>` (not just placeholder text).
2. Submit the sign-in form empty → error messages appear → verify errors are linked via `aria-describedby` to their respective inputs.
3. Open the host onboarding form → verify required fields have `aria-required="true"` and the required indicator is not only color (also text or asterisk with legend).
4. Verify that validation errors are not indicated by color alone (also include an icon or text alongside the red border).

**Acceptance criteria**:

- [ ] Every form input has a programmatically associated `<label>` (using `for`/`id` or `aria-labelledby`).
- [ ] Inline validation errors are linked to their inputs via `aria-describedby`.
- [ ] Required fields are indicated with `aria-required="true"` and a non-color indicator.
- [ ] Validation errors are not communicated by color alone.

**Mitigation if broken in beta**:

- Add `aria-label` attributes to inputs missing labels as a quick patch deployable without a full release. Document the remaining gaps in an accessibility statement.

**Escalation trigger** (P1 → P0 if):

- A formal accessibility complaint is received citing form inaccessibility, or a screen reader user reports they cannot complete the sign-in or contact form.

---

## P. Browser and device matrix (1 P1 item)

### 78: Desktop Chrome/Firefox/Safari

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min (10min per browser)
> **Source**: checklist item #78

**Preconditions**:

- Access to Chrome (latest), Firefox (latest), and Safari (macOS, latest).
- Admin panel running on staging or preview URL.
- An ADMIN account with access to tables, moderation, and billing pages.

**Steps**:

1. In each browser: log in to the admin panel → verify the main dashboard renders without visual breakage (tables, sidebar, charts).
2. Open the accommodations list with filters and pagination → verify the table layout is correct (no overflowing columns, pagination controls work).
3. Open a modal (e.g., confirmation dialog for moderation) → verify it is centered, scrollable if tall, and closable with both Escape and the X button.
4. In Safari specifically: check for CSS Grid or `gap` layout issues in the admin tables and side panels (Safari historically lags on CSS features).

**Acceptance criteria**:

- [ ] Admin panel renders without layout breakage in Chrome, Firefox, and Safari.
- [ ] Modals are functional (open, close, confirm) in all three browsers.
- [ ] Table pagination and filtering work without JavaScript errors in all three browsers.
- [ ] Safari-specific CSS issues are documented if found; critical layout failures are fixed, cosmetic issues deferred.

**Mitigation if broken in beta**:

- If Safari breaks the admin panel, instruct the beta admin team to use Chrome or Firefox. Safari admin support can be deferred to post-beta since the admin audience is small and controllable.

**Escalation trigger** (P1 → P0 if):

- A key admin workflow (moderation, billing actions) is completely non-functional in Chrome or Firefox (not just Safari) — blocking the operator's ability to run the platform.

---

## Q. Operations, deploy and configuration (1 P1 item)

### 86: Structured logs and correct level

> **Mode**: `agent-runnable`
> **Estimated effort**: ~15min
> **Source**: checklist item #86

**Preconditions**:

- API running on staging with at least a few requests processed.
- Access to Vercel function logs or a local log file from the API process.
- `@repo/logger` is the configured logger for all API output.

**Steps**:

1. Make 5 requests to the API (mix of public and protected endpoints) → capture the structured log output.
2. Inspect each log line: verify JSON format with `timestamp`, `level`, `requestId`, `userId` (where applicable), and `message` fields.
3. Run `grep -r "console.log" apps/api/src/` → verify zero matches (no stray console.log in committed code).
4. Trigger a known error (e.g., request a non-existent resource) → verify the error is logged at `error` level with stack trace, not at `info` level.
5. Verify no log line contains an email address, JWT token, or password field value.

**Acceptance criteria**:

- [ ] All log lines are valid JSON with the required fields from `@repo/logger`.
- [ ] Zero `console.log` calls in `apps/api/src/` (CI grep enforced).
- [ ] Error-level events include stack traces and are distinguishable from info-level events.
- [ ] No PII (email, token, password) appears in any log output captured during the test.

**Mitigation if broken in beta**:

- If stray `console.log` calls are present, they produce non-JSON output mixed into the log stream. This degrades log parsing but does not break functionality. Queue a cleanup PR.

**Escalation trigger** (P1 → P0 if):

- A log line exposes a user's password, session token, or payment credentials (immediate security incident requiring log scrubbing and secret rotation).

---

## R. Audit, compliance and privacy (3 P1 items)

### 87: Audit log completeness

> **Mode**: `agent-runnable`
> **Estimated effort**: ~30min
> **Source**: checklist item #87

**Preconditions**:

- A staging environment where the following actions can be triggered: billing refund, role change (HOST → USER), hard-delete, plan change, addon revocation, manual conversation close.
- Access to the audit log table via admin panel or DB query.

**Steps**:

1. Trigger each sensitive action once: issue a billing refund, change a user's role, hard-delete a record, change a subscription plan, revoke an addon, manually close a conversation.
2. Query the audit log table for entries corresponding to each action → verify each has `action`, `actorId`, `targetId`, `createdAt`, and `metadata` fields.
3. Attempt to delete or update an audit log row directly via the API → verify it returns 403 or 405 (immutability check).
4. Navigate to `/admin/audit-log` → verify the log is queryable by `action`, `actorId`, and date range.

**Acceptance criteria**:

- [ ] All six sensitive action types produce an audit log entry.
- [ ] Each entry contains `action`, `actorId`, `targetId`, `createdAt`, and a non-empty `metadata` object.
- [ ] Audit log entries cannot be modified or deleted via the API (immutability).
- [ ] The admin panel exposes a queryable audit log UI.

**Mitigation if broken in beta**:

- If audit logging is missing for some actions, manually document those actions in a spreadsheet during beta as a temporary compliance record. Add the missing `auditLog.create()` calls in the next sprint.

**Escalation trigger** (P1 → P0 if):

- A regulatory audit is requested and the audit log cannot demonstrate a complete chain of custody for billing or PII changes — compliance failure.

---

### 88: GDPR — right of access

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min per request
> **Source**: checklist item #88

**Preconditions**:

- A test user account with data across multiple tables: account info, at least one accommodation or bookmark, at least one review, at least one conversation, at least one billing record.
- A documented process for handling data access requests (even if manual for beta).

**Steps**:

1. Simulate a user submitting a data access request via the support email defined in `/legal/privacidad`.
2. As ADMIN/operator: query all tables containing the user's data (`users`, `accommodations`, `reviews`, `conversations`, `billing_customers`, `billing_subscriptions`).
3. Compile the data into a JSON or CSV export that the user can receive.
4. Send the export to the requesting user within the defined SLA (document the SLA — suggested: 30 days max under GDPR/LGPD).
5. Log the request and response in the audit log: `action: GDPR_DATA_ACCESS_REQUEST`, `actorId: admin`, `targetUserId`, `metadata: { deliveredAt }`.

**Acceptance criteria**:

- [ ] A documented process exists (even if manual during beta) for handling data access requests.
- [ ] All tables containing user data are identified and included in the export.
- [ ] The export is delivered within the documented SLA.
- [ ] The request and delivery are recorded in the audit log.

**Mitigation if broken in beta**:

- The entire flow is manual during beta — this IS the mitigation. Document the runbook with table list and query templates so any operator can execute it consistently.

**Escalation trigger** (P1 → P0 if):

- A formal GDPR/LGPD complaint is filed with the relevant authority (Argentine AAIP or EU DPA) requiring a certified automated process — at that point, automation becomes legally mandated.

---

### 89: GDPR — right to be forgotten

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min per deletion
> **Source**: checklist item #89

**Preconditions**:

- A test user account with content (review, conversation, accommodation) to exercise the deletion policy.
- Documented policy for each content type: cascade-delete, transfer, or archive for accommodations; anonymize for reviews and conversations.

**Steps**:

1. Receive deletion request (simulate via support email → `/legal/privacidad` contact).
2. As ADMIN, navigate to `/admin/users/[id]` → initiate account deletion workflow.
3. For the user's reviews: rename author to "Usuario anónimo" and strip any name/email text from the review body.
4. For the user's conversations: keep message content, anonymize author fields in both `conversations` and `messages` tables.
5. For the user's accommodation: apply documented policy (archive or transfer to a placeholder owner).
6. Soft-delete or hard-delete the user account; verify subsequent login attempt returns 401/404.
7. Confirm that legally required billing records remain (with a note in `metadata` justifying retention under LGPD Art. 16).

**Acceptance criteria**:

- [ ] User cannot authenticate post-deletion.
- [ ] Reviews display "Usuario anónimo" as author; no personal fields remain.
- [ ] Conversation messages are preserved but author identity fields are anonymized.
- [ ] Billing records are retained with documented legal basis.
- [ ] Audit log entry: `action: USER_DELETED`, `actorId`, `targetUserId`, `metadata: { policy, retainedFor }`.

**Mitigation if broken in beta**:

- This entire flow is manual during beta. The runbook IS the mitigation. For each step that cannot be performed via UI, use `pnpm db:studio` with the documented query templates.

**Escalation trigger** (P1 → P0 if):

- After deletion, the user's personal data (name, email) is still visible in reviews or conversation threads visible to other users — a data breach under LGPD/GDPR.

---

## S. Seed data and integrity (1 P1 item)

### 94: Seed data makes visual sense

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #94

**Preconditions**:

- `pnpm db:fresh-dev` completed successfully (item #93 passed).
- Web app running locally or on a preview URL with the seeded database.
- At least 10 accommodations seeded with Cloudinary photo URLs, realistic descriptions in Spanish, and prices in ARS.

**Steps**:

1. Open the home page as a GUEST → verify featured accommodations show realistic names, valid photo thumbnails (no broken image icons), and coherent prices (not 0 or extreme outliers).
2. Navigate to `/alojamientos` → browse several cards → verify descriptions are in Spanish, prices are in a realistic ARS range, accommodation types are varied.
3. Navigate to `/destinos/[slug]` → verify the destination has associated content (events and accommodations seeded, not empty).
4. Open 2-3 accommodation detail pages → verify gallery images load from Cloudinary (not placeholder URLs), amenities are listed coherently, and the description reads as natural text (not lorem ipsum).
5. Check that at least one seeded event has a future date (post 2026-04-27) — events with past dates would make the "upcoming events" page appear empty.

**Acceptance criteria**:

- [ ] No broken image icons on any seeded accommodation card or detail page.
- [ ] Prices are within a realistic ARS range for the accommodation type (e.g., cabin: 50,000–300,000 ARS/night range).
- [ ] Descriptions are in Spanish and read as natural human-written text (no lorem ipsum, no English placeholder text).
- [ ] At least 3 seeded events have `startDate` in the future relative to beta launch date.
- [ ] The home page presents a coherent first impression — a visiting beta host should not think the platform looks unfinished.

**Mitigation if broken in beta**:

- If seed data looks poor (broken photos, lorem ipsum): update the seed JSON files in `packages/seed/src/data/` and re-run `pnpm db:fresh-dev`. Seed data quality is entirely controlled by the operator and can be fixed without a code change.

**Escalation trigger** (P1 → P0 if):

- Broken images or placeholder text appear on the public-facing home page when a real beta user visits (direct reputational damage before the product has a chance to prove itself).
