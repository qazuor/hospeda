import { SUBSCRIPTION_CLASSES, SUBSCRIPTION_STATUSES } from '@repo/db';
import { AdminSubscriptionClassSchema, AdminSubscriptionStatusSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

describe('HOS-2081 CA-1 un admin con permiso encuentra una suscripción por el email del dueño, sin conocer su ID', () => {
    it('keeps administrative status and class schemas aligned with persisted values', () => {
        expect(AdminSubscriptionStatusSchema.options).toEqual([...SUBSCRIPTION_STATUSES]);
        expect(AdminSubscriptionClassSchema.options).toEqual([...SUBSCRIPTION_CLASSES]);
    });
});
