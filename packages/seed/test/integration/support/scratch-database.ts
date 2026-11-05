/**
 * Scratch-database helper for seed integration tests that must not touch the shared
 * global-setup database (its other tests assert it holds no users, for instance).
 *
 * Every scratch database is created fresh, migrated with the versioned carril, and
 * dropped by the owner test. The name must match `hospeda_it_[a-z0-9_]+`, so a DROP
 * can never reach a dev, template or shared test database.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
/** Repository root. */
export const repoRoot = resolve(here, '../../../../..');
const NAME_PATTERN = /^hospeda_it_[a-z0-9_]{1,40}$/;
const EXEC_BUFFER = 256 * 1024 * 1024;

/** Handle on one scratch database. */
export interface ScratchDatabase {
    /** Connection string of the scratch database. */
    readonly url: string;
    /** Drops and recreates the database with the extensions the schema needs. */
    create(): Promise<void>;
    /** Applies the versioned migrations and the extras, like the CI global setup. */
    migrate(): Promise<void>;
    /** Runs `pnpm <args>` at `cwd` against the scratch database. */
    pnpm(input: {
        readonly cwd: string;
        readonly args: readonly string[];
        readonly timeout: number;
    }): void;
    /** Drops the database. */
    drop(): Promise<void>;
}

/**
 * Describes a scratch database next to the server named by `HOSPEDA_TEST_DATABASE_URL`.
 *
 * @param input - Receive-object.
 * @param input.name - Database name, `hospeda_it_*`.
 * @returns The handle.
 * @throws Error when the name does not match the guard.
 */
export function scratchDatabase({ name }: { readonly name: string }): ScratchDatabase {
    if (!NAME_PATTERN.test(name)) throw new Error(`Scratch database name "${name}" is not allowed`);
    const base =
        process.env.HOSPEDA_TEST_DATABASE_URL ||
        'postgresql://hospeda_user:hospeda_pass@localhost:5436/postgres';
    const admin = new URL(base);
    admin.pathname = '/postgres';
    const target = new URL(base);
    target.pathname = `/${name}`;
    const url = target.toString();
    const pnpm: ScratchDatabase['pnpm'] = ({ cwd, args, timeout }) => {
        execFileSync('pnpm', [...args], {
            cwd,
            stdio: 'pipe',
            timeout,
            maxBuffer: EXEC_BUFFER,
            env: {
                ...process.env,
                CI: 'true',
                HOSPEDA_DATABASE_URL: url,
                HOSPEDA_CLOUDINARY_CLOUD_NAME: '',
                HOSPEDA_CLOUDINARY_API_KEY: '',
                HOSPEDA_CLOUDINARY_API_SECRET: ''
            }
        });
    };
    return {
        url,
        async create() {
            const pool = new Pool({ connectionString: admin.toString() });
            try {
                await pool.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
                await pool.query(`CREATE DATABASE "${name}"`);
            } finally {
                await pool.end();
            }
            const bootstrap = new Pool({ connectionString: url });
            try {
                for (const extension of ['uuid-ossp', 'pgcrypto', 'unaccent'])
                    await bootstrap.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
            } finally {
                await bootstrap.end();
            }
        },
        async migrate() {
            pnpm({
                cwd: resolve(repoRoot, 'packages/db'),
                args: ['run', 'drizzle-kit', 'migrate', '--config', 'drizzle.config.ts'],
                timeout: 180_000
            });
            execFileSync('node', ['packages/db/scripts/apply-postgres-extras.mjs', url], {
                cwd: repoRoot,
                stdio: 'pipe',
                timeout: 120_000,
                maxBuffer: EXEC_BUFFER
            });
        },
        pnpm,
        async drop() {
            const pool = new Pool({ connectionString: admin.toString() });
            try {
                await pool.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
            } finally {
                await pool.end();
            }
        }
    };
}
