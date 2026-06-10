/**
 * Tests for the shared navigation permission-visibility module (SPEC-154).
 *
 * Covers the two pure functions that previously lived (duplicated) across
 * MainMenu, BottomNav, QuickCreate, and useVisibleSidebarItems:
 *
 * isPermissionGateGranted:
 * - undefined gate → granted.
 * - empty gate → granted.
 * - exact gate granted (KEY→VALUE bridge).
 * - exact gate denied.
 * - wildcard gate (KEY prefix → VALUES) granted/denied.
 * - unknown permission key → denied (safe default, expansion throws).
 *
 * hasSidebarAccessibleItem:
 * - ungated link → accessible.
 * - gated link granted → accessible.
 * - gated link denied + onMissing:'disable' → still counts (renders disabled).
 * - gated link denied + onMissing:'hide' → does NOT count.
 * - separators are transparent (never accessible on their own).
 * - nested group: accessible child surfaces through the group.
 * - nested group: all children hidden → not accessible.
 * - group gate denied + onMissing:'hide' → whole group skipped.
 * - group gate denied + onMissing:'disable' → children still evaluated.
 *
 * @see apps/admin/src/lib/nav/permission-visibility.ts
 * @see SPEC-154
 */

import type { SidebarItem } from '@/config/ia/schema';
import { hasSidebarAccessibleItem, isPermissionGateGranted } from '@/lib/nav/permission-visibility';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

/** Minimal valid I18nLabel. */
const LABEL = { es: 'Test', en: 'Test', pt: 'Test' } as const;

/** Ungated link. */
const publicLink: SidebarItem = {
    type: 'link',
    id: 'public-link',
    label: { ...LABEL },
    route: '/public',
    exact: false,
    onMissing: 'disable'
};

/** Link gated on ACCOMMODATION_VIEW_ALL, onMissing:'disable'. */
const gatedDisableLink: SidebarItem = {
    type: 'link',
    id: 'gated-disable-link',
    label: { ...LABEL },
    route: '/accommodations',
    exact: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'disable'
};

/** Link gated on ACCOMMODATION_VIEW_ALL, onMissing:'hide'. */
const gatedHideLink: SidebarItem = {
    type: 'link',
    id: 'gated-hide-link',
    label: { ...LABEL },
    route: '/hidden',
    exact: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'hide'
};

const separator: SidebarItem = {
    type: 'separator',
    id: 'sep-1'
};

/** Group with one ungated child, no gate on the group. */
const groupWithPublicChild: SidebarItem = {
    type: 'group',
    id: 'group-public',
    label: { ...LABEL },
    defaultOpen: false,
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'group-public-child',
            label: { ...LABEL },
            route: '/open',
            exact: false,
            onMissing: 'disable'
        }
    ]
};

/** Group whose only child is gated + hidden (so child does not count). */
const groupWithAllHiddenChildren: SidebarItem = {
    type: 'group',
    id: 'group-all-hidden',
    label: { ...LABEL },
    defaultOpen: false,
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'group-hidden-child',
            label: { ...LABEL },
            route: '/secret',
            exact: false,
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            onMissing: 'hide'
        }
    ]
};

/** Group gated + hidden, with an ungated child (group itself blocks it). */
const groupGatedHidden: SidebarItem = {
    type: 'group',
    id: 'group-gated-hidden',
    label: { ...LABEL },
    defaultOpen: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'hide',
    items: [
        {
            type: 'link',
            id: 'group-gated-hidden-child',
            label: { ...LABEL },
            route: '/open',
            exact: false,
            onMissing: 'disable'
        }
    ]
};

