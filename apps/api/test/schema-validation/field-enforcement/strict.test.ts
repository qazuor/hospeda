/**
 * SPEC-087 — strict response strip behavior.
 *
 * When the service returns data that does NOT satisfy the declared
 * `responseSchema` (e.g. a missing required field), the response helper must:
 *   1. Log a structured error describing the schema drift.
 *   2. Throw `ServiceError(INTERNAL_ERROR)` so the route returns HTTP 500.
 *
 * Replaces the old "fallback" behavior introduced by SPEC-062 T-019. Under
 * strict mode a drift between handler payload and declared schema is treated
 * as a server bug, not a runtime fallback — the caller must never receive
 * unstripped data, otherwise admin-only fields could leak silently.
 */

import { AccommodationService } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

/**
 * Intentionally invalid payload: misses the required `name` field, so
 * `AccommodationPublicSchema.safeParse()` returns `success: false`. Under
 * SPEC-087 strict mode this MUST trigger a 500 response and log an error.
 */
const INVALID_PAYLOAD = {
    id: VALID_UUID,
    slug: 'broken-payload',
    createdById: 'would-have-leaked',
    adminInfo: { leaked: true }
};

describe('SPEC-087 — strict response strip', () => {
    let app: ReturnType<typeof initApp>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        errorSpy = vi.spyOn(apiLogger, 'error');
        vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
            data: INVALID_PAYLOAD
        } as unknown as Awaited<ReturnType<AccommodationService['getById']>>);
    });

    it('returns 500 instead of leaking unstripped data when schema parse fails', async () => {
        const res = await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(500);

        const body = (await res.json()) as { success: false; error: { code: string } };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('does not echo the unstripped payload in the error response body', async () => {
        const res = await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });
        const text = await res.text();
        expect(text).not.toContain('would-have-leaked');
        expect(text).not.toContain('adminInfo');
    });

    it('logs a structured error describing the schema drift', async () => {
        await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        const stripErrors = errorSpy.mock.calls
            .map((c) => c[0])
            .filter(
                (arg): arg is { message: string; issues: unknown } =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'message' in arg &&
                    typeof (arg as Record<string, unknown>).message === 'string' &&
                    ((arg as Record<string, unknown>).message as string).includes('stripping')
            );

        expect(stripErrors.length).toBeGreaterThan(0);
        const first = stripErrors[0];
        expect(first).toBeDefined();
        if (first) {
            expect(first.message).toMatch(/stripping failed/i);
            expect(Array.isArray(first.issues)).toBe(true);
        }
    });
});
