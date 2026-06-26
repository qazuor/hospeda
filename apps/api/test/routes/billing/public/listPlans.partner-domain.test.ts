import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPlanList, mockCreateSimpleRoute, mockExecute } = vi.hoisted(() => ({
    mockPlanList: vi.fn(),
    mockCreateSimpleRoute: vi.fn(),
    mockExecute: vi.fn()
}));

vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: mockPlanList
    }))
}));

vi.mock('../../../../src/utils/route-factory.js', () => ({
    createSimpleRoute: mockCreateSimpleRoute
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ execute: mockExecute })),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

import '../../../../src/routes/billing/public/listPlans';

const OWNER_PLAN = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico',
    category: 'owner' as const,
    monthlyPriceArs: 500000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: true,
    sortOrder: 1,
    entitlements: [],
    limits: {},
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const PARTNER_PLAN = {
    ...OWNER_PLAN,
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'partner-listing',
    name: 'Partner Listing'
};

describe('publicListPlansRoute partner-domain isolation', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
        mockExecute.mockReset();
    });

    it('filters partner plans out of the public plan list', async () => {
        const call = mockCreateSimpleRoute.mock.calls[0];
        const handler = (call?.[0] as Record<string, unknown>)?.handler as () => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [OWNER_PLAN, PARTNER_PLAN],
                pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 }
            }
        });

        mockExecute.mockResolvedValue({ rows: [{ name: 'partner-listing' }] });

        const result = await handler();

        expect(result).toEqual([OWNER_PLAN]);
    });
});
