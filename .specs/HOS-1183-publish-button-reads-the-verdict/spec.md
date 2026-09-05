---
title: The publish button reads the server's verdict
linear: HOS-1183
statusSource: linear
created: 2026-09-05
type: fix
areas:
  - web
  - api
  - billing
---

# The publish button reads the server's verdict

## 1. Summary

`POST /accommodations/:id/publish` resolves **three** outcomes and **two of them publish**. The card's publish button gates on **one boolean** that means "does this owner have a plan loaded" — which is `has_active_sub` and nothing else. So the button is hidden from exactly the owner the server would let publish: the one whose accommodation trial is still intact.

This spec replaces that boolean with the server's own verdict, read through a new endpoint that reuses the existing resolver rather than re-deriving it, and keeps the plans link for the one case that still needs it.

## 2. Problem

### 2.1 The two sides disagree, measured

| Verdict | Server (`publish()`) | Card button today |
| -- | -- | -- |
| `has_active_sub` | publishes | offers "Publicar" |
| `first_publish` | **publishes**, starting a local trial | **hides the button**, offers the plans link |
| `subscription_required` | rejects 403 | offers the plans link |

The middle row is the bug. `apps/web/src/lib/host/usage-badge.ts:179`:

```ts
const hasOwnerPlan = entitlementsJson.data?.plan != null;
```

An owner with no subscription and an unused accommodation trial has `plan == null`, so `hasOwnerPlan` is `false`, so `PublishButton.client.tsx:262` returns early and replaces the whole button with a link to `/planes/anfitriones/precios/`.

### 2.2 How it got here — a premise flipped under a correct fix

The branch is not an oversight; it is documented at `PublishButton.client.tsx:24-53` and was the fix for **HOS-498 (H-99)**: offering "Publicar" without a plan opened a dialog promising the listing would go live, then failed on confirm — and, until the server's guard order was flipped, failed citing bathrooms rather than the missing plan.

It was correct under the premise of its time. **HOS-171** had moved the trial onto the MercadoPago preapproval that CHECKOUT creates, so publishing without a plan was genuinely impossible, and "no plan" and "cannot publish" were the same sentence.

**HOS-1012 reverted that premise.** The trial came off MercadoPago and became a local row (`mp_subscription_id = NULL`) inserted in the same transaction as the lifecycle flip — so the clock starts when the listing goes live. The server was updated. The boolean was not. HOS-498 is `Done` and was never wrong; the ground moved under it.

### 2.3 The fail-open comment is no longer true

`propiedades/index.astro:86-88` justifies defaulting `hasOwnerPlan` to `true` on a fetch error by stating the value "only gates a proactive nag banner, never actual publish capability". That stopped being true when H-99 wired the same value into the button. One value now gates both, and the comment reads as a guarantee that no longer holds.

## 3. Findings that amend the issue

### F-1 · The verdict is not readable anywhere

`checkEligibility` is a closure inside `buildAccommodationPublishDeps` (`apps/api/src/services/accommodation-publish-deps.ts:135`). It is reachable only through the deps object `publish()` holds. There is no GET that answers "which of the three am I", so the only way to learn the verdict today is to POST `/publish` and take the 403.

This is why the fix needs a new endpoint and not a new field on an existing one.

### F-2 · HOS-1156's precheck answers a different question

`GET /protected/publish/precheck/{vertical}` returns `{ currentCount, maxAllowed, hasQuota, draftCount, drafts, decision }` — the cap and the owner's DRAFTs. It answers **"can you CREATE another listing"**, asked before a create form renders. This spec needs **"can you put THIS one live"**, asked on a card that already exists. Different gate, different moment, different consumer page. Merging them would couple two questions that never separate again.

### F-3 · The server states the rule by EXCLUSION, and that decides the design

`accommodation.service.ts:1885-1888`:

```ts
if (eligibility === 'subscription_required') {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
}
startsLocalTrial = eligibility === 'first_publish';
```

Publishing is not granted to a listed set; it is *denied* to one value. If the new endpoint derived its answer by INCLUSION (`=== 'first_publish' || === 'has_active_sub'`), the two sides would agree today and diverge the moment a fourth `PublishEligibility` value is added: the server would publish it and the UI would hide the button — today's bug, mirrored.

So `canPublish` is derived **once**, by a pure function next to the type, and BOTH `publish()` and the new route call it.

### F-4 · Three existing tests freeze the branch this spec changes

`apps/web/test/components/host/PublishButton.test.tsx` has 8 tests; three of them assert the current contract with `hasActivePlan: false`. They are supposed to fail — they are H-99's guard doing its job, and the spec changes the contract deliberately. They get **rewritten with the reason**, never deleted, and the protection they hold (never offer publishing that cannot succeed) must still be asserted afterwards, now against `subscription_required`.

