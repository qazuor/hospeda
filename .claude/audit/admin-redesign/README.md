# Admin Panel Redesign — Audit

**Status:** in progress (audit + discovery phase, pre-spec)
**Branch:** `chore/admin-redesign-audit`
**Worktree:** `/home/qazuor/projects/WEBS/hospeda-admin-redesign-audit`
**Started:** 2026-05-21

## Goal

Reorganize, improve and polish the Hospeda admin panel. Define menu, sidebars, dashboards and settings per **permission bundle** (NOT per role — roles are presets of granular permissions, and users can have permissions added/removed individually). Align visual identity with the public web app while keeping each app's styling tooling (admin = Tailwind v4 + shadcn, web = vanilla CSS / CSS Modules).

## Scope notes

- Access in this codebase is permission-driven, not role-driven. Roles are just preset bundles. The redesign must support per-user permission overrides on top of any preset.
- Visual alignment is at the **token level** (colors, fonts, spacing, radius, shadows, dark mode strategy), NOT tooling-level.
- Out of scope of this audit: implementation. We persist findings here, then decide what to attack as formal SPECs.

## Phase 1 audits (completed in original session)

Stored in [`phase-1/`](./phase-1/):

| # | File | Topic |
|---|------|-------|
| 01 | `01-code-structure.md` | Route inventory, feature areas, dead code, gaps |
| 02 | `02-navigation.md` | Layout, sidebar, topbar, per-permission gating, mobile |
| 03 | `03-roles-permissions.md` | 9 roles, ~791 permissions, access matrix |
| 04 | `04-visual-identity.md` | Token sources, palette, typography, brand gap |
| 05 | `05-dashboard-settings.md` | Dashboard widgets, user/platform settings inventory |

## Phase 2 audits (deeper UX/functional)

Stored in [`phase-2/`](./phase-2/):

| # | File | Topic |
|---|------|-------|
| 06 | `06-ui-patterns.md` | Tables, filters, sort, bulk actions, empty/loading/error states |
| 07 | `07-forms.md` | RHF + Zod consistency, repeated patterns |
| 08 | `08-command-palette.md` | What CommandPalette searches, what it exposes |
| 09 | `09-notifications.md` | `/notifications` route + dropdown + `packages/notifications` integration |
| 10 | `10-impersonation.md` | ImpersonationBanner, endpoints, audit log |
| 11 | `11-i18n-coverage.md` | Hardcoded strings vs `useTranslation()` |
| 12 | `12-accessibility.md` | Keyboard nav, ARIA, dark mode contrast |
| 13 | `13-mobile-ux.md` | Forms, tables, dialogs on mobile |
| 14 | `14-performance.md` | Bundle size, lazy loading, slow pages |
| 15 | `15-help-onboarding.md` | Tours, tooltips, empty-state CTAs |

## Discussion axes (next step after Phase 2)

1. **Permission bundles model** — what preset bundles do we want?
2. **Information architecture** — main menu and contextual sidebars
3. **Visual identity tokens** — where they live, how both apps consume them
4. **Dashboard + Settings redesign** — per-bundle defaults + user overrides

## Status convention for audit files

Each audit file has a frontmatter block:

```
---
audit: "<topic>"
status: complete | in-progress | blocked
date: YYYY-MM-DD
agent: <agent-type>
---
```
