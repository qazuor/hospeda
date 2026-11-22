import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    type ListingReturnFact,
    planListingReturn,
    planPartnerReturn,
    planS7SideEffects,
    returnPresenceKind
} from '../../../../src/services/billing/subscription/late-manual-payment-return-plan';

const created = new Date('2025-01-01T00:00:00Z');
const listing = (id: string, publicationStatus: PublicationStatusEnum): ListingReturnFact => ({
    id,
    name: `Listing ${id}`,
    publicationStatus,
    createdAt: created
});
const outcomes = (items: readonly { id: string; outcome: string }[]) =>
    Object.fromEntries(items.map((item) => [item.id, item.outcome]));

describe('HOS-1640 MP4 preview: listing return (fila 10-bis (a))', () => {
    it('PB4+PB7: archived from PUBLISHED or UNPUBLISHED_BY_BILLING returns when the quota allows', () => {
        // Arrange
        const listings = [
            listing('from-published', PublicationStatusEnum.ARCHIVED),
            listing('from-billing', PublicationStatusEnum.ARCHIVED),
            listing('unpublished', PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
        ];
        const archiveOrigins = new Map([
            ['from-published', PublicationStatusEnum.PUBLISHED],
            ['from-billing', PublicationStatusEnum.UNPUBLISHED_BY_BILLING]
        ]);

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins,
            incompleteIds: new Set(),
            publishedAt: new Map(),
            limit: 3
        });

        // Assert
        expect(outcomes(items)).toEqual({
            'from-published': 'RETURNS',
            'from-billing': 'RETURNS',
            unpublished: 'RETURNS'
        });
    });

    it('PB5: an archived draft does not return on its own, even with free quota', () => {
        // Arrange
        const listings = [listing('draft', PublicationStatusEnum.ARCHIVED)];
        const archiveOrigins = new Map([['draft', PublicationStatusEnum.DRAFT]]);

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins,
            incompleteIds: new Set(),
            publishedAt: new Map(),
            limit: 10
        });

        // Assert
        expect(items[0]?.outcome).toBe('ARCHIVED_DRAFT');
    });

    it('PB7: candidates beyond the free slots are left out, newest manual publish first', () => {
        // Arrange
        const listings = [
            listing('older', PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
            listing('newer', PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
            listing('public', PublicationStatusEnum.PUBLISHED)
        ];
        const publishedAt = new Map([
            ['older', new Date('2026-01-01T00:00:00Z')],
            ['newer', new Date('2026-05-01T00:00:00Z')]
        ]);

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins: new Map(),
            incompleteIds: new Set(),
            publishedAt,
            limit: 2
        });

        // Assert
        expect(outcomes(items)).toEqual({
            older: 'NO_SLOT',
            newer: 'RETURNS',
            public: 'ALREADY_PUBLISHED'
        });
    });

    it('PB9/PB12: a PURGED listing never returns; MODERATED and DRAFT stay as they are', () => {
        // Arrange
        const listings = [
            listing('purged', PublicationStatusEnum.PURGED),
            listing('moderated', PublicationStatusEnum.MODERATED),
            listing('draft', PublicationStatusEnum.DRAFT)
        ];

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins: new Map(),
            incompleteIds: new Set(),
            publishedAt: new Map(),
            limit: 10
        });

        // Assert
        expect(outcomes(items)).toEqual({
            purged: 'PURGED',
            moderated: 'MODERATED',
            draft: 'DRAFT'
        });
    });

    it('PB7 surplus: a returning plan below what is public lowers the newest publish and restores nothing', () => {
        // Arrange
        const listings = [
            listing('first', PublicationStatusEnum.PUBLISHED),
            listing('second', PublicationStatusEnum.PUBLISHED),
            listing('waiting', PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
        ];
        const publishedAt = new Map([
            ['first', new Date('2026-01-01T00:00:00Z')],
            ['second', new Date('2026-02-01T00:00:00Z')]
        ]);

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins: new Map(),
            incompleteIds: new Set(),
            publishedAt,
            limit: 1
        });

        // Assert
        expect(outcomes(items)).toEqual({
            first: 'ALREADY_PUBLISHED',
            second: 'LOWERED_BY_SURPLUS',
            waiting: 'NO_SLOT'
        });
    });

    it('HOS-1744: an incomplete candidate does not return and does not take a slot', () => {
        // Arrange
        const listings = [
            listing('incomplete', PublicationStatusEnum.UNPUBLISHED_BY_BILLING),
            listing('complete', PublicationStatusEnum.UNPUBLISHED_BY_BILLING)
        ];

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins: new Map(),
            incompleteIds: new Set(['incomplete']),
            publishedAt: new Map(),
            limit: 1
        });

        // Assert
        expect(outcomes(items)).toEqual({ incomplete: 'INCOMPLETE', complete: 'RETURNS' });
    });

    it('a plan without a declared publication limit restores nothing, as PB7 does', () => {
        // Arrange
        const listings = [listing('a', PublicationStatusEnum.UNPUBLISHED_BY_BILLING)];

        // Act
        const items = planListingReturn({
            listings,
            archiveOrigins: new Map(),
            incompleteIds: new Set(),
            publishedAt: new Map(),
            limit: null
        });

        // Assert
        expect(items[0]?.outcome).toBe('NO_SLOT');
    });
});

