import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { protectedReadManualInstallmentsRoute } from '../../../src/routes/billing-subscription/read-manual-installments';
import {
    isManualInstallmentShown,
    resolveManualInstallmentDueAt
} from '../../../src/routes/billing-subscription/read-own-manual-installments';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';

function buildGuestApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError && error.code === ServiceErrorCode.UNAUTHORIZED) {
            return c.text(error.message, 401);
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.text('Unexpected route error', 500);
    });
    app.use((c, next) => {
        c.set('actor', createGuestActor());
        return next();
    });
    app.route('/', protectedReadManualInstallmentsRoute);
    return app;
}

describe('manual installment due date (HOS-1782)', () => {
    it('returns 401 when the actor is a guest without a session', async () => {
        const app = buildGuestApp();

        const response = await app.request('/manual-installments');

        expect(response.status).toBe(401);
    });

    it('the first installment is due when the authorization window ends', () => {
        // Arrange
        const dueAt = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const result = resolveManualInstallmentDueAt({
            status: 'PENDING_AUTHORIZATION',
            authorizationWindowEndsAt: dueAt,
            graceEndsAt: null
        });
        // Assert
        expect(result).toBe(dueAt);
    });

    it('a renewal installment is due when the grace period ends', () => {
        // Arrange
        const dueAt = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const result = resolveManualInstallmentDueAt({
            status: 'GRACE_PERIOD',
            authorizationWindowEndsAt: null,
            graceEndsAt: dueAt
        });
        // Assert
        expect(result).toBe(dueAt);
    });

    it.each([
        'ACTIVE',
        'SUSPENDED',
        'CANCEL_SCHEDULED',
        'PAUSED',
        'CANCELLED'
    ])('no other subscription state has a due date', (status) => {
        // Arrange
        // Act
        const result = resolveManualInstallmentDueAt({
            status,
            authorizationWindowEndsAt: new Date(),
            graceEndsAt: new Date()
        });
        // Assert
        expect(result).toBeNull();
    });

    it('an installment is shown only while its due date is ahead', () => {
        // Arrange
        const now = new Date('2026-11-20T00:00:00.000Z');
        // Act
        const atNow = isManualInstallmentShown({ dueAt: now, now });
        const ahead = isManualInstallmentShown({ dueAt: new Date(now.getTime() + 1), now });
        const missing = isManualInstallmentShown({ dueAt: null, now });
        // Assert
        expect(atNow).toBe(false);
        expect(ahead).toBe(true);
        expect(missing).toBe(false);
    });
});
