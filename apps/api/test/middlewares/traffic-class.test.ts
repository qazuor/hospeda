import { currentTrafficContext } from '@repo/payments';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/utils/create-app';

describe('traffic class middleware', () => {
    it('marks a request as interactive while its route runs (kills missing request propagation)', async () => {
        const app = createApp();
        app.get('/class', (context) =>
            context.json({ trafficClass: currentTrafficContext()?.trafficClass })
        );
        const response = await app.request('/class', {
            headers: { 'user-agent': 'traffic-class-test' }
        });
        expect(await response.json()).toMatchObject({
            success: true,
            data: { trafficClass: 'interactive' }
        });
    });
});
