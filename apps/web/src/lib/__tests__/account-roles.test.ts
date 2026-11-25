import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    resolveSubscriptionPlansPath,
    resolveSubscriptionPlansPathForAudience
} from '../account-roles';
import { hasAccommodationsNavAccess, hasListingNavAccess } from '../nav-gating';

describe('effective pricing and navigation authority', () => {
    it.each([
        [[], 'planes/turistas/precios'],
        [[P.ACCOMMODATION_CREATE], 'planes/anfitriones/precios'],
        [[P.VENUE_EDIT_OWN], 'planes/comer-y-salir/precios'],
        [[P.VENUE_EDIT_ALL], 'planes/comer-y-salir/precios'],
        [[P.EXPERIENCE_EDIT_OWN], 'planes/experiencias/precios'],
        [[P.VENUE_EDIT_OWN, P.EXPERIENCE_EDIT_OWN], 'planes/comer-y-salir/precios'],
        [[P.VENUE_EDIT_OWN, P.ACCOMMODATION_CREATE], 'planes/anfitriones/precios']
    ] as const)('resolves %j to %s', (permissions, path) => {
        expect(resolveSubscriptionPlansPath({ permissions })).toBe(path);
    });
    it('fails closed on role names and unknown permissions', () => {
        expect(hasAccommodationsNavAccess({ permissions: ['HOST', 'ADMIN'] })).toBe(false);
        expect(hasListingNavAccess({ permissions: ['VENUE_OWNER'] })).toBe(false);
        expect(resolveSubscriptionPlansPath({ permissions: ['HOST'] })).toBe(
            'planes/turistas/precios'
        );
    });
    it('admits independent and combined vertical grants regardless of order', () => {
        const permissions = [P.ACCOMMODATION_CREATE, P.VENUE_EDIT_OWN];
        for (const held of [permissions, [...permissions].reverse()]) {
            expect(hasAccommodationsNavAccess({ permissions: held })).toBe(true);
            expect(hasListingNavAccess({ permissions: held })).toBe(true);
        }
        expect(hasListingNavAccess({ permissions: [P.EXPERIENCE_EDIT_ALL] })).toBe(true);
        expect(hasAccommodationsNavAccess({ permissions: [P.EXPERIENCE_EDIT_OWN] })).toBe(false);
    });
    it.each([
        'host',
        'tourist',
        'venue',
        'experience'
    ] as const)('keeps explicit %s pricing', (audience) => {
        const permission = {
            host: P.ACCOMMODATION_CREATE,
            tourist: '',
            venue: P.VENUE_EDIT_OWN,
            experience: P.EXPERIENCE_EDIT_OWN
        }[audience];
        expect(resolveSubscriptionPlansPathForAudience({ audience })).toBe(
            resolveSubscriptionPlansPath({ permissions: [permission] })
        );
    });
});
