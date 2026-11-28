/**
 * @file limit-addon-offer.test.ts
 * @description HOS-2677 — the limit-reached notice leads with the catalog add-on when one is on
 * sale for the limit hit, and stays plan-only otherwise.
 */
import { describe, expect, it, vi } from 'vitest';
import { findLimitAddonOffer } from '../../../src/lib/billing/addon-cap-offer';
import {
    applyLimitAddonOffer,
    withLimitAddonOffer
} from '../../../src/lib/billing/limit-addon-offer';
import type { LimitReachedToastPayload } from '../../../src/lib/billing-limit-error';

vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: { offers: vi.fn() }
}));

const offer = (over: Record<string, unknown> = {}) => ({
    productId: '11111111-1111-4111-8111-111111111111',
    addonVersionId: '22222222-2222-4222-8222-222222222222',
    slug: 'photo-pack',
    name: 'Pack de fotos',
    description: null,
    chargeKind: 'PERIODICO' as const,
    cycle: 'monthly' as const,
    price: 150000,
    currency: 'ARS' as const,
    compatibleVerticals: ['accommodation'],
    grantedKeys: ['max_photos_per_accommodation'],
    scopeType: 'LISTING' as const,
    validity: 'WHILE_SUBSCRIPTION_ALIVE' as const,
    validityDays: null,
    freeUnderGrantVerticals: [],
    ...over
});

const PLAN: LimitReachedToastPayload = {
    title: 't',
    message: 'm',
    action: { label: 'Mejorar plan', href: '/es/mi-cuenta/suscripcion/' }
};

describe('findLimitAddonOffer', () => {
    it('finds the offer granting the limit key on its vertical', () => {
        expect(
            findLimitAddonOffer({
                offers: [offer()],
                limitKey: 'max_photos_per_accommodation'
            })
        ).toMatchObject({ slug: 'photo-pack', vertical: 'accommodation' });
    });

    it('returns null when the offer grants another key', () => {
        expect(
            findLimitAddonOffer({
                offers: [offer({ grantedKeys: ['max_photos_per_venue'] })],
                limitKey: 'max_photos_per_accommodation'
            })
        ).toBeNull();
    });

    it('returns null when the offer is not compatible with the limit vertical', () => {
        expect(
            findLimitAddonOffer({
                offers: [offer({ compatibleVerticals: ['venue'] })],
                limitKey: 'max_photos_per_accommodation'
            })
        ).toBeNull();
    });

    it('returns null for a limit key that belongs to no vertical', () => {
        expect(
            findLimitAddonOffer({
                offers: [
                    offer({ grantedKeys: ['max_favorites'], compatibleVerticals: ['tourist'] })
                ],
                limitKey: 'max_favorites'
            })
        ).toBeNull();
    });
});

describe('applyLimitAddonOffer', () => {
    it('puts the add-on first and the plan change second', () => {
        const result = applyLimitAddonOffer({
            payload: PLAN,
            limitKey: 'max_photos_per_accommodation',
            offers: [offer()],
            locale: 'es'
        });
        expect(result.action.label).toMatch(/^Ampliar con .*Pack de fotos|^Ampliar con /);
        expect(result.action.href).toBe('/es/mi-cuenta/suscripcion/#addons-accommodation');
        expect(result.secondaryAction).toEqual(PLAN.action);
    });

    it('returns the payload untouched when no add-on is on sale', () => {
        expect(
            applyLimitAddonOffer({
                payload: PLAN,
                limitKey: 'max_photos_per_accommodation',
                offers: [],
                locale: 'es'
            })
        ).toBe(PLAN);
    });

    it('localizes the add-on label differently in pt and es', () => {
        const label = (locale: 'es' | 'pt') =>
            applyLimitAddonOffer({
                payload: PLAN,
                limitKey: 'max_photos_per_accommodation',
                offers: [offer()],
                locale
            }).action.label;
        expect(label('pt')).toMatch(/^Ampliar com /);
        expect(label('pt')).not.toBe(label('es'));
    });
});

describe('withLimitAddonOffer', () => {
    const details = { limitKey: 'max_photos_per_accommodation' };

    it('leads with the add-on when the catalog read returns one', async () => {
        const result = await withLimitAddonOffer({
            payload: PLAN,
            details,
            locale: 'es',
            fetchOffers: () => Promise.resolve({ ok: true, data: { items: [offer()] } }) as never
        });
        expect(result.secondaryAction).toEqual(PLAN.action);
    });

    it('falls back to the plan-only payload when the read fails or throws', async () => {
        const failed = await withLimitAddonOffer({
            payload: PLAN,
            details,
            locale: 'es',
            fetchOffers: () => Promise.resolve({ ok: false }) as never
        });
        const thrown = await withLimitAddonOffer({
            payload: PLAN,
            details,
            locale: 'es',
            fetchOffers: () => Promise.reject(new Error('net'))
        });
        expect(failed).toBe(PLAN);
        expect(thrown).toBe(PLAN);
    });

    it('does not touch the network for a limit key with no vertical', async () => {
        const fetchOffers = vi.fn();
        const result = await withLimitAddonOffer({
            payload: PLAN,
            details: { limitKey: 'max_favorites' },
            locale: 'es',
            fetchOffers
        });
        expect(result).toBe(PLAN);
        expect(fetchOffers).not.toHaveBeenCalled();
    });
});
