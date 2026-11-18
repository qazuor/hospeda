---
title: Notice when approving a provider lead does not create the provider (and a way to retry)
linear: HOS-2339
statusSource: linear
created: 2026-11-18
type: fix
smoke:
  - staging
areas:
  - api
  - admin
  - i18n
---

# Notice when approving a provider lead does not create the provider (and a way to retry)

## 1. Summary

When an admin approves a `service_provider` alliance lead, the system tries to create the provider
(`host_trades` row). Sometimes it silently does not: for example, none of the categories the
applicant chose is still active (`no-active-category`, introduced by HOS-919). The lead becomes
`approved`, the applicant gets the approval email, the admin sees a green success toast, and **no
provider exists**. Nobody is told.

This spec makes that outcome visible and recoverable:

1. `mark-handled` reports what provisioning did (additive response field).
2. The admin dialog shows the categories the applicant chose, with a marker for inactive or deleted ones.
3. After an approval that did not create the provider, the admin gets a warning toast and the row keeps a
   persistent badge **«Proveedor no creado»** with a **«Crear proveedor»** button.
4. That button calls a new dedicated retry endpoint that re-runs provisioning only.

Approval is never refused up front: the approval decision is the durable outcome (existing design in
`alliance-lead.service.ts` `markHandled`).

### 1.1 Out of scope

| Item | Why |
|---|---|
| Refusing approval when provisioning would skip | Owner decision: approval is never blocked |
| Re-sending the approval email on retry | Owner decision 2026-11-18: dedicated retry, no email re-send (but see OQ-1 about the claim invite) |
| The same notice for partner leads | Partner provisioning is a separate action with its own outcome (`approve-and-provision-partner.ts`, HOS-2336 aligns its shape). No admin button exists for it yet |
| Editing a lead's categories in the inbox | The admin fixes the catalog (reactivate a category, HOS-2340) and retries |
| Telling the applicant their provider was not created | Not requested. See risk R2 |
| Sponsor and editor leads | They never provision |

## 2. Current state (verified on this branch, 2026-11-18)

- `packages/service-core/src/services/alliance-lead/alliance-lead.provisioning.ts`: `ProvisionSkipReason` (`:44-48`) is `not-a-service-provider | already-provisioned | legacy-lead-without-typed-fields | no-active-category`; the result is `ProvisionListingResult` (`:132-138`), a discriminated union with `provisioned`, `hostTradeId?`, `reason?`. `provisionServiceProviderListing` is called from `markHandled`.
- `alliance-lead.service.ts` `markHandled` (`:1020`): `applyDecision` (`~:1098`) calls `provisionServiceProviderListing`, writes `provisionedHostTradeId` only when `provisioning?.provisioned`, and **drops the result**. It returns only the lead (`ServiceOutput<AllianceLead>`). A transaction is opened only when `resolveProvisionPlan(existing).kind === 'provision'` (`:1074`).
- Re-approving an already-approved lead re-runs provisioning today (idempotent), but also re-sends the decision email and, for unclaimed leads that already have a listing, a fresh claim invite (`needsClaimInvite`, `:1078`). That side effect is exactly why the owner asked for a dedicated retry.
- `apps/api/src/routes/alliance/admin/mark-handled.ts`: response schema is `AllianceLeadSchema`; the route `description` (`:81-84`) still says *"Never auto-provisions any role/entity (HOS-277 NG-1)"*, which is stale since HOS-278.
- `apps/admin/src/features/alliance-leads/components/AllianceLeadInbox.tsx`: `HandleDialog` (`:58`) always toasts `successApproved` (`~:66-77`); the dialog shows only phone and message (`~:88-107`), not the chosen categories (`AllianceLead.categorySlugs`, `alliance-lead.schema.ts:238`). The file header (`:9-13`) and the `RowActions` JSDoc claim there is no provisioning and that it is manual. `hooks/useAllianceLeads.ts` header (`:12-16`) and `__tests__/alliance-leads.test.tsx:9` repeat the claim.
- `AllianceLeadSchema` already exposes `provisionedHostTradeId` (`:269`, nullish) and `status`, `kind`, so the badge needs no new column.
- Precedent for an outcome in a response: `approve-and-provision-partner.ts` returns `{ lead, partnerId | null, provisioned }`.
- Error contract: `apps/api/docs/error-contract.md` (order 401, 403, 400, 404, then business rules; state conflict is 409 `ALREADY_EXISTS`; well-formed but unprocessable is 422 `VALIDATION_ERROR`).
- Toast variants available: `'default' | 'success' | 'error' | 'warning' | 'info'` (`apps/admin/src/components/ui/ToastProvider.tsx:15`).

