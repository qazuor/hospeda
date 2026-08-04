---
title: Editor unsaved-changes warning and invalid-field focus
linear: HOS-373
statusSource: linear
created: 2026-08-01
type: feature
areas:
  - web
---

# Editor unsaved-changes warning and invalid-field focus

## 1. Summary

Both `apps/web` self-service editors — `AccommodationEditor.client.tsx` (host) and
`CommerceListingEditor.client.tsx` (commerce) — let an owner navigate away with
unsaved changes with zero warning, and leave a failed submit with no indication of
*where* the invalid field is. This spec adds (1) a dirty-state exit guard covering
both browser unload and Astro `ClientRouter` soft-navigation, and (2) scroll+focus
to the first invalid field on a failed validation, backed by a new field-name → DOM
id resolution contract that neither editor currently has.

## 2. Problem

Verified directly in the code (not assumed from the Linear description):

- **`beforeunload` does not exist anywhere in `apps/web/src`** (`grep -rn
  beforeunload apps/web/src` returns a single hit: the comment in
  `TranslationPanel.client.tsx:24-33` documenting it as known, deliberately
  deferred debt: *"apps/web has no `beforeunload` guard anywhere, so an automatic
  reload silently discarded whatever the host had typed and not yet saved. [...]
  warning the host before it happens needs the editor's dirty state and is tracked
  separately."* This spec is that separate tracking.
- **Both editors already compute a dirty signal**, with different shapes (see
  §5), but neither wires it to anything that fires before the page is left.
- **A failed submit moves nothing and shows nothing localized to a field.**
  `useZodForm.validate()` (`apps/web/src/lib/forms/use-zod-form.ts:120-141`) sets
  `fieldErrors` and fires one generic toast
  (`t('validation.formHasErrors', 'Revisá los campos marcados')`) — it never
  scrolls or focuses anything. In the accommodation editor's ~11-section page (see
  §5), an error in a section below the fold is invisible until the owner scrolls
  through the whole form.
- **Both editors need this equally.** This is not a comercio-vs-alojamiento parity
  gap — it is filed as its own issue precisely because framing it as parity work
  would misplace it (per the Linear issue description).

## 3. Goals

- G-1: Warn the owner before losing unsaved changes, on a real full-page unload
  (browser close/refresh/back-forward-outside-SPA) AND on Astro `ClientRouter`
  soft-navigation away from the editor page — both editor pages render under
  `AccountLayout.astro` → `BaseLayout.astro` → `<ClientRouter />` (verified, see
  §5), so a browser-unload-only guard misses the common in-app case (clicking a
  sidebar link, "mi cuenta" nav, etc.).
- G-2: On a failed validation at submit, move scroll and keyboard focus to the
  first invalid field, in the document/field order the schema issues resolve to.
- G-3: Establish one reusable field-name → DOM element id mapping usable by both
  editors, since neither currently has one (see §6 — this is the technical core
  of the spec).
- G-4: The exit guard must be provably inert when the form is clean — a
  guard that fires unconditionally is worse than no guard (explicit AC, §9).

## 4. Non-goals

- NG-1: Building a generic "prompt/router-guard" primitive for the whole app —
  scope is the two editors named in the Linear issue.
- NG-2: Migrating `BasicInfoSection.client.tsx`'s hand-rolled `acc-*-error` markup
  to the shared `FieldError`/`fieldErrorId()` components. The Linear issue flags
  this as "an easy dedup" but it is separable cleanup, not required for either
  goal here — call out only if it turns out G-3's id contract cannot be built
  without it (see §11).
- NG-3: An error-summary banner listing every invalid field (the Linear issue
  mentions "no error summary" as part of gap 2). Scroll+focus-to-first-field is
  the AC; a full summary component is a larger, separate UI addition — open
  question in §11 on whether it belongs in this spec's scope.
