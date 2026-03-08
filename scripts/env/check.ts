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
import { readEnvFile } from './utils/dotenv.js';
import { colors } from './utils/formatters.js';
import { getVercelToken, listEnvVars, readProjectConfig } from './utils/vercel-api.js';

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
 * Reads variable names from an `.env.example` file.
 *
 * @param filePath - Path to the `.env.example` file.
 * @returns Set of variable names.
 */
async function readExampleKeys(filePath: string): Promise<ReadonlySet<string>> {
    if (!existsSync(filePath)) return new Set();
    const vars = await readEnvFile({ filePath });
    return new Set(vars.keys());
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

    // Read .env.example keys
    const examplePath = join(appDir, '.env.example');
    const exampleKeys = await readExampleKeys(examplePath);

    // Compute diff
    const missing: string[] = [];
    const ok: string[] = [];
    const extra: string[] = [];

    for (const key of exampleKeys) {
        if (remoteKeys.has(key)) {
            ok.push(key);
        } else {
            missing.push(key);
        }
    }

    for (const key of remoteKeys) {
        if (!exampleKeys.has(key)) {
            extra.push(key);
        }
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
