---
spec-id: SPEC-115
title: Brevo Webhook Endpoint Returns 404 — Configure or Implement
type: fix
complexity: low
status: draft
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
