import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveLiftTransition } from '../../src/publication/moderation-origin';

describe('TEST:V6:11 resolveLiftTransition', () => {
    it('TEST:V6:11 sends DRAFT origins through PB11', () => {
        expect(resolveLiftTransition({ origin: { from: Status.DRAFT, archiveOrigin: null } })).toBe(
            'PB11'
        );
    });
    it('TEST:V6:11 sends PUBLISHED origins through PB13', () => {
        expect(
            resolveLiftTransition({ origin: { from: Status.PUBLISHED, archiveOrigin: null } })
        ).toBe('PB13');
    });
    it('TEST:V6:11 sends UNPUBLISHED_BY_BILLING origins through PB13', () => {
        expect(
            resolveLiftTransition({
                origin: { from: Status.UNPUBLISHED_BY_BILLING, archiveOrigin: null }
            })
        ).toBe('PB13');
    });
    it('TEST:V6:11 resolves ARCHIVED using its archive origin', () => {
        expect(
            resolveLiftTransition({
                origin: { from: Status.ARCHIVED, archiveOrigin: Status.PUBLISHED }
            })
        ).toBe('PB13');
        expect(
            resolveLiftTransition({
                origin: { from: Status.ARCHIVED, archiveOrigin: Status.DRAFT }
            })
        ).toBe('PB11');
    });
    it('TEST:V6:11 fails closed for missing or invalid origins', () => {
        expect(
            resolveLiftTransition({ origin: { from: Status.ARCHIVED, archiveOrigin: null } })
        ).toBe('PB11');
        expect(resolveLiftTransition({ origin: null })).toBe('PB11');
        expect(
            resolveLiftTransition({ origin: { from: Status.MODERATED, archiveOrigin: null } })
        ).toBe('PB11');
        expect(
            resolveLiftTransition({ origin: { from: Status.PURGED, archiveOrigin: null } })
        ).toBe('PB11');
    });
});
