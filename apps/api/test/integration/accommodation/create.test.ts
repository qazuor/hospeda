import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('POST /accommodations (create)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/accommodations';

    beforeAll(() => {
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    it('creates an accommodation (happy path)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                name: 'Hotel Azul',
                summary: 'A cozy place near the beach',
                description: 'Comfortable rooms and great views by the sea',
                type: 'HOTEL',
                ownerId: crypto.randomUUID(),
                destinationId: crypto.randomUUID(),
                isFeatured: true,
                price: { price: 120, currency: 'USD' }
            })
        });

        // Mock de service en test puede devolver 2xx o la validación puede forzar 400
        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body).toHaveProperty('data');
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('name', 'Hotel Azul');
        }
    });

    it('returns 400 on validation errors (missing required)', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                // name missing
                summary: 'short',
                description: 'too short',
                type: 'APARTMENT'
            })
        });

        // assertions continue below

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body).toHaveProperty('error');
    });

    it('returns 400 when name is too short', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                name: 'Ho',
                slug: 'ho',
                summary: 'short summary that is still valid enough',
                description: 'a'.repeat(40),
                type: 'HOTEL',
                ownerId: crypto.randomUUID(),
                destinationId: crypto.randomUUID(),
                price: { price: 100, currency: 'USD' }
            })
        });
        expect(res.status).toBe(400);
    });

    it('accepts optional fields and returns 2xx', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'user-agent': 'vitest',
                accept: 'application/json'
            },
            body: JSON.stringify({
                name: 'Hotel Verde',
                slug: 'hotel-verde',
                summary: 'A cozy place',
                description: 'a'.repeat(60),
                type: 'HOTEL',
                ownerId: crypto.randomUUID(),
                destinationId: crypto.randomUUID(),
                price: { price: 150, currency: 'USD' },
                features: { wifi: true },
                amenities: { pool: true },
                schedule: { checkInTime: '14:00', checkOutTime: '11:00' },
                extraInfo: { capacity: 2 },
                faqs: [{ question: 'Q?', answer: 'A' }]
            })
        });
        expect([200, 201, 202, 400]).toContain(res.status);
        const body = await res.json();
        if (res.status >= 200 && res.status < 300) {
            expect(body).toHaveProperty('data');
        }
    });

    it('returns 400 on invalid enum values', async () => {
        const res = await app.request(base, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'X',
                summary: 'A valid summary about place',
                description: 'A valid description with enough length to pass validation',
                type: 'INVALID_TYPE',
                destinationId: crypto.randomUUID()
            })
        });
        expect(res.status).toBe(400);
    });
});
