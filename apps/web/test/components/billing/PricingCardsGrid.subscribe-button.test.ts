import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBSCRIBE_VERTICAL_BY_AUDIENCE } from '@/lib/publish/subscribe-button';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

describe('PricingCardsGrid subscribe button (TEST:V8a:3 / TEST:V8a:4)', () => {
    it('mounts one visible island outside the hasPlans conditional and only in checkout mode', () => {
        expect(src).toContain(
            '<SubscribeButton client:idle locale={locale} vertical={subscribeVertical} />'
        );
        expect(src).toContain("ctaMode === 'checkout' && subscribeVertical !== null");
        expect(src.indexOf('<SubscribeButton')).toBeGreaterThan(src.lastIndexOf('{!hasPlans ?'));
    });
    it.each([
        ['owner', 'accommodation'],
        ['gastronomy', 'gastronomy'],
        ['experience', 'experience']
    ] as const)('maps %s to %s', (audience, vertical) => {
        expect(SUBSCRIBE_VERTICAL_BY_AUDIENCE[audience]).toBe(vertical);
    });
    it.each(['tourist', 'partner'] as const)('does not mount an island for %s', (audience) => {
        expect(SUBSCRIBE_VERTICAL_BY_AUDIENCE[audience]).toBeNull();
    });
    it('uses the same grid placement with empty and non-empty card branches', () => {
        expect(src.indexOf('<SubscribeButton')).toBeGreaterThan(
            src.indexOf('</div>', src.indexOf('id="pricing-cards-grid"'))
        );
    });
});
