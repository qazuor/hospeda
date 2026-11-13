import { describe, expect, it } from 'vitest';
import {
    AdminSubscriptionDetailHttpSchema,
    AdminSubscriptionDetailParamsSchema,
    AdminSubscriptionDetailSchema,
    AdminSubscriptionListItemHttpSchema,
    AdminSubscriptionListQuerySchema
} from '../../../src/api/billing/subscription-admin.schema';

describe('HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID', () => {
    it('defaults pagination and trims search text', () => {
        expect(AdminSubscriptionListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
        expect(AdminSubscriptionListQuerySchema.parse({ q: '  owner  ' })).toEqual({
            page: 1,
            pageSize: 20,
            q: 'owner'
        });
    });

    it('rejects oversize pages, unknown statuses, and unknown query keys', () => {
        expect(AdminSubscriptionListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
        expect(AdminSubscriptionListQuerySchema.safeParse({ status: 'UNKNOWN' }).success).toBe(
            false
        );
        expect(AdminSubscriptionListQuerySchema.safeParse({ limit: 10 }).success).toBe(false);
    });
});

describe('HOS-2081 the admin subscription detail schemas validate ids and strip extra fields', () => {
    it('requires a UUID and rejects unknown parameters', () => {
        expect(
            AdminSubscriptionDetailParamsSchema.safeParse({ subscriptionId: 'bad' }).success
        ).toBe(false);
        expect(
            AdminSubscriptionDetailParamsSchema.safeParse({
                subscriptionId: crypto.randomUUID(),
                extra: true
            }).success
        ).toBe(false);
    });

    it('keeps nullable detail fields and does not expose a declared payer or payments', () => {
        const id = crypto.randomUUID();
        const detail = AdminSubscriptionDetailSchema.parse({
            id,
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            vertical: 'accommodation',
            owner: {
                id: crypto.randomUUID(),
                email: 'owner@example.test',
                displayName: null,
                deleted: false
            },
            plan: null,
            cycle: null,
            paymentMethod: null,
            nextChargeAt: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            serviceEndsAt: null,
            planVersion: null,
            price: null,
            succeedsId: null,
            succeededById: null,
            pause: null,
            courtesy: null,
            declaredPayerEmail: 'declared@example.test',
            payments: []
        });
        expect(Object.keys(detail).sort()).toEqual([
            'class',
            'courtesy',
            'createdAt',
            'cycle',
            'id',
            'nextChargeAt',
            'owner',
            'pause',
            'paymentMethod',
            'plan',
            'planVersion',
            'price',
            'serviceEndsAt',
            'status',
            'succeededById',
            'succeedsId',
            'vertical'
        ]);
    });
});

describe('HOS-2081 the admin subscription HTTP schemas require ISO strings for dates', () => {
    const iso = '2026-01-01T00:00:00.000Z';

    it('rejects Date objects in the list item and accepts ISO strings', () => {
        const base = {
            id: crypto.randomUUID(),
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            vertical: 'accommodation',
            owner: null,
            plan: null,
            cycle: null,
            paymentMethod: null,
            nextChargeAt: null
        };
        expect(
            AdminSubscriptionListItemHttpSchema.safeParse({ ...base, createdAt: new Date(iso) })
                .success
        ).toBe(false);
        expect(
            AdminSubscriptionListItemHttpSchema.safeParse({ ...base, createdAt: iso }).success
        ).toBe(true);
        expect(
            AdminSubscriptionListItemHttpSchema.safeParse({
                ...base,
                nextChargeAt: iso,
                createdAt: iso
            }).success
        ).toBe(true);
    });

    it('rejects Date objects in the detail and accepts ISO strings', () => {
        const base = {
            id: crypto.randomUUID(),
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            vertical: 'accommodation',
            owner: null,
            plan: null,
            cycle: null,
            paymentMethod: null,
            nextChargeAt: null,
            serviceEndsAt: null,
            planVersion: null,
            price: null,
            succeedsId: null,
            succeededById: null,
            pause: null,
            courtesy: null
        };
        expect(
            AdminSubscriptionDetailHttpSchema.safeParse({ ...base, createdAt: new Date(iso) })
                .success
        ).toBe(false);
        expect(
            AdminSubscriptionDetailHttpSchema.safeParse({ ...base, createdAt: iso }).success
        ).toBe(true);
        expect(
            AdminSubscriptionDetailHttpSchema.safeParse({
                ...base,
                createdAt: iso,
                serviceEndsAt: iso,
                planVersion: {
                    id: crypto.randomUUID(),
                    current: true,
                    sellable: false,
                    createdAt: iso
                },
                pause: {
                    reason: 'CUSTOMER_REQUEST',
                    startsAt: iso,
                    expectedEndAt: null,
                    requestedMonths: 2
                },
                courtesy: {
                    courtesyGrantId: crypto.randomUUID(),
                    months: 2,
                    startsAt: iso,
                    endsAt: iso,
                    remainingMonths: 1
                }
            }).success
        ).toBe(true);
    });
});
