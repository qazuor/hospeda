/**
 * HOS-2037: the fresh-database path (what `db:fresh` runs:
 * versioned migrate, `db:apply-extras`, `seed --required --poi-catalog`, then
 * `seed --data-migrate --baseline-stamp`) must end with
 * `owner-basico` granting `can_embed_video`, a trial version with zero entitlement
 * rows, and the baseline Pro/Premium grants, all through the REAL runner (so a
 * `contentOnly` regression, i.e. baseline-stamping 0133, fails here).
 *
 * HOS-2077 asserts on the same run that `contentOnly` migration 0156 left chat on the
 * venue and experience Basic and Pro plans.
 *
 * HOS-2398 asserts on the same run that `contentOnly` migration 0188 left the nine sellable
 * owner plans without the tourist keys, with `ai_chat` intact and Tourist VIP untouched.
 *
 * Builds its own scratch database (`hospeda_it_hos2037_fresh`, dropped afterwards) so
 * that the shared integration database stays untouched by the runner.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS,
    OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS
} from '../../src/catalog/next-version-entitlements.js';
import { repoRoot, scratchDatabase } from './support/scratch-database.js';

const database = scratchDatabase({ name: 'hospeda_it_hos2037_fresh' });
let scratch: Pool | undefined;
let promoRowsBeforeDataMigrations: string[] = [];

/**
 * Distinct promotion grants per plan (not per version): other data-migrations
 * publish new accommodation versions that copy their parent's rows, so a
 * per-version comparison would report those copies as changes.
 */
async function promotionCatalogRows(pool: Pool): Promise<string[]> {
    const result = await pool.query<{ row: string }>(`
        SELECT DISTINCT row FROM (
        SELECT concat_ws('|', p.vertical, p.slug, 'entitlement', e.key, coalesce(e.plan_quota::text, 'null')) AS row
          FROM plan p
          JOIN plan_version v ON v.plan_id = p.id
          JOIN plan_version_entitlement e ON e.plan_version_id = v.id
         WHERE e.key IN ('create_promotions', 'venue_vip_promotions')
        UNION ALL
        SELECT concat_ws('|', p.vertical, p.slug, 'limit', l.key, l.value::text) AS row
          FROM plan p
          JOIN plan_version v ON v.plan_id = p.id
          JOIN plan_version_limit l ON l.plan_version_id = v.id
         WHERE l.key = 'max_active_promotions'
        ) AS grants
         ORDER BY row
    `);
    return result.rows.map(({ row }) => row);
}

beforeAll(async () => {
    await database.create();
    // migrate + db:apply-extras, then the db:fresh seed steps (minus --example, which cannot
    // affect the plan catalog), then the db:fresh data-migration step: stamp the historical
    // migrations, run the `contentOnly` ones for real.
    await database.migrate();
    database.pnpm({
        cwd: repoRoot,
        args: ['--filter', '@repo/seed', 'seed', '--required', '--poi-catalog'],
        timeout: 300_000
    });
    scratch = new Pool({ connectionString: database.url });
    promoRowsBeforeDataMigrations = await promotionCatalogRows(scratch);
    database.pnpm({
        cwd: repoRoot,
        args: ['--filter', '@repo/seed', 'seed', '--data-migrate', '--baseline-stamp'],
        timeout: 300_000
    });
}, 900_000);

afterAll(async () => {
    await scratch?.end();
    await database.drop();
});

