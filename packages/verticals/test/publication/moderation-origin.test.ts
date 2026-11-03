import { PublicationStatusEnum as Status } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveLiftTransition } from '../../src/publication/moderation-origin';
import { selectPublishedWithinQuota } from '../../src/publication/moderation-queue';

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

describe('TEST:V6:11 selectPublishedWithinQuota', () => {
    const returning = {
        id: 'returning',
        createdAt: new Date('2026-01-01'),
        publishedAt: new Date('2026-01-01')
    };
    const newer = {
        id: 'newer',
        createdAt: new Date('2026-01-01'),
        publishedAt: new Date('2026-02-01')
    };
    it('TEST:V6:11 publishes a returning candidate when a slot is available', () => {
        expect(selectPublishedWithinQuota({ published: [], returning, limit: 1 })).toEqual({
            publishReturning: true,
            lower: []
        });
    });
    it('TEST:V6:11 lowers the older published listing when a more recently published one returns', () => {
        const older = {
            id: 'older',
            createdAt: new Date('2026-01-01'),
            publishedAt: new Date('2025-12-01')
        };
        expect(
            selectPublishedWithinQuota({ published: [older], returning: newer, limit: 1 })
        ).toEqual({ publishReturning: true, lower: [older] });
    });
    it('TEST:V6:11 leaves the returning listing waiting when a more recently published one holds the slot', () => {
        expect(selectPublishedWithinQuota({ published: [newer], returning, limit: 1 })).toEqual({
            publishReturning: false,
            lower: []
        });
    });
    it('TEST:V6:11 ranks a returning listing without a publish instant last (HOS-1997)', () => {
        const unknown = { id: 'unknown', createdAt: new Date('2025-01-01'), publishedAt: null };
        expect(
            selectPublishedWithinQuota({ published: [newer], returning: unknown, limit: 1 })
        ).toEqual({ publishReturning: false, lower: [] });
        expect(
            selectPublishedWithinQuota({ published: [unknown], returning: newer, limit: 1 })
        ).toEqual({ publishReturning: true, lower: [unknown] });
    });
    it('TEST:V6:11 keeps the most recently published listings across a limit of two (HOS-1997)', () => {
        const mid = {
            id: 'mid',
            createdAt: new Date('2026-01-01'),
            publishedAt: new Date('2026-01-15')
        };
        const old = {
            id: 'old',
            createdAt: new Date('2025-01-01'),
            publishedAt: new Date('2025-06-01')
        };
        expect(
            selectPublishedWithinQuota({ published: [old, mid], returning: newer, limit: 2 })
        ).toEqual({ publishReturning: true, lower: [old] });
    });
    it('TEST:V6:11 publishes nothing at a zero limit', () => {
        expect(selectPublishedWithinQuota({ published: [newer], returning, limit: 0 })).toEqual({
            publishReturning: false,
            lower: []
        });
    });
});