## 3. Decisions (approved by the owner on 2026-11-18)

| # | Decision |
|---|---|
| D1 | The `mark-handled` response is the lead plus an optional `provisioning: { provisioned, reason?, hostTradeId? }`. Additive and non-breaking. The schema lives in `@repo/schemas`. |
| D2 | The admin is warned for `no-active-category` and `legacy-lead-without-typed-fields`. `already-provisioned` and success are silent (success toast as today). |
| D3 | `HandleDialog` shows the lead's chosen categories, resolved from `categorySlugs` against the admin catalog, with an inactive or deleted marker. |
| D4 | After an approval with a skip: a warning toast plus a persistent row badge «Proveedor no creado», derived from `status = approved` AND `kind = service_provider` AND `provisionedHostTradeId` null, with a «Crear proveedor» button. |
| D5 | Retry is a **new dedicated endpoint** `POST /api/v1/admin/alliance/leads/{id}/provision` (owner decision). It re-runs provisioning only, with the same permission as mark-handled, is idempotent (already provisioned returns the existing `hostTradeId`), follows the error-contract order, and returns the same provisioning outcome. It does not re-send the approval email. |
| D6 | The stale route description and the stale inbox, hook and test comments are fixed in the same change. |
| D7 | Approval is never refused up front. |

### 3.1 Error choices inside D5 (picked from the error contract)

| Case | Answer |
|---|---|
| Not signed in | 401 `UNAUTHORIZED` |
| Lacks `ALLIANCE_LEAD_MANAGE` | 403 `FORBIDDEN` |
| `id` is not a UUID | 400 `VALIDATION_ERROR` |
| Lead does not exist | 404 `NOT_FOUND` |
| Lead is not `service_provider` | 422 `VALIDATION_ERROR`, `details.reason = 'NOT_A_SERVICE_PROVIDER'` |
| Lead is not `approved` | 409 `ALREADY_EXISTS`, `details.reason = 'LEAD_NOT_APPROVED'` |
| Provisioning skipped (no active category, legacy lead) | **200** with `provisioning.provisioned = false` and the reason. A skip is an outcome, not an error (same as the partner precedent) |
| Already provisioned | 200 with `provisioning.provisioned = false`, `reason = 'already-provisioned'`, `hostTradeId` of the existing listing |

The kind check runs before the status check, so a sponsor lead never reads «not approved».

### 3.2 Claim invite on retry (resolved)

**OQ-1. Claim invite on a successful retry.** `markHandled` sends the claim invite only when a listing
exists at approval (`needsClaimInvite`, `alliance-lead.service.ts:1078`). If the first approval skipped,
no invite went out. A retry that finally creates the listing for an anonymous (unclaimed) lead would
leave a listing nobody can claim.
Options: (1) the retry mints and sends the claim invite only when it newly creates the listing for an
unclaimed lead, and never sends the approval email (**recommended**: it keeps "no email re-send" for the
decision and avoids an orphan listing; the invite is the HOS-599 mechanism); (2) the retry sends nothing
and the admin forwards the claim link by hand (leaves ownerless listings and no tooling for that);
(3) the retry re-sends both emails (contradicts the owner decision).
**Resolved 2026-11-18 by the owner: option 1.** The retry sends only the claim invite, never the approval email.

