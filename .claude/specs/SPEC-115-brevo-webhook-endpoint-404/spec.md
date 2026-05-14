---
spec-id: SPEC-115
title: Brevo Webhook Endpoint Returns 404 — Configure or Implement
type: fix
complexity: low
status: in-progress
created: 2026-05-14T08:30:00Z
effort_estimate_hours: 1-3
tags: [webhooks, brevo, api, newsletter, investigation]
extracted_from: SPEC-110 Phase 1 prod log inspection
priority: medium
---

# SPEC-115: Brevo Webhook Endpoint Returns 404

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Resolve repeated `404 Not Found` responses on `POST /api/v1/public/webhooks/brevo` in production. Either implement the endpoint (if we need to consume Brevo webhooks) or stop Brevo from sending them (if we don't).

**Why now:** Discovered during SPEC-110 Phase 1 prod log inspection (2026-05-14). Brevo is hitting:

```
POST /api/v1/public/webhooks/brevo 404 37ms
POST /api/v1/public/webhooks/brevo 429 14ms  ← rate-limited after 404 storm
```

So the same incoming request stream triggers two distinct issues:
1. Endpoint does not exist (404).
2. The retry storm fills the `webhook` bucket (`rl:webhook:<ip>`) and gets 429'd.

**Audience:** Solo developer (qazuor). Small investigation + decision.

---

### 2. Out of Scope

- Building a comprehensive Brevo event-processing pipeline. This spec only resolves the 404; if we DO need to process events, capture that as a separate spec.
- Changing the rate-limit policy for legitimate webhook endpoints (SPEC-110 territory).

---

### 3. Investigation Approach

#### Phase 0 — Determine intent

- Check `apps/api/src/routes/webhooks/brevo.ts` and surrounding files. The file exists in the codebase (per `grep` from SPEC-110 Phase 0 file map), so it was likely partially implemented or registered without a corresponding route mount.
- Verify route registration in `apps/api/src/routes/index.ts` (or wherever public webhooks are mounted).
- Check Brevo dashboard configuration to see WHICH events are being sent and to which URL pattern.

#### Phase 1 — Decide

Four mutually exclusive resolutions:

- **(a) Implement the endpoint.** If Brevo events feed something we care about (delivery status for transactional emails, unsubscribe events, bounce handling).
- **(b) Unregister the webhook in Brevo.** If we don't need the events. Removes the 404 storm at the source.
- **(c) Fix the URL mismatch.** If Brevo is configured to hit a path that exists under a different prefix (e.g. `/api/v1/webhooks/brevo` without `/public/`).
- **(d) Return 200 + drop.** If we want to keep the URL "alive" without acting on payloads (cheap; avoids retry storms even if we don't process events).

#### Phase 2 — Implement chosen path

Each option has very different scope:

- (a) needs event payload parsing, signature verification, idempotency, persistence.
- (b) is a 30-second change in the Brevo dashboard.
- (c) is a one-line route remount.
- (d) is an empty route returning `204`.

---

### 4. Tasks (expand after Phase 1)

| Task | Title | Status |
|---|---|---|
| T-115-01 | Phase 0: inspect `webhooks/brevo.ts` + route registration + Brevo dashboard config | pending |
| T-115-02 | Phase 1: decide between (a)/(b)/(c)/(d) | pending, blocked by T-115-01 |
| T-115-03 | Phase 2: implement chosen path | pending, blocked by T-115-02 |
| T-115-04 | Validation: confirm 404s stop in prod logs over 24h | pending, blocked by T-115-03 |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Option (a) selected but signature verification omitted | If implementing, validate Brevo's webhook signature (`X-Mailin-Custom` or whatever they emit currently); the docs page in Brevo dashboard has the spec. |
| Option (b) selected but the webhook turns out to be load-bearing for some flow we forgot about | Inspect what events Brevo is sending first (Phase 0) before disabling. |
| Retry storm from Brevo persists even after fix due to caching at their end | Most webhook services back off automatically once 200s start returning. If not, manual reset via dashboard. |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] The chosen resolution path is implemented and deployed.
- [ ] Production logs show zero `POST /api/v1/public/webhooks/brevo` 404 responses over a 24-hour observation period.
- [ ] The `rl:webhook:*` bucket no longer accumulates 429s attributable to Brevo retries.
- [ ] Decision rationale is documented either in the implementation PR or in `docs/integrations/brevo.md`.

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-110 Phase 1 prod log inspection (2026-05-14, ~08:30 UTC). The 404 + 429 pattern appeared alongside the loopback healthcheck investigation but is unrelated to the rate-limit bug itself.

### Sequencing

Independent of SPEC-110. Can ship anytime. If option (b) is chosen, it can happen entirely in the Brevo dashboard with no code change.

### Related

- `apps/api/src/routes/webhooks/brevo.ts` (exists per SPEC-110 file map)
- Newsletter MVP SPEC-101 / SPEC-108 (Brevo is the newsletter provider)
- `packages/notifications` (uses Brevo for transactional email)

---

## Part 3 — Phase 0/1 Findings & Decision (2026-05-14)

### Findings

**The handler was implemented but the auth mechanism was wrong.**

`apps/api/src/routes/webhooks/brevo.ts:1-249` ships a complete handler — signature verification with `timingSafeEqual`, event normalisation, whitelist filtering, dispatch to `NewsletterTrackingService.processBrevoWebhookEvent`. The route is correctly mounted at `app.route('/api/v1/public/webhooks', brevoWebhookRoutes)` + `.post('/brevo', …)` = `POST /api/v1/public/webhooks/brevo`.

Two separate problems were producing the 404 + signature-mismatch storm:

1. **Production `main` branch did not yet contain commit `b298fc618`** (SPEC-101 T-101-32, 2026-05-12). The route was on `staging` only. Hits against `api.hospeda.com.ar` returned 404 with the standard NOT_FOUND wrapper. **Resolution path**: this self-corrects on the next staging→main promotion.

2. **Staging-api accepted the request but rejected with 401 `invalid_signature`.** Confirmed in the live deploy via `curl -X POST https://staging-api.hospeda.com.ar/api/v1/public/webhooks/brevo` returning `401 {"error":"invalid_signature"}`. Brevo's webhook dashboard for the staging environment shows 45 historical failures (pre-deploy 404s; post-deploy these became 401s once the route loaded).

The api logger was collapsing the warn context to `[Object]`, so the original investigation could not tell whether the header was present. After fixing the logger (separate chore branch `chore/logger-no-object-collapse`, merged 2026-05-14), the warn context surfaced `hasHeader: false` — Brevo was NOT sending the `X-Sib-Webhook-Token` header at all.

### Root cause (now confirmed)

The handler verifies `X-Sib-Webhook-Token`, which is a **Sendinblue-era** header name. Brevo deprecated it in the rebrand. Brevo's current outgoing webhook deliveries carry **no authentication by default**. Auth must be opted into explicitly at webhook creation via the Brevo API — none of these options are exposed in the dashboard UI. The three supported mechanisms are:

- Basic auth embedded in the URL: `"url": "https://user:pass@host/path"`.
- Bearer token: `"auth": {"type": "bearer", "token": "..."}` → arrives as `Authorization: Bearer <token>`.
- Custom headers: `"headers": [{"key": "...", "value": "..."}]`.

The fact that none of these are visible in the dashboard means the webhook is at risk of having its auth wiped any time the URL or events list is edited via the UI.

### Decision: option C — secret in URL path

Chosen because it is **robust to dashboard UI edits**. The webhook configuration in the Brevo dashboard ends at "URL + events"; both are routine edits, and either can be performed without an API call. By moving the secret into the URL path, the credential travels with the URL and cannot be wiped by an unrelated dashboard change.

Trade-off accepted: the secret appears in upstream proxy access logs (Cloudflare, Traefik). Mitigated by generating a long random secret (32 hex characters from `openssl rand -hex 32`) and rotating on any suspected leak.

### Implementation

| Change | Where |
|---|---|
| Route path changed from `.post('/brevo', …)` to `.post('/brevo/:token', …)` | `apps/api/src/routes/webhooks/brevo.ts:242` |
| Auth source changed from header lookup (`c.req.header('x-sib-webhook-token')`) to path param (`c.req.param('token')`) | `apps/api/src/routes/webhooks/brevo.ts:141` |
| File-level JSDoc updated to document the new URL pattern + the security trade-off | `apps/api/src/routes/webhooks/brevo.ts:1-37` |
| Logger context key renamed `hasHeader` → `hasToken` (semantic clarity) | `apps/api/src/routes/webhooks/brevo.ts:144` |
| Tests rewritten: URL pattern updated everywhere; the "missing X-Sib-Webhook-Token header" case becomes "no token segment → 404"; the "wrong token" case becomes "wrong path segment → 401" | `apps/api/test/routes/webhooks/brevo.test.ts` |
| ADR-027 docstring updated with the new URL pattern + SPEC-115 cross-reference | `docs/decisions/ADR-027-newsletter-dispatch-architecture.md:60-65` |

The existing `verifyWebhookToken()` helper is unchanged — its semantics are "constant-time compare two strings via HMAC-of-fixed-length-digest", and the source of the candidate string (header vs path) is irrelevant to it.

### Operator runbook (post-merge)

1. Generate a new secret: `openssl rand -hex 32`.
2. Set it on both environments:
   - `hops env-set api HOSPEDA_BREVO_WEBHOOK_SECRET --secret --target=staging`
   - `hops env-set api HOSPEDA_BREVO_WEBHOOK_SECRET --secret --target=prod`
3. Redeploy: `hops redeploy api --target=staging` (and prod once staging→main is promoted).
4. In Brevo dashboard, edit **both** webhooks (staging and prod):
   - staging: `https://staging-api.hospeda.com.ar/api/v1/public/webhooks/brevo/<secret>`
   - prod: `https://api.hospeda.com.ar/api/v1/public/webhooks/brevo/<secret>` (no-op until staging→main promotion brings the route to main)
5. From the Brevo dashboard, trigger "Send test webhook" on each. Expected: 200 OK with `{ ok: true, processed: N, skipped: M }` in the response body.
6. Confirm in logs: `hops logs api -f -g brevo --target=staging` — `signature mismatch` warnings stop.

### Acceptance criteria — status

- [x] The chosen resolution path is implemented (option C — secret in URL).
- [x] Tests for the new path pattern pass (8/8 in `apps/api/test/routes/webhooks/brevo.test.ts`).
- [x] Decision rationale documented in this spec + ADR-027.
- [ ] Production logs show zero `POST /api/v1/public/webhooks/brevo` 404 responses over a 24-hour observation period **after** the staging→main promotion + Brevo prod webhook URL update.
- [ ] The `rl:webhook:*` bucket no longer accumulates 429s attributable to Brevo retries.
