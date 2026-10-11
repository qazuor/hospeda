import type { Pool } from 'pg';

interface PlanVersionState {
    readonly id: string;
    readonly current: boolean;
    readonly sellable: boolean;
}

/** Temporarily removes every accommodation version from the sellable current catalog. */
export async function retireAccommodationPlanVersions(pool: Pool): Promise<() => Promise<void>> {
    const { rows } = await pool.query<PlanVersionState>(
        `SELECT version.id, version.current, version.sellable
         FROM plan_version AS version
         JOIN plan ON plan.id = version.plan_id
         WHERE plan.vertical = 'accommodation'`
    );
    await pool.query(
        `UPDATE plan_version AS version
         SET current = false, sellable = false
         FROM plan
         WHERE plan.id = version.plan_id AND plan.vertical = 'accommodation'`
    );
    return async () => {
        for (const version of rows) {
            await pool.query('UPDATE plan_version SET current = $2, sellable = $3 WHERE id = $1', [
                version.id,
                version.current,
                version.sellable
            ]);
        }
    };
}