## 4. User stories and acceptance criteria

### US-1. The admin learns what approval did

- **AC-1.1** Given a `service_provider` lead with an active category, when the admin approves it, then the response contains `provisioning: { provisioned: true, hostTradeId }` and the toast is the existing green success message.
- **AC-1.2** Given a lead whose categories are all inactive, deleted or unknown, when the admin approves it, then the lead is `approved`, the response contains `provisioning: { provisioned: false, reason: 'no-active-category' }`, and the admin sees a **warning** toast (variant `warning`) with the text «Lead aprobado, pero el proveedor no se creó: ninguna de sus categorías está activa.» The success toast is not shown.
- **AC-1.3** Given a legacy lead without typed fields, when approved, then `reason = 'legacy-lead-without-typed-fields'` and the warning toast reads «Lead aprobado, pero el proveedor no se creó: faltan datos del formulario. Crealo a mano.»
- **AC-1.4** Given an already provisioned lead approved again, then `provisioning = { provisioned: false, reason: 'already-provisioned', hostTradeId }` and the toast is the success one (no warning).
- **AC-1.5** Given a rejection, or an approval of a `partner`, `sponsor` or `editor` lead, then the response has **no** `provisioning` key and the toasts are unchanged.
- **AC-1.6** Given an older API client that ignores the new key, then the response still validates as an `AllianceLead` (additive).

### US-2. The admin sees what the applicant chose

- **AC-2.1** Given the `HandleDialog` of a `service_provider` lead with `categorySlugs`, when it opens, then a «Categorías elegidas» block lists each slug resolved to its localized name from the admin catalog.
- **AC-2.2** Given a chosen category that is INACTIVE, then its entry carries an «Inactiva» marker; given it is soft-deleted, a «Borrada» marker; given the slug no longer exists, the raw slug is shown with «No existe».
- **AC-2.3** Given at least one chosen category is not ACTIVE, then the dialog shows a one-line note «Si ninguna categoría está activa, el proveedor no se crea.» before the decision radios.
- **AC-2.4** Given the actor lacks `HOST_TRADE_CATEGORY_VIEW` (catalog request answers 403), then the block shows the raw slugs with no markers and no error banner.
- **AC-2.5** Given the catalog request is loading, the block shows a skeleton; given it fails for another reason, the raw slugs with a muted «No se pudo cargar el catálogo» line. The decision controls stay usable in both cases.
- **AC-2.6** Given a lead of another kind, or a `service_provider` lead with `categorySlugs` null or empty, then the block is not rendered.

### US-3. The admin sees which approved leads have no provider

- **AC-3.1** Given a list row with `status = approved`, `kind = service_provider` and `provisionedHostTradeId` null, then the status cell shows the badge «Proveedor no creado» and the actions cell shows a «Crear proveedor» button. The badge is shown after a reload, not only right after approval.
- **AC-3.2** Given any other row (provisioned, rejected, pending, another kind), then neither the badge nor the button renders.
- **AC-3.3** The badge has accessible text (not color only) and the button is reachable by keyboard.
- **AC-3.4** Given the admin lacks `ALLIANCE_LEAD_MANAGE`, the button is not rendered (the inbox already gates handling on that permission).

### US-4. The admin retries provisioning

