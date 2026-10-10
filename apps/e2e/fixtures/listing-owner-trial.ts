import { createHash } from 'node:crypto';
import { TRIAL_PLAN_ROLE, TrialStatusEnum, type VerticalEnum } from '@repo/schemas';
import type { Pool } from 'pg';

/** Give a listing owner the same active trial as the E2E seed, once per vertical. */
export async function ensureListingOwnerTrial(
    pool: Pool,
    ownerId: string,
    vertical: VerticalEnum
): Promise<void> {
    const existing = await pool.query('SELECT 1 FROM trial WHERE user_id = $1 AND vertical = $2', [
        ownerId,
        vertical
    ]);
    if (existing.rowCount) return;

    const owner = await pool.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [
        ownerId
    ]);
    const email = owner.rows[0]?.email;
    if (!email) throw new Error(`Missing seeded ${vertical} owner account`);

    const versions = await pool.query<{
        id: string;
        plan_id: string;
        rank: number;
        trial_days: number;
        sellable: boolean;
        role: string | null;
    }>(
        `SELECT v.id, v.plan_id, v.rank, v.trial_days, v.sellable, p.role
         FROM plan_version v
         JOIN plan p ON p.id = v.plan_id
         WHERE p.vertical = $1 AND v.current = true`,
        [vertical]
    );
    const trial = versions.rows.find((version) => version.role === TRIAL_PLAN_ROLE);
    const sellable = versions.rows
        .filter((version) => version.sellable)
        .sort((a, b) => a.rank - b.rank);
    const lowest = sellable[0];
    const highest = sellable.at(-1);
    if (!trial || !lowest || !highest || trial.trial_days < 1) {
        throw new Error(`Missing current trial or sellable plan catalog for ${vertical}`);
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + trial.trial_days * 24 * 60 * 60 * 1000);
    const emailPseudonym = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    await pool.query(
        `INSERT INTO trial (
             user_id, vertical, status, trial_plan_id,
             floor_entitlements_version_id, floor_limits_version_id,
             floor_trial_plan_version_id, started_at, ends_at,
             email_pseudonym, deadlines_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
         ON CONFLICT (user_id, vertical) DO NOTHING`,
        [
            ownerId,
            vertical,
            TrialStatusEnum.TRIAL_ACTIVE,
            trial.plan_id,
            highest.id,
            lowest.id,
            trial.id,
            startedAt,
            endsAt,
            emailPseudonym
        ]
    );
}
