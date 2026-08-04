---
title: Shared TextField wrapper — derive the DOM id from the Zod key
linear: HOS-385
statusSource: linear
created: 2026-08-03
type: chore
areas:
  - web
---

# Shared TextField wrapper — derive the DOM id from the Zod key

## 1. Summary

Introduce a shared `<TextField>` wrapper in `apps/web` that owns the DOM `id`,
the `aria-describedby` pairing and the `<FieldError>` render as one unit, and
**derives** that id from the Zod field name through a single pure function that
`focusFirstInvalidField` also uses.

The point is not tidier markup. It is that the per-editor lookup tables
introduced by HOS-373 (`field-input-ids.ts`) and their static guard exist only to
bridge names that drifted apart. Derive the id and there is nothing left to
bridge: both tables and the guard get deleted, because divergence stops being
possible rather than being detected after the fact.

## 2. Problem

Four naming layers describe the same field, and they drifted independently:

| Layer | Example A | Example B |
|---|---|---|
| Zod key | `facebook` | `destinationId` |
| React state key | `facebookUrl` | `destinationId` |
| DOM id | `acc-facebook` | `acc-destination` |
| Error element id | `fieldErrorId('acc-phone')` | — |

No string rule bridges them, which is exactly why `FieldError.tsx` documents
`FieldInputIdMap` as "deliberately an explicit table rather than a template".

The fourth layer is its own small scandal: `fieldErrorId()` is documented to take
the **Zod key** (`fieldErrorId('email')`), but `ContactInfoSection` calls it with
the **DOM id** (`fieldErrorId('acc-phone')`). Even the helper meant to unify two
sides is used two different ways.

Why it matters beyond aesthetics: `focusFirstInvalidField` resolves ids with
`document.getElementById`. A wrong id returns `null` and the function silently
does nothing — no throw, no warning, no failing assertion. The feature degrades
to precisely the behavior it was built to replace. That failure mode is why the
guard was written, and it is the failure mode this spec removes at the source.

## 3. Goals

- **G-1** — One pure function is the single source of a field's DOM id, its
  `aria-describedby` target and its `<FieldError>` id. Callers never write an id
  literal.
- **G-2** — `focusFirstInvalidField` resolves ids through that same function, so
  a field that validates is a field that can be focused, by construction.
- **G-3** — Delete `apps/web/src/components/{host,commerce}/editor/field-input-ids.ts`
  and `apps/web/test/lib/forms/field-input-id-contract.test.ts`. Deleting the
  guard is only legitimate because the contract it policed no longer exists (see
  §10 R-1 — this is the highest-risk claim in the spec and §9 AC-5 is what earns
  it).
- **G-4** — Migrate all 36 measured call sites: 23 in the accommodation editor,
  13 in the commerce editor.
- **G-5** — The wrapper absorbs the `.fieldErrorSpacing.fieldErrorSpacing`
  double-selector hack, so no consumer repeats it.

## 4. Non-goals

- **NG-1** — Do NOT touch `.error` in `FieldError.module.css`. It has 33
  consumers across the app; restyling it is a separate change.
- **NG-2** — `<FieldError>` itself keeps its current public API. The wrapper
  composes it; it does not replace or fork it.
- **NG-3** — The 9 `useZodForm` consumers outside the two editors are out of
  scope for the migration. They become eligible afterwards, they are not part of
  this spec's definition of done.
- **NG-4** — No visual change. This is a refactor; any rendered difference is a
  defect (see AC-4).

## 5. Current baseline

### 5.1 Files that define the contract today

| File | Role |
|---|---|
| `src/components/ui/FieldError.tsx` | `FieldError`, `fieldErrorId()`, `FieldInputIdMap`, `fieldInputId()` |
| `src/components/host/editor/field-input-ids.ts` | 21-row accommodation table |
| `src/components/commerce/editor/field-input-ids.ts` | commerce table |
| `src/lib/forms/focus-first-invalid-field.ts` | `getElementById` + focus + guarded `scrollIntoView` |
| `src/lib/forms/use-zod-form.ts` | validation + `fieldErrors`; 11 consumers, 2 adopted the table |
| `test/lib/forms/field-input-id-contract.test.ts` | static guard: scans `.tsx` sources for each mapped id |

**How the guard works today**, since G-3 deletes it: it reads both map modules
and text-searches the editors' `.tsx` trees for `id="<id>"`, driven by the map so
every key must be accounted for. Ids built from a template are declared in a
`DYNAMIC_IDS` table with the literal fragment that proves the generator exists
(`acc-${config.idSlug}`, `ce-social-${key}`). That escape hatch is the guard's
weakest seam and a live argument for deriving instead of scanning: a text search
cannot see a computed id, so every computed id needs a hand-written exemption,
and each exemption is a place the guard can pass while the markup is wrong.

