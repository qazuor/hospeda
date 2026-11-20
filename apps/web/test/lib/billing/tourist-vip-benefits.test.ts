import { describe, expect, it } from 'vitest';
import { resolveTouristVipBenefitKeys } from '@/lib/billing/tourist-vip-benefits';

function plan(input: {
    readonly slug: string;
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly billingOptions?: { readonly monthly: string; readonly annual: string | null };
}) {
    return {
        id: input.slug,
        vertical: 'tourist' as const,
        slug: input.slug,
        name: input.slug,
        description: '',
        category: 'tourist' as const,
        monthlyPriceArs: 0,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 1,
        isActive: true,
        inheritsTouristVip: false,
        entitlements: input.entitlements,
        limits: input.limits,
        ...(input.billingOptions ? { billingOptions: input.billingOptions } : {})
    };
}

describe('resolveTouristVipBenefitKeys', () => {
    it('uses only sellable plan entitlements and limit keys, excluding the free floor', () => {
        const floor = plan({
            slug: 'floor',
            entitlements: ['floor_feature'],
            limits: { floor_cap: 1 }
        });
        const vip = plan({
            slug: 'vip',
            entitlements: ['vip_feature'],
            limits: { vip_cap: 10 },
            billingOptions: { monthly: 'monthly', annual: null }
        });

        expect(resolveTouristVipBenefitKeys({ result: { ok: true, plans: [floor, vip] } })).toEqual(
            {
                entitlements: new Set(['vip_feature']),
                limits: new Set(['vip_cap']),
                plan: { slug: 'vip', entitlements: ['vip_feature'], limits: { vip_cap: 10 } }
            }
        );
    });

    it('HOS-2398 exposes the top sellable tier as the plan the inherited cells resolve against', () => {
        // Arrange
        const lower = {
            ...plan({
                slug: 'vip-lite',
                entitlements: ['lite_feature'],
                limits: { vip_cap: 5 },
                billingOptions: { monthly: 'm1', annual: null }
            }),
            sortOrder: 1
        };
        const top = {
            ...plan({
                slug: 'tourist-vip',
                entitlements: ['vip_feature'],
                limits: { vip_cap: 10 },
                billingOptions: { monthly: 'm2', annual: null }
            }),
            sortOrder: 3
        };

        // Act
        const result = resolveTouristVipBenefitKeys({ result: { ok: true, plans: [lower, top] } });

        // Assert
        expect(result?.plan).toEqual({
            slug: 'tourist-vip',
            entitlements: ['vip_feature'],
            limits: { vip_cap: 10 }
        });
    });

    it('returns null when the catalog fails or has no sellable plans', () => {
        expect(
            resolveTouristVipBenefitKeys({ result: { ok: false, error: 'offline' } })
        ).toBeNull();
        expect(
            resolveTouristVipBenefitKeys({
                result: { ok: true, plans: [plan({ slug: 'floor', entitlements: [], limits: {} })] }
            })
        ).toBeNull();
    });
});
