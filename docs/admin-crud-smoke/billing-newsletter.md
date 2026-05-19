# CRUD smoke — sponsorships / owner-promotions / newsletter-campaigns (D-15, D-16, D-17)

- **Date:** 2026-05-15
- **Operator:** <superadmin@hospeda.com> (SUPER_ADMIN)
- **Branch:** `fix/admin-pages-audit`

These three entities share dialog/page-based create UI (vs the consolidated EntityFormSection family used by /destinations, /events, etc.). All three loaded list views cleanly post-A-* + M-2 fixes (B-5 + N-1 + N-2 retry-storm closed via M-2). Findings below cover what BROKE in the create path.

## Sponsorships (D-15)

- `/billing/sponsorships` → 200, "Patrocinios" heading, tabs (Patrocinios / Niveles / Paquetes), 3 status combos (estados / tipos / lifecycle), "Crear patrocinio" button visible. Table: "No se encontraron registros" (zero seed). No `[MISSING:]`, no console errors.
- `GET /api/v1/admin/sponsorships?page=1&pageSize=20` → 200.

### D-SPONSORSHIP.1 🟠 HIGH — "Crear patrocinio" button is a no-op (no dialog, no navigation, no console error)

- **Symptom:** clicking `Crear patrocinio` (only Create affordance) produces zero effect — no dialog, no navigation, no toast, no console error/warning. Network panel shows no request.
- **Surface:** `/billing/sponsorships` (also affects the `Niveles` and `Paquetes` tabs — both have their own Create buttons with similar wiring, untested).
- **Suspected root cause:** the handler is wired to a state setter that's not connected to a Dialog component, OR the `onClick` is missing, OR a guard upstream is short-circuiting (e.g. plan-limit gate without a fallback toast).
- **Files to investigate:**
  - `apps/admin/src/features/billing/sponsorships/...` (or `apps/admin/src/routes/_authed/billing/sponsorships.tsx` if route-level)
  - Search for `setIsCreateOpen` / `setOpen(true)` near the button definition; verify the controlled `<Dialog open={...}>` consumer exists.
- **Acceptance:** SUPER_ADMIN can click the button and reach a working Create form/dialog.
- **Triage:** in-scope per spec §5 — Create flow is broken end-to-end. Probably a 5-15 line fix once located.

### D-SPONSORSHIP.2 🟢 LOW — Breadcrumb "Sponsorships" rendered in English

- **Symptom:** breadcrumb shows `Inicio > Billing > Sponsorships` (English) on `/billing/sponsorships`. Spanish heading is correct ("Patrocinios").
- **Surface:** same pattern likely on every billing page (verified subset: sponsorships).
- **Suspected root cause:** breadcrumb auto-derives from path segments without going through i18n.
- **Fix direction:** route the breadcrumb segments through a mapping or per-route override.

## Owner-promotions (D-16)

- `/billing/owner-promotions` → 200, table renders 1 row, no `[MISSING:]`, no console errors.
- `GET /api/v1/admin/owner-promotions?page=1&pageSize=20` → 200.
- **No visible "Crear" affordance** — neither in heading nor in row actions. The list is **view-only via the admin UI** even for SUPER_ADMIN.

### D-OWNERPROMO.1 🟡 MED — No Create button on `/billing/owner-promotions` list

- **Symptom:** the page reads as a passive list (1 seeded row). No way to create a new owner promotion via the admin UI. SUPER_ADMIN should be able to do everything.
- **Suspected root cause:** the feature is mostly read-only by design (owner-promotions might originate from the public side / user-facing flow). But the admin needs the ability to create/edit/delete for moderation. OR the button was deferred.
- **Fix direction:** product decision — confirm whether Create from admin is in scope. If yes, add the button + dialog/page wiring.
- **Triage:** out of scope of THIS smoke unless the product owner answers yes. File as follow-up.

## Newsletter campaigns (D-17)

- `/newsletter/campaigns` → 200, table renders 0 rows ("zero seeded"). No `[MISSING:]`, no console errors.
- `GET /api/v1/admin/newsletter/campaigns?page=1&pageSize=25&sort=createdAt%3Adesc` → 200 (confirms N-1 sort param fix from Phase 5 is live).
- **No visible "Crear" affordance** — same shape as owner-promotions.

### D-NEWSLETTER.1 🟡 MED — No Create button on `/newsletter/campaigns` list (paired with D-OWNERPROMO.1)

- **Symptom:** same as D-OWNERPROMO.1 — list is admin-passive.
- **Fix direction:** same product decision as D-OWNERPROMO.1. The newsletter campaign feature presumably has a triggering flow (admin-initiated mass send), so a Create button is expected.

## Phase 6 summary on this smoke batch

- **List endpoints all return 200** — A-* family is well covered for these entities.
- **Create flows are broken or missing** — 1 broken (D-SPONSORSHIP.1, button no-op), 2 absent (D-OWNERPROMO.1, D-NEWSLETTER.1).
- **No i18n missing keys** for these surfaces — good shape.
- **No retry storms** — M-2 retry policy fix from Phase 5 visibly working (no 429 cascades despite multiple back-to-back list requests).

Compared to the rest of Phase 6, this batch surfaces UX completion gaps rather than data-layer bugs — different family from D-USERS.4 / D-ACCOM.1 (schema/form mismatch) and D-RELATIONS.1 (config mismatch).
