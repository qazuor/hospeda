#!/usr/bin/env tsx
/**
 * Interactive env push script.
 *
 * Reads local `.env.local` and pushes new or changed variables to
 * the Vercel project for the selected app and environment. Shows a
 * diff for each variable and asks for confirmation before pushing.
 *
 * Usage:
 *   pnpm env:push
 *
 * Requirements:
 *   - VERCEL_TOKEN env var set (or via `vercel login`)
 *   - Target app must be linked via `vercel link` (creates `.vercel/project.json`)
 *
 * @module scripts/env/push
 */

import { join, resolve } from 'node:path';
import { readEnvFile } from './utils/dotenv.js';
import { colors } from './utils/formatters.js';
import { confirmVar, selectApp, selectEnvironment } from './utils/prompts.js';
import type { AppSelection } from './utils/prompts.js';
import { getVarDescription } from './utils/registry.js';
import {
    createEnvVar,
    getVercelToken,
    listEnvVars,
    readProjectConfig,
    updateEnvVar
} from './utils/vercel-api.js';

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
 * Pushes environment variables for a single app from `.env.local` to Vercel.
 *
 * Steps:
 * 1. Read project config from `.vercel/project.json`
 * 2. Fetch current Vercel env vars
 * 3. Read local `.env.local`
 * 4. For each local var that is new or changed: show diff, ask for confirmation
 * 5. Create or update via Vercel API
 *
 * @param appName - App directory name (e.g. `'api'`, `'web'`, `'admin'`).
 * @param environment - Vercel environment target.
 * @param token - Vercel API token.
 */
async function pushForApp(
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

    const { projectId } = projectConfig;

    // Fetch remote vars
    let remoteVars: Awaited<ReturnType<typeof listEnvVars>>;
    try {
        remoteVars = await listEnvVars({ projectId, token });
    } catch (err) {
        console.error(colors.red(`  Error fetching Vercel env vars: ${String(err)}`));
        return;
    }

    // Build remote lookup for the target environment
    const remoteMap = new Map(
        remoteVars.filter((v) => v.target.includes(environment)).map((v) => [v.key, v])
    );

    // Read local env file
    const localVars = await readEnvFile({ filePath: envFilePath });

    if (localVars.size === 0) {
        return;
    }

    let _added = 0;
    let _updated = 0;
    let _skipped = 0;

    for (const [key, localValue] of localVars.entries()) {
        const remoteVar = remoteMap.get(key);
        const remoteValue = remoteVar?.value;
        const _description = getVarDescription(key);

        // Skip if identical
        if (remoteValue === localValue) {
            _skipped++;
            continue;
        }

        const action = remoteVar === undefined ? 'Create' : 'Update';
        const confirmed = await confirmVar({
            key,
            action: `${action} in Vercel`,
            value: localValue
        });

        if (!confirmed) {
            _skipped++;
            continue;
        }

        try {
            if (remoteVar === undefined) {
                await createEnvVar({
                    projectId,
                    token,
                    key,
                    value: localValue,
                    target: [environment],
                    type: 'plain'
                });
                _added++;
            } else {
                await updateEnvVar({
                    projectId,
                    token,
                    envId: remoteVar.id,
                    value: localValue
                });
                _updated++;
            }
        } catch (err) {
            console.error(colors.red(`  Error pushing ${key}: ${String(err)}`));
            _skipped++;
        }
    }
}

/**
 * Main entry point for the push script.
 * Prompts for app and environment, then runs the push for each selected app.
 */
async function main(): Promise<void> {
    const token = await getVercelToken();
    const appSelection = await selectApp();
    const environment = await selectEnvironment();

    const apps = resolveApps(appSelection);

    for (const appName of apps) {
        await pushForApp(appName, environment, token);
    }
}

main().catch((err: unknown) => {
    console.error(colors.red(`\nFatal error: ${String(err)}`));
    process.exit(1);
});
