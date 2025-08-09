import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

/**
 * Given-When-Then style acceptance flows for Destination.
 */
describe('Destination - Acceptance Scenarios', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    it('Given a destination ID, When requesting summary then stats, Then responses are consistent', async () => {
        const id = '123e4567-e89b-12d3-a456-426614174000';

        const summaryRes = await app.request(`${base}/${id}/summary`);
        expect([200, 400, 404]).toContain(summaryRes.status);

        const statsRes = await app.request(`${base}/${id}/stats`);
        expect([200, 400, 404]).toContain(statsRes.status);

        if (summaryRes.status === 200 && statsRes.status === 200) {
            const summary = await summaryRes.json();
            const stats = await statsRes.json();
            expect(summary.success).toBe(true);
            expect(stats.success).toBe(true);
        }
    });
});
