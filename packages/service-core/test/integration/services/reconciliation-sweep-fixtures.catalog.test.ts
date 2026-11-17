import { afterAll, describe, expect, it } from 'vitest';
import { closeServiceTestPool, getServiceTestPool } from './helpers.js';
import { seedSubscription } from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);

describe('reconciliation fixture plan catalog isolation', () => {
    it('does not change the sellable catalog choice when it creates an anchor', async () => {
        const pool = getServiceTestPool();
        const readCatalogChoice = async () => {
            const result = await pool.query<{ id: string }>(
                'SELECT id FROM plan_version WHERE vertical = $1 AND sellable = true AND current = true ORDER BY rank DESC LIMIT 1',
                ['accommodation']
            );
            return result.rows[0]?.id;
        };

        const before = await readCatalogChoice();
        if (!before) throw new Error('Missing sellable accommodation catalog version');

        const seeded = await seedSubscription({ vertical: 'accommodation' });

        const after = await readCatalogChoice();
        const fixtureVersion = await pool.query<{ sellable: boolean; current: boolean }>(
            'SELECT sellable, current FROM plan_version WHERE id = $1',
            [seeded.subscription.planVersionId]
        );

        expect(fixtureVersion.rows[0]).toEqual({ sellable: false, current: true });
        expect(after).toBe(before);
    });
});