- NG-4: Any change to `use-scroll-into-view-when.ts` on branch
  `fix/web-alliance-and-commerce-forms` (PR #2553) beyond what this spec's own
  implementation needs — that PR is not this spec's to touch; if it merges first,
  this spec builds on top of what actually landed, not what is described here.

## 5. Current baseline

### Gap 1 — no exit warning, and `ClientRouter` is live on both editor pages

`grep -rn beforeunload apps/web/src` → one match, the doc comment in
`apps/web/src/components/host/editor/TranslationPanel.client.tsx:24-33` quoted in
§2. No `window.addEventListener('beforeunload', ...)` exists anywhere in the app.

Both editor pages —
`apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar.astro` and
`apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar.astro` —
render through `AccountLayout.astro`, which wraps `BaseLayout.astro`
(`AccountLayout.astro:20,127`), which mounts `<ClientRouter />`
(`BaseLayout.astro:21,140`). **`window.beforeunload` is NOT dispatched by Astro's
soft (client-side) navigation** — it only fires on a real document unload. Any
in-app link (sidebar nav, "volver", breadcrumb) navigated via `ClientRouter` would
silently bypass a `beforeunload`-only guard. The repo already has a working
precedent for hooking the `ClientRouter` lifecycle from a client component:
`apps/web/src/components/shared/navigation/nav-progress.ts:196-198` registers
`astro:before-preparation` / `astro:before-swap` / `astro:after-swap` on
`document`. `astro:before-preparation` is the cancelable pre-navigation event
(`event.preventDefault()` stops the soft-navigation) and is the mechanism this
spec must use for the in-app case.

**Dirty-state shapes already exist, independently, in both editors:**

- **Commerce** (`CommerceListingEditor.client.tsx`): a `ReadonlySet<string>` of
  dirty field-group names, `dirty` (line 265), mutated only through `markDirty(field)`
  (line 268-275), called from every field's `onChange` (e.g. `updateContact`,
  `updateSocial`, `updateMedia`, `toggleAmenity`, `toggleFeature`,
  `handleI18nChange`, and direct `markDirty('name'|'destinationId'|'type'|...)`
  calls at the raw `<input>`s). It resets to `new Set()` in `handleSubmit` on a
  successful PATCH (line 474), right after `setStatus({ kind: 'idle' })`. The
  live "is dirty" check used for the Save button and the submit guard is
  `dirty.size > 0` (`canSave`, line 496; early-return in `handleSubmit`, line 452).
- **Accommodation** (`AccommodationEditor.client.tsx`): NO stored dirty flag.
  Dirtiness is derived on demand: `buildPatchPayload(formData)` (line 298-404)
  diffs `formData` against a `baseline` state (line 242) field-by-field, and the
  caller treats `Object.keys(payload).length === 0` as "nothing to save" (line
  413, shows an explicit `noChanges` toast and returns — HOS-190 requirement that
  Save must never silently no-op). `baseline` starts as `initialData` and is
  **resynced to `formData` after every successful save**
  (`setBaseline(formData)`, line 448), with an explicit comment (lines 236-241)
  explaining why: diffing against the load-time `initialData` prop instead
  caused a shipped bug where reverting a field just saved produced an empty diff
  ("no changes") while the DB still held the new value — the revert was
  unrepresentable without a full reload. Any exit-guard "is dirty" check for this
  editor MUST reuse `buildPatchPayload(formData).length > 0` (or an equivalent
  derived from the same `baseline` comparison) — a separately-tracked boolean
  would drift from this diff the same way the old code drifted.

### Gap 2 — failed submit: no focus, no field-targeted scroll

`useZodForm` (`apps/web/src/lib/forms/use-zod-form.ts`) is the shared primitive
both editors use for validation. `validate()` (lines 120-141): on
`schema.safeParse` failure, calls `setFieldErrors(zodIssuesToFieldErrors(...))`
and fires exactly one `addToast({ type: 'error', message:
t('validation.formHasErrors', 'Revisá los campos marcados') })`. Nothing in this
hook — or in either editor's `handleSubmit` — calls `.focus()`,
`.scrollIntoView()`, or reads `fieldErrors` to pick a "first" field. Both editors'
`handleSubmit` just `return` after a failed `validate()` call
(`AccommodationEditor.client.tsx:431-433`, `CommerceListingEditor.client.tsx:462-464`).