describe('HOS-1640 MP4 preview: partner return (fila 10-bis (b))', () => {
    it('the gold page returns when the plan grants partner_public_page', () => {
        // Arrange / Act
        const outcome = planPartnerReturn({
            partner: { revokedAt: null },
            grantsPublicPage: true,
            grantsCarousel: true
        });

        // Assert
        expect(outcome).toBe('GOLD_PAGE_RETURNS');
    });

    it('a revoked partner does not return, whatever the plan grants (410)', () => {
        // Arrange / Act
        const outcome = planPartnerReturn({
            partner: { revokedAt: new Date('2026-10-01T00:00:00Z') },
            grantsPublicPage: true,
            grantsCarousel: true
        });

        // Assert
        expect(outcome).toBe('REVOKED');
    });

    it.each([
        [{ grantsPublicPage: false, grantsCarousel: true }, 'CAROUSEL_RETURNS'],
        [{ grantsPublicPage: false, grantsCarousel: false }, 'NO_PRESENCE']
    ])('without the page entitlement %o answers %s', (grants, expected) => {
        // Arrange / Act
        const outcome = planPartnerReturn({ partner: { revokedAt: null }, ...grants });

        // Assert
        expect(outcome).toBe(expected);
    });

    it('an account without a partner row answers NO_PARTNER', () => {
        // Arrange / Act
        const outcome = planPartnerReturn({
            partner: null,
            grantsPublicPage: true,
            grantsCarousel: true
        });

        // Assert
        expect(outcome).toBe('NO_PARTNER');
    });
});

describe('HOS-1640 MP4 preview: presence branch per vertical (decision 1)', () => {
    it.each([
        [VerticalEnum.ACCOMMODATION, 'LISTINGS'],
        [VerticalEnum.VENUE, 'LISTINGS'],
        [VerticalEnum.EXPERIENCE, 'LISTINGS'],
        [VerticalEnum.PARTNER, 'PARTNER'],
        [VerticalEnum.TOURIST, 'NONE'],
        [null, 'NONE']
    ])('vertical %s takes the %s branch', (vertical, expected) => {
        // Arrange / Act
        const kind = returnPresenceKind({ vertical });

        // Assert
        expect(kind).toBe(expected);
    });
});

describe('HOS-1640 MP4 preview: the other three S7 effects (decision 2)', () => {
    const none = {
        pausedComplements: [],
        inheritsTouristVip: false,
        cancellableTouristVipIds: [],
        dueScheduledChange: null
    };

    it('reports nothing when no effect applies', () => {
        // Arrange / Act
        const effects = planS7SideEffects(none);

        // Assert
        expect(effects).toEqual({
            complements: { resumed: [], skipped: [] },
            touristVip: { cancels: false, subscriptionIds: [] },
            scheduledChange: null
        });
    });

    it('S33: splits paused complements into resumed (card + link) and skipped', () => {
        // Arrange / Act
        const effects = planS7SideEffects({
            ...none,
            pausedComplements: [
                { complementSubscriptionId: 'card', resumableAtProvider: true },
                { complementSubscriptionId: 'manual', resumableAtProvider: false }
            ]
        });

        // Assert
        expect(effects.complements).toEqual({ resumed: ['card'], skipped: ['manual'] });
    });

    it('cancels the inherited Tourist VIP only when inherited AND a paid VIP exists', () => {
        // Arrange / Act
        const inheritedWithVip = planS7SideEffects({
            ...none,
            inheritsTouristVip: true,
            cancellableTouristVipIds: ['vip']
        });
        const vipWithoutInheritance = planS7SideEffects({
            ...none,
            cancellableTouristVipIds: ['vip']
        });
        const inheritedWithoutVip = planS7SideEffects({ ...none, inheritsTouristVip: true });

        // Assert
        expect(inheritedWithVip.touristVip).toEqual({ cancels: true, subscriptionIds: ['vip'] });
        expect(vipWithoutInheritance.touristVip.cancels).toBe(false);
        expect(inheritedWithoutVip.touristVip.cancels).toBe(false);
    });

    it('applies the overdue scheduled plan change when one is due', () => {
        // Arrange
        const effectiveAt = new Date('2026-09-01T00:00:00Z');

        // Act
        const effects = planS7SideEffects({ ...none, dueScheduledChange: { effectiveAt } });

        // Assert
        expect(effects.scheduledChange).toEqual({ effectiveAt });
    });
});
