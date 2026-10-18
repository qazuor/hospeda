import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/MySubscriptions.astro'),
    'utf8'
);
describe('MySubscriptions SSR block', () => {
    it('renders the individual grace notice only for card payments with their grace date', () => {
        expect(source).toContain(
            "row.status === 'GRACE_PERIOD' && GRACE_NOTICE[row.paymentMethod] && row.graceEndsAt"
        );
        expect(source).toContain('data-testid="my-subscription-grace"');
        expect(source).toContain('date: date(row.graceEndsAt)');
    });
    it('offers cancellation only for allowed states and handles empty and failed reads', () => {
        expect(source).toContain('CANCELLATION_OFFERED[row.status]');
        expect(source).toContain('account.subscription.mine.loadError');
        expect(source).toContain('account.subscription.mine.empty');
        expect(source).toContain("row.status === 'CANCEL_SCHEDULED'");
    });
    it('shows the unavailable plan-change notice through its status record', () => {
        expect(source).toContain('PLAN_CHANGE_UNAVAILABLE[row.status]');
        expect(source).toContain('data-testid="my-subscription-plan-change-unavailable"');
    });
    it('renders deferred courtesy balances with plural wording and the payment condition', () => {
        expect(source).toContain('result?.deferredCourtesies.map((c) =>');
        expect(source).toContain('tPlural(DEFERRED_COURTESY_KEY, c.balanceMonths');
        expect(source).toContain('data-testid="my-subscription-deferred-courtesy"');
    });
    it('shows empty only when subscriptions and deferred courtesies are both empty', () => {
        expect(source).toContain(
            'result.subscriptions.length === 0 && result.deferredCourtesies.length === 0'
        );
    });
});
