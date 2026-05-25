// @vitest-environment jsdom
/**
 * Tests for useVisibleSidebarItems.
 *
 * Covers:
 * - Item with no permission gate → always visible, disabled: false.
 * - Item with granted permission → visible, disabled: false.
 * - Item with ungranted permission + onMissing:'disable' → kept, disabled: true.
 * - Item with ungranted permission + onMissing:'hide' → omitted from result.
 * - Separator items → always kept (disabled: false).
 * - Group where ALL children are hidden → group omitted entirely.
 * - Group where some children are disabled → group kept, children preserved.
 * - Group with no gate, some children hidden → group kept with visible children.
 * - Wildcard permission gate (e.g. 'ACCOMMODATION_*') resolves correctly.
 * - KEY→VALUE bridge verification: user has VALUE 'accommodation.viewAll',
 *   item gates KEY 'ACCOMMODATION_VIEW_ALL' → visible (bridge works).
 *
 * @see apps/admin/src/hooks/use-visible-sidebar-items.ts
 * @see SPEC-154 T-022
 */

import type { SidebarItem } from '@/config/ia/schema';
import {
    type VisibleGroupItem,
    type VisibleLinkItem,
    useVisibleSidebarItems
} from '@/hooks/use-visible-sidebar-items';
import { PermissionEnum } from '@repo/schemas';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock useUserPermissions so we control the user's permissions per test.
// ---------------------------------------------------------------------------

const mockPermissions: PermissionEnum[] = [];

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => mockPermissions,
    useHasPermission: vi.fn(),
    useHasAnyPermission: vi.fn(),
    useHasAllPermissions: vi.fn()
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mutates the shared permissions array for the next renderHook call. */
function setPermissions(...perms: PermissionEnum[]): void {
    mockPermissions.length = 0;
    mockPermissions.push(...perms);
}

/** Builds a minimal valid I18nLabel. */
const LABEL = { es: 'Test', en: 'Test', pt: 'Test' } as const;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Link item with no permission gate. */
const publicLink: SidebarItem = {
    type: 'link',
    id: 'public-link',
    label: { ...LABEL },
    route: '/public',
    exact: false,
    onMissing: 'disable'
};

/** Link item gated on ACCOMMODATION_VIEW_ALL. */
const gatedLink: SidebarItem = {
    type: 'link',
    id: 'gated-link',
    label: { ...LABEL },
    route: '/accommodations',
    exact: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'disable'
};

/** Link item gated on ACCOMMODATION_VIEW_ALL with onMissing:'hide'. */
const hiddenLink: SidebarItem = {
    type: 'link',
    id: 'hidden-link',
    label: { ...LABEL },
    route: '/hidden',
    exact: false,
    permissions: ['ACCOMMODATION_VIEW_ALL'],
    onMissing: 'hide'
};

/** Separator item. */
const separator: SidebarItem = {
    type: 'separator',
    id: 'sep-1'
};

/** Group where ALL children are gated and set to 'hide'. */
const allHiddenGroup: SidebarItem = {
    type: 'group',
    id: 'all-hidden-group',
    label: { ...LABEL },
    defaultOpen: false,
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'child-hidden-1',
            label: { ...LABEL },
            route: '/secret/a',
            exact: false,
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            onMissing: 'hide'
        },
        {
            type: 'link',
            id: 'child-hidden-2',
            label: { ...LABEL },
            route: '/secret/b',
            exact: false,
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            onMissing: 'hide'
        }
    ]
};

/** Group where some children are disabled (no access + onMissing:'disable'). */
const mixedGroup: SidebarItem = {
    type: 'group',
    id: 'mixed-group',
    label: { ...LABEL },
    defaultOpen: true,
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'child-public',
            label: { ...LABEL },
            route: '/open',
            exact: false,
            onMissing: 'disable'
        },
        {
            type: 'link',
            id: 'child-disabled',
            label: { ...LABEL },
            route: '/protected',
            exact: false,
            permissions: ['ACCOMMODATION_VIEW_ALL'],
            onMissing: 'disable'
        }
    ]
};

