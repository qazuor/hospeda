import { describe, expect, it } from 'vitest';
import {
    ArrearsSuspensionNoticeContentSchema,
    type ArrearsSuspensionNoticeFacts,
    buildArrearsSuspensionNoticeContent
} from '../../../../src/services/billing/subscription/arrears-suspension-notice';

const NOW = new Date('2026-10-15T03:00:00.000Z');
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const at = (ms: number) => new Date(NOW.getTime() + ms);

const facts = (overrides: Partial<ArrearsSuspensionNoticeFacts>): ArrearsSuspensionNoticeFacts => ({
    vertical: 'accommodation',
    paymentMethod: 'CARD',
    versionInheritsTouristVip: false,
    anotherTitleInheritsTouristVip: false,
    oneTimeAddons: [],
    hasLivePromo: false,
    now: NOW,
    ...overrides
});

describe('AC:B7:30 — the arrears suspension notice content (pure part)', () => {
    it('card with a live promo, an inherited Tourist VIP and two one-time addons', () => {
        // Arrange
        const input = facts({
            versionInheritsTouristVip: true,
            oneTimeAddons: [
                { name: 'Destacado', endsAt: at(10 * DAY_MS) },
                { name: 'Impulso', endsAt: at(2 * DAY_MS + HOUR_MS) }
            ],
            hasLivePromo: true
        });

        // Act
        const content = buildArrearsSuspensionNoticeContent(input);

        // Assert
        expect(content).toEqual({
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            touristVipLost: true,
            oneTimeAddons: [
                { name: 'Destacado', remainingDays: 10 },
                { name: 'Impulso', remainingDays: 3 }
            ],
            promoLost: true
        });
        expect(ArrearsSuspensionNoticeContentSchema.parse(content)).toEqual(content);
    });

    it('card with nothing to lose but the subscription', () => {
        // Arrange / Act
        const content = buildArrearsSuspensionNoticeContent(facts({ vertical: 'gastronomy' }));

        // Assert
        expect(content).toEqual({
            vertical: 'gastronomy',
            paymentMethod: 'CARD',
            touristVipLost: false,
            oneTimeAddons: [],
            promoLost: false
        });
    });

    it('manual payer with a live promo never loses it (H5)', () => {
        // Arrange / Act
        const content = buildArrearsSuspensionNoticeContent(
            facts({ paymentMethod: 'MANUAL', hasLivePromo: true, versionInheritsTouristVip: true })
        );

        // Assert
        expect(content).toEqual({
            vertical: 'accommodation',
            paymentMethod: 'MANUAL',
            touristVipLost: true,
            oneTimeAddons: [],
            promoLost: false
        });
    });

    it('another title that still inherits keeps the Tourist VIP (H3)', () => {
        // Arrange / Act
        const content = buildArrearsSuspensionNoticeContent(
            facts({ versionInheritsTouristVip: true, anotherTitleInheritsTouristVip: true })
        );

        // Assert
        expect(content.touristVipLost).toBe(false);
    });

    it('rounds the remaining addon days up and drops an addon already over', () => {
        // Arrange
        const input = facts({
            oneTimeAddons: [
                { name: 'one ms', endsAt: at(1) },
                { name: 'exact day', endsAt: at(DAY_MS) },
                { name: 'twenty-five hours', endsAt: at(25 * HOUR_MS) },
                { name: 'now', endsAt: at(0) },
                { name: 'past', endsAt: at(-DAY_MS) }
            ]
        });

        // Act
        const content = buildArrearsSuspensionNoticeContent(input);

        // Assert
        expect(content.oneTimeAddons).toEqual([
            { name: 'one ms', remainingDays: 1 },
            { name: 'exact day', remainingDays: 1 },
            { name: 'twenty-five hours', remainingDays: 2 }
        ]);
    });
});
