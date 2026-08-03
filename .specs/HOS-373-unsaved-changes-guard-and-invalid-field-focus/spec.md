---
title: Unsaved-changes guard and first-invalid-field focus in apps/web editors
linear: HOS-373
statusSource: linear
created: 2026-08-03
type: feature
areas:
  - web
---

# Unsaved-changes guard and first-invalid-field focus in `apps/web` editors

## 1. Summary

Two independent usability gaps in the `apps/web` editors, delivered as two
phases behind one spec:

- **Phase 1 — Unsaved-changes guard.** Nothing warns a user who leaves an editor
  with unsaved edits. Add a guard covering hard exits (`beforeunload`) and
  internal link clicks (capture-phase `click` interception). Back/forward is
  deliberately **not** covered — see NG-6; the mechanism the issue proposed for
  it turned out not to work at all (§5.2.1).
- **Phase 2 — First-invalid-field focus.** A failed submit shows a generic toast
  and nothing else. Move focus to the first invalid field. The real work is not
  the focus call: it is establishing a reliable Zod-field → input-id contract,
  which does not exist today.

Each phase ships as its own PR. Phase 1's PR carries **no** Linear magic word;
Phase 2's PR carries `Closes HOS-373`.

## 2. Problem

### 2.1 Nothing warns before losing edits

`beforeunload` does not appear anywhere in `apps/web/src` or in `packages/`
(verified by grep). A user who edits an accommodation or a commerce listing and
then closes the tab, hits back, or clicks any internal link loses everything
silently.

This is worse than a plain unload guard would be, because both editor pages
render through `AccountLayout.astro` → `BaseLayout.astro`, which mounts
`<ClientRouter />` (`BaseLayout.astro:140`). Internal navigation is soft and
never fires `beforeunload` at all. A `beforeunload`-only fix would leave the most
common exit path — clicking a link in the site's own header — completely
unguarded.

The codebase already documents this as known debt, in
`apps/web/src/components/host/editor/TranslationPanel.client.tsx:23-33`:

> The page NEVER reloads on its own. This panel is a `<fieldset>` inside the
> editor's `<form>`, and `apps/web` has no `beforeunload` guard anywhere, so an
> automatic reload silently discarded whatever the host had typed and not yet
> saved. […] warning the host before it happens needs the editor's dirty state
> and is tracked separately.

It compounds [HOS-372](https://linear.app/hospeda-beta/issue/HOS-372) (commerce
photos are lost if the owner does not save): today nothing tells them.

### 2.2 A failed submit gives no way to find the error

Neither editor focuses the first invalid field, and neither renders an
error summary above the form. In the accommodation editor — 12 sections — a
validation failure in a distant section leaves the user with only a generic
toast (`use-zod-form.ts:131-136`, `"Revisá los campos marcados"`) and no hint of
where to look.

## 3. Goals

- **G-1** Warn before losing unsaved edits in both editors, covering hard unload
  **and** Astro soft navigation.
- **G-2** On a failed submit, move focus to the first invalid field's input.
- **G-3** Establish a single, tested Zod-field → input-id contract that makes G-2
  possible and prevents silent regressions.
- **G-4** Leave the accommodation editor's per-field error rendering on the
  shared `FieldError` component instead of six hand-rolled copies.

## 4. Non-goals

