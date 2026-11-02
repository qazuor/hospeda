import { describe, expect, it, vi } from 'vitest';
import {
    buildProviderReason,
    resolvePlanDisplayName
} from '../../../src/services/billing/plan-display-name';

describe('resolvePlanDisplayName', () => {
    it('returns the Spanish catalog name for a translated slug instead of the internal name', async () => {
        expect(
            await resolvePlanDisplayName({ plan: { slug: 'owner-basico', name: 'Basic' } })
        ).toBe('Básico');
        expect(
            await resolvePlanDisplayName({ plan: { slug: 'owner-premium', name: 'Premium' } })
        ).toBe('Premium');
    });

    it('names the tourist plan after its vertical', async () => {
        expect(
            await resolvePlanDisplayName({
                vertical: 'tourist',
                plan: { slug: 'tourist-vip', name: 'VIP' }
            })
        ).toBe('Turista VIP');
    });

    it('falls back to the stored name when the slug has no translation', async () => {
        expect(
            await resolvePlanDisplayName({ plan: { slug: 'no-such-plan-slug', name: 'Stored' } })
        ).toBe('Stored');
    });
});

describe('buildProviderReason', () => {
    it('prefixes the brand and the vertical for vertical plans', async () => {
        expect(
            await buildProviderReason({
                vertical: 'accommodation',
                plan: { slug: 'owner-basico', name: 'Basic' }
            })
        ).toBe('Hospeda · Alojamiento Básico');
    });

    it('does not repeat the vertical for tourist plans', async () => {
        expect(
            await buildProviderReason({
                vertical: 'tourist',
                plan: { slug: 'tourist-vip', name: 'VIP' }
            })
        ).toBe('Hospeda · Turista VIP');
    });

    it('never exposes the internal name when the plan is translated', async () => {
        const reason = await buildProviderReason({
            vertical: 'accommodation',
            plan: { slug: 'owner-basico', name: 'Basic' }
        });
        expect(reason).not.toContain('Basic');
    });
});

describe('when the billing copy cannot be loaded (HOS-1993)', () => {
    it('falls back to the stored plan name and retries on the next call', async () => {
        vi.resetModules();
        let attempts = 0;
        vi.doMock('@repo/i18n/locales/es/billing.json', () => {
            attempts++;
            if (attempts === 1) throw new Error('boom');
            return { default: { plan: { 'owner-basico': { name: 'Básico' } } } };
        });
        const mod = await import('../../../src/services/billing/plan-display-name');

        const first = await mod.resolvePlanDisplayName({
            plan: { slug: 'owner-basico', name: 'Basic' }
        });
        const second = await mod.resolvePlanDisplayName({
            plan: { slug: 'owner-basico', name: 'Basic' }
        });

        expect(first).toBe('Basic');
        expect(second).toBe('Básico');
        vi.doUnmock('@repo/i18n/locales/es/billing.json');
    });
});
