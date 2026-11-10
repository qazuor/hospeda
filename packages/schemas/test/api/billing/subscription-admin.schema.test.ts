import { describe, expect, it } from 'vitest';
import { AdminSubscriptionListQuerySchema } from '../../../src/api/billing/subscription-admin.schema';

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
