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
    it('offers promo redemption only through the status and payment-method eligibility record (AC:B9b:12 HOS-1591 TEST:B9b:12 (support))', () => {
        expect(source).toContain('PROMO_REDEEM_OFFERED[row.status][row.paymentMethod]');
        const article = source.slice(source.indexOf('<article'), source.indexOf('</article>'));
        expect(article).toContain('PROMO_REDEEM_OFFERED[row.status][row.paymentMethod]');
        expect(article).toContain(
            '<PromoCodeRedeem client:visible vertical={row.vertical as PublishVerticalSlug} locale={locale} offer="SUBSCRIPTION" />'
        );
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
    it('uses the scheduled-renewal resolver and the live service end for the row 22 copy', () => {
        expect(source).toContain('resolveScheduledRenewal({ row })');
        expect(source).toContain('data-renewal=');
        expect(source).toContain('date: date(row.serviceEndsAt)');
        expect(source).toContain('paidAfterCancellationAddons');
    });
});

describe('MySubscriptions plan summary — TEST:1755:9', () => {
    it('wires the summary helper, conditional price and next charge lines inside each subscription card', () => {
        const article = source.slice(source.indexOf('<article'), source.indexOf('</article>'));
        expect(source).toContain('resolveMySubscriptionSummary({ row, locale, t })');
        expect(article).toContain('<h3 class={styles.title}>{summary.title}</h3>');
        expect(article).toContain('data-testid="my-subscription-price"');
        expect(article).toContain('{summary.priceLine &&');
        expect(article).toContain('data-testid="my-subscription-next-charge"');
        expect(article).toContain('{summary.nextChargeLine &&');
        expect(article).toContain('data-testid="my-subscription-vertical"');
    });

    it('uses the account vertical label for deferred courtesy cards (AC:1755:6)', () => {
        expect(source).toContain('resolveMySubscriptionVerticalLabelKey({ vertical: c.vertical })');
        expect(source).toContain(
            '<h3 class={styles.title}>{t(resolveMySubscriptionVerticalLabelKey({ vertical: c.vertical }))}</h3>'
        );
    });
});

describe('MySubscriptions cancellation confirmation — TEST:1762:5', () => {
    it('names the plan and the vertical of each subscription on its cancel island', () => {
        const article = source.slice(source.indexOf('<article'), source.indexOf('</article>'));
        const open = article.indexOf('<SubscriptionCancel');
        const cancel = article.slice(open, article.indexOf('/>', open));

        expect(article).toContain('planName={summary.title}');
        expect(article).toContain('verticalLabel={t(summary.verticalLabelKey)}');
        expect(cancel).toContain('planName={summary.title}');
        expect(cancel).toContain('verticalLabel={t(summary.verticalLabelKey)}');
    });
});
