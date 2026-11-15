import { describe, expect, it, vi } from 'vitest';
import {
    ChargebackSuspensionNoticeContentSchema,
    readChargebackSuspensionNoticeContent
} from '../../../../src/services/billing/subscription/chargeback-suspension-notice';

vi.mock('../../../../src/services/billing/subscription/arrears-suspension-notice', () => ({
    readArrearsSuspensionNoticeContent: async () => ({
        vertical: 'accommodation',
        paymentMethod: 'CARD',
        touristVipLost: true,
        oneTimeAddons: [{ name: 'Destacado', remainingDays: 2 }],
        promoLost: true
    })
}));

describe('TEST:B7:7 AC:B7:10 chargeback suspension notice content', () => {
    it('uses the payment day in UTC-4 and carries courtesyEnded without promoLost', async () => {
        const content = await readChargebackSuspensionNoticeContent({
            subscription: {} as Parameters<
                typeof readChargebackSuspensionNoticeContent
            >[0]['subscription'],
            payment: {
                amount: 10_000,
                currency: 'ARS',
                factAt: new Date('2026-11-20T03:30:00Z')
            } as Parameters<typeof readChargebackSuspensionNoticeContent>[0]['payment'],
            courtesyEnded: true,
            now: new Date('2026-11-20T04:00:00Z')
        });
        expect(content).toStrictEqual({
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            touristVipLost: true,
            oneTimeAddons: [{ name: 'Destacado', remainingDays: 2 }],
            chargedBackPayment: { amountMinor: 10_000, currency: 'ARS', chargedOn: '2026-11-19' },
            courtesyEnded: true
        });
        expect(
            ChargebackSuspensionNoticeContentSchema.safeParse({ ...content, extra: true }).success
        ).toBe(false);
    });
});