- **AC-4.1** Given an approved `service_provider` lead with no provider and at least one ACTIVE category, when the admin presses «Crear proveedor», then `POST .../leads/{id}/provision` answers 200 with `provisioning.provisioned = true`, the lead has `provisionedHostTradeId` set, the badge disappears, the list refreshes, and a green toast «Proveedor creado» shows.
- **AC-4.2** Given there is still no ACTIVE category, then the endpoint answers 200 with `provisioned = false, reason = 'no-active-category'`, nothing is written, the badge stays and the warning toast repeats the reason.
- **AC-4.3** Given the lead is already provisioned (for example another admin retried first), then the endpoint answers 200 with `reason = 'already-provisioned'` and the existing `hostTradeId`, creates no second listing, and the UI refreshes and shows an info toast «El proveedor ya existe».
- **AC-4.4** Given two concurrent retries, then exactly one listing is created (the lead row is locked `FOR UPDATE` inside the transaction and `provisionedHostTradeId` is re-read after the lock).
- **AC-4.5** (OQ-1 resolved: option 1) Given the retry newly created the listing for a lead with `applicantUserId` null, then a fresh claim invite is minted and sent (fire-and-forget, same as `markHandled`); no approval-decision email is sent in any case. Given the lead already has an applicant user, no invite is sent.
- **AC-4.6** The error cases of §3.1 each answer exactly the listed status and `error.code`, and none answers `INTERNAL_ERROR`.
- **AC-4.7** While the request is in flight the button is disabled and shows «Creando...». A network or 5xx failure shows an error toast and leaves the badge in place.
- **AC-4.8** Given the provisioning transaction fails midway, then neither the listing nor the `provisionedHostTradeId` link is persisted (one transaction), and the failure is logged with the lead id.

### US-5. The docs and comments tell the truth

- **AC-5.1** The `mark-handled` route description no longer says it never provisions; it states that approving a `service_provider` lead provisions the listing and describes the `provisioning` field.
- **AC-5.2** The header comments of `AllianceLeadInbox.tsx`, its `RowActions` JSDoc, `useAllianceLeads.ts` and `alliance-leads.test.tsx` match the new behaviour (a static test greps the touched files for the old sentence «NO "Approve & provision"» and «never auto-provisions» and fails if found).

## 5. Technical approach

### 5.1 Schemas (`packages/schemas/src/entities/alliance-lead/`)

- New `AllianceLeadProvisioningOutcomeSchema` in `alliance-lead.provisioning.schema.ts` (exported from `index.ts`): `{ provisioned: boolean, reason?: AllianceLeadProvisionSkipReasonSchema, hostTradeId?: uuid }` where the reason is the closed enum of the four `ProvisionSkipReason` values. Add a refinement: `provisioned: true` requires `hostTradeId` and forbids `reason`.
- `AllianceLeadWithProvisioningSchema = AllianceLeadSchema.extend({ provisioning: AllianceLeadProvisioningOutcomeSchema.optional() })`, used as the `mark-handled` and `provision` response schema. `AllianceLeadSchema` itself is untouched (it doubles as the list allowlist).
- `ProvisionSkipReason` in `alliance-lead.provisioning.ts:44` must be derived from, or pinned by a test to, the schema enum, so the two cannot drift (single source of truth is `@repo/schemas`).

### 5.2 Service (`packages/service-core/src/services/alliance-lead/alliance-lead.service.ts`)

- `markHandled` keeps its signature but resolves to `AllianceLead & { provisioning?: ProvisioningOutcome }`. `applyDecision` returns `{ row, provisioning }` and the outcome is mapped (`provisioned: true` + `hostTradeId`, or `provisioned: false` + `reason` + optional `hostTradeId`). For rejections and kinds other than `service_provider` nothing is added.
- New method `provisionListing({ actor, id }, ctx?)`:
  1. `ALLIANCE_LEAD_MANAGE` check (same message as `markHandled`).
  2. Open one transaction (`withServiceTransaction`; reuse `ctx.tx` when given).
  3. Read the lead `FOR UPDATE` (new model method `findByIdForUpdate`, pattern of `findByIdForShare` in `packages/db/src/models/hostTrade/host-trade-category-group.model.ts:80`); `NOT_FOUND` if missing.
  4. Kind check (`VALIDATION_ERROR` with `details.reason`), status check (`ALREADY_EXISTS` with `details.reason`).
  5. `provisionServiceProviderListing` with the locked row; on `provisioned`, write `provisionedHostTradeId` and `updatedById` in the same transaction.
  6. After commit, when OQ-1 option 1 applies, mint and send the claim invite using the existing `_claimInviter` port; never call `_decisionNotifier`.
  7. Return `{ lead, provisioning }`.
