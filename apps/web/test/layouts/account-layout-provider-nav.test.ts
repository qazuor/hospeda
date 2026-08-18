/**
 * @file account-layout-provider-nav.test.ts
 * @description Regression coverage for H-158 ("the provider panel is a
 * capacity with no door") — the account sidebar rendered by
 * `AccountLayout.astro` had 15 entries and none of them linked to
 * `/mi-cuenta/proveedor`, even for an approved provider whose `host_trades`
 * row was active. The only way in was typing the URL.
 *
 * Gating must be by ROW OWNERSHIP, never by permission or role: HOS-278 AC-7
 * establishes that an approved provider is an ordinary tourist account with
 * no `HOST_TRADE_*` permission and no role change, so the usual
 * `requiredPermission` -> `isVisibleByRoles` mechanism every other sidebar
 * group uses structurally cannot represent this state.
 *
 * The ownership answer therefore rides on the SESSION, from the `/auth/me`
 * payload the middleware already fetches once per protected request. The first
 * version of this fix asked `GET /host-trades/mine` from the layout instead,
 * which is why one of these tests now asserts the ABSENCE of an API call: this
 * layout wraps 123 pages, so a fetch in its frontmatter is a blocking
 * round-trip on every single one of them.
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer) — these are
 * source-level assertions on the `.astro` file, the same pattern used by
 * `account-layout-owner-nav.test.ts` and `account-layout-discovery-doors.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PROVIDER_NAV_GROUP } from '../../src/config/navigation';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AccountLayout — provider nav door (H-158)', () => {
    it('imports PROVIDER_NAV_GROUP from the single-source nav config', () => {
        expect(source).toContain('PROVIDER_NAV_GROUP');
        expect(source).toMatch(/from '@\/config\/navigation'/);
    });

    it('reads ownership OFF THE SESSION, never by asking the API from the layout', () => {
        // THE POINT OF THIS TEST. This layout wraps 123 `/mi-cuenta/*` pages,
        // so an API call in its frontmatter is a blocking round-trip (~36 ms
        // measured) added to every one of them — for a question none of those
        // pages are about. The answer rides on `/auth/me`, which the
        // middleware already fetches once per protected request.
        expect(source).toContain('Astro.locals.user?.ownsHostTradeListing === true');
        expect(source).not.toContain('hostTradesApi');
    });

    it('gates the door on row ownership, never on a permission or role', () => {
        // An approved provider holds no role and no `HOST_TRADE_*` permission
        // (HOS-278 AC-7), so the usual primitive structurally cannot express
        // this state. The permission/role primitives DO appear in this file for
        // the other groups — this targets the provider branch specifically.
        expect(source).toContain('ownsHostTradeListing');
        expect(source).not.toContain('PermissionEnum.HOST_TRADE');
    });

    it('does NOT hide the door for a revoked listing', () => {
        // A revoked provider still reaches a meaningful page
        // (mi-cuenta/proveedor renders a "listing taken down" state with the
        // admin's reason) — hiding the nav entry on revoke would strand them
        // exactly like the bug this test guards against, just one step later.
        // The flag is deliberately ownership-only, with no lifecycle qualifier.
        expect(source).not.toMatch(/ownsHostTradeListing[^\n]*revoked/i);
        expect(source).not.toMatch(/ownsHostTradeListing[^\n]*isActive/);
    });

    it('splices PROVIDER_NAV_GROUP into navGroups only when ownership is confirmed', () => {
        expect(source).toContain(
            'isProvider ? [...baseNavGroups, PROVIDER_NAV_GROUP] : baseNavGroups'
        );
    });

    it('reads the flag through optional chaining, so a guest never trips it', () => {
        // `Astro.locals.user` is null for a guest; `?.` yields undefined and
        // the `=== true` comparison makes that a hard false rather than a
        // truthiness accident.
        expect(source).toContain('Astro.locals.user?.ownsHostTradeListing');
    });
});

describe('PROVIDER_NAV_GROUP (config shape, mirrors the comercio "cajón" group)', () => {
    it('links to the provider self-service panel', () => {
        expect(PROVIDER_NAV_GROUP.items).toHaveLength(1);
        expect(PROVIDER_NAV_GROUP.items[0]?.id).toBe('provider');
        expect(PROVIDER_NAV_GROUP.items[0]?.href).toBe('mi-cuenta/proveedor');
    });

    it('suppresses its group header, single-item "cajón" group — same as comercio', () => {
        expect(PROVIDER_NAV_GROUP.suppressHeaderWhenSingle).toBe(true);
    });

    it('declares no requiredPermission — ownership-gated groups cannot use the permission primitive (HOS-278 AC-7)', () => {
        expect(PROVIDER_NAV_GROUP.requiredPermission).toBeUndefined();
        expect(PROVIDER_NAV_GROUP.items[0]?.requiredPermission).toBeUndefined();
    });

    it('stores i18n keys, never resolved text, for the group and item label', () => {
        expect(PROVIDER_NAV_GROUP.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
        expect(PROVIDER_NAV_GROUP.items[0]?.i18nKey).toMatch(/^[a-zA-Z0-9.]+$/);
    });

    it('gives the item an @repo/icons component reference, not a string', () => {
        expect(typeof PROVIDER_NAV_GROUP.items[0]?.icon).toBe('function');
    });

    it('is intentionally absent from ACCOUNT_NAV_GROUPS (permission-only catalog)', async () => {
        const { ACCOUNT_NAV_GROUPS } = await import('../../src/config/navigation');
        expect(ACCOUNT_NAV_GROUPS.map((group) => group.id)).not.toContain('proveedor');
    });
});
