# CRUD smoke — sponsors (D-8)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-sponsor (id reported: `e1bde6d4-ff8e-434e-b035-b4116077394e`)
- **Outcome**: 🔴 **GHOST CREATE — toast claims success and redirects, but no row persists**

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 5 rows visible (all seeded). |
| 2 | Create | 🔴 GHOST | Form submitted, redirect to `/sponsors/<uuid>` happened, success toast "Patrocinador creado exitosamente" shown. **BUT** the row was never persisted. |
| 3 | Verify created — UI (re-navigate) | 🔴 | Returning to the same `/sponsors/<uuid>` URL → `GET /api/v1/admin/post-sponsors/<uuid>` returns **404**. Detail page renders error boundary. |
| 4 | Verify created — DB | 🔴 | `SELECT id FROM post_sponsors WHERE id='e1bde6d4-...'` returns 0 rows. |
| 5-9 | … | ⏭ N/A | Blocked by step 2 |

## Findings

### D-8.1 🔴 CRITICAL — Sponsor `Create` shows success toast and redirects to a detail URL that does NOT exist in the DB

The flow: submit Create form → see success toast → land on `/sponsors/<uuid>`. Reload the
page → 404. List page → row not present. DB query → row not persisted.

This is the worst kind of bug — the operator believes the entity was created and walks away.
Several days later the data is "missing".

- **Suspected root cause:** the `useCreate` mutation handler treats the response as a success
  before the row is actually committed, OR the API returns 201 with a phantom UUID without
  actually persisting (e.g. the service layer bails inside a transaction without rolling back
  the success status), OR the optimistic UI reads the form data and routes to a fake URL
  without waiting for the real id from the response.
- **First investigation:** capture the POST `/api/v1/admin/post-sponsors` response body and
  check whether it returned 200/201 with a fake id, or whether the client constructed the
  redirect URL itself.
- **Fix direction:** ensure the client uses the response's `data.id` (verified by reading the
  freshly-created row from the same response, not from optimistic state). Add an integration
  test that creates a sponsor via API and asserts the row exists with the same id afterward.
- **Acceptance:** creating a sponsor produces a row in `post_sponsors` with the same id shown
  in the redirect URL; reloading the detail page works.

### D-8.2 (CONFIRMS D-CONTENT.1 / D-2.1) — Sponsors form has dot-notation contactInfo / socialNetworks

Likely identical pattern to event-organizers (D-5.1). Required `mobilePhone` would block this
form too if it were marked required (here it is **optional**, so the smoke could submit anyway).
But filling those fields would still fail per D-2.1.

### D-8.3 (CONFIRMS D-TOAST.1 + D-TOAST.2) — `Patrocinador creado exitosamente: Patrocinador creado exitosamente`

Title-equals-body again. "Patrocinador" is masculine (correct), so no D-TOAST.2 here. But the
duplication issue is identical to amenities/features/attractions.

## Console errors during this smoke

- After creating: none.
- After reloading the detail page: `Failed to load resource: 404`.
