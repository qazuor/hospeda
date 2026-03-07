#!/usr/bin/env tsx
/**
 * Interactive env pull script.
 *
 * Fetches environment variables from Vercel and writes them to the
 * local `.env.local` file for the selected app. Shows a diff for each
 * variable and asks for confirmation before writing.
 *
 * Usage:
 *   pnpm env:pull
 *
 * Requirements:
 *   - VERCEL_TOKEN env var set (or via `vercel login`)
 *   - Target app must be linked via `vercel link` (creates `.vercel/project.json`)
 *
 * @module scripts/env/pull
 */

import { join, resolve } from 'node:path';
import { readEnvFile, setEnvVar } from './utils/dotenv.js';
import { colors } from './utils/formatters.js';
import { confirmVar, selectApp, selectEnvironment } from './utils/prompts.js';
import type { AppSelection } from './utils/prompts.js';
import { getVarDescription } from './utils/registry.js';
import { getVercelToken, listEnvVars, readProjectConfig } from './utils/vercel-api.js';

/** Root of the monorepo (two levels up from scripts/env/). */
const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

/**
 * Maps an AppSelection to one or more app directory names.
 *
 * @param selection - User-selected app or `'all'`.
 * @returns Array of app directory names under `apps/`.
 */
function resolveApps(selection: AppSelection): readonly string[] {
    if (selection === 'all') return ['api', 'web', 'admin'] as const;
    return [selection] as const;
}

/**
 * Pulls environment variables for a single app from Vercel into `.env.local`.
 *
 * Steps:
 * 1. Read project config from `.vercel/project.json`
 * 2. Fetch all env vars from Vercel API
 * 3. Filter to the selected environment target
 * 4. Read current local `.env.local`
 * 5. For each remote var, show diff and ask for confirmation
 * 6. Write confirmed vars to `.env.local`
 *
 * @param appName - App directory name (e.g. `'api'`, `'web'`, `'admin'`).
 * @param environment - Vercel environment target.
 * @param token - Vercel API token.
 */
async function pullForApp(
    appName: string,
    environment: 'development' | 'preview' | 'production',
    token: string
): Promise<void> {
    const appDir = join(ROOT_DIR, 'apps', appName);
    const envFilePath = join(appDir, '.env.local');

    // Load project config
    let projectConfig: Awaited<ReturnType<typeof readProjectConfig>>;
    try {
        projectConfig = await readProjectConfig(appDir);
    } catch (err) {
        console.error(colors.red(`  Error reading project config: ${String(err)}`));
        return;
    }

    // Fetch remote vars
    let remoteVars: Awaited<ReturnType<typeof listEnvVars>>;
    try {
        remoteVars = await listEnvVars({ projectId: projectConfig.projectId, token });
    } catch (err) {
        console.error(colors.red(`  Error fetching Vercel env vars: ${String(err)}`));
        return;
    }

    // Filter to the requested environment target
    const filteredVars = remoteVars.filter((v) => v.target.includes(environment));

    if (filteredVars.length === 0) {
        return;
    }

    // Read local env file
    const localVars = await readEnvFile({ filePath: envFilePath });

    let _added = 0;
    let _updated = 0;
    let _skipped = 0;

    for (const remoteVar of filteredVars) {
        const localValue = localVars.get(remoteVar.key);
        const remoteValue = remoteVar.value;
        const _description = getVarDescription(remoteVar.key);

        // Skip if identical
        if (localValue === remoteValue) {
            _skipped++;
            continue;
        }

        const action = localValue === undefined ? 'Add' : 'Update';
        const confirmed = await confirmVar({
            key: remoteVar.key,
            action: `${action} locally`,
            value: remoteValue
        });

        if (!confirmed) {
            _skipped++;
            continue;
        }

        await setEnvVar({ filePath: envFilePath, key: remoteVar.key, value: remoteValue });

        if (localValue === undefined) {
            _added++;
        } else {
            _updated++;
        }
    }
}

/**
 * Main entry point for the pull script.
 * Prompts for app and environment, then runs the pull for each selected app.
 */
async function main(): Promise<void> {
    const token = await getVercelToken();
    const appSelection = await selectApp();
    const environment = await selectEnvironment();

    const apps = resolveApps(appSelection);

    for (const appName of apps) {
        await pullForApp(appName, environment, token);
    }
}

main().catch((err: unknown) => {
    console.error(colors.red(`\nFatal error: ${String(err)}`));
    process.exit(1);
});
