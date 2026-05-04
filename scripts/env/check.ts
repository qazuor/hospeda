#!/usr/bin/env tsx
/**
 * Env audit/check script.
 *
 * For each app, compares the variables defined in `.env.example` against
 * those configured in the Vercel project for every environment target.
 * Reports:
 * - Variables in `.env.example` but missing from Vercel (potential gaps)
 * - Variables in Vercel but not in `.env.example` (undocumented variables)
 *
 * Usage:
 *   pnpm env:check               # Interactive mode
 *   pnpm env:check --ci          # Non-interactive CI mode (no prompts)
 *
 * Exit codes:
 *   0 — All required variables are present in Vercel
 *   1 — One or more required variables are missing
 *
 * @module scripts/env/check
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readDocumentedKeys, readEnvFile } from './utils/dotenv.js';
import { colors } from './utils/formatters.js';
import { getVercelToken, listEnvVars, readProjectConfig } from './utils/vercel-api.js';

/**
 * Variables that legitimately exist in Vercel but are NOT user-managed and
 * therefore should not be flagged as "extra" by the audit.
 *
 * Two sources:
 * 1. Platform-injected values that Vercel/Node set automatically and reject
 *    as project-Settings entries (e.g. NODE_ENV, VERCEL, CI).
 * 2. Marketplace integrations that auto-provision a fixed family of vars
 *    (e.g. Neon → POSTGRES_*, PG*, NEON_PROJECT_ID, DATABASE_URL[_UNPOOLED]).
 *
 * Adding to this list is a deliberate choice: it tells reviewers "yes, this
 * shows up in `vercel env ls`, no, you do not need to document it in
 * `.env.example`". If a variable is here it must also be ignored by the
 * deploy gate, so keep the list narrow and well-justified.
 */
const PLATFORM_EXPECTED_EXTRAS: ReadonlySet<string> = new Set([
    // Platform / runtime
    'NODE_ENV',
    'CI',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_REGION',
    'VERCEL_GIT_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_REF',
    'VERCEL_GIT_COMMIT_MESSAGE',
    'VERCEL_GIT_REPO_OWNER',
    'VERCEL_GIT_REPO_SLUG',
    'VERCEL_GIT_PROVIDER',
    'VERCEL_OIDC_TOKEN',
    // Neon Marketplace integration (auto-provisioned)
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'NEON_PROJECT_ID',
    'POSTGRES_DATABASE',
    'POSTGRES_HOST',
    'POSTGRES_PASSWORD',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_URL_NO_SSL',
    'POSTGRES_USER',
    'PGDATABASE',
    'PGHOST',
    'PGHOST_UNPOOLED',
    'PGPASSWORD',
    'PGUSER'
]);

/** Root of the monorepo (two levels up from scripts/env/). */
const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

/** All app names to audit. */
const ALL_APPS = ['api', 'web', 'admin'] as const;
type AppName = (typeof ALL_APPS)[number];

/** Vercel environment targets to check. */
const ENVIRONMENTS = ['development', 'preview', 'production'] as const;
type VercelEnv = (typeof ENVIRONMENTS)[number];

/**
 * Audit result for a single app + environment combination.
 */
interface AppEnvAudit {
    readonly appName: AppName;
    readonly environment: VercelEnv;
    /** Variables in .env.example but missing from Vercel. */
    readonly missing: readonly string[];
    /** Variables in Vercel but not documented in .env.example. */
    readonly extra: readonly string[];
    /** Variables present in both. */
    readonly ok: readonly string[];
}

/**
 * Reads the variable names a `.env.example` file declares, splitting them
 * into "required" (uncommented `KEY=...`) and "all documented" (required
 * plus commented `# KEY=...`).
 *
 * - `required` drives the missing check: a required variable absent from
 *   Vercel is a hard failure.
 * - `documented` drives the extra check: a Vercel variable not mentioned
 *   in `.env.example` (commented or otherwise) is an extra.
 *
 * @param filePath - Path to the `.env.example` file.
 * @returns Both key sets. Empty sets if the file does not exist.
 */
async function readExampleKeys(filePath: string): Promise<{
    readonly required: ReadonlySet<string>;
    readonly documented: ReadonlySet<string>;
}> {
    if (!existsSync(filePath)) {
        return { required: new Set(), documented: new Set() };
    }
    const required = new Set((await readEnvFile({ filePath })).keys());
    const documented = await readDocumentedKeys({ filePath });
    return { required, documented };
}

/**
 * Audits a single app against Vercel for the given environment.
 *
 * @param appName - App directory name.
 * @param environment - Vercel environment target.
 * @param token - Vercel API token.
 * @returns Audit result, or `null` if the app is not linked.
 */
