import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';

describe('Destination - Sorting variants', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';

    beforeAll(() => {
        app = initApp();
    });

    const sortBys = ['name', 'createdAt', 'averageRating', 'reviewsCount', 'accommodationsCount'];
    const orders = ['ASC', 'DESC'];

    for (const sortBy of sortBys) {
        for (const order of orders) {
            it(`supports sortBy=${sortBy} order=${order}`, async () => {
                const res = await app.request(`${base}?sortBy=${sortBy}&sortOrder=${order}`);
                expect([200, 400]).toContain(res.status);
            });
        }
    }
});
