import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

describe('AC:B12:2 action 17 has its own permission after migration from empty', () => {
    it('adds billing.migratePlan with one generated enum statement', async () => {
        const sql = readFileSync(
            path.join(process.cwd(), 'src/migrations/0219_hos1612_migrate_plan_permission.sql'),
            'utf8'
        );
        expect(sql.trim()).toBe(
            `ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.migratePlan' BEFORE 'billing.pauseSubscription';`
        );

        const pool = getTestPool();
        const result = await pool.query<{ enumlabel: string }>(
            `SELECT enumlabel FROM pg_enum
             WHERE enumtypid = 'permission_enum'::regtype
               AND enumlabel = 'billing.migratePlan'`
        );
        expect(result.rows).toEqual([{ enumlabel: 'billing.migratePlan' }]);
    });
});
