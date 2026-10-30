import { describe, expect, it } from 'vitest';
import { up } from '../../src/data-migrations/0036-hos-369-w24-revalidation-config.js';

describe('0036-hos-369-w24-revalidation-config', () => {
    it('inserts the venue revalidation row', async () => {
        let inserted: readonly { entityType: string }[] = [];
        const returning = async () => [{ entityType: 'venue' }];
        const values = (rows: readonly { entityType: string }[]) => {
            inserted = rows;
            return { onConflictDoNothing: () => ({ returning }) };
        };
        const db = { insert: () => ({ values }) };

        await up({ db } as never);

        expect(inserted.map((row) => row.entityType)).toContain('venue');
    });
});
