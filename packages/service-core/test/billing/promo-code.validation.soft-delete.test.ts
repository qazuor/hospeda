/**
 * HOS-777 — promo-code validation must ignore soft-deleted billing customers.
 *
 * These guards run before checkout writes, so a stale billing customer row must
 * not block a first-subscription promo or consume a per-user redemption slot.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

const fixtures = vi.hoisted(() => ({
    customers: [] as Row[],
    promoCodes: [] as Row[],
    promoCodeUsage: [] as Row[],
    subscriptions: [] as Row[]
}));

vi.mock('@repo/db', () => {
    const billingCustomers = {
        id: 'id',
        externalId: 'externalId',
        deletedAt: 'deletedAt'
    } as const;

    const billingPromoCodeUsage = {
        customerId: 'customerId',
        promoCodeId: 'promoCodeId'
    } as const;

    const billingPromoCodes = {
        id: 'id',
        maxPerCustomer: 'maxPerCustomer'
    } as const;

    const billingSubscriptions = {
        id: 'id',
        customerId: 'customerId',
        planId: 'planId'
    } as const;

    const eq =
        (column: string, value: unknown): Predicate =>
        (row) =>
            row[column] === value;

    const isNull =
        (column: string): Predicate =>
        (row) =>
            row[column] === null || row[column] === undefined;

    const and =
        (...predicates: readonly Predicate[]): Predicate =>
        (row) =>
            predicates.every((predicate) => predicate(row));

    const count = () => ({ __count: true }) as const;

    const isCountExpression = (value: unknown): value is { readonly __count: true } =>
        Boolean(value && typeof value === 'object' && '__count' in value);

    const projectRows = (rows: readonly Row[], selection?: Record<string, unknown>) => {
        if (!selection) {
            return [...rows];
        }

        const countAlias = Object.entries(selection).find(([, value]) =>
            isCountExpression(value)
        )?.[0];
        if (countAlias) {
            return [{ [countAlias]: rows.length }];
        }

        return rows.map((row) => {
            const projected: Row = {};
            for (const [alias, column] of Object.entries(selection)) {
                projected[alias] = row[column as string];
            }
            return projected;
        });
    };

    const resolveInArrayValues = (values: unknown): readonly unknown[] => {
        if (Array.isArray(values)) {
            return values;
        }
        if (values && typeof values === 'object' && '_execute' in values) {
            return (values as { _execute: () => Row[] })
                ._execute()
                .map((row) => Object.values(row)[0]);
        }
        return [];
    };

    const inArray =
        (column: string, values: unknown): Predicate =>
        (row) =>
            resolveInArrayValues(values).includes(row[column]);

    const createBuilder = (selection?: Record<string, unknown>) => {
        let rows: Row[] = [];
        const returnsCount = Boolean(
            selection && Object.values(selection).some((value) => isCountExpression(value))
        );

        const builder = {
            from(table: unknown) {
                if (table === billingCustomers) {
                    rows = [...fixtures.customers];
                } else if (table === billingSubscriptions) {
                    rows = [...fixtures.subscriptions];
                } else if (table === billingPromoCodeUsage) {
                    rows = [...fixtures.promoCodeUsage];
                } else {
                    rows = [...fixtures.promoCodes];
                }
                return builder;
            },
            where(predicate: Predicate) {
                rows = rows.filter(predicate);
                return returnsCount ? Promise.resolve(projectRows(rows, selection)) : builder;
            },
            limit(limit: number) {
                return Promise.resolve(projectRows(rows.slice(0, limit), selection));
            },
            _execute() {
                return projectRows(rows, selection);
            }
        };

        return builder;
    };

    return {
        billingCustomers,
        billingPromoCodes,
        billingPromoCodeUsage,
        billingSubscriptions,
        and,
        count,
        eq,
        getDb: () => ({
            select: (selection?: Record<string, unknown>) => createBuilder(selection)
        }),
        inArray,
        isNull,
        sql: Object.assign(vi.fn(), { raw: vi.fn() })
    };
});

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeByCode: vi.fn()
}));

import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import { validatePromoCode } from '../../src/services/billing/promo-code/promo-code.validation.js';

const mockGetPromoCodeByCode = promoCrudModule.getPromoCodeByCode as ReturnType<typeof vi.fn>;

const USER_ID = 'user-hos-777';
const LIVE_CUSTOMER_ID = 'cus-live';

function buildActivePromoCode(overrides: Record<string, unknown> = {}) {
    return {
        id: 'pc-777',
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        active: true,
        expiresAt: null,
        maxUses: null,
        timesRedeemed: 0,
        validPlans: null,
        newCustomersOnly: false,
        metadata: null,
        ...overrides
    };
}

describe('HOS-777 — validatePromoCode ignores soft-deleted billing customers', () => {
    beforeEach(() => {
        fixtures.customers = [];
        fixtures.promoCodes = [];
        fixtures.promoCodeUsage = [];
        fixtures.subscriptions = [];
        vi.clearAllMocks();
    });

    it('allows a new-customers-only promo when only a soft-deleted duplicate customer has prior subscriptions', async () => {
        fixtures.customers = [
            {
                id: 'cus-stale',
                externalId: USER_ID,
                deletedAt: new Date('2026-08-22T12:00:00.000Z')
            },
            { id: LIVE_CUSTOMER_ID, externalId: USER_ID, deletedAt: null }
        ];
        fixtures.subscriptions = [{ id: 'sub-stale', customerId: 'cus-stale', planId: 'plan-pro' }];
        mockGetPromoCodeByCode.mockResolvedValue({
            success: true,
            data: buildActivePromoCode({ newCustomersOnly: true })
        });

        const result = await validatePromoCode('SAVE10', { userId: USER_ID, planId: 'plan-pro' });

        expect(result.valid).toBe(true);
    });

    it('still blocks a new-customers-only promo when the live customer has a prior subscription (control)', async () => {
        fixtures.customers = [{ id: LIVE_CUSTOMER_ID, externalId: USER_ID, deletedAt: null }];
        fixtures.subscriptions = [
            { id: 'sub-live', customerId: LIVE_CUSTOMER_ID, planId: 'plan-pro' }
        ];
        mockGetPromoCodeByCode.mockResolvedValue({
            success: true,
            data: buildActivePromoCode({ newCustomersOnly: true })
        });

        const result = await validatePromoCode('SAVE10', { userId: USER_ID, planId: 'plan-pro' });

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('PROMO_CODE_NEW_USERS_ONLY');
    });

    it('does not count usage rows tied only to a soft-deleted duplicate customer', async () => {
        fixtures.customers = [
            {
                id: 'cus-stale',
                externalId: USER_ID,
                deletedAt: new Date('2026-08-22T12:00:00.000Z')
            },
            { id: LIVE_CUSTOMER_ID, externalId: USER_ID, deletedAt: null }
        ];
        fixtures.promoCodes = [{ id: 'pc-777', maxPerCustomer: 1 }];
        fixtures.promoCodeUsage = [{ customerId: 'cus-stale', promoCodeId: 'pc-777' }];
        mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: buildActivePromoCode() });

        const result = await validatePromoCode('SAVE10', { userId: USER_ID });

        expect(result.valid).toBe(true);
    });

    it('still blocks the promo when the live customer already reached maxPerCustomer (control)', async () => {
        fixtures.customers = [{ id: LIVE_CUSTOMER_ID, externalId: USER_ID, deletedAt: null }];
        fixtures.promoCodes = [{ id: 'pc-777', maxPerCustomer: 1 }];
        fixtures.promoCodeUsage = [{ customerId: LIVE_CUSTOMER_ID, promoCodeId: 'pc-777' }];
        mockGetPromoCodeByCode.mockResolvedValue({ success: true, data: buildActivePromoCode() });

        const result = await validatePromoCode('SAVE10', { userId: USER_ID });

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('PROMO_CODE_MAX_USES_PER_USER');
    });
});