/** Group gated + disable, with an ungated child (children still evaluated). */
const groupGatedDisable: SidebarItem = {
    type: 'group',
    id: 'group-gated-disable',
    label: { ...LABEL },
    defaultOpen: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'group-gated-disable-child',
            label: { ...LABEL },
            route: '/open',
            exact: false,
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// isPermissionGateGranted
// ---------------------------------------------------------------------------

describe('isPermissionGateGranted', () => {
    it('returns true when the gate is undefined', () => {
        expect(isPermissionGateGranted({ gate: undefined, userPermissions: [] })).toBe(true);
    });

    it('returns true when the gate is an empty array', () => {
        expect(isPermissionGateGranted({ gate: [], userPermissions: [] })).toBe(true);
    });

    it('returns true for an exact gate the user holds (KEY→VALUE bridge)', () => {
        // Gate uses the enum KEY; user holds the enum VALUE.
        expect(
            isPermissionGateGranted({
                gate: ['ACCOMMODATION_VIEW_ALL'],
                userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
            })
        ).toBe(true);
    });

    it('returns false for an exact gate the user does not hold', () => {
        expect(
            isPermissionGateGranted({
                gate: ['ACCOMMODATION_VIEW_ALL'],
                userPermissions: []
            })
        ).toBe(false);
    });

    it('returns true for a wildcard gate when the user holds any matching VALUE', () => {
        // 'ACCOMMODATION_*' expands to all ACCOMMODATION_ VALUES, including create.
        expect(
            isPermissionGateGranted({
                gate: ['ACCOMMODATION_*'],
                userPermissions: [PermissionEnum.ACCOMMODATION_CREATE]
            })
        ).toBe(true);
    });

    it('returns false for a wildcard gate when the user holds no matching VALUE', () => {
        expect(
            isPermissionGateGranted({
                gate: ['ACCOMMODATION_*'],
                userPermissions: []
            })
        ).toBe(false);
    });

    it('returns false (safe default) when a gate key is unknown and expansion throws', () => {
        expect(
            isPermissionGateGranted({
                gate: ['TOTALLY_UNKNOWN_PERMISSION_KEY'],
                userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
            })
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// hasSidebarAccessibleItem
// ---------------------------------------------------------------------------

describe('hasSidebarAccessibleItem', () => {
    it('returns true for an ungated link', () => {
        expect(hasSidebarAccessibleItem({ items: [publicLink], userPermissions: [] })).toBe(true);
    });

    it('returns true for a gated link the user can access', () => {
        expect(
            hasSidebarAccessibleItem({
                items: [gatedDisableLink],
                userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
            })
        ).toBe(true);
    });

    it('returns true for a denied gated link with onMissing:"disable" (renders disabled)', () => {
        expect(hasSidebarAccessibleItem({ items: [gatedDisableLink], userPermissions: [] })).toBe(
            true
        );
    });

    it('returns false for a denied gated link with onMissing:"hide"', () => {
        expect(hasSidebarAccessibleItem({ items: [gatedHideLink], userPermissions: [] })).toBe(
            false
        );
    });

    it('treats separators as transparent (a lone separator is not accessible)', () => {
        expect(hasSidebarAccessibleItem({ items: [separator], userPermissions: [] })).toBe(false);
    });

    it('returns true when a nested group has an accessible child', () => {
        expect(
            hasSidebarAccessibleItem({ items: [groupWithPublicChild], userPermissions: [] })
        ).toBe(true);
    });

    it('returns false when a nested group has only hidden children', () => {
        expect(
            hasSidebarAccessibleItem({ items: [groupWithAllHiddenChildren], userPermissions: [] })
        ).toBe(false);
    });

    it('skips a group whose own gate is denied with onMissing:"hide" (child not surfaced)', () => {
        expect(hasSidebarAccessibleItem({ items: [groupGatedHidden], userPermissions: [] })).toBe(
            false
        );
    });

    it('still evaluates children when a group gate is denied with onMissing:"disable"', () => {
        expect(hasSidebarAccessibleItem({ items: [groupGatedDisable], userPermissions: [] })).toBe(
            true
        );
    });

    it('returns false for an empty item list', () => {
        expect(hasSidebarAccessibleItem({ items: [], userPermissions: [] })).toBe(false);
    });
});