/** Group with a wildcard permission gate. */
const wildcardGroup: SidebarItem = {
    type: 'group',
    id: 'wildcard-group',
    label: { ...LABEL },
    defaultOpen: false,
    permissions: ['ACCOMMODATION_*'],
    onMissing: 'disable',
    items: [
        {
            type: 'link',
            id: 'accommodation-list',
            label: { ...LABEL },
            route: '/accommodations',
            exact: false,
            onMissing: 'disable'
        }
    ]
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVisibleSidebarItems', () => {
    // ── No gate ────────────────────────────────────────────────────────────────

    it('item with no permission gate is always visible (disabled: false)', () => {
        setPermissions(); // no permissions
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [publicLink] }));
        expect(result.current).toHaveLength(1);
        expect((result.current[0] as VisibleLinkItem).disabled).toBe(false);
    });

    // ── Separator ──────────────────────────────────────────────────────────────

    it('separator is always kept with disabled: false', () => {
        setPermissions(); // no permissions
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [separator] }));
        expect(result.current).toHaveLength(1);
        expect(result.current[0].type).toBe('separator');
        expect((result.current[0] as { disabled: boolean }).disabled).toBe(false);
    });

    // ── Granted permission ─────────────────────────────────────────────────────

    it('KEY→VALUE bridge: item gated on KEY "ACCOMMODATION_VIEW_ALL" is visible when user holds VALUE "accommodation.viewAll"', () => {
        // This is the core bridge test.
        // The item config uses the enum KEY: 'ACCOMMODATION_VIEW_ALL'
        // expandPermissions maps it to the enum VALUE: 'accommodation.viewAll'
        // useUserPermissions returns VALUES — so this must pass.
        setPermissions(PermissionEnum.ACCOMMODATION_VIEW_ALL); // = 'accommodation.viewAll'
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [gatedLink] }));
        expect(result.current).toHaveLength(1);
        expect((result.current[0] as VisibleLinkItem).disabled).toBe(false);
    });

    // ── Ungranted + onMissing:'disable' ────────────────────────────────────────

    it('item with ungranted permission + onMissing:"disable" is kept but disabled: true', () => {
        setPermissions(); // no permissions
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [gatedLink] }));
        expect(result.current).toHaveLength(1);
        expect((result.current[0] as VisibleLinkItem).disabled).toBe(true);
    });

    // ── Ungranted + onMissing:'hide' ───────────────────────────────────────────

    it('item with ungranted permission + onMissing:"hide" is omitted entirely', () => {
        setPermissions(); // no permissions
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [hiddenLink] }));
        expect(result.current).toHaveLength(0);
    });

    it('item with granted permission + onMissing:"hide" is visible', () => {
        setPermissions(PermissionEnum.ACCOMMODATION_VIEW_ALL);
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [hiddenLink] }));
        expect(result.current).toHaveLength(1);
        expect((result.current[0] as VisibleLinkItem).disabled).toBe(false);
    });

    // ── Group: all children hidden ─────────────────────────────────────────────

    it('group with all children hidden (onMissing:"hide") is omitted entirely', () => {
        setPermissions(); // no permissions → both children hidden
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [allHiddenGroup] }));
        expect(result.current).toHaveLength(0);
    });

    // ── Group: mixed children ──────────────────────────────────────────────────

    it('group with some disabled children is kept; public child is enabled, gated child is disabled', () => {
        setPermissions(); // no access to gated child
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [mixedGroup] }));
        expect(result.current).toHaveLength(1);
        const group = result.current[0] as VisibleGroupItem;
        expect(group.type).toBe('group');
        expect(group.disabled).toBe(false); // group itself has no gate
        expect(group.items).toHaveLength(2);
        const [publicChild, disabledChild] = group.items;
        expect((publicChild as VisibleLinkItem).disabled).toBe(false);
        expect((disabledChild as VisibleLinkItem).disabled).toBe(true);
    });

    it('group with all children granted is kept with all children enabled', () => {
        setPermissions(PermissionEnum.ACCOMMODATION_VIEW_ALL);
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [mixedGroup] }));
        const group = result.current[0] as VisibleGroupItem;
        expect(group.items).toHaveLength(2);
        for (const child of group.items) {
            expect((child as VisibleLinkItem).disabled).toBe(false);
        }
    });

    // ── Wildcard permission gate ───────────────────────────────────────────────

    it('group gated on "ACCOMMODATION_*" wildcard is visible when user has any ACCOMMODATION_ permission', () => {
        // User has ACCOMMODATION_CREATE (value: 'accommodation.create')
        // expandPermissions(['ACCOMMODATION_*']) expands to all ACCOMMODATION_ values
        // including 'accommodation.create' → access granted
        setPermissions(PermissionEnum.ACCOMMODATION_CREATE);
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [wildcardGroup] }));
        expect(result.current).toHaveLength(1);
        const group = result.current[0] as VisibleGroupItem;
        expect(group.disabled).toBe(false);
    });

    it('group gated on "ACCOMMODATION_*" wildcard is disabled when user has no ACCOMMODATION_ permissions', () => {
        setPermissions(); // no permissions
        const { result } = renderHook(() => useVisibleSidebarItems({ items: [wildcardGroup] }));
        // Group has onMissing:'disable' — group is kept but disabled
        // Group has one ungated child → child is visible (no gate on child)
        expect(result.current).toHaveLength(1);
        const group = result.current[0] as VisibleGroupItem;
        expect(group.disabled).toBe(true);
    });

    // ── Multiple items ─────────────────────────────────────────────────────────

    it('processes a mixed list: visible items kept, hidden items removed', () => {
        setPermissions(); // no permissions
        const items: SidebarItem[] = [publicLink, hiddenLink, separator, gatedLink];
        const { result } = renderHook(() => useVisibleSidebarItems({ items }));
        // publicLink → kept (no gate), disabled:false
        // hiddenLink → omitted (no access + hide)
        // separator  → kept
        // gatedLink  → kept disabled:true (no access + disable)
        expect(result.current).toHaveLength(3);
        expect(result.current[0].id).toBe('public-link');
        expect((result.current[0] as VisibleLinkItem).disabled).toBe(false);
        expect(result.current[1].id).toBe('sep-1');
        expect(result.current[2].id).toBe('gated-link');
        expect((result.current[2] as VisibleLinkItem).disabled).toBe(true);
    });

    // ── Memoization ────────────────────────────────────────────────────────────

    it('returns referentially stable result on re-render with same inputs', () => {
        setPermissions(PermissionEnum.ACCOMMODATION_VIEW_ALL);
        const items: SidebarItem[] = [publicLink, gatedLink];
        const { result, rerender } = renderHook(() => useVisibleSidebarItems({ items }));
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
