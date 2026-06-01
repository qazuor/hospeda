---
spec-id: SPEC-112
title: Per-environment OAuth credentials — Google + Facebook separate for prod and staging
type: hardening
complexity: medium
status: draft
created: 2026-05-14T01:50:00Z
effort_estimate_hours: 3-5
tags: [auth, oauth, google, facebook, security, hardening, pre-public-launch]
extracted_from: SPEC-103 T-056 + T-057 + T-058 (deferred 2026-05-14 after pragmatic review)
priority: medium (pre-public-launch hardening; not blocking beta)
target_completion: 1 week before public launch
---

# SPEC-112: Per-environment OAuth credentials

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Eliminate the shared OAuth credentials (Google + Facebook) between hospeda-api-prod and hospeda-api-staging. Create separate OAuth clients/apps per environment so that:

- A credential leak in staging does NOT compromise prod
- Rate limits / quotas / account flagging are scoped per environment
- Audit logs in Google Cloud Console and Facebook Developers are cleanly separable
- Credential rotation can happen per environment independently

### 2. Why Deferred (Decision 2026-05-14)

Originally tracked as SPEC-103 T-056 + T-057 + T-058 in the operational batch. Deferred during the 2026-05-13 ops session after pragmatic review:

**Risk vector analysis for 1 month of beta with ~30-40 known testers**:

| Scenario | Probability during beta | Impact if it happens |
|---|---|---|
| Secret leak (logs, screenshots) | Low (no public access) | High (rotate both envs atomically) |
| Rate limit cap | Very low (low volume) | Medium (alert + intervene) |
| Audit log noise | Low (we want unified view during beta) | Low |
| Google/Facebook flags client | Very low (legitimate use) | High but rare |
| Forced rotation in 1 month | Not required | N/A |
| Beta tester revokes per-env | Rare during beta | Low |

**Mitigation operativa during beta**: rotate the shared credentials in Google + FB consoles + redeploy both targets (~5 min). De facto "isolation by procedure" during the beta window.

**Time investment vs alternative work**: 3-5h could be redirected to features that DO block beta (UX fixes, server-islands fix, MP integration, auth smoke validation of current shared-credential flow).

**Conclusion**: defer to ~1 week before public launch. Hygiene work that doesn't get harder by waiting.

### 3. Out of Scope

- Migrating to a separate Google Cloud project (full visual + technical isolation). Same-project + separate client is the recommended approach unless the operator specifically wants different OAuth consent screens visible to users.
- Migrating away from Better Auth / changing OAuth provider integration.
- Adding new OAuth providers (Apple Sign-In, GitHub, etc.) — track separately if needed.

---

### 4. Implementation Plan

#### Phase 0 — Pre-checks

- Confirm beta is winding down / public launch is < 2 weeks away.
- Capture current state for rollback: `hops env-list api --target=staging --match "GOOGLE|FACEBOOK" --reveal` → save Client IDs + Secrets to password manager labeled "Hospeda OAuth — pre-separation backup".

#### Phase 1 — Google OAuth (T-056 equivalent)

1. Login to https://console.cloud.google.com → select existing Hospeda project.
2. APIs & Services → Credentials → list existing OAuth 2.0 Client IDs to identify prod client.
3. + Create Credentials → OAuth client ID → Web application.
4. Name: `Hospeda Staging`.
5. Authorized JavaScript origins:
   - `https://staging.hospeda.com.ar`
   - `https://staging-admin.hospeda.com.ar`
6. Authorized redirect URIs:
   - `https://staging-api.hospeda.com.ar/api/auth/callback/google`
7. Copy Client ID + Client Secret to password manager.
8. `hops env-set api HOSPEDA_GOOGLE_CLIENT_ID <new-id> --target=staging`
9. `hops env-set api HOSPEDA_GOOGLE_CLIENT_SECRET --secret --target=staging` (interactive prompt)
10. `hops redeploy api --target=staging`
11. Smoke: visit `https://staging.hospeda.com.ar/es/auth/signin`, click "Continuar con Google", complete consent, verify session created.

#### Phase 2 — Facebook (T-057 equivalent)

1. Login to https://developers.facebook.com → My Apps → identify existing Hospeda app.
2. Create App → Business / Consumer → name `Hospeda Staging`.
3. Add product: Facebook Login → Settings.
4. Valid OAuth Redirect URIs:
   - `https://staging-api.hospeda.com.ar/api/auth/callback/facebook`
5. Allowed Domains:
   - `staging.hospeda.com.ar`
   - `staging-admin.hospeda.com.ar`
