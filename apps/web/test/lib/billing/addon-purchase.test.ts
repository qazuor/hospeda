import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    closedCopyKey,
    eligibleTargets,
    hiddenListingNoticeKind,
    mintOrderRequestId,
    processingCopyKey,
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
            free || publicationStatus === 'PUBLISHED'
                ? null
                : chargeKind === 'UNA_VEZ'
                  ? 'ONE_TIME'
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

    it('sells recurring and one-time offers alike (HOS-2179 D-4)', () => {
        expect(purchasableOffers([oneTime, recurring] as const)).toEqual([oneTime, recurring]);
        expect(purchasableOffers([oneTime] as const)).toEqual([oneTime]);
    });

    it('leaves out a charge kind the screen does not know how to sell', () => {
        const unknown = { productId: 'other', chargeKind: 'OTRO' } as unknown as typeof oneTime;
        expect(purchasableOffers([unknown, recurring])).toEqual([recurring]);
    });
});

describe('HOS-2179 one-time copy decisions', () => {
    it.each([
        [
            { chargeKind: 'UNA_VEZ' as const, exhausted: false },
            'billing.addonPurchase.waitingPayment'
        ],
        [
            { chargeKind: 'UNA_VEZ' as const, exhausted: true },
            'billing.addonPurchase.waitingPaymentMail'
        ],
        [{ chargeKind: 'PERIODICO' as const, exhausted: true }, 'billing.addonPurchase.processing'],
        [{ chargeKind: null, exhausted: false }, 'billing.addonPurchase.processing']
    ])('processing copy for %o is %s', (input, expected) => {
        expect(processingCopyKey(input)).toBe(expected);
    });

    it.each([
        [
            { status: 'ABANDONED' as const, chargeKind: 'UNA_VEZ' as const },
            'billing.addonPurchase.pageExpired'
        ],
        [
            { status: 'CANCELLED' as const, chargeKind: 'UNA_VEZ' as const },
            'billing.addonPurchase.paymentNotConfirmed'
        ],
        [
            { status: 'ABANDONED' as const, chargeKind: 'PERIODICO' as const },
            'billing.addonPurchase.closed'
        ],
        [null, 'billing.addonPurchase.closed']
    ])('closed copy for %o is %s', (read, expected) => {
        expect(closedCopyKey({ read })).toBe(expected);
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
        [
            { ...base, chargeKind: 'UNA_VEZ' as const, checkoutUrl: 'https://example.test/page' },
            'REDIRECT'
        ],
        [{ ...base, outcome: 'PENDING_ELSEWHERE' as const, processing: true }, 'PROCESSING'],
        [{ ...base, chargeKind: 'UNA_VEZ' as const, processing: true }, 'PROCESSING'],
        [{ ...base, outcome: 'EXISTING' as const, chargeKind: 'UNA_VEZ' as const }, 'SETTLED']
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
