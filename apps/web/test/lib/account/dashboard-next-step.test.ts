import type { TrialSummaryResponse } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveDashboardNextStep } from '../../../src/lib/account/dashboard-next-step';
import type { SubscriptionStatText } from '../../../src/lib/account/general-dashboard';

const text: SubscriptionStatText = {
    value: 'Free',
    hint: null,
    rows: [],
    action: null,
    viewAll: false
};
const now = Date.parse('2026-11-25T12:00:00Z');
const trial = (endsAt: string | null): TrialSummaryResponse => ({
    status: 'TRIAL_ACTIVE',
    startedAt: '2026-11-20T12:00:00Z',
    endsAt,
    totalDays: 30,
    origins: { base: 30, promo: 0, support: 0 }
});
const subscription = (
    overrides: Partial<SubscriptionStatText> = {},
    trialSummaries: readonly TrialSummaryResponse[] = []
) =>
    resolveDashboardNextStep({
        kind: 'subscription',
        locale: 'en',
        text: { ...text, ...overrides },
        trialSummaries,
        now
    });

describe('dashboard next-step selection', () => {
    it('always supplies free-plan context', () => {
        expect(subscription()).toBe('Explore the benefits of your plan.');
    });

    it('prioritizes billing action over status and trial countdown', () => {
        expect(
            subscription({ hint: 'Declined', action: 'Retry payment' }, [
                trial('2026-11-26T12:00:00Z')
            ])
        ).toBe('Retry payment');
        expect(subscription({ hint: 'Active' })).toBe('Active');
    });

    it('preserves multiple-plan status context when no action exists', () => {
        expect(
            subscription({
                rows: [
                    { plan: 'Pro', status: 'Active' },
                    { plan: 'Gold', status: 'Paused' }
                ]
            })
        ).toBe('Pro · Active; Gold · Paused');
    });

    it('selects the earliest live trial and rounds partial days up', () => {
        expect(
            subscription({}, [trial('2026-11-30T12:00:00Z'), trial('2026-11-26T13:00:00Z')])
        ).toBe('Your trial ends in 2 days.');
        expect(subscription({}, [trial('2026-11-26T12:00:00Z')])).toBe('Your trial ends in 1 day.');
        expect(subscription({}, [trial('2026-11-25T12:00:00Z')])).toBe(
            'Your trial ends today. Choose how to continue.'
        );
    });

    it.each([
        null,
        'invalid',
        '2026-11-24T12:00:00Z'
    ])('does not invent a countdown for %s', (endsAt) => {
        expect(subscription({}, [trial(endsAt)])).toBe('Explore the benefits of your plan.');
    });

    it.each([
        [
            'es',
            'Volvé a visitar tu lugar guardado.',
            'Explorá tus 2 lugares guardados.',
            'Revisá tus 2 reseñas compartidas.'
        ],
        [
            'en',
            'Visit your saved place again.',
            'Explore your 2 saved places.',
            'Revisit your 2 shared reviews.'
        ],
        [
            'pt',
            'Visite seu lugar salvo novamente.',
            'Explore seus 2 lugares salvos.',
            'Reveja suas 2 avaliações compartilhadas.'
        ]
    ] as const)('localizes real activity and plurals in %s', (locale, one, other, reviews) => {
        expect(resolveDashboardNextStep({ kind: 'favorites', count: 1, locale })).toBe(one);
        expect(resolveDashboardNextStep({ kind: 'favorites', count: 2, locale })).toBe(other);
        expect(resolveDashboardNextStep({ kind: 'reviews', count: 2, locale })).toBe(reviews);
        for (const kind of ['favorites', 'reviews'] as const) {
            const empty = resolveDashboardNextStep({ kind, count: 0, locale });
            expect(empty).not.toMatch(/\d|account\.|MISSING/);
            expect(empty).not.toBe(one);
        }
    });
});
