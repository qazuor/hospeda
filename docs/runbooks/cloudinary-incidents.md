# Cloudinary Incident Response Runbook

This runbook provides troubleshooting procedures for incidents affecting Hospeda's image management subsystem (Cloudinary). It covers detection, health verification, credential rotation, account/quota issues, soft-delete semantics, GDPR erasure handoff, contacts, and escalation.

> **Background**: Hospeda uses Cloudinary as the canonical image storage and CDN for accommodations, destinations, events, posts, and user-uploaded media. The integration is encapsulated in `packages/media/src/server/cloudinary.provider.ts` and exposed to the API through `apps/api/src/services/media.ts`. The design history lives in the archived SPEC-078 (Cloudinary Image Management) and the SPEC-078-GAPS remediation series (T-007, T-009, T-035, T-051, T-052, T-054).

## Quick Reference

| Issue                       | Severity   | Section                                                |
| --------------------------- | ---------- | ------------------------------------------------------ |
| `/health/media` returns 503 | High       | [Detection](#1-detection), [Health Check](#2-health-check) |
| Bad / rotated credentials   | High       | [Credential Rotation](#3-credential-rotation)          |
| Cloudinary account suspended| Critical   | [Account Suspension](#4-account-suspension)            |
| Quota exceeded (bandwidth/storage/transformations) | High | [Quota Exceeded](#5-quota-exceeded) |
| Asset still visible after delete | Low   | [Soft-Delete + Restore Note](#6-soft-delete--restore-note) |
| GDPR erasure request         | High      | [GDPR Erasure Reference](#7-gdpr-erasure-reference)     |

## Severity Definitions

- **Critical (red)**: Image upload completely down or account suspended; revenue / publishing impact.
- **High (orange)**: Degradation visible to users (broken images, upload failures), or single environment down.
- **Medium (yellow)**: Subset of features broken, workaround available.
- **Low (blue)**: Cosmetic, no user-visible impact.

---

## 1. Detection

There are four primary signals that indicate a Cloudinary incident.

### 1.1 Sentry alerts

Look for events tagged with one of the following error classes (see `packages/media/src/server/cloudinary.provider.ts`):

- `ConfigurationError` — credentials missing/invalid at provider construction.
- `InvalidFolderError` — caller passed a folder outside the `hospeda/` namespace (usually a code regression, not a Cloudinary outage).
- Generic `Error` from `provider.upload()` / `provider.delete()` / `provider.deleteByPrefix()` with messages mentioning `http_code`, `429`, `5xx`, or "Cloudinary".

Sentry release tagging is configured per ADR; consult `docs/runbooks/sentry-setup.md` if alerts appear unfiltered.

### 1.2 `/health/media` red

The public health endpoint at `GET /api/v1/public/health/media` returns:

- **`200 { status: "ok" }`** when the Cloudinary `api.ping()` admin call succeeds.
- **`503 { status: "error", message: "..." }`** when credentials are missing or the upstream ping fails.

Any monitoring uptime probe pointed at this endpoint will fire on 503.

Implementation: `apps/api/src/routes/health/media.ts` (added in SPEC-078-GAPS T-052 / GAP-078-232).

### 1.3 User reports

- "Photos are not loading" → check delivery URL (CDN) and look for 401 / 403 / 404 from `res.cloudinary.com/<cloud-name>/...`.
- "Upload failed" → check API logs for the upload attempt; cross-reference with Sentry.
- Hospeda admin panel media manager shows red toasts on upload.

### 1.4 Metrics dashboards

- Vercel logs for `apps/api`: search for `[health/media]` warns and Cloudinary error stacks.
- Cloudinary Dashboard → **Reports** → spikes in error rate, or quota usage near 100%.
- Orphan cleanup cron metrics (added in T-052) — if it errors out, that is an early indicator of credential / quota problems.

---

## 2. Health Check

Use the public health endpoint to manually verify Cloudinary connectivity. This call does NOT upload, list, or mutate any asset; it only invokes `cloudinary.api.ping()`.

### 2.1 Production / preview

```bash
curl -i https://api.hospeda.com.ar/api/v1/public/health/media
```

> TODO: confirm production hostname with team if it differs.

### 2.2 Local

```bash
curl -i http://localhost:3001/api/v1/public/health/media
```

### 2.3 Expected responses

**Healthy (200)**:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "cloudName": "hospeda",
    "timestamp": "2026-04-19T12:34:56.000Z"
  },
  "metadata": {
    "timestamp": "2026-04-19T12:34:56.000Z",
    "requestId": "..."
  }
}
```

**Misconfigured / unreachable (503)**:

```json
{
  "success": true,
  "data": {
    "status": "error",
    "message": "Invalid API key (http_code=401)",
    "timestamp": "2026-04-19T12:34:56.000Z"
  },
  "metadata": { "...": "..." }
}
```

The `data.message` field is sanitized — it never includes secrets, only `error.message` plus the `http_code` suffix. See `packages/media/src/server/cloudinary.provider.ts` (`healthCheck()`).

### 2.4 If 503 persists

1. Check that all three credentials are set in the affected environment (next section).
2. Confirm the Cloudinary account is not suspended (section 4).
3. Confirm Cloudinary is not in a regional outage: <https://status.cloudinary.com>.

---

## 3. Credential Rotation

Cloudinary credentials live in three Vercel environment variables:

| Variable                           | Type   | Secret | Apps         |
| ---------------------------------- | ------ | ------ | ------------ |
| `HOSPEDA_CLOUDINARY_CLOUD_NAME`    | string | no     | `api`, `seed`|
| `HOSPEDA_CLOUDINARY_API_KEY`       | string | yes    | `api`, `seed`|
| `HOSPEDA_CLOUDINARY_API_SECRET`    | string | yes    | `api`, `seed`|

Definitions live in `packages/config/src/env-registry.hospeda.ts` (lines ~400-428).

### 3.1 Rotate in Cloudinary dashboard

1. Sign in to <https://console.cloudinary.com> with an account that has admin rights on the `hospeda` cloud.
2. Navigate to **Settings → Access Keys**.
3. Click **Generate New API Key**. This creates a SECOND active key (does not invalidate the current one).
4. Copy the new `api_key` and `api_secret` to a secure scratchpad (do NOT paste in chat or commit anywhere).
5. Keep the old key active until step 3.4 is done — both keys can authenticate during the rollover.

### 3.2 Update Vercel env vars

For each affected project (`hospeda-api`, `hospeda-seed` if applicable):

```bash
# Pull current env to compare (does not show secret values, just keys)
vercel env ls --token=$VERCEL_TOKEN

# Remove old values for production / preview
vercel env rm HOSPEDA_CLOUDINARY_API_KEY production
vercel env rm HOSPEDA_CLOUDINARY_API_SECRET production

# Add new values (interactive prompt for the value)
vercel env add HOSPEDA_CLOUDINARY_API_KEY production
vercel env add HOSPEDA_CLOUDINARY_API_SECRET production
```

`HOSPEDA_CLOUDINARY_CLOUD_NAME` does NOT change unless the Cloudinary cloud itself is being migrated.

> If your team uses `pnpm env:push` / `pnpm env:pull`, prefer those — see `docs/guides/environment-variables.md`.

### 3.3 Redeploy

```bash
# Trigger a new production deploy so the new env vars are loaded
pnpm deploy:api
```

Wait for the deploy to be live. Vercel runtime functions read env vars at cold start, so a redeploy is required even if the env value is updated.

### 3.4 Validate

```bash
# Should return 200 status:ok
curl -i https://api.hospeda.com.ar/api/v1/public/health/media
```

If the validation curl returns 200, revoke the old key in the Cloudinary dashboard:
**Settings → Access Keys → [old key] → Revoke**.

> TODO: confirm with team whether the old key should be kept active for 24h as a safety window.

### 3.5 Common rotation pitfalls

- Forgetting to redeploy → env vars unchanged at runtime.
- Updating `production` but not `preview` → preview deploys keep failing silently. The startup check in `apps/api/src/utils/cloudinary-preview-warn.ts` (T-051 / GAP-078-134) emits a warn line when preview is missing creds.
- Pasting an API key with trailing whitespace → Cloudinary rejects with 401. Strip whitespace before pasting.

---

## 4. Account Suspension

Cloudinary may suspend an account on quota overrun, billing failure, or terms-of-service violation. When suspended, ALL provider calls (upload, delete, ping) fail with 401 / 403 even though the credentials themselves are valid.

### 4.1 How to detect

- `/health/media` returns 503 with messages like `Account is suspended` or `Forbidden (http_code=403)`.
- Cloudinary dashboard banner: red strip across the top with "Account suspended" or "Payment failed".
- Inbound email from Cloudinary support / billing.

### 4.2 Immediate mitigation

1. **Preview env**: degradation is automatic. The provider falls back to the `InMemoryImageProvider` (T-018 in SPEC-078-GAPS) when credentials are absent or unconfigured. Uploads succeed in-process but URLs are ephemeral and NOT persisted. Acceptable for preview, NOT for production.
2. **Production env**: there is no in-memory fallback in production by design. Uploads will fail. Communicate the outage on the status page if customer-facing.

### 4.3 Escalate to Cloudinary support

- **Email**: `support@cloudinary.com`
- **Portal**: <https://support.cloudinary.com> (sign in with the Cloudinary account)
- **Status**: <https://status.cloudinary.com>

Provide:

- Cloud name (`HOSPEDA_CLOUDINARY_CLOUD_NAME`).
- Account email of the admin.
- Time of first 4xx / 5xx response (UTC).
- A copy of the suspension banner / email.

### 4.4 Pay outstanding invoice (if billing-related)

1. Cloudinary dashboard → **Settings → Billing & Usage**.
2. Update card / pay invoice.
3. Suspension is typically lifted within 1 hour after payment clears.

### 4.5 After lift

```bash
curl -i https://api.hospeda.com.ar/api/v1/public/health/media
```

Should return 200. Confirm an upload through the admin panel.

---

## 5. Quota Exceeded

Cloudinary enforces three independent quotas:

| Quota             | What it counts                             | Effect at 100%                          |
| ----------------- | ------------------------------------------ | --------------------------------------- |
| **Storage**       | Total bytes stored                          | New uploads rejected                    |
| **Bandwidth**     | Bytes served from CDN per month             | Image delivery throttled or paused      |
| **Transformations** | Distinct transformation operations / month | New transformation URLs return errors  |

### 5.1 Where to see quotas

Cloudinary dashboard → **Reports → Usage**. Alerts can be configured at 50%, 75%, and 90% thresholds; check that they are enabled.

> TODO: confirm with team whether an alert is wired to `#ops` or to email.

### 5.2 What to do at >90% usage

1. Identify the dominant consumer:
   - Storage → check the largest folders in the Media Library.
   - Bandwidth → check Reports for top-delivered assets and their referrers.
   - Transformations → check for unintentional transformation explosions (e.g. dynamic dimensions in URLs).
2. **Short-term**: trigger the orphan cleanup cron (T-052) to remove unreferenced assets:
   - The cron is registered via Vercel Cron and removes assets in `hospeda/<env>/...` folders that have no DB row pointing at them.
   - Do NOT trigger this in production without verifying `HOSPEDA_ALLOW_PROD_CLEANUP=true` is set. The seed `--clean-images` flag is gated by this env var (T-009 / GAP-078-XXX) — `packages/seed/src/utils/cloudinary-upload.ts`.
3. **Medium-term**: upgrade the Cloudinary plan in **Settings → Plan**.
4. **Long-term**: revisit the transformation strategy (e.g. limit the catalogue of allowed widths, prefer presets).

### 5.3 Bandwidth incidents

- If the bandwidth quota is breached on a specific asset (hotlinking, scrape), contact Cloudinary support to enable referrer restrictions or signed URLs.
- Cloudinary status page: <https://status.cloudinary.com>.

---

## 6. Soft-Delete + Restore Note

> **Critical for on-call**: Hospeda uses soft delete by default. Soft-deleting a record (e.g. an Accommodation) does NOT remove its Cloudinary asset. The asset survives until the parent record is HARD-deleted.

### Why this matters

Hospeda models extend `BaseModel` with soft-delete semantics (see `packages/db/docs/guides/soft-delete.md`). The `provider.delete()` and `provider.deleteByPrefix()` calls are wired into the `_afterHardDelete()` hooks, NOT `_afterDelete()`. This is intentional:

- Soft delete is reversible (`restore()`); the Cloudinary asset must remain so the restored record's images still resolve.
- Hard delete is irreversible; the Cloudinary asset is removed at that point.

### What this means in practice

- If an on-call engineer sees "deleted accommodation X but its images are still in Cloudinary", that is **expected behavior** for soft delete. Do NOT rotate credentials, do NOT escalate to Cloudinary support — the assets will be cleaned up when the record is hard-deleted (or by the orphan cleanup cron, T-052, if the soft-deleted record is purged).
- The destructive provider calls live in `packages/media/src/server/cloudinary.provider.ts` and are wired in the entity service `_afterHardDelete` hooks (search service-core for `provider.delete` / `deleteByPrefix`).

### Restore semantics

When `restore()` is called on a soft-deleted record, the original Cloudinary URLs in the DB are still valid because the assets were never touched. No additional Cloudinary call is needed.

---

## 7. GDPR Erasure Reference

A user submitting a "right to be forgotten" / erasure request triggers removal of:

1. The user's DB record (hard delete).
2. Any owned content (accommodations, posts, events) per data-retention policy.
3. **All associated Cloudinary assets** — handled automatically by the `_afterHardDelete` hooks chain (section 6).

### Procedure

> TODO: link the dedicated GDPR erasure runbook once it lands. As of 2026-04-19, no such runbook exists in `docs/`. Until then:

1. Open a ticket in the Hospeda issue tracker tagged `gdpr` / `erasure` so the request is auditable.
2. Resolve via SQL hard delete on the user record. Triggers cascade through service hooks → Cloudinary `deleteByPrefix({ prefix: 'hospeda/<env>/users/<userId>/' })`.
3. Verify in Cloudinary Media Library that the user's folder is empty.
4. Document the erasure in the ticket with timestamp, operator, and assets removed (count).

> TODO: confirm with team whether a SPEC exists for end-to-end GDPR erasure (likely SPEC-XXX). If yes, replace this section with a link.

---

## 8. Emergency Contacts

> All placeholders below should be confirmed with the on-call team and replaced with real values.

### Cloudinary

- **Support email**: `support@cloudinary.com`
- **Support portal**: <https://support.cloudinary.com>
- **Status page**: <https://status.cloudinary.com>
- **Account admin**: TODO: confirm with team (likely the engineering lead).

### Hospeda internal

- **Slack channel**: `#ops` — TODO: confirm channel name with team.
- **On-call rotation**: TODO: confirm tool (PagerDuty / Opsgenie / manual) with team.
- **Engineering lead**: TODO: confirm with team.

### Related runbooks

- [Sentry Setup](./sentry-setup.md)
- [Monitoring](./monitoring.md)
- [Production Bugs](./production-bugs.md)
- [Rollback](./rollback.md)

---

## 9. Escalation Tree

Use this ladder to decide when to escalate. Do not skip levels unless the impact justifies it (e.g. account suspension goes straight to L3).

### L1 — Logs and dashboards (first 15 min)

- Triage in Sentry: is it a one-off error, a spike, or sustained?
- Curl `/health/media` from your machine.
- Check Vercel logs for the API deployment.
- Check the Cloudinary dashboard for banners or quota alerts.
- Check <https://status.cloudinary.com>.

**Resolve at L1 if**: transient 5xx that resolved on retry (the provider already retries via `pRetry` — T-035 / GAP-078-087, see `cloudinary.provider.ts` lines 74-107). If retries succeeded, document and close.

### L2 — Engineer (15 min – 1 hr)

Escalate to the engineer on rotation when:

- `/health/media` returns 503 for >5 minutes.
- Sentry shows >10 Cloudinary errors / 5 minutes.
- Users are reporting broken uploads or images.

Engineer responsibilities:

- Decide if rotation, redeploy, or rollback is needed (see [Rollback runbook](./rollback.md)).
- Verify env vars are set correctly across environments.
- Coordinate with the Cloudinary admin if account-level intervention is needed.

> TODO: confirm with team whether L2 has a defined SLA.

### L3 — Cloudinary support + status page (>1 hr or critical)

Escalate to Cloudinary support and surface the incident on the public status page (if customer-facing) when:

- Account is suspended.
- Sustained 5xx from Cloudinary upstream (confirmed via status page).
- Quota cannot be lifted via self-service plan upgrade in time.

Provide Cloudinary support with the data listed in section 4.3.

If the incident is customer-facing, post an update to the Hospeda status page (TODO: confirm whether one exists and where).

---

## Appendix: Reference Files

| Concern                              | File                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| Cloudinary provider implementation   | `packages/media/src/server/cloudinary.provider.ts`                  |
| Provider construction / DI           | `apps/api/src/services/media.ts`                                    |
| Health endpoint                       | `apps/api/src/routes/health/media.ts` (T-052)                        |
| Preview-deploy startup warn          | `apps/api/src/utils/cloudinary-preview-warn.ts` (T-051)             |
| Env var registry                     | `packages/config/src/env-registry.hospeda.ts` (lines ~400-440)      |
| Production cleanup gate              | `HOSPEDA_ALLOW_PROD_CLEANUP` (T-009)                                |
| Soft-delete model                    | `packages/db/docs/guides/soft-delete.md`                            |
| Spec                                 | `.claude/specs/SPEC-078-cloudinary-image-management/spec.md`        |
| Hardening tasks                      | T-007 (provider hardening), T-009 (SSRF + prod gate), T-035 (p-retry), T-051 (preview warn), T-052 (`/health/media` + cron), T-054 (CI isolation) |