**Existing precedents to build on**: `CommercePhoneField.tsx`, `SocialUrlField`
(local to `host/editor/SocialNetworksSection.client.tsx`),
`CountryCodeCombobox.client.tsx`. These already bundle label + input + error;
`<TextField>` generalizes what they each do privately.

**Prior art in favour**: the 6 accommodation sections already render the shared
`<FieldError>` (migrated in the HOS-373 PR), so half the plumbing exists.

## 6. Proposed design

### 6.1 The id function

```ts
/** Builds the DOM id for a form field. The ONLY place a field id is produced. */
export function buildFieldId({
    prefix,
    name,
    suffix
}: {
    readonly prefix: string;
    readonly name: string;
    readonly suffix?: string;
}): string;
```

`buildFieldId({ prefix: 'acc', name: 'facebook' })` → `'acc-facebook'`.

**`fieldErrorId()` is NOT changed.** An audit of its call sites (below) killed
the first draft of this section, which proposed redefining it to take a built id:

| Convention passed today | Examples | Count |
|---|---|---|
| Raw Zod key | `'email'`, `'summary'`, `'contactInfo.workEmail'` | most |
| DOM id | `'acc-name'`, `'acc-phone'`, `'acc-destination'` | accommodation editor |
| Ad-hoc string | `'ext-rep-url'`, `'review-content'`, `'gastronomy-review-title'` | several |
| A variable | `id`, `errorKey`, `inputId` | several |

It has ~55 call sites across the whole app — `account/`, `accommodation/`,
`comments/`, `gastronomy/`, `newsletter/`, `commerce/` — not just the two
editors. Changing its signature would drag ~40 sites outside this spec's scope
into the change.

It also turns out to be unnecessary. `fieldErrorId` is a pure `string → string`
that appends `-error`; it never interprets its argument. The bug was never in the
helper, it was that a single form could pass one thing to the input and another
to the `<FieldError>`. The wrapper closes that by construction: it calls
`fieldErrorId(id)` once, internally, with the id it just built, and wires both
sides from that one value. Call sites outside the wrapper keep working untouched.

### 6.2 The wrapper

```tsx
<TextField
    prefix="acc"
    name="facebook"
    label={t('...')}
    value={data.facebookUrl}
    error={fieldErrors.facebook}
    onChange={(v) => onFieldChange('facebookUrl', v)}
/>
```

It renders label + control + `<FieldError>`, and owns:

- `id = buildFieldId({ prefix, name, suffix })`
- `htmlFor` on the label, from the same value
- `aria-invalid={Boolean(error)}`
- `aria-describedby = error ? fieldErrorId(id) : undefined`
- the `.fieldErrorSpacing` spacing, absorbed here (G-5)

Note what `name` and `value` prove: the wrapper takes the **Zod key** as `name`
while the caller still supplies the React state value separately. This spec does
NOT unify the React state layer (`facebookUrl`) with the Zod layer (`facebook`) —
that drift survives, deliberately. It is the id layer that stops drifting,
because the id is no longer written by hand anywhere.

### 6.3 Focus resolution

`focusFirstInvalidField` stops taking a `FieldInputIdMap` and takes the prefix
plus the same `buildFieldId`. Given a failing Zod key it computes the id the
wrapper rendered. One function, one answer, no table.

### 6.4 The escape hatch, and why it is the dangerous part

`phone` and `whatsapp` are ONE Zod key rendered as TWO inputs (country combobox
plus number input); focus belongs on the number. That is what `suffix` is for:
`buildFieldId({ prefix: 'acc', name: 'phone', suffix: 'number' })` →
`'acc-phone-number'`.

The hazard is precise: the wrapper and `focusFirstInvalidField` must agree on the
suffix, and nothing forces them to. A suffix supplied at the render site but not
at the focus site reintroduces exactly the silent no-op this spec exists to kill —
in a form that now has no guard.

**Therefore the suffix must not be a free parameter passed twice.** It is
declared ONCE per editor, in a single exported constant, and both the render site
and the focus site read that constant:

```ts
/** Zod keys whose focus target is a suffixed sub-input. */
export const ACCOMMODATION_FIELD_ID_SUFFIXES = {
    phone: 'number',
    whatsapp: 'number'
} as const;
```

This is deliberately NOT a return to `field-input-ids.ts`: that table mapped
every field to a free-form id string, so any row could be wrong. This declares
only the exceptions, and only the suffix — the prefix and the name still come
from the derivation, so a wrong entry can only ever mis-target within one field's
own family, never point at an unrelated element or at nothing.

### 6.5 Ids that change

Derivation renames every id that does not already follow the rule. Known:
`acc-destination` → `acc-destinationId`. The full list is produced during
implementation by diffing each table against `buildFieldId` output.

Ids are internal (no deep links, no external consumers, not part of any API), so
renaming is safe at runtime. The cost lands on tests that query by id or by label
association, which must be updated in the same commit.

## 7. Data model / contracts

No DB, schema, endpoint or migration changes. The only contract is the exported
surface of `apps/web/src/lib/forms/`:

