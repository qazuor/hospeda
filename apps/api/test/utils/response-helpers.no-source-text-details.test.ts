/**
 * HOS-2658 AC-20: `handleRouteError` publishes `error.details` of the
 * `VALIDATION_ERROR` + `NO_SOURCE_TEXT` rejection with debug errors OFF, and
 * only that one — the exception is gated on the exact top-level reason, never on
 * the shape of `details`, so it does not open `details` for every
 * `VALIDATION_ERROR` (`apps/api/docs/error-contract.md`).
 */

import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { NODE_ENV: 'production', HOSPEDA_API_DEBUG_ERRORS: false },
    validateApiEnv: vi.fn()
}));

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { handleRouteError } from '../../src/utils/response-helpers';

type ErrorBody = {
    error: { code: string; message: string; details?: unknown; reason?: string };
};

const render = (error: unknown): { body: ErrorBody; status: number | undefined } => {
    const calls: { body: unknown; status: number | undefined }[] = [];
    const ctx = {
        req: { method: 'POST', path: '/api/v1/protected/venues/x/translations/ai' },
        get: (key: string) => (key === 'requestId' ? 'req-ac20' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    handleRouteError(error, ctx);
    const [call] = calls;
    if (!call) throw new Error('handleRouteError did not respond');
    return { body: call.body as ErrorBody, status: call.status };
};

describe('handleRouteError — NO_SOURCE_TEXT details (HOS-2658 AC-20)', () => {
    it('publishes details.reason for VALIDATION_ERROR with reason NO_SOURCE_TEXT, debug off', () => {
        // Arrange
        const error = new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The field has no Spanish source text to translate',
            { reason: 'NO_SOURCE_TEXT' },
            'NO_SOURCE_TEXT'
        );

        // Act
        const { body, status } = render(error);

        // Assert
        expect(status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toEqual({ reason: 'NO_SOURCE_TEXT' });
        expect(body.error.reason).toBe('NO_SOURCE_TEXT');
    });

    it('keeps details debug-only for a VALIDATION_ERROR that only mimics the payload', () => {
        // Arrange
        const error = new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Something else', {
            reason: 'NO_SOURCE_TEXT',
            secret: 'internal'
        });

        // Act
        const { body, status } = render(error);

        // Assert
        expect(status).toBe(400);
        expect(body.error.details).toBeUndefined();
    });

    it('keeps details debug-only for another code carrying the same reason', () => {
        // Arrange
        const error = new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Not found',
            { reason: 'NO_SOURCE_TEXT', secret: 'internal' },
            'NO_SOURCE_TEXT'
        );

        // Act
        const { body, status } = render(error);

        // Assert
        expect(status).toBe(404);
        expect(body.error.details).toBeUndefined();
    });
});
