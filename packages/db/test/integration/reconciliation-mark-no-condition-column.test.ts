import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

async function columns(tableName: string): Promise<string[]> {
    const result = await getTestPool().query<{ column_name: string }>(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position',
        [tableName]
    );
    return result.rows.map((row) => row.column_name);
}

describe('TEST:B13a:9 — the reconciliation mark gains no column (DEC-RF-005)', () => {
    it('a: preserves the exact mark and mark-payment column sets', async () => {
        // Which condition failed lives in the event (`late_payment.failed_condition`), not on the mark.
        expect(await columns('reconciliation_mark')).toEqual([
            'id',
            'subscription_id',
            'addon_instance_id',
            'reason',
            'placed_at',
            'lifted_at',
            'lifted_by',
            'version',
            'deadlines_version',
            'escalated_at'
        ]);
        expect(await columns('reconciliation_mark_payment')).toEqual([
            'id',
            'mark_id',
            'payment_id',
            'manual_payment_id',
            'hung_at',
            'resolved_at',
            'refund_id',
            'created_at'
        ]);
    });
});
