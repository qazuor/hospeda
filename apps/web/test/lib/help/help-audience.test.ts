/**
 * HOS-2410 web-ui §2 (AC-1, AC-2) — audience preselection precedence.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { pickHelpAudience } from '../../../src/lib/help/help-audience';

describe('pickHelpAudience', () => {
    it('picks venue for a user with VENUE_EDIT_OWN (AC-1)', () => {
        expect(
            pickHelpAudience({
                permissions: [PermissionEnum.VENUE_EDIT_OWN],
                ownsHostTrade: false,
                ownsPartner: false
            })
        ).toBe('venue');
    });

    it('picks host over provider for someone who is both (AC-2)', () => {
        expect(
            pickHelpAudience({
                permissions: [PermissionEnum.ACCOMMODATION_CREATE],
                ownsHostTrade: true,
                ownsPartner: true
            })
        ).toBe('host');
    });

    it('follows host > venue > experience among permissions', () => {
        expect(
            pickHelpAudience({
                permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN, PermissionEnum.VENUE_EDIT_OWN],
                ownsHostTrade: false,
                ownsPartner: false
            })
        ).toBe('venue');
    });

    it('falls back to provider, then partner, from row ownership', () => {
        expect(pickHelpAudience({ permissions: [], ownsHostTrade: true, ownsPartner: true })).toBe(
            'provider'
        );
        expect(pickHelpAudience({ permissions: [], ownsHostTrade: false, ownsPartner: true })).toBe(
            'partner'
        );
    });

    it('picks nothing when nothing matches, so the server default stays', () => {
        expect(
            pickHelpAudience({
                permissions: ['user.read'],
                ownsHostTrade: false,
                ownsPartner: false
            })
        ).toBeUndefined();
    });
});