- **NG-1** Autosave or draft persistence. This spec warns; it does not save.
- **NG-2** Migrating the other nine `useZodForm` consumers to the id contract.
  Phase 2 makes the primitive safe for them and *reports* which ones are not yet
  covered (see G-3's guard); wiring them is follow-up work.
- **NG-3** An error-summary banner listing every invalid field. Focus only.
- **NG-4** Rebuilding the editors around a shared `<TextField>` wrapper. See
  OQ-2 — that is the alternative design, deliberately deferred unless chosen.
- **NG-5** Guarding the secondary mini-forms that are not part of the editors'
  main `handleSubmit` (`CalendarProviderRow`, `ExternalReputationSection`,
  `TranslationPanel`, `FeaturedToggleSection`).
- **NG-6** Guarding **back/forward navigation** (OQ-1, resolved). It needs a
  history trap; see P1-4. A user who presses back still loses unsaved edits after
  this spec ships. Stated here so the limitation is explicit rather than implied
  by "covers soft navigation".

## 5. Current baseline

### 5.1 Dirty state — one mechanism, not two

The Linear issue states the two editors track dirty state with different
mechanics (a `Set<string>` of field groups in commerce, a baseline diff in
accommodation). **This is wrong.** Both use the same baseline-diff pattern; the
commerce editor's own comment says so:

```tsx
// CommerceListingEditor.client.tsx:355-362
const [formData, setFormData] = useState<CommerceEditData>(buildInitialEditData);
// The PATCH diff is computed against this MUTABLE baseline, resynced to the
// persisted values after every successful save — mirroring the accommodation
// editor (HOS-190 F6). ...
const [baseline, setBaseline] = useState<CommerceEditData>(buildInitialEditData);
```

The `Set<string>` that exists in commerce is for `amenityIds`/`featureIds` value
storage and a set comparator, not dirty tracking.

| | Commerce | Accommodation |
|---|---|---|
| File | `components/commerce/CommerceListingEditor.client.tsx` (606 ln) | `components/host/AccommodationEditor.client.tsx` (731 ln) |
| Dirty mechanism | baseline diff | baseline diff |
| Baseline resync after save | `setBaseline(persisted)` (:478) | `setBaseline(formData)` (:448) |
| Reactive dirty flag | ✅ `canSave` memo (:499-502) | ❌ none — diff computed only inside `handleSubmit` (:412) |
| Exposed outside component | ❌ | ❌ |

The single asymmetry that matters for Phase 1: **the accommodation editor has no
reactive dirty flag.** It computes `buildPatchPayload(formData)` once, on submit.
A guard needs the value on every render.

### 5.2 Navigation — this would be the repo's first cancelled navigation

- Both editor pages route through `AccountLayout.astro` → `BaseLayout.astro`,
  which renders `<ClientRouter />` at `BaseLayout.astro:140`.
  - `pages/[lang]/mi-cuenta/propiedades/[id]/editar.astro`
  - `pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro`
- The repo has ~40 `astro:*` listeners. **None of them calls `preventDefault()`.**
  All are cosmetic or state-sync (progress bar, theme reapply, scroll reveal,
  dialog-history, sticky headers). This spec introduces the first one that
  actually cancels a navigation.
- The precedent the issue points at, `nav-progress.ts:192-207`, only *observes*
  the event to drive a progress bar. Note the path: the file lives in
  `components/shared/navigation/`, not `lib/` as the issue says.

**`astro:before-preparation` is genuinely cancelable** — verified in the
installed Astro 7.0.9 source, not inferred from docs (which never state it):

```js
// astro/dist/transitions/events.js:38-50 — the event is constructed with:
super("astro:before-preparation", { cancelable: true }, ...)
```

But the surrounding flow imposes a hard constraint the issue did not anticipate:

```js
// astro/dist/transitions/events.js:99-107
if (document.dispatchEvent(event)) {   // false when a listener called preventDefault()
    await event.loader();              // ← skipped entirely when cancelled
    if (!event.defaultPrevented) { ... }
}
```

The listener runs **synchronously** inside `document.dispatchEvent(event)`.
There is no way to `await` a user's answer inside it.

### 5.2.1 Measured: cancelling the event does NOT stop the navigation

Verified empirically on 2026-08-03 against this worktree's dev server
(`localhost:4433`, Astro 7.0.9, Chromium via Playwright), by installing a
listener that unconditionally calls `preventDefault()` on
`astro:before-preparation` and observing what the browser actually did. The
probe scripts and raw results are in `docs/r1-probe-findings.md`.

**Baseline — soft navigation works and the event is cancelable.** An
observe-only probe recorded the full lifecycle on an internal link click, with
the `window` object surviving (i.e. no page reload):

```
before-preparation  navigationType=push  cancelable=true
after-preparation
before-swap         navigationType=push  cancelable=false   ← matches the docs
after-swap
page-load
```

**Result A — cancelling a `push` (link click) degrades to a full page load.**

```
cancelled:      1            our listener did call preventDefault()
unloadFired:    true         a NATIVE navigation happened anyway
probeSurvived:  false        window was destroyed → full page load
final url:      /es/contacto/  the navigation completed regardless
```

Cancelling the event tells Astro "do not handle this navigation". It does not
tell the browser to stay. The `<a>`'s native navigation proceeds, the user
leaves anyway, and the SPA state is lost — strictly worse than doing nothing.

**Result B — cancelling a `traverse` (back button) is worse still.** With a
history stack built entirely by the router:

```
navType:        "traverse"
urlAtDispatch:  "/es/destinos/"   ← the URL had ALREADY moved when the event fired
to:             "/es/destinos/"
cancelled:      1
final url:      /es/destinos/     navigated anyway
```

Compare with the `push` case, where `urlAtDispatch` was still the origin page.
On a back/forward traversal the browser commits the history entry **before**
Astro dispatches the event, so by the time a listener can decide, the address bar
has already changed — and cancelling does not put it back.

**Conclusion: `astro:before-preparation` cannot be used to block navigation.**
It is an interception point for *modifying* a navigation (its `loader`, its
`direction`), not for preventing one. §6's design accounts for this.

### 5.3 No confirmation primitive exists

- No `useUnsavedChanges` / `useConfirm` / `useBeforeUnload` hook in
  `apps/web/src/hooks/`, `apps/web/src/lib/`, or `packages/`.
- **No shared modal component exists.** `apps/web/CLAUDE.md` lists "Modal" among
  the `ui/` primitives — that line is stale; there is no `Modal.tsx`. Every
  feature that needs one builds its own `*.client.tsx` + `*.module.css` pair.
- The only precedent for a confirm is `window.confirm()`, used for a destructive
  action in `CollectionDetailActions.client.tsx` and accepted as an MVP pattern.

### 5.4 The Zod-field → input-id contract does not exist

`fieldErrorId()` names the **message**, never the input:

```tsx
// apps/web/src/components/ui/FieldError.tsx:43-45
export function fieldErrorId(fieldName: string): string {
    return `${fieldName}-error`;
}
```

There is no `fieldInputId()`. Every input's `id` is a hand-written literal at
**~30+ call sites across 13 section files**, kept in sync with the error message
only by the developer remembering to write
`aria-describedby={... ? fieldErrorId('name') : undefined}`.

**A pure string template cannot bridge it**, because three naming layers have
drifted apart independently:

| Zod schema key | React state key | DOM id | Where |
|---|---|---|---|
| `facebook` | `facebookUrl` | `acc-facebook` | accommodation social |
| `destinationId` | `destinationId` | `acc-destination` | accommodation basic info |
| `phone` | `phone` | `acc-phone-country` **+** `acc-phone-number` | accommodation contact |
| `contactInfo.mobilePhone` | — | `ce-phone-country` **+** `ce-phone-number` | commerce contact |

The accommodation social drift is already patched by hand with a lookup table
(`SOCIAL_FIELD_TO_SCHEMA_KEY`, `AccommodationEditor.client.tsx:178-208`).

Fields with **no `id` at all** today:

| Field | File | Shape |
|---|---|---|
| `socialNetworks.*` (6 inputs) | `commerce/editor/SocialNetworksSection.client.tsx:45` | `aria-label` only |
| `openingHours` (7 days × N shifts) | `commerce/editor/OpeningHoursSection.client.tsx:88,111,127` | one aggregate error, many inputs |
| `description` / `richDescription` | `editor/RichTextEditor.client.tsx` | contenteditable, not an `<input>` |

> The issue claims `contactInfo.mobilePhone` and `contactInfo.workEmail` have no
> `id`. **That is stale** — HOS-371 (commit `7c5db4319`) fixed both. The class of
> bug it describes is real, but it now lives in the three rows above.

### 5.5 The injection point is shared by eleven forms

`validate()` in `use-zod-form.ts:120-141` is where `parseError.issues` is
available in order — the natural place to resolve "first invalid field". That
hook has **eleven** consumers, not two:

`AccommodationEditor`, `CommerceListingEditor`, `CommerceCreateForm`,
`CreatePropertyMiniForm`, `CalendarProviderRow`, `ContactHost`,
`CommentThreadIsland`, `ProfileEditForm`, `ProfileCompletion`,
`CreateEditCollectionModal`.

This cuts both ways. Implementing focus inside `validate()` gives all eleven the
behavior for free — but wherever the id contract is missing, the focus call
**fails silently**: `document.getElementById()` returning `null` throws nothing.
Nobody finds out until a user complains. That is why G-3 requires a static guard,
not care.

### 5.6 Error rendering is hand-rolled in 6 of 6 sections

Every field-bearing section of the accommodation editor reimplements
`<span id="acc-<field>-error" role="alert">` by hand instead of importing the
shared `FieldError`: `BasicInfoSection` (5), `CapacitySection` (3),
`PricingSection` (1), `LocationPicker` (2), `ContactInfoSection` (4),
`SocialNetworksSection` (1, via a local `SocialUrlField`). That is 100% of them —
not "some", as the issue implies. Only the mini-forms outside `handleSubmit`
(`ExternalReputationSection`, `CalendarProviderRow`) use the shared helper.

## 6. Proposed design

### Phase 1 — Unsaved-changes guard

**P1-1. Give the accommodation editor a reactive dirty flag.**
Extract the diff currently inlined in `handleSubmit` into a `useMemo`, mirroring
commerce's `canSave`. Both editors then expose an equivalent `isDirty` boolean
internally.

> Behavior must not change: the memo has to produce exactly what
> `buildPatchPayload(formData)` produces at submit time, or the "no changes"
> path silently breaks. This is a refactor with a regression test, not a rewrite.

**P1-2. Add `apps/web/src/lib/forms/use-unsaved-changes-guard.ts`.**

```ts
export interface UseUnsavedChangesGuardOptions {
    /** Whether the form currently holds unsaved edits. */
    readonly isDirty: boolean;
    /** Localized confirmation text shown on soft navigation. */
    readonly message: string;
}

export function useUnsavedChangesGuard(
    options: UseUnsavedChangesGuardOptions
): void;
```

It registers, and cleans up, listeners while `isDirty` is true. Per §5.2.1,
`astro:before-preparation` is **not** among them — cancelling it does not stop a
navigation, it only downgrades one:

| Exit path | Mechanism | Confidence |
|---|---|---|
| Tab close, reload, external URL | `beforeunload` + `preventDefault()` | Standard, works |
| Internal link click | `click` listener on `document` in the **capture phase**, before the router sees it | Design below |
| Back / forward | History trap — see P1-4 | Design below, has real cost |

**P1-3. Intercept the click, not the router event.**
Astro's router acts on a normal `click` on an `<a>`. A capture-phase listener on
`document` runs *before* the router's own handler, and calling `preventDefault()`
there stops the navigation outright — the native navigation never starts, so
Result A does not apply. It is also free of the synchronous constraint from §5.2:
because nothing has begun, the guard may show an async dialog and, on confirm,
re-issue the navigation itself with `navigate(href)` from
`astro:transitions/client`.

The listener must ignore: modified clicks (Ctrl/Cmd/Shift/middle),
`target="_blank"`, `download`, external origins, and pure hash changes.

**P1-4. Back/forward is OUT OF SCOPE for this spec** (OQ-1 resolved 2026-08-03).

Per Result B the URL has already moved by the time any event fires, so the only
technique that covers it is a history trap: a sentinel entry pushed on mount, and
a `popstate` handler that immediately `history.pushState`es back while asking for
confirmation. That mutates the user's history stack, must coexist with the repo's
existing `dialog-history.ts` / `useDialogHistoryBack` machinery (which already
manipulates history for modals), and is the classic source of "the back button is
broken" bugs — materially larger and riskier than the rest of Phase 1 combined.

**A user who presses back still loses their edits.** That is a known, accepted
limitation of this spec, not an oversight. It goes to a follow-up issue.

**P1-5. Wire it into both editors** and add the i18n keys (see §7.3).

### Phase 2 — First-invalid-field focus

**P2-1. Add `fieldInputId()` next to `fieldErrorId()`** in
`components/ui/FieldError.tsx`, backed by an **explicit lookup table**, not a
template (per §5.4). Shape:

```ts
/** Maps a Zod field path to the DOM id of the input that should receive focus. */
export type FieldInputIdMap = Readonly<Record<string, string>>;

export function fieldInputId(
    fieldName: string,
    map: FieldInputIdMap
): string | undefined;
```

Each editor owns its own map (`ACCOMMODATION_FIELD_INPUT_IDS`,
`COMMERCE_FIELD_INPUT_IDS`), colocated with the editor. Composite phone fields
map to the `-number` input — that is where `aria-describedby` already points.

**P2-2. Close the three id gaps** from §5.4: give ids to commerce
`socialNetworks.*` and `openingHours`, and decide a focus target for
contenteditable rich text (OQ-3).

**P2-3. Focus the first invalid field.** Extend `useZodForm` with an optional
`fieldInputIds` option. When present, `validate()`'s failure branch resolves the
first issue's path through the map and focuses it. When absent, behavior is
exactly as today — the other nine consumers are unaffected until they opt in.

Focus must `scrollIntoView` and respect `prefers-reduced-motion` (the repo
already has `use-reduced-motion.ts`).

**P2-4. Add the static guard (G-3).** A test that, for every editor wired with a
`fieldInputIds` map, asserts every key of that map resolves to an `id` literal
that actually exists in the section sources. Discovery must be by reference to
the map symbol, not by grepping for a syntax pattern — otherwise a renamed field
silently drops out of coverage.

**P2-5. Migrate the 6 accommodation sections to `FieldError`** (G-4). Mechanical,
but it is what keeps the id contract from drifting again.

## 7. Data model / contracts

No DB, schema, or endpoint changes. No migrations. No env vars.

### 7.1 New files

| Path | Phase |
|---|---|
| `apps/web/src/lib/forms/use-unsaved-changes-guard.ts` | 1 |
| `apps/web/test/lib/forms/use-unsaved-changes-guard.test.ts` | 1 |
| `apps/web/src/components/host/editor/field-input-ids.ts` | 2 |
| `apps/web/src/components/commerce/editor/field-input-ids.ts` | 2 |
| `apps/web/test/lib/forms/field-input-id-contract.test.ts` (guard) | 2 |

### 7.2 Changed contracts

`UseZodFormOptions` gains one optional, backward-compatible field:

```ts
/** When supplied, a failed `validate()` focuses the first invalid field's input. */
readonly fieldInputIds?: FieldInputIdMap;
```

### 7.3 i18n

Keys live under the `editor` namespace, in `host.json` (accommodation) and
`commerce.json` (commerce), across `es`/`en`/`pt` — **6 JSON files minimum**.
Per `apps/web/CLAUDE.md`, `en`/`pt` may carry the `es` text until translated, but
the key must exist in all three.

Proposed: `editor.unsavedChanges.confirm`.

## 8. UX / UI behavior

- **Hard unload**: the browser's own dialog. The string is not customizable —
  `event.preventDefault()` is the entire API. Do not try to pass a message.
- **Soft navigation**: per OQ-1.
- **Not dirty**: no listeners registered at all. Navigation is untouched.
- **After a successful save**: the baseline resyncs, `isDirty` goes false, and
  the guard unregisters. Saving then leaving must never prompt.
- **Failed submit**: the existing toast stays; focus moves to the first invalid
  field, scrolled into view.

## 9. Acceptance criteria

### Phase 1 criteria

- **AC-1** With unsaved edits in either editor, closing/reloading the tab
  triggers the browser's unsaved-changes dialog.
- **AC-2** With unsaved edits, clicking an internal link prompts for
  confirmation; cancelling keeps the user on the page with edits intact, the URL
  unchanged, **and no page reload** (assert the `window` object survived — a full
  reload is the exact failure mode §5.2.1 measured, and it looks like success
  from the URL alone).
- **AC-2b** Confirming the dialog completes the navigation as a soft transition,
  not a full page load.
- **AC-2c** Modified clicks (Ctrl/Cmd/Shift/middle), `target="_blank"`,
  `download`, external origins, and pure hash changes are not intercepted.
- **AC-3** With no unsaved edits, neither path prompts.
- **AC-4** After a successful save, leaving does not prompt.
- **AC-5** The accommodation editor's reactive dirty flag produces the same
  payload as the previous submit-time computation (regression test).
- **AC-6** Unmounting the editor removes every listener the guard registered.
- **AC-6b** Back/forward is documented as uncovered (NG-6). No test asserts a
  prompt there — a test that "passes" for back would mean the history trap got
  added without the decision being revisited.

### Phase 2 criteria

- **AC-7** A failed submit in either editor moves focus to the first invalid
  field's input and scrolls it into view.
- **AC-8** Focus lands on the `-number` input for composite phone fields.
- **AC-9** Every key in each editor's `fieldInputIds` map resolves to an `id`
  that exists in the rendered sources — enforced by the AC-11 guard.
- **AC-10** Commerce `socialNetworks.*` and `openingHours` inputs have ids.
- **AC-11** A static guard fails CI when a mapped field's input id is missing or
  renamed. Verify the guard by mutation: break one id, confirm it goes red.
- **AC-12** The nine `useZodForm` consumers that pass no `fieldInputIds` behave
  exactly as before.
- **AC-13** All 6 accommodation field sections render errors via `FieldError`.

## 10. Risks

- **R-1 — RESOLVED (2026-08-03), and it invalidated the original design.**
  Measured, not assumed — see §5.2.1. Cancelling `astro:before-preparation` does
  not prevent navigation in either direction: a `push` degrades to a full native
  page load (user leaves anyway, SPA state lost), and on a `traverse` the URL has
  already moved before the event fires. The design moved to capture-phase click
  interception (P1-3) plus an explicit decision on the history trap (P1-4).
  **Do not reintroduce `astro:before-preparation` cancellation** — it reads
  plausible, the docs do not contradict it, and it does not work.
- **R-2 — Silent focus failure.** A missing id makes focus a no-op with no error.
  Mitigated by AC-11, and only by AC-11.
- **R-3 — Test environment cannot verify focus.** jsdom does not implement real
  focus/scroll behavior reliably (prior art: `jsdom cannot test focus traps` —
  assert on `defaultPrevented`/`document.activeElement` and verify the real
  behavior in a browser, do not trust a green jsdom test alone).
- **R-4 — `beforeunload` fires on every reload in dev.** Guard registration must
  be strictly conditional on `isDirty`, or local development becomes miserable.
- **R-5 — P1-1 is a behavior-preserving refactor of live save logic.** Getting
  the memo subtly wrong breaks saving for every host. AC-5 is not optional.
- **R-6 — Phase 2 touches 13 files.** Per the repo's chained-PR guidance, if it
  exceeds ~400 lines it should be split again (contract + ids first, then the
  `FieldError` migration).

## 11. Open questions

- **OQ-1 — RESOLVED 2026-08-03 (owner decision): links + hard exits only.**
  Back/forward is deferred to a follow-up issue (see NG-6 and P1-4). Rationale:
  the history trap is riskier than everything else in Phase 1 put together, and
  the two covered paths already remove most of the data loss. Since P1-3 also
  removes the synchronous constraint, the dialog *may* be a styled async modal —
  but no shared modal exists (§5.3), so `window.confirm()` stays the lower-cost
  starting point unless someone wants to build one.
- **OQ-2 — Lookup table or a shared `<TextField>` wrapper?** P2-1 proposes the
  table because it is additive and low-risk. The alternative — introducing a
  shared field wrapper that owns `id`/`aria-describedby`/`FieldError` together —
  fixes the drift at its root and would make G-4 free, but it is a rewrite of
  ~30 call sites across 13 files. **Owner decision required.** NG-4 assumes the
  table unless overridden.
- **OQ-3 — What does focus target for non-input fields?** `openingHours` has one
  aggregate error across 7 days × N shift inputs, and rich `description` is a
  contenteditable with no `id`. Options: focus the section heading, focus the
  first control in the group, or exclude these fields from the map (documented,
  guard-exempt). Needs a UX call.
- **OQ-4 — Does Phase 1 cover the other nine `useZodForm` forms?** NG-2 says no.
  Confirm that is acceptable: `ProfileEditForm` and `CommerceCreateForm` can also
  lose typed work.

## 12. Implementation notes

- **Verify claims against code, not against this issue's history.** The Linear
  description has now been wrong twice (the `Set<string>` dirty mechanic, and the
  `mobilePhone`/`workEmail` ids that HOS-371 already fixed). §5 is the current
  verified baseline as of 2026-08-03.
- `astro:before-swap` is **not** cancelable — `preventDefault()` there is a
  documented no-op. `astro:before-preparation` is the only cancelable hook.
- Cancelling at `astro:before-preparation` skips `await event.loader()`
  entirely (`events.js:99-107`), so the next page is never fetched. It fires
  before any request and before browser state changes — which is what makes
  cancellation clean for link clicks. See R-1 for why `traverse` may differ.
- The repo's existing tests for the touched primitives live in
  `apps/web/test/lib/forms/use-zod-form.test.ts` and
  `apps/web/test/lib/forms/field-errors.test.ts` — run them, they are the
  regression surface for §7.2.
- No smoke-gate label is expected: this is local-verifiable UI behavior with no
  third-party integration, no cron, and no payment flow. Phase 1's browser
  behavior should still be checked manually in a real browser (R-3).

## 13. Linear

Canonical tracking:
[HOS-373](https://linear.app/hospeda-beta/issue/HOS-373)

Delivery: two PRs.

1. **Phase 1** — unsaved-changes guard. PR title
   `[HOS-373] feat(web): warn before leaving an editor with unsaved changes`.
   **No magic word** — this PR does not complete the spec.
2. **Phase 2** — field-id contract + focus. PR title
   `[HOS-373] feat(web): focus the first invalid field on failed submit`.
   Body carries `Closes HOS-373`.
