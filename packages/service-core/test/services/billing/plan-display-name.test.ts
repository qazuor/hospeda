import { describe, expect, it } from 'vitest';
import {
    buildProviderReason,
    resolvePlanDisplayName
} from '../../../src/services/billing/plan-display-name';

describe('resolvePlanDisplayName', () => {
    it('returns the Spanish catalog name for a translated slug instead of the internal name', () => {
        expect(resolvePlanDisplayName({ plan: { slug: 'basic', name: 'Basic' } })).toBe('Básico');
        expect(resolvePlanDisplayName({ plan: { slug: 'vip', name: 'VIP' } })).toBe('Turista VIP');
    });

    it('falls back to the stored name when the slug has no translation', () => {
        expect(
            resolvePlanDisplayName({ plan: { slug: 'no-such-plan-slug', name: 'Stored' } })
        ).toBe('Stored');
    });
});

describe('buildProviderReason', () => {
    it('prefixes the brand and the vertical for vertical plans', () => {
        expect(
            buildProviderReason({
                vertical: 'accommodation',
                plan: { slug: 'basic', name: 'Basic' }
            })
        ).toBe('Hospeda · Alojamiento Básico');
    });

    it('does not repeat the vertical for tourist plans', () => {
        expect(
            buildProviderReason({ vertical: 'tourist', plan: { slug: 'vip', name: 'VIP' } })
        ).toBe('Hospeda · Turista VIP');
    });

    it('never exposes the internal name when the plan is translated', () => {
        const reason = buildProviderReason({
            vertical: 'accommodation',
            plan: { slug: 'basic', name: 'Basic' }
        });
        expect(reason).not.toContain('Basic');
    });
});