async function auditApp(
    appName: AppName,
    environment: VercelEnv,
    token: string
): Promise<AppEnvAudit | null> {
    const appDir = join(ROOT_DIR, 'apps', appName);

    // Load project config — skip app if not linked
    let projectConfig: Awaited<ReturnType<typeof readProjectConfig>>;
    try {
        projectConfig = await readProjectConfig(appDir);
    } catch {
        return null;
    }

    // Fetch remote vars for the environment
    let remoteVars: Awaited<ReturnType<typeof listEnvVars>>;
    try {
        remoteVars = await listEnvVars({ projectId: projectConfig.projectId, token });
    } catch (err) {
        console.error(
            colors.red(`  [${appName}/${environment}] Failed to fetch Vercel vars: ${String(err)}`)
        );
        return null;
    }

    const remoteKeys = new Set(
        remoteVars.filter((v) => v.target.includes(environment)).map((v) => v.key)
    );

    // Read .env.example keys (required + all-documented)
    const examplePath = join(appDir, '.env.example');
    const { required, documented } = await readExampleKeys(examplePath);

    // Compute diff
    const missing: string[] = [];
    const ok: string[] = [];
    const extra: string[] = [];

    // Missing: required variables absent from Vercel.
    for (const key of required) {
        if (remoteKeys.has(key)) {
            ok.push(key);
        } else {
            missing.push(key);
        }
    }

    // Extra: Vercel variables not mentioned in .env.example (commented or
    // otherwise) and not part of the platform-managed allow-list.
    for (const key of remoteKeys) {
        if (documented.has(key)) continue;
        if (PLATFORM_EXPECTED_EXTRAS.has(key)) continue;
        extra.push(key);
    }

    return { appName, environment, missing, extra, ok };
}

/**
 * Prints the audit result for a single app + environment to stdout.
 *
 * @param audit - The audit result to display.
 * @param verbose - Whether to also print OK variables (default: only problems).
 */
function printAudit(audit: AppEnvAudit, verbose: boolean): void {
    const hasProblems = audit.missing.length > 0 || audit.extra.length > 0;

    if (!hasProblems && !verbose) return;

    const header = `  [${audit.appName}/${audit.environment}]`;

    if (!hasProblems) {
        console.info(colors.green(`${header} ✓ ${audit.ok.length} vars OK`));
        return;
    }

    console.info(`${header}`);

    for (const key of audit.missing) {
        console.info(colors.red(`    ✗ MISSING  ${key}`));
    }

    for (const key of audit.extra) {
        console.info(colors.yellow(`    ? EXTRA    ${key}`));
    }

    if (verbose) {
        for (const key of audit.ok) {
            console.info(colors.green(`    ✓ OK       ${key}`));
        }
    }

    const summary = [
        audit.missing.length > 0 ? colors.red(`${audit.missing.length} missing`) : null,
        audit.extra.length > 0 ? colors.yellow(`${audit.extra.length} extra`) : null,
        colors.green(`${audit.ok.length} ok`)
    ]
        .filter(Boolean)
        .join(', ');

    console.info(`    ${summary}`);
}

/**
 * Main entry point for the check script.
 * Audits all apps and environments, then exits with code 0 or 1.
 */
async function main(): Promise<void> {
    const isCi = process.argv.includes('--ci');
    const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    if (isCi) {
        console.info('Running env:check in CI mode (no prompts)');
    }

    let token: string;
    try {
        token = await getVercelToken();
    } catch (err) {
        console.error(colors.red(`Error: ${String(err)}`));
        process.exit(1);
    }

    let totalMissing = 0;
    let totalExtra = 0;
    let totalOk = 0;
    let appsSkipped = 0;

    for (const appName of ALL_APPS) {
        for (const environment of ENVIRONMENTS) {
            const audit = await auditApp(appName, environment, token);

            if (audit === null) {
                if (!isCi) {
                    console.info(
                        colors.yellow(`  [${appName}/${environment}] skipped (not linked)`)
                    );
                }
                appsSkipped++;
                continue;
            }

            printAudit(audit, isVerbose);
            totalMissing += audit.missing.length;
            totalExtra += audit.extra.length;
            totalOk += audit.ok.length;
        }
    }
    if (appsSkipped > 0) {
        console.info(
            colors.yellow(`\n⚠ ${appsSkipped} app/environment(s) skipped (not linked to Vercel)`)
        );
    }

    console.info(`\nSummary: ${totalOk} ok, ${totalMissing} missing, ${totalExtra} extra`);
    if (totalMissing > 0) {
        console.info(colors.red(`\n✗ ${totalMissing} env var(s) missing from Vercel`));
        process.exit(1);
    }
    console.info(colors.green('\n✓ All required env vars are configured'));
    process.exit(0);
}

main().catch((err: unknown) => {
    console.error(colors.red(`\nFatal error: ${String(err)}`));
    process.exit(1);
});