`zodIssuesToFieldErrors` (`apps/web/src/lib/forms/field-errors.ts:99-126`) keys
`fieldErrors` by the **full dotted Zod path** (`issue.path.map(String).join('.')`,
line 106) — e.g. `contactInfo.mobilePhone` — preserving insertion order of the
schema's own issue array (first issue per field wins, subsequent duplicates for
the same path are skipped, line 107). This order is not guaranteed to match
visual/DOM order for either editor's schema, but for both current schemas it is a
close-enough proxy (no test currently pins this) — noted as a risk in §10.

**The `fieldErrorId()` helper does not solve field-targeting on its own.**
`apps/web/src/components/ui/FieldError.tsx:43-45`:

```ts
export function fieldErrorId(fieldName: string): string {
    return `${fieldName}-error`;
}
```

This produces the id of the `<p role="alert">` **error message**, wired via
`aria-describedby` on the input — it does NOT identify the input/select/textarea
itself, and the two are independently named in every consumer site checked:

- `CommerceListingEditor.client.tsx:517` — the `name` input has `id="ce-name"`
  (arbitrary `ce-` prefix chosen per field), while its error paragraph has
  `id={fieldErrorId('name')}` → `"name-error"` (line 529). Two unrelated ids.
- `CommerceListingEditor.client.tsx:726-743` — the `contactInfo.mobilePhone` and
  `contactInfo.workEmail` `<input>`s have **no `id` attribute at all** (only
  `aria-label`); only their `FieldError` paragraphs get an id, via
  `fieldErrorId('contactInfo.mobilePhone')`. There is currently no DOM element to
  focus for these two fields, full stop — `document.getElementById` would find
  nothing.
- `apps/web/src/components/host/editor/BasicInfoSection.client.tsx` hand-rolls
  its own per-field ids with yet another prefix: `id="acc-name"` /
  `id="acc-name-error"` (lines 58, 70), `id="acc-summary-error"` (99),
  `id="acc-description-error"` (184), `id="acc-type-error"` (246) — no
  `fieldErrorId()` import at all in this file.