- The two codepaths (`markHandled` and `provisionListing`) share one private helper that maps a `ProvisionListingResult` to the outcome, so the mapping exists once.

### 5.3 API (`apps/api/src/routes/alliance/admin/`)

- `provision.ts`: `createAdminRoute`, `POST /:id/provision`, `requiredPermissions: [ALLIANCE_LEAD_MANAGE]`, `requestParams.id` uuid, no body, `responseSchema: AllianceLeadWithProvisioningSchema`, status 200. Same service construction as `mark-handled.ts:34-38` (claim-invite port wired, decision notifier is wired but never used by this method). Register in `index.ts` and `apps/api/route-manifest.json`, and extend the barrel comment.
- `mark-handled.ts`: response schema becomes `AllianceLeadWithProvisioningSchema`; description fixed (AC-5.1).
- Add a row to `apps/api/docs/route-architecture.md` (admin alliance routes) and note the new `details.reason` values in `error-contract.md`.

### 5.4 Admin (`apps/admin/src/features/alliance-leads/`)

- `hooks/useAllianceLeads.ts`: `markAllianceLeadHandled` returns `AllianceLeadWithProvisioning`; new `useProvisionAllianceLeadMutation` (invalidates `allianceLeadKeys.lists()`); fix the header and JSDoc.
- New `hooks/useLeadCategories.ts`: given `categorySlugs`, returns `{ items: [{ slug, label, state: 'active' | 'inactive' | 'deleted' | 'missing' }], status: 'loading' | 'ready' | 'forbidden' | 'error' }`. Fetches the admin catalog with `includeDeleted=true` through `GET /api/v1/admin/host-trade-categories` (all pages, cap 20 pages like `host-trade-category-api.utils.ts:33`) and resolves labels with `resolveI18nText`. `use-host-trade-categories.ts` `HostTradeCategoryFilters` gains `includeDeleted?: boolean` (HOS-2340 adds the same filter: whichever lands first adds it, the other reuses it).
- `components/AllianceLeadInbox.tsx`: `HandleDialog` renders the categories block (US-2) and picks the toast from `result.provisioning` (US-1); `RowActions` adds the retry button; the status cell adds `AllianceLeadProvisioningBadge` (new file `AllianceLeadProvisioningBadge.tsx`). A pure helper `needsProvider(lead)` (`status === 'approved' && kind === 'service_provider' && !provisionedHostTradeId`) lives next to the badge so the cell, the button and the tests share one predicate. Fix the header and JSDoc (AC-5.2).
- i18n (`packages/i18n/src/locales/{es,en,pt}/admin-entities.json`, under `allianceLeads`): `handle.categoriesLabel`, `handle.categoryState.{inactive,deleted,missing}`, `handle.categoriesNote`, `handle.catalogUnavailable`, `handle.warningNoActiveCategory`, `handle.warningLegacy`, `badge.providerNotCreated`, `actions.createProvider`, `actions.creatingProvider`, `provision.success`, `provision.alreadyExists`, `provision.error`. Update `untranslated-spanish.baseline.json` if the guard requires it.

## 6. Alternatives considered

