# SPEC-205 — Host Web Foundation (Phase 3: Owner Promotions CRUD)

> Status: in-progress. Phases 1, 2 and 4 already shipped (host dashboard API + UI, nav, funnel polish) and were promoted to main in PR #1542. This spec file formalizes the **remaining Phase 3** scope, which was never built. Canonical design source: [`openspec/changes/host-web-foundation/`](../../../openspec/changes/host-web-foundation/) (proposal.md / design.md / tasks.md).

## Context

The host web area lets accommodation owners manage their listings. Phase 2 shipped the host dashboard, whose quick-actions already link to `mi-cuenta/promociones` — but that page does not exist yet (a live dead-link, `HostDashboard.client.tsx:60`). Phase 3 builds the owner promotions CRUD on the web layer.

## Scope correction (discovered 2026-06-12)

The original Phase 3 plan assumed "backend ready". It is NOT: the owner-promotions **protected** API tier only exposes mutations (`POST/PUT/PATCH/DELETE`). There is **no `GET /protected/owner-promotions`** for an owner to list/read their own promotions, and the **public** endpoint hard-forces `lifecycleState = ACTIVE` (`ownerPromotion.service.ts:133`), so it cannot back a CRUD that must show drafts/inactive. Phase 3 therefore also adds the two protected GET endpoints.

## User stories

- **US-1**: As an owner, I can see a list of all my promotions (any lifecycle state), so I can manage them.
- **US-2**: As an owner, I can create a promotion (title, discount type/value, validity window, optional accommodation/min-nights/max-redemptions).
- **US-3**: As an owner, I can edit an existing promotion of mine.
- **US-4**: As an owner, I can delete a promotion of mine.
- **US-5**: The host dashboard quick-action and the account sidebar both link to the promotions area (no dead-links).

## Acceptance criteria

- **AC-1**: `GET /api/v1/protected/owner-promotions` returns only the authenticated owner's promotions, across all lifecycle states (not just ACTIVE), guarded by `OWNER_PROMOTION_*` permission.
- **AC-2**: `GET /api/v1/protected/owner-promotions/{id}` returns a single promotion owned by the actor, 404/403 otherwise.
- **AC-3**: The web promotions list page renders the owner's promotions with edit/delete actions, empty state, loading and error states.
- **AC-4**: The create/edit form validates input with the `@repo/schemas` owner-promotion Create/Update Zod schema via `safeParse` (no TanStack Form — native HTML), surfaces field + form errors with `role="alert"`/`aria-invalid`, and handles 403 (`LIMIT_REACHED` / missing `CREATE_PROMOTIONS` entitlement).
- **AC-5**: A "Promociones" entry is added to the "Anfitrión" sidebar group; i18n keys exist in es/en/pt.
- **AC-6**: The `HostDashboard.client.tsx:60` quick-action resolves to the new page; hardcoded `quickActions` hrefs in `transforms.ts` use `buildUrl` (locale-prefixed).
- **AC-7**: Styling uses CSS Modules colocated with each island (no Tailwind in web).
- **AC-8**: Tests cover the new endpoints, the web API client + transform, both islands, and the previously-missing `HostDashboard.test.tsx`.

## Out of scope

- Phases 1/2/4 (already shipped).
- Public/admin promotion surfaces.
- Promotion redemption flow (separate concern).
