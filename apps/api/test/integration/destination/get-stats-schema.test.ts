import { DestinationStatsSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../src/app';

const ApiStatsResponse = z.object({
    success: z.boolean(),
    data: DestinationStatsSchema
});

describe('GET /destinations/:id/stats (schema validation)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('validates response against DestinationStatsSchema', async () => {
        const res = await app.request(`${base}/123e4567-e89b-12d3-a456-426614174000/stats`);
        expect([200, 400, 404]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            const parsed = ApiStatsResponse.safeParse(body);
            expect(parsed.success).toBe(true);
        }
    });
});
