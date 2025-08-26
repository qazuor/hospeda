import { DestinationSummarySchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

const ApiSummaryResponse = z.object({
    success: z.boolean(),
    data: DestinationSummarySchema
});

describe('GET /destinations/:id/summary (schema validation)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('validates response against DestinationSummarySchema', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/summary`);
        expect([200, 400, 404]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            const parsed = ApiSummaryResponse.safeParse(body);
            expect(parsed.success).toBe(true);
        }
    });
});
