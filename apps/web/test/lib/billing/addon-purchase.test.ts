import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    eligibleTargets,
    hiddenListingNoticeKind,
    mintOrderRequestId,
    purchasableOffers,
    purchaseStateFrom
} from '@/lib/billing/addon-purchase';

const states = Object.values(PublicationStatusEnum);
const listing = (publicationStatus: PublicationStatusEnum, vertical = 'accommodation') => ({
    listingId: crypto.randomUUID(),
    publicationStatus,
    vertical,
    recurringListingAddons: 0,
    notices: []
});

describe('AC:B10:11 TEST:B10:13 hidden listing notice decision', () => {
    it.each(
        states.flatMap((publicationStatus) =>
            (['PERIODICO', 'UNA_VEZ'] as const).flatMap((chargeKind) =>
                [true, false].map((free) => ({ publicationStatus, chargeKind, free }))
            )
        )
    )('$publicationStatus $chargeKind free=$free', ({ publicationStatus, chargeKind, free }) => {
        const expected =
            free || publicationStatus === 'PUBLISHED' || chargeKind === 'UNA_VEZ'
                ? null
                : 'RECURRING';
        expect(
            hiddenListingNoticeKind({
                scopeType: 'LISTING',
                publicationStatus,
                chargeKind,
                free
            })
        ).toBe(expected);
    });

    it.each(['USER', 'GLOBAL', 'VERTICAL_SUBSCRIPTION'] as const)('skips %s scope', (scopeType) => {
        expect(
            hiddenListingNoticeKind({
                scopeType,
                publicationStatus: PublicationStatusEnum.DRAFT,
                chargeKind: 'PERIODICO',
                free: false
            })
        ).toBeNull();
    });
});

describe('purchasableOffers', () => {
    const recurring = { productId: 'recurring', chargeKind: 'PERIODICO' } as const;
    const oneTime = { productId: 'one-time', chargeKind: 'UNA_VEZ' } as const;

    it('keeps recurring offers and excludes one-time offers', () => {
        expect(purchasableOffers([oneTime, recurring, oneTime] as const)).toEqual([recurring]);
    });

    it('returns an empty list when only one-time offers are returned', () => {
        expect(purchasableOffers([oneTime] as const)).toEqual([]);
    });
});

describe('eligibleTargets', () => {
    it('keeps compatible eligible listings and their status', () => {
        const draft = listing(PublicationStatusEnum.DRAFT);
        const published = listing(PublicationStatusEnum.PUBLISHED);
        const moderated = listing(PublicationStatusEnum.MODERATED);
        const purged = listing(PublicationStatusEnum.PURGED);
        const venue = listing(PublicationStatusEnum.DRAFT, 'venue');
        expect(
            eligibleTargets({
                items: [draft, published, moderated, purged, venue],
                compatibleVerticals: ['accommodation']
            })
        ).toEqual([draft, published]);
    });
});

describe('purchase identity and states', () => {
    it('mints a UUID for each new summary', () => {
        const first = mintOrderRequestId();
        const second = mintOrderRequestId();
        expect(first).toMatch(/^[0-9a-f]{8}-/);
        expect(second).toMatch(/^[0-9a-f]{8}-/);
        expect(first === second).toBe(false);
    });

    const base = {
        outcome: 'CREATED' as const,
        instanceId: crypto.randomUUID(),
        chargeKind: 'PERIODICO' as const,
        processing: false
    };
    it.each([
        [{ ...base, checkoutUrl: 'https://example.test/checkout' }, 'REDIRECT'],
        [{ ...base, outcome: 'PENDING_ELSEWHERE' as const, processing: true }, 'PROCESSING'],
        [
            { ...base, processing: true, order: { outcome: 'AWAITING_PROVIDER_ANSWER' as const } },
            'PROCESSING'
        ],
        [{ ...base, order: { outcome: 'ACTIVATED' as const } }, 'ACTIVE'],
        [
            {
                ...base,
                chargeKind: 'UNA_VEZ' as const,
                order: { outcome: 'ORDER_ALREADY_PLACED' as const }
            },
            'ACTIVE'
        ],
        [{ ...base, order: { outcome: 'ORDER_DECLINED' as const } }, 'REFUSED'],
        [{ ...base, order: { outcome: 'ORDER_REJECTED' as const } }, 'REFUSED'],
        [{ ...base, order: { outcome: 'NOT_APPROVED' as const } }, 'REFUSED'],
        [
            {
                ...base,
                processing: true,
                order: { outcome: 'PREVIOUS_PAYMENT_PROCESSING' as const }
            },
            'PROCESSING'
        ],
        [{ ...base, processing: true, order: { outcome: 'ORDER_PLACED' as const } }, 'PROCESSING'],
        [
            { ...base, processing: true, order: { outcome: 'ORDER_ALREADY_PLACED' as const } },
            'PROCESSING'
        ],
        [
            { ...base, processing: true, order: { outcome: 'NOT_APPLICABLE' as const } },
            'PROCESSING'
        ],
        [{ ...base, processing: true, order: { outcome: 'UNKNOWN' as const } }, 'PROCESSING']
    ] as const)('maps purchase response to %s', (response, expected) => {
        expect(purchaseStateFrom({ response })).toBe(expected);
    });
    it.each([
        ['PENDING_AUTHORIZATION', 'PROCESSING'],
        ['ACTIVE', 'ACTIVE'],
        ['ABANDONED', 'CLOSED'],
        ['EXPIRED', 'CLOSED'],
        ['CANCELLED', 'CLOSED']
    ] as const)('maps read %s to %s', (status, expected) => {
        expect(
            purchaseStateFrom({
                read: {
                    instanceId: base.instanceId,
                    status,
                    chargeKind: 'PERIODICO',
                    processing: status === 'PENDING_AUTHORIZATION'
                }
            })
        ).toBe(expected);
    });
});
