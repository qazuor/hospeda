/**
 * @file tokens/user-roles.ts
 * @description Per-user-role semantic color tokens.
 *
 * Layered color model (mirrors accommodation-types / event-categories /
 * post-categories):
 *
 *   generic base palette  →  `--palette-<name>-<shade>`
 *        ↓ referenced via var()
 *   per-role semantic token  →  `--user-role-<role>`  (this module)
 *        ↓ consumed in BOTH apps via the SSOT in `@repo/icons`
 *
 * Each of the 7 user roles maps to ONE existing base palette and exposes a
 * dedicated `--user-role-<role>` token whose VALUE is a `var()` reference to
 * that palette's shade-500 primitive. No NEW base palettes are introduced;
 * roles reuse the existing brand / semantic / accommodation-type palettes.
 * The chosen palettes match the prior badge colors. SYSTEM and GUEST both
 * map to `neutral` (gray) — that mirrors their `SLATE`/`GRAY` `BadgeColor`
 * assignment; the token names stay distinct so future tuning can give each
 * its own hue without touching consumers.
 */

import type { Theme } from '../themes/types.js';

/**
 * Role → palette assignment (matches the prior static badge colors):
 *   super_admin → danger · admin → accent · editor → river · host → purple ·
 *   user → forest · guest → neutral · system → neutral
 */
export const userRoleTokens: Theme = {
    'user-role-super-admin': 'var(--palette-danger-500)',
    'user-role-admin': 'var(--palette-accent-500)',
    'user-role-editor': 'var(--palette-river-500)',
    'user-role-host': 'var(--palette-purple-500)',
    'user-role-user': 'var(--palette-forest-500)',
    'user-role-guest': 'var(--palette-neutral-500)',
    'user-role-system': 'var(--palette-neutral-500)'
};
