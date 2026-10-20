import { describe, expect, it } from 'vitest';
import { resolvePromoCodeAvailability } from '../../../../src/services/billing/promo/promo-availability.js';

const now = new Date('2026-10-18T12:00:00.000Z');
const validFrom = new Date('2026-10-18T00:00:00.000Z');
const validUntil = new Date('2026-10-19T00:00:00.000Z');
const openPromo = {
    closedAt: null,
    validFrom,
    validUntil,
    totalQuota: 10
};

describe('AC:B9b:9 HOS-1591 promo code availability precedence', () => {
    it('returns CLOSED before expired or exhausted states', () => {
        expect(
            resolvePromoCodeAvailability({
                promo: { ...openPromo, closedAt: now, validUntil: now, totalQuota: 1 },
                redemptionCount: 1,
                now
            })
        ).toBe('CLOSED');
    });

    it('returns NOT_YET_VALID before expiry and quota checks', () => {
        expect(
            resolvePromoCodeAvailability({
                promo: {
                    ...openPromo,
                    validFrom: new Date(now.getTime() + 1),
                    validUntil: now,
                    totalQuota: 1
                },
                redemptionCount: 1,
                now
            })
        ).toBe('NOT_YET_VALID');
    });

    it('treats validUntil as an exclusive boundary', () => {
        expect(
            resolvePromoCodeAvailability({
                promo: { ...openPromo, validUntil: now },
                redemptionCount: 0,
                now
            })
        ).toBe('EXPIRED');
    });

    it('returns EXHAUSTED at the total quota', () => {
        expect(
            resolvePromoCodeAvailability({
                promo: { ...openPromo, totalQuota: 2 },
                redemptionCount: 2,
                now
            })
        ).toBe('EXHAUSTED');
    });

    it('leaves a null quota open regardless of redemption count', () => {
        expect(
            resolvePromoCodeAvailability({
                promo: { ...openPromo, totalQuota: null },
                redemptionCount: 10_000,
                now
            })
        ).toBe('OPEN');
    });

    it('returns OPEN inside the validity window and below quota', () => {
        expect(resolvePromoCodeAvailability({ promo: openPromo, redemptionCount: 9, now })).toBe(
            'OPEN'
        );
    });
});