| Symbol | Change |
|---|---|
| `buildFieldId({prefix, name, suffix})` | NEW — single source of field ids |
| `fieldErrorId()` | UNCHANGED — see §6.1; ~55 call sites app-wide, and the wrapper does not need it changed |
| `TextField` | NEW — label + control + FieldError, owns the a11y wiring |
| `focusFirstInvalidField` | CHANGED — takes `prefix` + suffix map, not `FieldInputIdMap` |
| `FieldInputIdMap`, `fieldInputId()` | DELETED |
| `ACCOMMODATION_FIELD_INPUT_IDS`, `COMMERCE_FIELD_INPUT_IDS` | DELETED |

## 8. UX / UI behavior

None intended. Same markup semantics: a `<label htmlFor>`, a control carrying
`aria-invalid` and `aria-describedby` when in error, and a `role="alert"` error
paragraph that renders only when there is a message.

## 9. Acceptance criteria

- **AC-1** — No `id="acc-*"` or `id="ce-*"` string literal remains in either
  editor's section components. Every field id comes from `buildFieldId`.
- **AC-2** — Both `field-input-ids.ts` modules and
  `test/lib/forms/field-input-id-contract.test.ts` are deleted, and nothing
  imports them.
- **AC-3** — For every field in both editors, submitting with that field invalid
  moves focus to that field's control. Verified by a test that iterates the Zod
  keys rather than spot-checking a few.
- **AC-4** — No visual change: the rendered spacing between a control and its
  error message is unchanged from `main` (this is what G-5 must preserve while
  absorbing the double-selector hack).
- **AC-5** — A test proves the derivation and the render agree by MOUNTING the
  editor and asserting that `document.getElementById(buildFieldId(...))` resolves
  to a focusable element for every Zod key — including the suffixed ones. This
  is the replacement for the deleted guard and it is stronger, because it checks
  the real DOM instead of text-searching source files.
- **AC-6** — Both editors' existing test suites pass unchanged in intent (id
  updates are allowed; assertions about behavior are not).

## 10. Risks

- **R-1 — Deleting the guard.** The guard is currently the only thing standing
  between a mistyped id and a silent no-op. It may only be deleted once AC-5 is
  green, and AC-5 must iterate the full key set — a hand-picked subset would
  reintroduce the gap while looking like coverage. Sequencing matters: AC-5 lands
  BEFORE the deletion, never in the same step.
- **R-2 — The suffix escape hatch (§6.4).** The highest-risk surface, because it
  is the one place derivation does not fully determine the answer. Mitigated by
  declaring suffixes once per editor and reading that constant from both sites.
- **R-3 — Id renames breaking tests.** Mechanical but broad; a missed rename
  surfaces as a test that queries a now-nonexistent id. Loud, not silent.
- **R-4 — 36 call sites in one change.** Large diff. Split per §12 so each PR is
  reviewable and independently green.
- **R-5 — RESOLVED before this spec was filed.** The draft proposed redefining
  `fieldErrorId()` to take a built id. Auditing its call sites first showed ~55
  of them app-wide across six feature areas, passing four different conventions,
  so the change would have reached ~40 files outside this scope. It is also
  unnecessary — see §6.1. Recorded rather than deleted because the lesson
  generalizes: a helper that looks editor-local can be app-wide, and the audit
  costs one command.

## 11. Open questions

- **OQ-1** — Does `<TextField>` cover only `<input>`, or also `<textarea>` and
  `<select>`? The 36 call sites include all three. Proposal: one component with a
  `as` prop, since the a11y wiring is identical and splitting it would duplicate
  exactly the logic being centralized. Needs confirmation before implementation.
- **OQ-2** — Do the rich-text (`acc-description` contenteditable) and map
  (`LocationPicker`) fields adopt the wrapper, or only its id derivation? They
  are not plain controls. Proposal: derivation only, wrapper not applied.
- **OQ-3** — Should `buildFieldId` reject a name that is not a key of the
  editor's Zod schema, at the type level? That would make a typo a compile error
  rather than a runtime miss, and would close R-2's remaining gap. Feasible with
  a generic over the schema shape; adds type complexity.

## 12. Implementation notes

Suggested split, each PR green on its own:

1. `buildFieldId` + `TextField` + their unit tests. Nothing migrated yet.
2. Accommodation editor: migrate 23 call sites, add AC-5's mounted test,
   rename ids, update tests. `field-input-ids.ts` still present.
3. Commerce editor: same, 13 call sites.
4. Delete both tables, the guard, `FieldInputIdMap` and `fieldInputId`; switch
   `focusFirstInvalidField` to derivation. This PR is the one that closes HOS-385.

Do NOT put a Linear magic word in PRs 1-3 — only PR 4 completes the spec.

Read `apps/web/CLAUDE.md` first: this app uses CSS Modules and vanilla CSS, never
Tailwind, and every user-facing string goes through `t()`.

## 13. Linear

Canonical tracking:
HOS-385