| | Option | Why not |
|---|---|---|
| A | Refuse approval when provisioning would skip | Strands applicants and contradicts D7; the approval decision is independent of catalog state |
| B | Retry by re-approving through `mark-handled` | Already works today, but re-sends the decision email and claim invite and re-overwrites the decision note. Rejected by the owner (D5) |
| C | Retry endpoint with a flag on `mark-handled` (`provisionOnly`) | Overloads one route with two meanings, and permission/error semantics diverge (409/422 only make sense for the retry) |
| D | Return the outcome as a new top-level wrapper `{ lead, provisioning }` | A breaking change for every consumer of `mark-handled`; additive merge (D1) avoids it |
| E | Store the skip reason on the lead (new column) | A DB change for something derivable from `status`, `kind` and `provisionedHostTradeId` (D4); the reason is only needed in the moment it happens |
| F | Persist the warning only as a toast | Toasts vanish; the badge is derived state, so it survives reloads and other admins see it |

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | A lead approved long ago and never provisioned shows the badge for pre-HOS-919 data | Intended: it is exactly the population the badge is for. The retry handles legacy leads by returning `legacy-lead-without-typed-fields` |
| R2 | The applicant got an «approved» email but has no provider | Out of scope; this spec only gives the admin the tool to fix it. A follow-up can adjust the email |
| R3 | The inbox needs `HOST_TRADE_CATEGORY_VIEW` to resolve names | Graceful fallback to raw slugs (AC-2.4) |
| R4 | `markHandled` return type change touches existing tests (`alliance-lead.service.test.ts`, `alliance-lead.service.categories.test.ts`, route tests) | Additive; tests that assert the lead keep passing; new tests assert the outcome |

## 8. Testing strategy

| AC | Level | Test |
|---|---|---|
| AC-1.1..1.5 | unit (service) | `alliance-lead.service.categories.test.ts`: outcome mapping for success, `no-active-category`, legacy, already-provisioned, reject, other kinds |
| AC-1.6, §5.1 | unit (schemas) | schema test: outcome refinement, additive validation of a lead without `provisioning`, enum pinned to `ProvisionSkipReason` |
| AC-1.2, 1.3, 1.4 | component (admin) | `alliance-leads.test.tsx`: warning vs success toast chosen from `provisioning` |
| AC-2.1..2.6 | component (admin) | `HandleDialog` categories block: active/inactive/deleted/missing, 403 fallback, loading, error, hidden for other kinds; `useLeadCategories` unit test |
| AC-3.1..3.4 | component + unit | `needsProvider` truth table; badge and button rendering; permission gate |
| AC-4.1..4.3 | unit (service) + route | `provisionListing` happy path, still-no-category, already provisioned |
| AC-4.4 | DB integration | two concurrent `provisionListing` calls create one `host_trades` row (real DB, `FOR UPDATE`) |
| AC-4.5 | unit (service) | claim inviter called once only for a newly created listing of an unclaimed lead; decision notifier never called |
| AC-4.6 | route | `apps/api/test/routes/alliance/admin/provision.test.ts`: 401, 403, 400, 404, 422, 409, 200 outcomes, exact `error.code`. Assert on port/service call counts, not only status (route tests in this app can hide behind conditional assertions) |
| AC-4.7 | component (admin) | disabled + label while pending; error toast on rejection |
| AC-4.8 | unit (service) | model update rejects, assert nothing persisted and error logged |
| AC-5.1, 5.2 | static test | grep guard over the four touched files for the old sentences |

Smoke (staging, label `status-needs-smoke-staging`): deactivate every category of a test lead, approve it, see the warning toast and badge; reactivate a category (HOS-2340), press «Crear proveedor», confirm the provider exists, the badge is gone, no second approval email arrived, and (OQ-1) a claim invite arrived.

## 9. Suggested tasks (phased)

**Phase 1, contracts:** outcome schemas + exports; pin `ProvisionSkipReason`; error-contract note.
**Phase 2, core:** outcome mapping helper; `markHandled` returns the outcome; model `findByIdForUpdate`; `provisionListing` (without the invite); service unit tests.
**Phase 3, API:** `provision.ts` route, `mark-handled` response + description, manifest, docs; route tests.
**Phase 4, admin:** hooks (`useProvisionAllianceLeadMutation`, `useLeadCategories`); `HandleDialog` categories + toasts; badge + button; i18n (es, en, pt); component tests.
**Phase 5, integration and docs:** concurrency DB integration test; stale-comment fixes + static test.
**Phase 6:** claim invite on retry (AC-4.5, OQ-1 resolved as option 1).
**Phase 7, verification:** tests, guards, staging smoke, sign-off.
