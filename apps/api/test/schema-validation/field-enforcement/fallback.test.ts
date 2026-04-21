/**
 * SPEC-062 T-019 — safeParse fallback behavior.
 *
 * When the service returns data that does NOT satisfy the declared
 * `responseSchema` (e.g. a missing required field), the response helper must:
 *   1. Log a structured warning describing the schema drift.
 *   2. Fall back to the unstripped data rather than failing the request.
 *
 * This guarantees a schema drift never takes down a live route; it only
 * surfaces the problem in logs so it can be caught and fixed.
 */

import { AccommodationService } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

/**
 * Intentionally invalid payload: misses the required `name` field, so
 * `AccommodationPublicSchema.safeParse()` will return `success: false`.
 * The handler must still respond 200 with the unstripped data.
 */
const INVALID_PAYLOAD = {
    id: VALID_UUID,
    slug: 'broken-payload',
    // Leaking admin fields that would normally be stripped. Because the
    // schema parse fails, stripping is skipped and these stay in the body.
    createdById: 'leaky-id',
    adminInfo: { leaked: true }
};

describe('SPEC-062 T-019 — safeParse fallback preserves availability', () => {
    let app: ReturnType<typeof initApp>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        warnSpy = vi.spyOn(apiLogger, 'warn');
        vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
            data: INVALID_PAYLOAD
        } as unknown as Awaited<ReturnType<AccommodationService['getById']>>);
    });

    it('returns 200 with the unstripped data when schema parse fails', async () => {
        const res = await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);

        const body = (await res.json()) as { data: Record<string, unknown> };
        // Fallback: data comes through even though required fields were missing.
        expect(body.data).toMatchObject({
            id: VALID_UUID,
            slug: 'broken-payload',
            // Fields that would have been stripped on success but leak here.
            createdById: 'leaky-id',
            adminInfo: { leaked: true }
        });
    });

    it('logs a structured warning describing the schema drift', async () => {
        await app.request(`/api/v1/public/accommodations/${VALID_UUID}`, {
            headers: { 'user-agent': 'vitest' }
        });

        const stripWarnings = warnSpy.mock.calls
            .map((c) => c[0])
            .filter(
                (arg): arg is { message: string; issues: unknown } =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'message' in arg &&
                    typeof (arg as Record<string, unknown>).message === 'string' &&
                    ((arg as Record<string, unknown>).message as string).includes('stripping')
            );

        expect(stripWarnings.length).toBeGreaterThan(0);
        const first = stripWarnings[0];
        expect(first).toBeDefined();
        if (first) {
            expect(first.message).toMatch(/stripping failed/i);
            expect(Array.isArray(first.issues)).toBe(true);
        }
    });
});