### F-5 · The trial is 30 days and the dialog does not mention it

`OWNER_TRIAL_DAYS = 30`. The confirm copy is "¿Publicar este alojamiento?" / "Va a aparecer en el sitio, visible para los turistas." — it says nothing about billing, because HOS-171 deliberately stripped that promise when the trial moved to MercadoPago. With HOS-1012, publishing starts the clock again, so the reason for stripping it is gone while the copy is not.

## 4. Scope

**In:** the read endpoint · one shared pure predicate · repointing the web chain · the confirm dialog announcing the trial on `first_publish` · rewriting the three frozen tests.

**Out:** commerce verticals (their listings go live through checkout — see HOS-1184) · the post-edit dialog (inherits this verdict, specified after) · the `--brand-accent`/`--core-card` contrast debt.

## 5. Decisions taken (owner, 2026-09-05)

**D-1 · A dedicated read endpoint**, `GET /api/v1/protected/accommodations/publish-eligibility`, resolved at OWNER level. The page fetches it once, inside the `Promise.all` it already runs, and passes the result to every card — exactly the shape `hasOwnerPlan` has today.

Rejected: a field on `/users/me/entitlements` (would make a transversal endpoint resolve accommodation billing for every caller), and folding it into HOS-1156's precheck (F-2).

**D-2 · The dialog announces the trial on `first_publish`.** Publishing starts a 30-day clock by the owner's own action; not saying so is what later produces "my trial was consumed without warning". The line appears **only** in that branch. It must not say "sin tarjeta": the card is requested at signup.

## 6. Acceptance criteria

### 6.1 The endpoint

- **AC-1** · Answers 200 with `{ eligibility, canPublish }` for an authenticated owner.
- **AC-2** · `eligibility` is what `checkEligibility(actor.id)` returns — by calling it, not re-deriving it.
- **AC-3** · `canPublish` comes from the shared predicate of AC-4, never an inline comparison.
- **AC-4** · A pure `publishEligibilityAllowsPublish()` lives beside the `PublishEligibility` type in `@repo/service-core`, states the rule by EXCLUSION, and is called by BOTH `publish()` and the new route. A static guard fails CI on a second inline comparison site.
- **AC-5** · Unauthenticated → 401.
- **AC-6** · Billing disabled or customer row missing → `subscription_required` / `canPublish: false`, inherited from `checkEligibility` rather than restated.

### 6.2 The web chain

- **AC-7** · `PublishButton` receives the verdict, not `hasActivePlan`. The prop is removed, not kept alongside.
- **AC-8** · `first_publish` and `has_active_sub` both render the button.
- **AC-9** · `subscription_required` renders the plans link exactly as today.
- **AC-10** · A failed fetch keeps the button visible (fail-open); the comment at `propiedades/index.astro:86-88` is corrected to say what the value now gates.
- **AC-11** · The "necesitás un plan" banner keeps its trigger on `hasOwnerPlan` — the two consumers stop sharing one value.

### 6.3 The dialog

- **AC-12** · On `first_publish` the confirm step adds one line stating the 30 days start on publishing. Never says "sin tarjeta".
- **AC-13** · On `has_active_sub` the confirm copy is byte-identical to today's.
- **AC-14** · The day count comes from `resolveGenericOwnerTrialDays`, never a literal `30`.
- **AC-15** · New strings exist in es/en/pt. No entry is added to `scripts/i18n-fallback-inventory.json` — that list may only shrink.

## 7. Open questions

None. D-1 and D-2 are resolved; the post-edit dialog is deliberately out of scope until this ships.

## 8. Risks

- **R-1 · Reintroducing H-99.** Deleting the branch instead of narrowing it brings back a dialog that promises the listing goes live and then fails. AC-9 and the rewritten tests hold this.
- **R-2 · The two sides drifting again.** This whole bug is one side of a two-sided rule being updated alone. AC-4's shared predicate plus its guard is the structural answer.
- **R-3 · One more SSR fetch on the properties page.** Joins the existing `Promise.all`; must not be awaited serially.
- **R-4 · A billing read on a hot page.** Runs per page load, not per card. A per-card fetch would multiply it by portfolio size.

## 9. Test plan

Route tests for the three verdicts plus 401 · a unit test per branch of the shared predicate, including that a value outside the union does NOT publish · a static guard for AC-4 · rewritten `PublishButton` tests · a test that the trial line appears on `first_publish` and is absent on `has_active_sub` · mutation-verify each new test.

## 10. Sequencing

The implementation branch is cut **after PR #3223 (HOS-1156) merges** — that PR touches two of the four files in the chain, and working both in parallel guarantees a conflict.