So today there are (at least) three disjoint, ad hoc id-naming schemes across the
two editors (`ce-<field>` inputs / `<field>-error` error text in commerce,
`acc-<field>` / `acc-<field>-error` in accommodation's `BasicInfoSection`), plus
fields with no input id whatsoever. None of them is derived from — or
discoverable from — the Zod field path that `fieldErrors` is actually keyed by.
**This is the real blocker for G-2**, not just "call `.focus()` on submit
failure" — see §6.

### The existing scroll/focus primitive is real, but is not a drop-in fit

`apps/web/src/lib/forms/use-scroll-into-view-when.ts` exists, but **only on
branch `fix/web-alliance-and-commerce-forms` (PR #2553, currently OPEN against
`staging`, not yet merged as of this spec's writing)** — it is not present on
`main`/`staging`/this branch today. Its actual signature:

```ts
export function useScrollIntoViewWhen<T extends HTMLElement>({
    active
}: {
    readonly active: boolean;
}): RefObject<T | null>
```

It returns **one ref for one statically-known element**, and fires an
effect—`scrollIntoView` + `.focus({ preventScroll: true })`, honoring
`prefers-reduced-motion` via `matchMedia`, both feature-detected for jsdom
safety—whenever `active` flips from `false` to `true`. Its one current consumer
(same PR) is `AllianceLead.client.tsx`, attaching it to the **success
confirmation panel** that replaces the form after a submit succeeds (`const
successRef = useScrollIntoViewWhen<HTMLDivElement>({ active: isSuccess })`).

This is the opposite shape from what G-2 needs: the Linear issue's framing
("Sirve tal cual para llevar el scroll y el foco al primer campo inválido" — "it
works as-is") does not hold up. `useScrollIntoViewWhen` targets exactly one
pre-attached ref triggered by a boolean; the invalid-field target is **one of N
possible fields, selected dynamically by name from `fieldErrors` after each
submit**. Reusing it "as-is" would mean either (a) attaching a distinct
`useScrollIntoViewWhen` instance to every single field in both editors (dozens of
hook instances, most permanently `active: false`), or (b) generalizing/wrapping
it to resolve an element by a computed id at call time instead of a static ref.
§6 resolves this.

## 6. Proposed design

### G-3 first — the field-name → DOM id contract (technical core)

Add one new shared helper, colocated with the existing form primitives (e.g.
`apps/web/src/lib/forms/field-focus-id.ts`), that is the SINGLE canonical way to
turn a `fieldErrors` key (a dotted Zod path, per `zodIssuesToFieldErrors`) into
the id of the **focusable input element**, distinct from `fieldErrorId()` (which
stays scoped to the error `<p>`'s id, unchanged):

```ts
export function fieldInputId(fieldName: string): string {
    return `field-${fieldName}`;
}
```

Nested paths (`contactInfo.mobilePhone`) pass through unchanged
(`field-contactInfo.mobilePhone`) — `document.getElementById` and HTML `id`
attributes both accept dots literally, no escaping needed since this is never
used as a CSS selector.

Both editors must then set every relevant input/select/textarea's `id` to
`fieldInputId(<the same key fieldErrors is checked against>)`. Concretely:

- Commerce: change `id="ce-name"` → `id={fieldInputId('name')}`, etc., for every
  field currently carrying an ad hoc `ce-*` id, and **add** an `id` to the two
  currently-id-less `contactInfo.mobilePhone` / `contactInfo.workEmail` inputs.
- Accommodation: same treatment for `BasicInfoSection.client.tsx`'s `acc-*` ids
  and any other section component using its own hand-rolled prefix — confirm the
  full field-error-id inventory across every section that reads `fieldErrors`
  from `AccommodationEditFormSchema` before implementation (open question, §11:
  this spec verified `BasicInfoSection` in depth but not every section file).

This is a **rename of existing ids**, not new markup — `htmlFor`/`aria-describedby`
pairings that reference the OLD ids must be updated in the same change, or
labels/`aria-describedby` silently break. Existing tests asserting on the old
literal id strings (if any) need updating alongside.

### G-2 — scroll + focus the first invalid field

Add a second helper (or fold into the same module) that, given the current
`fieldErrors` record and the dotted-path Zod issue order `zodIssuesToFieldErrors`
already preserves (§5), resolves the **first** key and imperatively focuses +
scrolls its element:

```ts
export function focusFirstFieldError({
    fieldErrors
}: {
    readonly fieldErrors: FieldErrors;
}): void {
    const firstKey = Object.keys(fieldErrors)[0];
    if (!firstKey) return;
    const el = document.getElementById(fieldInputId(firstKey));
    if (!el) return; // field has no id yet, or key has no DOM counterpart — no-op, not a crash
    const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    (el as HTMLElement).focus({ preventScroll: true });
}
```

Both editors call this from `handleSubmit`, right after `validate()` returns
`!parsed.success` (the same branch that currently just `return`s):

```ts
const parsed = validate(payload);
if (!parsed.success) {
    focusFirstFieldError({ fieldErrors: zodIssuesToFieldErrors(parsed.error.issues, t) });
    return;
}
```

Note `useZodForm.validate()` does not currently return the raw `fieldErrors` it
just computed — either re-derive from `parsed.error.issues` at the call site (as
above, matching what `validate()` internally does) or extend
`UseZodFormResult['validate']`'s return/add a fourth returned value so the fresh
`fieldErrors` don't have to be recomputed. **Decide this shape before
implementation** — recomputing is simpler and avoids a `useZodForm` API change,
but duplicates the mapping call; open question §11 asks which the user prefers.

Why not reuse `useScrollIntoViewWhen` here: that hook's contract (one ref, one
static target, `active: boolean`) fundamentally does not fit "one of N dynamic
targets, selected by name after each submit." `focusFirstFieldError` is
deliberately a plain imperative function (no hook, no ref, called directly from
an event handler), not a React-effect-driven primitive — there is no
`active`-flip to key off, since a submit that fails once and fails again on the
*same* field needs to refocus every time, not just on the first true→false→true
transition a `useEffect([active])` would require re-deriving via a toggling
key anyway.

### G-1 — dirty-state exit guard

New shared hook, e.g. `apps/web/src/lib/forms/use-unsaved-changes-guard.ts`:

```ts
export function useUnsavedChangesGuard({
    isDirty,
    message
}: {
    readonly isDirty: boolean;
    readonly message: string;
}): void {
    // 1. window.beforeunload — real document unload only.
    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (!isDirty) return;
            e.preventDefault();
            // Chrome requires setting returnValue; the custom `message` string is
            // ignored by every modern browser (they show their own generic text) —
            // kept as a parameter anyway for the ClientRouter path below, where the
            // browser's native confirm() DOES show it.
            e.returnValue = '';
        }
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // 2. Astro ClientRouter soft navigation — astro:before-preparation is
    // cancelable (precedent: nav-progress.ts:196-198).
    useEffect(() => {
        function handleBeforePreparation(e: Event) {
            if (!isDirty) return;
            if (!window.confirm(message)) {
                e.preventDefault();
            }
        }
        document.addEventListener('astro:before-preparation', handleBeforePreparation);
        return () =>
            document.removeEventListener('astro:before-preparation', handleBeforePreparation);
    }, [isDirty, message]);
}
```

Wiring `isDirty`:

- Commerce: `dirty.size > 0` — already computed as `canSave`'s left operand
  (line 496); pass that boolean straight through.
- Accommodation: `Object.keys(buildPatchPayload(formData)).length > 0` — call
  `buildPatchPayload(formData)` (already memoized via `useCallback`, deps
  `[baseline]`) directly, or wrap in a `useMemo` keyed on `[formData, baseline]`
  to avoid recomputing the diff on every render for a value only the guard reads.

**AC-driven requirement (G-4)**: `isDirty` must be `false` immediately after a
successful save reaches the same state update that already exists in each editor
(`setDirty(new Set())` in commerce, `setBaseline(formData)` in accommodation) —
no new "just saved" flag is needed since both already null out dirtiness through
their existing save-success paths; the guard hook only needs to receive the
correct live `isDirty` boolean, not manage it.

### Why NOT combine into one `beforeunload`-only guard

Explicitly rejecting the simpler "just add `beforeunload`" reading of the Linear
issue: since both editor pages confirmed run under `<ClientRouter />` (§5), a
`beforeunload`-only guard would silently miss every in-app navigation away from
the editor (clicking "Mi cuenta", a different nav-menu item, etc.) — the single
most likely way an owner actually leaves the page. Both paths are required for
G-1 to be a real guarantee, not a partial one.

## 7. Data model / contracts

No backend, schema, or migration changes. Purely client-side (`apps/web`):

- New: `apps/web/src/lib/forms/field-focus-id.ts` — exports `fieldInputId()` and
  `focusFirstFieldError()`.
- New: `apps/web/src/lib/forms/use-unsaved-changes-guard.ts` — exports
  `useUnsavedChangesGuard()`.
- Modified: `apps/web/src/components/commerce/CommerceListingEditor.client.tsx`
  (id renames on every field + hook wiring + `focusFirstFieldError` call).
- Modified: `apps/web/src/components/host/AccommodationEditor.client.tsx` +
  every host editor section component that renders a `fieldErrors`-checked input
  (id renames + hook wiring + `focusFirstFieldError` call at the top-level
  submit handler — sections themselves do not need to know about the guard,
  only about their own input's new `id`).
- Possibly modified: `useZodForm`'s `validate()` return shape, IF the
  implementation decides to avoid recomputing `zodIssuesToFieldErrors` at each
  call site (open question, §11).

## 8. UX / UI behavior

- **Exit guard**: unchanged look — browsers render their own native "leave
  site?" dialog for `beforeunload` (custom text is not shown by any current
  browser). For the `ClientRouter` soft-nav path, this design uses
  `window.confirm(message)` for parity/simplicity (no new modal component); the
  message string is opinion-owned by each editor's i18n copy — open question
  §11 on final wording placement (`host.properties.editor.*` /
  `commerce.owner.editor.*` namespaces already exist per editor).
- **Focus/scroll on failed submit**: the first invalid field scrolls to
  `block: 'center'` (not `'start'`, unlike `useScrollIntoViewWhen`'s success-panel
  use — a mid-form field benefits from being centered so surrounding context is
  visible, whereas a top-of-viewport success panel wants `'start'`) and receives
  keyboard focus with `preventScroll: true` (scroll and focus are two separate
  calls so the smooth scroll isn't fought by the browser's default
  focus-triggered scroll). The existing generic toast
  (`validation.formHasErrors`) is unchanged and still fires — this spec adds
  focus/scroll, it does not replace the toast (no error-summary banner, per
  NG-3).
- Both behaviors respect `prefers-reduced-motion` (instant jump instead of
  smooth scroll), matching the precedent in `use-scroll-into-view-when.ts`.

## 9. Acceptance criteria

- AC-1: With unsaved changes present, closing/refreshing the tab (real
  `beforeunload`) triggers the browser's native confirmation prompt. Testable in
  jsdom by dispatching a `beforeunload` event and asserting
  `event.preventDefault` was called (or `event.returnValue` was set) — NOT by
  asserting an actual browser dialog appeared (jsdom cannot render one).
- AC-2: With unsaved changes present, triggering `astro:before-preparation`
  and having `window.confirm` mocked to return `false` results in the event's
  `preventDefault()` being called (navigation blocked). Testable in jsdom via a
  manually dispatched `CustomEvent('astro:before-preparation')` and a
  `vi.spyOn(window, 'confirm')` mock.
- AC-3 (G-4, explicit inert-when-clean check): with `isDirty: false`, neither
  the `beforeunload` handler calls `preventDefault()`/sets `returnValue`, nor
  does the `astro:before-preparation` handler call `preventDefault()` or even
  invoke `window.confirm` — assert the confirm mock was NOT called. This is the
  regression test for "a guard that always fires is worse than none."
- AC-4: Both editors call `useUnsavedChangesGuard` with the correct live
  `isDirty` value, and that value becomes `false` in the same render pass a
  successful save already clears dirtiness in (`setDirty(new Set())` for
  commerce, the `baseline` resync for accommodation) — no new state variable
  drifts independently. Testable by rendering the editor, marking a field dirty,
  submitting successfully, and asserting the guard's `isDirty` input is now
  falsy (e.g. via a spy on the hook, or by asserting `beforeunload` no longer
  prevents default post-save).
- AC-5: On a failed `validate()` call in either editor, `document.activeElement`
  after the synchronous submit handler runs is the DOM node whose `id` equals
  `fieldInputId(<first key of the zod-issue-ordered fieldErrors>)`. Testable in
  jsdom (`.focus()` calls and `document.activeElement` ARE observable in jsdom,
  unlike Tab-driven focus traversal).
- AC-6: `fieldInputId()` and `fieldErrorId()` applied to the same field name
  produce two DIFFERENT ids (`field-name` vs `name-error`), and every input
  currently checked against `fieldErrors` in both editors (including the
  previously id-less `contactInfo.mobilePhone`/`contactInfo.workEmail` in
  commerce) has a non-empty `id` matching `fieldInputId(<its fieldErrors key>)`.
  Testable via `render()` + `container.querySelector('#' + fieldInputId(...))`.
- AC-7 (browser-only, cannot be asserted in jsdom — state explicitly, do not
  fake a passing jsdom test for this): the scroll actually lands the field
  within the viewport and the visible focus ring appears on it, verified
  manually in a real browser against both editors' longest sections (per the
  repo's own precedent: jsdom does not implement real layout/`scrollIntoView`
  geometry, and does not move focus via Tab — see the project's documented
  gotcha that focus traps/scroll geometry need browser verification, not a
  jsdom substitute).
- AC-8: `prefers-reduced-motion: reduce` results in `behavior: 'auto'` (instant)
  being passed to `scrollIntoView` instead of `'smooth'`, for both the exit-guard
  message flow (N/A — no scroll there) and the focus-first-invalid-field flow.
  Testable in jsdom via a `matchMedia` mock returning `matches: true`.

## 10. Risks

- R-1: `Object.keys(fieldErrors)[0]` as "first invalid field" relies on
  `zodIssuesToFieldErrors`' insertion-order preservation of `parsed.error.issues`,
  which itself depends on the Zod schema's own field declaration order (or
  `.superRefine`/cross-field issue emission order) matching visual/DOM order.
  Neither is contractually guaranteed by Zod for a schema this size; a schema
  edit that reorders fields, or a cross-field refinement emitting its issue out
  of declaration order, could silently point focus at a field that is not
  visually first. No test currently pins this for either
  `AccommodationEditFormSchema` or the commerce per-vertical schema.
- R-2: The `id` rename in G-3 touches every field-carrying input in both
  editors — a wide, mechanical but error-prone diff (dropped `id`, mismatched
  `htmlFor`/`aria-describedby`, or an id collision with a non-form element on
  the page) that existing per-section/per-field tests may not catch if they
  assert on old literal id strings rather than via the shared helper.
- R-3: `window.confirm()` for the soft-nav path is a blocking, unstyled native
  dialog — acceptable for now (no new modal component, matches G-1's scope) but
  a UX regression versus a themed confirmation modal if the product later wants
  one; flagged, not solved, here.
- R-4: Two independent `astro:before-preparation` listeners (one per editor,
  never mounted simultaneously since they're on different pages) is fine, but if
  a future page composes multiple forms with this same hook on one page,
  multiple `window.confirm()` calls could stack — out of scope for two
  single-form editor pages today, worth a code comment warning future readers.

## 11. Open questions

- OQ-1: Should `useZodForm.validate()`'s return type change to also hand back
  the freshly-computed `fieldErrors` (avoiding a second
  `zodIssuesToFieldErrors` call at each editor's submit site), or is
  recomputing acceptable? Both are cheap; this is a taste call the spec defers
  to the implementer/reviewer.
- OQ-2: Full inventory of host editor sections beyond `BasicInfoSection` that
  render `fieldErrors`-checked inputs with hand-rolled ids (`ContactInfoSection`,
  `SocialNetworksSection`, `LocationSection`/`LocationPicker`,
  `CapacitySection`, `PricingSection`, `AmenitiesSection`) was not exhaustively
  traced in this spec — implementation must grep each for `fieldErrors\.` /
  `errors\.` before doing the `fieldInputId()` rename, since any missed section
  leaves that field unfocusable (silent no-op per `focusFirstFieldError`'s
  `if (!el) return`, not a crash, but a silent miss).
- OQ-3: Does `NG-3` (no error-summary banner) hold, or does the user want a
  banner listing all invalid fields as part of this same spec rather than a
  follow-up? The Linear issue's gap-2 description explicitly calls out "no
  error summary" alongside "no focus" — this spec chose to scope the summary
  out, but that is a product-scope call, not purely technical, and should be
  confirmed before implementation starts.
- OQ-4: Exact copy/i18n keys for the `ClientRouter`-soft-nav `window.confirm()`
  message (and whether `beforeunload`'s ignored-by-browsers custom string is
  worth writing at all, given no modern browser displays it) — left to
  implementation to add under each editor's existing i18n namespace.
- OQ-5: If PR #2553 (`fix/web-alliance-and-commerce-forms`,
  `use-scroll-into-view-when.ts`) merges to `staging` before this spec is
  implemented, should `focusFirstFieldError` be re-homed to reuse whatever final
  shape that hook lands in (e.g. if it gets generalized during that PR's review),
  or stay a fully separate function as designed in §6? Recommend re-checking the
  merged file's shape at implementation time rather than assuming this spec's
  §6 sketch is still accurate.

## 12. Implementation notes

- Build `fieldInputId()`/`focusFirstFieldError()`/`useUnsavedChangesGuard()` as
  small, independently unit-tested modules in `apps/web/src/lib/forms/` (matching
  the existing `use-zod-form.ts`/`field-errors.ts` colocation) before wiring
  either editor, so the id-rename diff (R-2) can be reviewed against a
  known-correct helper contract rather than freehand per call site.
- Do the commerce editor first — it is a single flat form (no section-nav
  indirection, per §5) and confirmed to have exactly the two id-less
  `contactInfo.*` inputs as the trickiest case; validates the pattern before
  touching the larger, multi-section accommodation editor.
- For the accommodation editor, resolve OQ-2's section inventory before
  starting the rename, not during — a partial rename discovered mid-review is
  harder to land cleanly than a small upfront `grep -rn "fieldErrors\."
  apps/web/src/components/host/editor/`.
- Manual browser verification (AC-7) must be run against BOTH editors' longest
  section chain — for accommodation that means triggering a validation failure
  on a field in `AmenitiesSection` or `CalendarSection` (far down the ~11-section
  page) and confirming the scroll actually reaches it, not just a field already
  in the initial viewport (where a false pass would hide a broken
  `scrollIntoView` call).

## 13. Linear

Canonical tracking:
HOS-373
