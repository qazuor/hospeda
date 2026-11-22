/**
 * @file business-verticals.test.ts
 * @description The «real client» rule (HOS-2551, HOS-2562): one definition the
 * web and the API both read.
 */

import { describe, expect, it } from 'vitest';
import {
    BUSINESS_VERTICAL_GATES,
    BUSINESS_VERTICAL_IDS,
    isRealClient,
    isRealClientByPermissions,
    PermissionEnum,
    resolveBusinessVerticals
} from '../src/index.js';

const NO_OWNERSHIP = { ownsHostTradeListing: false, ownsPartner: false } as const;

describe('resolveBusinessVerticals', () => {
    it('lists nothing for a pure tourist', () => {
        // Arrange: a tourist holds plenty of permissions, none of them a vertical's
        const permissions = [PermissionEnum.ACCOMMODATION_REVIEW_CREATE];

        // Act
        const { verticals } = resolveBusinessVerticals({ permissions, ...NO_OWNERSHIP });

        // Assert
        expect(verticals).toEqual([]);
        expect(isRealClient({ permissions, ...NO_OWNERSHIP })).toBe(false);
    });

    it.each([
        [PermissionEnum.ACCOMMODATION_CREATE, 'accommodations'],
        [PermissionEnum.VENUE_EDIT_OWN, 'venues'],
        [PermissionEnum.EXPERIENCE_EDIT_OWN, 'experiences'],
        [PermissionEnum.POST_CREATE, 'editorial'],
        [PermissionEnum.EVENT_CREATE, 'editorial']
    ] as const)('grants %s → %s by permission', (permission, vertical) => {
        const { verticals } = resolveBusinessVerticals({
            permissions: [permission],
            ...NO_OWNERSHIP
        });

        expect(verticals).toEqual([vertical]);
    });

    it('grants partner and provider by row ownership only', () => {
        expect(
            resolveBusinessVerticals({
                permissions: [],
                ownsHostTradeListing: true,
                ownsPartner: false
            }).verticals
        ).toEqual(['provider']);
        expect(
            resolveBusinessVerticals({
                permissions: [],
                ownsHostTradeListing: false,
                ownsPartner: true
            }).verticals
        ).toEqual(['partner']);
    });

    it('keeps display order for a multi-vertical person', () => {
        const { verticals } = resolveBusinessVerticals({
            permissions: [PermissionEnum.POST_CREATE, PermissionEnum.ACCOMMODATION_CREATE],
            ownsHostTradeListing: true,
            ownsPartner: true
        });

        expect(verticals).toEqual(['accommodations', 'editorial', 'partner', 'provider']);
    });

    it('declares exactly one gate per vertical id', () => {
        expect(BUSINESS_VERTICAL_GATES.map((gate) => gate.id)).toEqual([...BUSINESS_VERTICAL_IDS]);
        for (const gate of BUSINESS_VERTICAL_GATES) {
            const hasPermission = (gate.anyPermission?.length ?? 0) > 0;
            expect(hasPermission !== (gate.ownership !== undefined)).toBe(true);
        }
    });
});

describe('isRealClientByPermissions', () => {
    it('ignores ownership: a provider without permissions is not decided by it', () => {
        expect(isRealClientByPermissions({ permissions: [] })).toBe(false);
        expect(isRealClientByPermissions({ permissions: [PermissionEnum.VENUE_EDIT_OWN] })).toBe(
            true
        );
    });
});
