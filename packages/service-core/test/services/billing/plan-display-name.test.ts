import { describe, expect, it } from 'vitest';
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
