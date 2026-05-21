---
audit: roles-permissions
status: complete
date: 2026-05-21
agent: Explore
---

# 03 — Roles, permissions, access control

## 1. Roles defined (9 total)

`packages/schemas/src/enums/role.enum.ts`:

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Unrestricted access |
| `ADMIN` | Unrestricted access |
| `CLIENT_MANAGER` | Conditional access (permission-driven) |
| `EDITOR` | "Can create/edit/publish events and posts only" (docstring) |
| `HOST` | "Owner of accommodation, can only edit their own accommodations" (docstring) |
| `SPONSOR` | Conditional access |
| `USER` | No admin access |
| `GUEST` | No admin access |
| `SYSTEM` | Non-loginable automation account |

**Roles are presets of permission bundles, not enforcement gates.**

## 2. Permissions defined (~791 total, 60 categories)

`packages/schemas/src/enums/permission.enum.ts`. Naming: `<entity>.<action>` or `<entity>.<action>.<scope>` (e.g., `accommodation.edit.own`).

Categories (representative):
- Accommodation (7 subcategories), Event, Post, Destination — 5+ each
- User & Role Management, Billing & Invoice — 8+ each
- Marketing, Newsletter, Notifications — 5+ each
- System & Configuration — 15+

## 3. Admin panel access gate

**Single entry point:** `apps/admin/src/lib/authed-guard.ts` → `decideAuthedGuard()`.

Logic:

1. Missing `ACCESS_PANEL_ADMIN` permission?
   - Role `USER` → redirect to public funnel
   - Role `HOST` → redirect forbidden (`host-missing-permission`)
   - Otherwise → redirect forbidden (`generic`)
2. Has permission but `passwordChangeRequired` → redirect to password change
3. Otherwise → allow

**The gate is PERMISSION-based** (`ACCESS_PANEL_ADMIN`). Role only affects redirect messaging.

## 4. Per-route guards (5 samples)

| Route | Guard |
|-------|-------|
| `/admin/conversations/index.tsx` | requires `CONVERSATION_VIEW_OWN` OR `CONVERSATION_VIEW_ALL` |
| `/admin/newsletter/campaigns/new.tsx` | requires `NEWSLETTER_CAMPAIGN_WRITE` |
| `/admin/billing/invoices.tsx` | no `beforeLoad` guard (API-side enforcement) |
| `/admin/dashboard.tsx` | no guard (all authenticated users) |
| `/admin/access/permissions.tsx` | no guard (read-only reference) |

**Pattern:** optional and granular. High-value routes guard tightly; others defer to API layer.

## 5. HOST and EDITOR roles — status

- **HOST**: defined and deployed. Docstring says "edit own accommodations only". **NOT gateable at panel entry** — if granted `ACCESS_PANEL_ADMIN` + feature permissions, can access admin. No dedicated route-level HOST enforcement today.
- **EDITOR**: defined and deployed. Docstring says "create/edit/publish events and posts only". **NOT gateable at panel entry** — only permission checks (e.g., `NEWSLETTER_CAMPAIGN_WRITE`) gate them. No dedicated EDITOR-blocking guards.

## 6. Honest access matrix

| Role | Can enter admin | Conversations | Newsletter | Invoices |
|------|----------------|---------------|------------|----------|
| `SUPER_ADMIN` | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes | Yes | Yes | Yes |
| `EDITOR` | If granted `ACCESS_PANEL_ADMIN` | No | If granted `NEWSLETTER_CAMPAIGN_WRITE` | No |
| `HOST` | If granted `ACCESS_PANEL_ADMIN` | No | No | No |
| `USER` | No (funnel redirect) | — | — | — |

## Core finding

Access is PERMISSION-driven, not role-driven. Roles are semantic labels (presets of permissions). HOST and EDITOR exist in code but are **NOT differentiated in admin UX today** — they're generic "non-superadmin" accounts with whatever permissions they happen to carry.

**Design implication:** the redesign must define what "default permission bundles" each role carries, AND simultaneously handle "user with bundle X + cherry-picked overrides". The sidebar/dashboard must be coherent for arbitrary permission subsets, not only for the 9 preset bundles.
