---
id: SPEC-307
title: Tiptap v2 → v3 coordinated migration (admin + web rich-text editors)
status: draft
type: chore
complexity: medium
dependsOn: []
---

# SPEC-307 — Tiptap v2 → v3 coordinated migration

> Motivated by Dependabot PR #1890, which tried to bump **only**
> `@tiptap/extension-text-align` from 2.27.2 to 3.27.1 while the rest of the
> `@tiptap/*` stack stayed on v2. CI was green, but that green is misleading: a v3
> extension mounted on a v2 `@tiptap/core` is a runtime incompatibility no current
> test exercises (no test mounts the editor with text-align). That PR was closed in
> favor of this coordinated migration. Tiptap requires `core`, `react`, and every
> extension to share the same major.

## 1. Background

Hospeda has two independent rich-text editors, both on the Tiptap **v2** stack:

| App | File | Extensions imported |
|-----|------|---------------------|
| admin | `apps/admin/src/components/newsletter/RichTextEditor.tsx` | StarterKit, Image, Link, TextAlign, Underline, react |
| admin | `apps/admin/src/components/entity-form/fields/RichTextField.tsx` | StarterKit, Link, Underline, react |
| web | `apps/web/src/components/host/editor/RichTextEditor.client.tsx` | StarterKit, Link, Underline, react |

Plus tiptap is used for content rendering (not editing) in the What's New surface:
`apps/admin/src/components/whats-new/WhatsNewModal.tsx` and
`apps/admin/src/lib/whats-new/render-markdown.ts` (and the `@repo/schemas`
`whats-new.schema.ts` validation). These paths use tiptap's HTML/JSON generation
helpers and must be re-verified after the bump.

Declared dependencies today (all `^2`):

- **admin** (`apps/admin/package.json`): `@tiptap/extension-image`,
  `@tiptap/extension-link`, `@tiptap/extension-text-align`,
  `@tiptap/extension-underline`, `@tiptap/react`, `@tiptap/starter-kit`.
- **web** (`apps/web/package.json`): `@tiptap/extension-link`,
  `@tiptap/extension-underline`, `@tiptap/react`, `@tiptap/starter-kit`.

## 2. Goals

- The entire `@tiptap/*` stack moves to v3 **in lockstep**, in both apps, in one
  reviewable change — never a single extension ahead of core.
- The three editors keep their current behavior: same marks/nodes, same toolbar,
  same value round-trip (controlled `setContent`), same serialized output.
- Existing tiptap tests stay green; add coverage where v3 changes behavior.
- Dependabot stops re-proposing isolated `@tiptap/*` majors (group them so they
  move together, or they are handled here).

## 3. Breaking changes that apply to Hospeda

Sourced from the official Tiptap v2→v3 upgrade guide. Only the items that touch
our codebase are listed; the rest of the guide (tables, lists, collaboration,
NodeViews, BubbleMenu/FloatingMenu, tippy→Floating UI) does **not** apply because
we use none of those.

1. **`Link` and `Underline` are now bundled in `StarterKit` by default.** Remove
   the separate `@tiptap/extension-link` and `@tiptap/extension-underline` imports
   and dependencies in all three editors; configure them via StarterKit options if
   needed. This drops 2 packages from admin and 2 from web.
2. **`setContent` signature changed.** All three editors call
   `editor.commands.setContent(value, false)` where the `false` is the old
   `emitUpdate` positional arg. v3 uses an options object:
   `setContent(value, { emitUpdate: false })`. Three call sites:
   - `RichTextEditor.tsx:337`
   - `RichTextField.tsx:169`
   - `RichTextEditor.client.tsx:115`
3. **`Image` and `TextAlign` remain their own packages in v3** — bump them to v3
   alongside the rest. (TextAlign v3 is exactly what #1890 wanted, now coordinated.)
4. **`clearContent` default behavior changed** — audit if used (grep showed no
   direct usage today, re-verify during implementation).
5. **`@tiptap/extensions` consolidation** — several standalone extensions merged
   into a single `@tiptap/extensions` package. We do not use the affected ones
   (Focus, Placeholder, History/UndoRedo, CharacterCount, etc.), so this is a
   no-op for us, but confirm during implementation that StarterKit's bundled
   history still satisfies undo/redo.

## 4. Scope

- Bump every `@tiptap/*` dep to `^3` in `apps/admin/package.json` and
  `apps/web/package.json`, removing the now-redundant link/underline packages.
- Apply the `setContent` signature change at the three call sites.
- Update StarterKit configuration so Link/Underline behavior is preserved.
- Re-verify the What's New render path (HTML/JSON generation) still produces the
  same output under v3.
- Update/extend tests:
  - `apps/web/test/components/RichTextEditor.test.tsx`
  - `apps/admin/src/components/whats-new/__tests__/WhatsNewModal.test.tsx`
  - Add a focused test that mounts each editor with all configured extensions and
    asserts a value round-trip (this is the gap that let #1890 look green).
- Dependabot config: group `@tiptap/*` so future majors move as one unit (or
  document that tiptap majors are handled via spec, not auto-PR).

## 5. Out of scope

- Adding new editor features (tables, mentions, collaboration, AI). This is a
  like-for-like major upgrade, not a feature change.
- Migrating to `@tiptap/extensions` for extensions we do not currently use.
- The mobile app (no tiptap usage).

## 6. Risks

- **Silent runtime breakage** — the original failure mode. Mitigation: the new
  mount-and-round-trip tests per editor; manual smoke of all three editors before
  merge (toolbar marks, alignment, image insert in admin newsletter, value
  persistence on form submit).
- **StarterKit option drift** — Link/Underline moving into StarterKit may change
  defaults (e.g. Link `openOnClick`, `autolink`). Verify configured options match
  the previous standalone-extension config.
- **Serialized-output divergence** — if v3 emits different HTML/JSON for the same
  document, stored What's New / newsletter content could render differently.
  Compare generated output on representative fixtures before and after.
- **pnpm peer resolution** — v3 introduces/changes `@tiptap/pm` peer expectations;
  ensure a single deduped `@tiptap/pm` and no v2/v3 split in the lockfile.

## 7. Tasks (draft — to be atomized via task-master:task-from-spec)

| # | Task | App | Notes |
|---|------|-----|-------|
| T-001 | Bump admin `@tiptap/*` to `^3`, drop link/underline packages | admin | package.json + lockfile |
| T-002 | Bump web `@tiptap/*` to `^3`, drop link/underline packages | web | package.json + lockfile |
| T-003 | Migrate `setContent` signature at 3 call sites | admin+web | options object |
| T-004 | Move Link/Underline config into StarterKit, preserve options | admin+web | verify defaults |
| T-005 | Re-verify What's New render path output under v3 | admin | fixtures compare |
| T-006 | Add mount + round-trip test per editor (the #1890 gap) | admin+web | new tests |
| T-007 | Group `@tiptap/*` in dependabot config | repo | `.github/dependabot.yml` |
| T-008 | Manual smoke of all three editors | admin+web | toolbar, align, image, persist |

## 8. Open questions

1. Pin to `^3` (track minors) or exact-pin tiptap given the burned-by-minor
   history (text-align "minor" was actually cross-major churn)? Owner decision.
2. Should the web editor and admin editors share a single `@repo/*` rich-text
   component instead of three independent ones, as part of this work or a
   follow-up? (Single-source-of-truth angle — likely a separate spec.)

## Revision history

- 2026-06-30 — initial draft, carved out of Dependabot PR #1890 (closed in favor
  of this coordinated migration).
