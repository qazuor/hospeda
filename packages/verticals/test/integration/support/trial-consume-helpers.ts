import { randomUUID } from 'node:crypto';
import type { CoverageResponse, CoverageSource } from '@repo/billing-verticals-contract';
import { CoverageResponseSchema, coverageSourceClassOf } from '@repo/billing-verticals-contract';
import type { Pool } from 'pg';

const since = new Date('2026-10-10T12:00:00.000Z');

export function subscriptionSource({ charged }: { readonly charged: boolean }): CoverageSource {
    return {
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: 'NO_KNOWN_DATE',
        charged,
        floor: null
    };
}

export function courtesySource(): CoverageSource {
    return {
        type: 'COURTESY',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: new Date('2027-10-10T12:00:00.000Z'),
        charged: null,
        floor: null
    };
}

export function grantSource(): CoverageSource {
    return {
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: randomUUID()
    };
}

export function coverageOf(args: {
    readonly sources: readonly CoverageSource[];
}): CoverageResponse {
    const covered = args.sources.some(
        (source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'
    );
    return CoverageResponseSchema.parse({ covered, sources: args.sources });
}

export async function consumedTrialRowOf(args: {
    readonly pool: Pool;
    readonly userId: string;
    readonly vertical: string;
}): Promise<Record<string, unknown> | undefined> {
    const client = await args.pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM trial WHERE user_id = $1 AND vertical = $2',
            [args.userId, args.vertical]
        );
        return result.rows[0] as Record<string, unknown> | undefined;
    } finally {
        client.release();
    }
}

export async function waitForAdvisoryLockWaiter(args: {
    readonly pool: Pool;
    readonly retries?: number;
    readonly delayMs?: number;
}): Promise<void> {
    const retries = args.retries ?? 100;
    const delayMs = args.delayMs ?? 20;
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const client = await args.pool.connect();
        try {
            const result = await client.query(
                `SELECT EXISTS (
                    SELECT 1 FROM pg_locks
                    WHERE locktype = 'advisory'
                      AND NOT granted
                      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
                ) AS waiting`
            );
            if (result.rows[0]?.waiting === true) return;
        } finally {
            client.release();
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`No advisory lock waiter appeared after ${retries} attempts`);
}
