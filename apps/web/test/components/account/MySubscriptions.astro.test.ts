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
});