6. Settings → Basic → copy App ID + App Secret.
7. `hops env-set api HOSPEDA_FACEBOOK_CLIENT_ID <new-id> --target=staging`
8. `hops env-set api HOSPEDA_FACEBOOK_CLIENT_SECRET --secret --target=staging`
9. Switch app to Live mode if needed (Settings → Basic → toggle).
10. `hops redeploy api --target=staging`
11. Smoke: signin via Facebook on staging.

#### Phase 3 — Validate isolation (T-058 equivalent)

1. Revoke (or temporarily disable) the staging Google Client. Confirm staging.hospeda.com.ar Google signin fails.
2. Confirm prod hospeda.com.ar Google signin STILL WORKS.
3. Restore staging Google Client.
4. Same test for Facebook.

#### Phase 4 — Cleanup legacy

- Remove `HOSPEDA_EXTRA_TRUSTED_ORIGINS` preview-scope value on hospeda-api-prod (`https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar`) — it's a leftover from when staging hosts reached prod-api. Now they reach staging-api directly. Confirm safe to remove via app log audit.

---

### 5. Tasks

| Task | Title | Phase | Status |
|---|---|---|---|
| T-112-01 | Capture rollback snapshot of current shared OAuth credentials | 0 | pending |
| T-112-02 | Create Hospeda Staging Google OAuth client | 1 | pending |
| T-112-03 | Update hospeda-api-staging env vars (Google) + redeploy + smoke | 1 | pending, blocked by T-112-02 |
| T-112-04 | Create Hospeda Staging Facebook app | 2 | pending |
| T-112-05 | Update hospeda-api-staging env vars (Facebook) + redeploy + smoke | 2 | pending, blocked by T-112-04 |
| T-112-06 | Validate isolation: revoke staging → prod still works | 3 | pending, blocked by T-112-03, T-112-05 |
| T-112-07 | Cleanup legacy HOSPEDA_EXTRA_TRUSTED_ORIGINS | 4 | pending, blocked by T-112-06 |

---

### 6. Risks

| Risk | Mitigation |
|---|---|
| Misconfiguration causes auth outage during cutover | Capture rollback snapshot Phase 0. Test on staging FIRST before any prod-side cleanup |
| Facebook app review process takes days | Submit Hospeda Staging app for review ~10 days before public launch to allow buffer |
| Google + Facebook clients reach quota limits during heavy beta testing | Phase 0 verifies low-volume reality; phase 1-2 monitors quota usage post-deploy |
| Beta testers already used Google/FB to signup; switching client breaks their grants | At the moment of switch, existing Better Auth sessions remain valid (cookie-based). Only NEW signups use the new clients. Existing tokens will fail when they expire and need re-consent. Acceptable transition cost |

---

### 7. Acceptance Criteria

- [ ] Google staging client ID is distinct from prod
- [ ] Facebook staging app ID is distinct from prod
- [ ] hospeda-api-staging env vars updated with staging credentials
- [ ] Google + Facebook signin work end-to-end on staging
- [ ] Google + Facebook signin still work on prod after staging swap
- [ ] Revoking staging client does NOT affect prod (verified via temporary disable test)
- [ ] HOSPEDA_EXTRA_TRUSTED_ORIGINS legacy values cleaned up
- [ ] Runbook updated with the new credential matrix per env

---

## Part 2 — Implementation Notes

### Source

Extracted from SPEC-103 T-056 + T-057 + T-058 on 2026-05-14 after the operator and agent agreed during the ops batch session that:

1. Pragmatic risk during 1 month of beta with ~30-40 known testers is low.
2. The 3-5h investment is more valuable applied to features blocking beta rather than hardening that doesn't compound risk in the meantime.
3. Operational mitigation (rotate shared creds in ~5 min if compromised) is sufficient backstop during beta.

Decision recorded in engram: `spec/SPEC-112/intent`.

### When to start

Recommended trigger: **1 week before the planned public-launch date**. Earlier if any of these happen:

- Beta volume scales beyond ~50 active testers
- A secret-handling incident in staging (any tier)
- Google or Facebook policy update affecting our integration
- Audit log noise becomes a debugging blocker

### Cross-spec dependencies

- SPEC-103 T-087 (web cutover at public launch) — both should land in the same launch-prep window
- SPEC-109 (MercadoPago production toggle) — independent but also pre-launch critical
- SPEC-111 (Astro server islands fix) — must land before T-087, so naturally before SPEC-112 if both target same window
