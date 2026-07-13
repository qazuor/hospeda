/**
 * @file account-layout-discovery-doors.test.ts
 * @description Source-level + engine-integration tests for the discovery-door
 * CTA entries in the `/mi-cuenta` sidebar (HOS-131 §6.2/§6.3). Doors render
 * ONLY on this surface (the sidebar), below the nav groups, gated
 * server-side by `isDoorVisible` + `isVisibleByRole` (HOS-131 D-4).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_DISCOVERY_DOORS, type DiscoveryDoor } from '../../src/config/discovery-doors';
import { isDoorVisible, isVisibleByRole } from '../../src/lib/nav-gating';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

/** Computes the doors visible in the sidebar exactly as `AccountLayout.astro` does for a given role. */
function visibleDoorsForRole(role: string | null): readonly DiscoveryDoor[] {
    return ACCOUNT_DISCOVERY_DOORS.filter((door) =>
        isDoorVisible({ door, visibility: (node) => isVisibleByRole(node, role) })
    );
}

describe('AccountLayout — discovery-door wiring (HOS-131 §6.2/§6.3)', () => {
    it('renders doors from the single-source config via ACCOUNT_DISCOVERY_DOORS + isDoorVisible', () => {
        expect(source).toContain(
            "import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';"
        );
        expect(source).toContain(
            "import { isDoorVisible, isVisibleByRole, resolveDoorLabelKey } from '@/lib/nav-gating';"
        );
        expect(source).toContain(
            'isDoorVisible({ door, visibility: (node) => isVisibleByRole(node, userRole) })'
        );
    });

    it('renders the doors block AFTER the nav groups, inside the same sidebar aside (visually below management)', () => {
        const navCloseIndex = source.indexOf('</nav>');
        const doorsBlockIndex = source.indexOf('account-nav__doors');
        const asideCloseIndex = source.indexOf('</aside>');
        expect(navCloseIndex).toBeGreaterThan(-1);
        expect(doorsBlockIndex).toBeGreaterThan(navCloseIndex);
        expect(asideCloseIndex).toBeGreaterThan(doorsBlockIndex);
    });

    it('styles the door CTA with its own dedicated class, distinct from a nav link', () => {
        expect(source).toContain("'account-nav__door-link',");
        expect(source).toContain('account-nav__door-link--active');
    });

    it('links each visible door to its hub page via buildUrl(door.href)', () => {
        expect(source).toContain('href={buildUrl({ locale, path: door.href })}');
    });

    it('computes the door active-state via the same getActiveSectionKey helper nav items use, and marks it with aria-current', () => {
        expect(source).toContain('const doorSectionKey = getActiveSectionKey(door.href);');
        expect(source).toContain('const isActiveDoor = doorSectionKey === activeSection;');
        expect(source).toContain("{ 'account-nav__door-link--active': isActiveDoor }");
        expect(source).toContain("aria-current={isActiveDoor ? 'page' : undefined}");
    });

    it('renders the door CTA label via resolveDoorLabelKey (HOS-134 stateful label), not a bare t(door.i18nKey)', () => {
        expect(source).toContain(
            "import { isDoorVisible, isVisibleByRole, resolveDoorLabelKey } from '@/lib/nav-gating';"
        );
        expect(source).toContain('resolveDoorLabelKey({');
        expect(source).toContain('door,');
        expect(source).toContain('visibility: (node) => isVisibleByRole(node, userRole),');
        expect(source).not.toContain('{t(door.i18nKey)}');
    });
});

describe('AccountLayout — discovery-door lifecycle by role (HOS-131 §6.3)', () => {
    it('shows both doors for a plain tourist (USER) — neither listing option is acquired, partner is always shown', () => {
        const doors = visibleDoorsForRole(RoleEnum.USER);
        expect(doors.map((door) => door.id)).toEqual(['listing', 'partner']);
    });

    it('still shows the listing door for a HOST — only one of its two options is acquired', () => {
        const doors = visibleDoorsForRole(RoleEnum.HOST);
        expect(doors.map((door) => door.id)).toContain('listing');
    });

    it('hides the listing door for platform staff (ADMIN) — both listing options are acquired via the role map', () => {
        const doors = visibleDoorsForRole(RoleEnum.ADMIN);
        expect(doors.map((door) => door.id)).not.toContain('listing');
    });

    it('always shows the partner door — its options are coming-soon placeholders that never acquire (NG-2)', () => {
        for (const role of [
            null,
            RoleEnum.USER,
            RoleEnum.HOST,
            RoleEnum.COMMERCE_OWNER,
            RoleEnum.ADMIN
        ]) {
            const doors = visibleDoorsForRole(role);
            expect(doors.map((door) => door.id)).toContain('partner');
        }
    });
});
