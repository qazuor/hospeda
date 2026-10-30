import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const databaseName = 'hospeda_hos1822_venue_bootstrap_empty_test';
const integrationUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!integrationUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');

function withDatabase(connectionString: string, name: string): string {
    const url = new URL(connectionString);
    url.pathname = `/${name}`;
    return url.toString();
}

const adminPool = new Pool({ connectionString: withDatabase(integrationUrl, 'postgres') });
const databaseUrl = withDatabase(integrationUrl, databaseName);
const migrationTimeout = 300_000;
const cliTimeout = 600_000;

async function run(command: string, args: string[], timeout: number): Promise<void> {
    try {
        await execFileAsync(command, args, {
            cwd: workspaceDir,
            env: {
                ...process.env,
                HOSPEDA_DATABASE_URL: databaseUrl,
                HOSPEDA_CLOUDINARY_CLOUD_NAME: '',
                HOSPEDA_CLOUDINARY_API_KEY: '',
                HOSPEDA_CLOUDINARY_API_SECRET: ''
            },
            timeout,
            maxBuffer: 50 * 1024 * 1024
        });
    } catch (error) {
        const e = error as { code?: number; stdout?: string; stderr?: string; message?: string };
        throw new Error(
            `${command} ${args.join(' ')} exited ${e.code ?? 'unknown'}: ${e.message ?? ''}\n${e.stdout ?? ''}\n${e.stderr ?? ''}`
        );
    }
}

beforeAll(async () => {
    await adminPool.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    const pool = new Pool({ connectionString: databaseUrl });
    try {
        for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent']) {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
        }
    } finally {
        await pool.end();
    }
}, 30_000);

afterAll(async () => {
    try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    } finally {
        await adminPool.end();
    }
});

describe('venue bootstrap from an empty database', () => {
    it('runs schema, extras, required seed and data migrations in order on the same database', {
        timeout: 1_200_000
    }, async () => {
        await run('pnpm', ['db:migrate'], migrationTimeout);
        await run(
            'node',
            ['packages/db/scripts/apply-postgres-extras.mjs', databaseUrl],
            migrationTimeout
        );
        await run('pnpm', ['--filter', '@repo/seed', 'seed', '--required'], cliTimeout);
        await run('pnpm', ['db:seed:migrate'], cliTimeout);

        const pool = new Pool({ connectionString: databaseUrl });
        try {
            const [vertical, revalidation, amenities, features] = await Promise.all([
                pool.query<{ entity_type: string }>(
                    `SELECT id AS entity_type FROM vertical WHERE id = 'venue'`
                ),
                pool.query<{ entity_type: string }>(
                    `SELECT entity_type FROM revalidation_config WHERE entity_type = 'venue'`
                ),
                pool.query<{ count: number }>(
                    `SELECT count(*)::int AS count FROM amenities WHERE 'venue' = ANY(applicable_verticals)`
                ),
                pool.query<{ count: number }>(
                    `SELECT count(*)::int AS count FROM features WHERE 'venue' = ANY(applicable_verticals)`
                )
            ]);
            expect(vertical.rows.length).toBeGreaterThan(0);
            expect(revalidation.rows.length).toBeGreaterThan(0);
            expect(amenities.rows[0]?.count).toBeGreaterThan(0);
            expect(features.rows[0]?.count).toBeGreaterThan(0);

            const legacyNames = [['GASTRO', 'NOMY'].join(''), ['gastro', 'nomy'].join('')];
            const legacyValues = await pool.query<{ table_name: string; count: number }>(
                `
                    SELECT 'vertical.id' AS table_name, count(*)::int AS count
                      FROM vertical WHERE id = ANY($1::text[])
                    UNION ALL
                    SELECT 'revalidation_config.entity_type', count(*)::int
                      FROM revalidation_config WHERE entity_type = ANY($1::text[])
                    UNION ALL
                    SELECT 'amenities.applicable_verticals', count(*)::int
                      FROM amenities WHERE applicable_verticals && $1::text[]
                    UNION ALL
                    SELECT 'features.applicable_verticals', count(*)::int
                      FROM features WHERE applicable_verticals && $1::text[]
                `,
                [legacyNames]
            );
            expect(legacyValues.rows).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ table_name: 'vertical.id', count: 0 }),
                    expect.objectContaining({
                        table_name: 'revalidation_config.entity_type',
                        count: 0
                    }),
                    expect.objectContaining({
                        table_name: 'amenities.applicable_verticals',
                        count: 0
                    }),
                    expect.objectContaining({
                        table_name: 'features.applicable_verticals',
                        count: 0
                    })
                ])
            );
        } finally {
            await pool.end();
        }
    });
});