describe('HOS-2037 fresh database (migrate, seed, data-migrate)', () => {
    it('ends with Basic, Pro and Premium granting video and the trial deriving it', async () => {
        if (!scratch) throw new Error('scratch database was not initialized');
        const grants = await scratch.query<{ slug: string; role: string | null; grants: string }>(
            `SELECT p.slug, p.role,
                    count(e.id) FILTER (WHERE e.key = 'can_embed_video')::text AS grants
               FROM plan p
               JOIN plan_version v ON v.plan_id = p.id AND v.current
          LEFT JOIN plan_version_entitlement e ON e.plan_version_id = v.id
              WHERE p.vertical = 'accommodation'
           GROUP BY p.slug, p.role`
        );
        const bySlug = new Map(grants.rows.map((row) => [row.slug, row]));
        for (const slug of ['owner-basico', 'owner-pro', 'owner-premium'])
            expect(bySlug.get(slug)?.grants, slug).toBe('1');
        const trialRows = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM plan_version_entitlement e
               JOIN plan_version v ON v.id = e.plan_version_id
               JOIN plan p ON p.id = v.plan_id
              WHERE p.vertical = 'accommodation' AND p.role = 'trial'`
        );
        expect(trialRows.rows[0]?.n).toBe('0');
        const ledger = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM seed_migrations WHERE name = '0133-hos-2037-video-link-all-plans'`
        );
        expect(ledger.rows[0]?.n).toBe('1');
    }, 60_000);

    // HOS-2077 rides the same fresh-database run: 0156 is `contentOnly`, so a fresh database
    // must end with chat on venue/experience Basic (20) and Pro (100), not baseline-stamp it.
    it('ends with chat on venue and experience Basic (20) and Pro (100) through the real runner', async () => {
        if (!scratch) throw new Error('scratch database was not initialized');
        const rows = await scratch.query<{ slug: string; quota: string | null; limit: string }>(
            `SELECT p.slug,
                    e.plan_quota::text AS quota,
                    l.value::text AS limit
               FROM plan p
               JOIN plan_version v ON v.plan_id = p.id AND v.current
          LEFT JOIN plan_version_entitlement e ON e.plan_version_id = v.id AND e.key = 'ai_chat'
               JOIN plan_version_limit l ON l.plan_version_id = v.id
                AND l.key = 'max_ai_chat_' || p.vertical || '_per_month'
              WHERE p.vertical IN ('venue', 'experience') AND p.role IS NULL`
        );
        const bySlug = new Map(rows.rows.map((row) => [row.slug, row]));
        for (const [slug, quota] of [
            ['venue-basico', '20'],
            ['venue-pro', '100'],
            ['venue-premium', '1250'],
            ['experience-basico', '20'],
            ['experience-pro', '100'],
            ['experience-premium', '1250']
        ] as const) {
            expect(bySlug.get(slug)?.quota, slug).toBe(quota);
            expect(bySlug.get(slug)?.limit, slug).toBe(quota);
        }
        const ledger = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM seed_migrations WHERE name = '0156-hos-2077-ai-chat-venue-experience-basic-pro'`
        );
        expect(ledger.rows[0]?.n).toBe('1');
    }, 60_000);

    it('grants all venue Pro/Premium versions and leaves other verticals and venue Básico unchanged', async () => {
        if (!scratch) throw new Error('scratch database was not initialized');
        const grants = await scratch.query<{
            slug: string;
            versions: string;
            entitlements: string;
            limits: string;
            min_limit: string | null;
            max_limit: string | null;
        }>(`
            SELECT p.slug,
                   count(DISTINCT v.id)::text AS versions,
                   count(DISTINCT e.plan_version_id)::text AS entitlements,
                   count(DISTINCT l.plan_version_id)::text AS limits,
                   min(l.value)::text AS min_limit,
                   max(l.value)::text AS max_limit
              FROM plan p
              JOIN plan_version v ON v.plan_id = p.id
         LEFT JOIN plan_version_entitlement e ON e.plan_version_id = v.id AND e.key = 'create_promotions'
         LEFT JOIN plan_version_limit l ON l.plan_version_id = v.id AND l.key = 'max_active_promotions'
             WHERE p.vertical = 'venue' AND p.slug IN ('venue-pro', 'venue-premium')
          GROUP BY p.slug
        `);
        const bySlug = new Map(grants.rows.map((row) => [row.slug, row]));
        for (const [slug, limit] of [
            ['venue-pro', '5'],
            ['venue-premium', '2147483647']
        ] as const) {
            const row = bySlug.get(slug);
            expect(row?.versions, slug).toBeTruthy();
            expect(row?.entitlements, slug).toBe(row?.versions);
            expect(row?.limits, slug).toBe(row?.versions);
            expect(row?.min_limit, slug).toBe(limit);
            expect(row?.max_limit, slug).toBe(limit);
        }

        const protectedSlugs = new Set(['venue-basico']);
        const protectedVerticals = new Set(['accommodation', 'experience']);
        const protectedBefore = promoRowsBeforeDataMigrations.filter((row) => {
            const [vertical, slug] = row.split('|');
            return protectedSlugs.has(slug ?? '') || protectedVerticals.has(vertical ?? '');
        });
        const after = await promotionCatalogRows(scratch);
        const protectedAfter = after.filter((row) => {
            const [vertical, slug] = row.split('|');
            return protectedSlugs.has(slug ?? '') || protectedVerticals.has(vertical ?? '');
        });
        expect(protectedAfter).toEqual(protectedBefore);
        expect(protectedAfter.filter((row) => row.startsWith('venue|venue-basico|'))).toEqual([]);

        const ledger = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM seed_migrations WHERE name = '0187-hos-2282-venue-promotions-grant'`
        );
        expect(ledger.rows[0]?.n).toBe('1');
    }, 60_000);

    // HOS-2398 rides the same fresh-database run: 0188 is `contentOnly`, so a fresh database
    // must end with the owner plans clean of tourist keys, not baseline-stamp it.
    it('ends with the owner plans free of tourist keys, ai_chat kept and Tourist VIP untouched', async () => {
        if (!scratch) throw new Error('scratch database was not initialized');
        const rows = await scratch.query<{
            vertical: string;
            slug: string;
            tourist_entitlements: string;
            tourist_limits: string;
            ai_chat: string;
        }>(
            `SELECT p.vertical, p.slug,
                    (SELECT count(*) FROM plan_version_entitlement e
                      WHERE e.plan_version_id = v.id AND e.key = ANY($1::text[]))::text AS tourist_entitlements,
                    (SELECT count(*) FROM plan_version_limit l
                      WHERE l.plan_version_id = v.id AND l.key = ANY($2::text[]))::text AS tourist_limits,
                    (SELECT count(*) FROM plan_version_entitlement e
                      WHERE e.plan_version_id = v.id AND e.key = 'ai_chat')::text AS ai_chat
               FROM plan p
               JOIN plan_version v ON v.plan_id = p.id AND v.current
              WHERE v.sellable AND p.vertical IN ('accommodation', 'venue', 'experience', 'tourist')`,
            [
                [...OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS],
                [...OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS]
            ]
        );
        const owners = rows.rows.filter((row) => row.vertical !== 'tourist');
        expect(owners).toHaveLength(9);
        for (const row of owners) {
            expect(row.tourist_entitlements, row.slug).toBe('0');
            expect(row.tourist_limits, row.slug).toBe('0');
            expect(row.ai_chat, row.slug).toBe('1');
        }
        const vip = rows.rows.find((row) => row.slug === 'tourist-vip');
        expect(vip?.tourist_entitlements).toBe('15');
        expect(vip?.tourist_limits).toBe('7');
        const ledger = await scratch.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM seed_migrations WHERE name = '0188-hos-2398-drop-tourist-keys-from-owner-plans'`
        );
        expect(ledger.rows[0]?.n).toBe('1');
    }, 60_000);
});
