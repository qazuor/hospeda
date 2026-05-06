#!/usr/bin/env tsx
/**
 * Interactive env sync script.
 *
 * For each selected app and Vercel environment, detects which registry-defined
 * environment variables are NOT yet configured in Vercel, and prompts the user
 * for a value (with sensible suggestions from the registry) to create them
 * one-by-one via the Vercel API.
 *
 * Behavior matrix (decided 2026-05-04):
 *   - Existing vars in Vercel: SKIP by default. Use `--update` to overwrite
 *     when the new value differs from the remote one.
 *   - Secret vars (`secret: true` in registry): value is typed visibly
 *     (developer convenience) but uploaded as `type: 'encrypted'` to Vercel.
 *   - Optional vars (`required: false` in registry): asks per-var whether to
 *     include. Use `--include-optional` to include all without prompting.
 *
 * Usage:
 *   pnpm env:sync                           # interactive
 *   pnpm env:sync --app=admin --env=development
 *   pnpm env:sync --update                  # also overwrite differing values
 *   pnpm env:sync --include-optional        # include optional vars without asking
 *
 * Requirements:
 *   - VERCEL_TOKEN env var set (or via `vercel login`)
 *   - Each target app linked via `vercel link` (creates `.vercel/project.json`)
 *
 * @module scripts/env/sync
 */

import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { confirm, input, select } from '@inquirer/prompts';
import { colors, formatHeader, formatSummary } from './utils/formatters.js';
import { selectApp } from './utils/prompts.js';
import type { AppSelection, EnvironmentSelection } from './utils/prompts.js';
import type { AppId, EnvVarDefinition } from './utils/registry.js';
import { ENV_REGISTRY } from './utils/registry.js';
import {
    createEnvVar,
    getVercelToken,
    listEnvVars,
    readProjectConfig,
    updateEnvVar
} from './utils/vercel-api.js';

/** Root of the monorepo (two levels up from scripts/env/). */
const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

/** All apps that have a corresponding `apps/<name>/.vercel/project.json`. */
const SYNCABLE_APPS = ['api', 'web', 'admin'] as const;
type SyncableApp = (typeof SYNCABLE_APPS)[number];

/** Vercel environment targets we sync to. */
const ENVIRONMENTS = ['development', 'preview', 'production'] as const;
type EnvironmentTarget = (typeof ENVIRONMENTS)[number];

/**
 * CLI flags parsed from argv.
 */
interface SyncFlags {
    /** Allow overwriting existing Vercel vars when value differs. */
    readonly update: boolean;
    /** Include optional registry vars without per-var prompts. */
    readonly includeOptional: boolean;
    /** Pre-selected app (skip interactive prompt). */
    readonly app?: AppSelection;
    /** Pre-selected environment (skip interactive prompt; 'all' loops). */
    readonly env?: EnvironmentSelection | 'all';
}

/**
 * Counters for the run summary.
 */
interface SyncCounters {
    added: number;
    updated: number;
    skipped: number;
    errors: number;
}

/**
 * Parses CLI flags from `process.argv`.
 *
 * @returns Parsed and validated flags.
 */
function parseFlags(): SyncFlags {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            update: { type: 'boolean', default: false },
            'include-optional': { type: 'boolean', default: false },
            app: { type: 'string' },
            env: { type: 'string' }
        },
        strict: false
    });

    const app = values.app as string | undefined as AppSelection | undefined;
    const env = values.env as string | undefined as EnvironmentSelection | 'all' | undefined;

    if (app && !['api', 'web', 'admin', 'all'].includes(app)) {
        throw new Error(`Invalid --app value: ${app}. Use api|web|admin|all.`);
    }
    if (env && !['development', 'preview', 'production', 'all'].includes(env)) {
        throw new Error(`Invalid --env value: ${env}. Use development|preview|production|all.`);
    }

    return {
        update: Boolean(values.update),
        includeOptional: Boolean(values['include-optional']),
        app,
        env
    };
}

/**
 * Maps an `AppSelection` to one or more concrete app directory names.
 *
 * @param selection - User-selected app or `'all'`.
 * @returns Array of app names that have Vercel projects.
 */
function resolveApps(selection: AppSelection): readonly SyncableApp[] {
    if (selection === 'all') return SYNCABLE_APPS;
    return [selection as SyncableApp];
}

/**
 * Maps an environment selection to the list of environments to process.
 *
 * @param selection - User-selected environment or `'all'`.
 * @returns Array of environment targets.
 */
function resolveEnvironments(
    selection: EnvironmentSelection | 'all'
): readonly EnvironmentTarget[] {
    if (selection === 'all') return ENVIRONMENTS;
    return [selection];
}

/**
 * The registry uses an `AppId` ('api'|'web'|'admin'|'docker'|'seed').
 * Map our syncable app names directly (they happen to align).
 */
function asAppId(app: SyncableApp): AppId {
    return app;
}

/**
 * Vars in this category are managed by the runtime/platform (Node.js, Vercel, CI)
 * and MUST NOT be set manually in Vercel project Settings — the platform either
 * injects them or rejects them. Always exclude from sync.
 */
const PLATFORM_MANAGED_CATEGORY = 'system';

/**
 * Returns the registry vars consumed by a given app, sorted by category and name
 * for stable, predictable prompting order.
 *
 * Excludes platform-managed vars (NODE_ENV, CI, VERCEL, VERCEL_GIT_COMMIT_SHA,
 * TEST_DB_*) which Vercel sets automatically and should never be configured by hand.
 *
 * @param app - App identifier.
 * @returns Sorted readonly array of variable definitions.
 */
function getRegistryVarsForApp(app: SyncableApp): readonly EnvVarDefinition[] {
    const appId = asAppId(app);
    return [...ENV_REGISTRY]
        .filter((v) => v.apps.includes(appId))
        .filter((v) => v.category !== PLATFORM_MANAGED_CATEGORY)
        .sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.name.localeCompare(b.name);
        });
}

/**
 * Computes the suggested default value for a prompt, based on registry data
 * and the target environment.
 *
 * Priority:
 *   1. `defaultValue` from registry (always wins).
 *   2. `exampleValue` if it looks safe for `development` (contains 'localhost' or similar).
 *   3. Empty string (user must type it).
 *
 * @param def - Registry definition.
 * @param env - Target Vercel environment.
 * @returns Suggested default string.
 */
function suggestValue(def: EnvVarDefinition, env: EnvironmentTarget): string {
    if (def.defaultValue !== undefined) return def.defaultValue;
    if (env === 'development' && def.exampleValue) {
        const looksLocal =
            def.exampleValue.includes('localhost') ||
            def.exampleValue.includes('127.0.0.1') ||
            def.exampleValue.includes('0.0.0.0');
        if (looksLocal) return def.exampleValue;
        // For non-URL types in dev, use example (safe text values like 'es', 'true', etc.)
        if (def.type !== 'url') return def.exampleValue;
    }
    return '';
}

/**
 * Validates a user-provided value against the registry definition.
 * Returns true on success, or an error message string on failure.
 *
 * @param value - The raw input.
 * @param def - Registry definition.
 * @returns true if valid, error message otherwise.
 */
function validateValue(value: string, def: EnvVarDefinition): true | string {
    if (def.required && value.length === 0) return 'Esta variable es obligatoria';
    if (value.length === 0) return true; // optional, allow empty

    switch (def.type) {
        case 'url': {
            try {
                new URL(value);
                return true;
            } catch {
                return 'Tiene que ser una URL válida (ej: https://ejemplo.com)';
            }
        }
        case 'number': {
            return Number.isFinite(Number(value)) ? true : 'Tiene que ser un número';
        }
        case 'boolean': {
            return ['true', 'false', '1', '0'].includes(value.toLowerCase())
                ? true
                : 'Tiene que ser true|false|1|0';
        }
        case 'enum': {
            if (!def.enumValues || def.enumValues.length === 0) return true;
            return def.enumValues.includes(value)
                ? true
                : `Tiene que ser uno de: ${def.enumValues.join(', ')}`;
        }
        default:
            return true;
    }
}

/**
 * Prompts the user for a value, dispatching to the right inquirer prompt
 * based on the registry type. Secret vars are typed visibly (decided trade-off).
 *
 * @param def - Registry definition.
 * @param env - Target environment.
 * @returns The value entered by the user.
 */
/**
 * Prints the full informational block for a variable: name + tags, What/How/Docs,
 * Default/Example, and the suggested prefill. Called BEFORE any prompt so the user
 * always sees full context — even when deciding whether to set an optional var.
 *
 * @param def - Registry definition.
 * @param env - Target Vercel environment.
 */
function printVarInfo(def: EnvVarDefinition, env: EnvironmentTarget): void {
    const tags: string[] = [];
    if (def.required) tags.push(colors.red('obligatoria'));
    else tags.push(colors.dim('opcional'));
    if (def.secret) tags.push(colors.yellow('secreto'));
    tags.push(colors.dim(`tipo=${def.type}`));
    if (def.enumValues && def.enumValues.length > 0) {
        tags.push(colors.dim(`opciones=[${def.enumValues.join('|')}]`));
    }
    const tagLine = tags.join(' ');

    // Pick Spanish content when available, fall back to the English original.
    const description = def.descriptionEs ?? def.description;
    const howToObtain = def.howToObtainEs ?? def.howToObtain;

    // Visual separator — blank lines + horizontal rule so each var stands apart
    // from the previous prompt output. The rule width matches the typical
    // terminal column width but stays subtle (dim).
    console.log('');
    console.log('');
    console.log(
        colors.dim('  ────────────────────────────────────────────────────────────────────')
    );
    console.log('');
    // Header — name + tags
    console.log(`  ${colors.bold(colors.cyan(def.name))}  ${tagLine}`);
    console.log('');
    // What it does
    console.log(`  ${colors.dim('Qué:        ')}${description}`);
    // How to fill it (free-form guidance from the registry)
    if (howToObtain) {
        console.log(`  ${colors.dim('Cómo:       ')}${howToObtain}`);
    }
    // Provider docs link, if any
    if (def.helpUrl) {
        console.log(`  ${colors.dim('Docs:       ')}${colors.cyan(def.helpUrl)}`);
    }
    // Default + example, with explicit labels
    if (def.defaultValue !== undefined) {
        console.log(`  ${colors.dim('Por defecto:')} ${def.defaultValue}`);
    }
    if (def.exampleValue && def.exampleValue !== def.defaultValue) {
        console.log(`  ${colors.dim('Ejemplo:    ')}${def.exampleValue}`);
    }
    // What we are about to suggest as the prompt prefill
    const suggestion = suggestValue(def, env);
    if (suggestion) {
        console.log(
            `  ${colors.dim('Sugerencia: ')}${colors.green(suggestion)}  ${colors.dim('(Enter para aceptar)')}`
        );
    }
    // Spacer between the info block and the prompt that follows
    console.log('');
}

async function promptForValue(def: EnvVarDefinition, env: EnvironmentTarget): Promise<string> {
    if (def.type === 'enum' && def.enumValues && def.enumValues.length > 0) {
        return select<string>({
            message: 'Elegí un valor',
            choices: def.enumValues.map((v) => ({ name: v, value: v })),
            default: suggestValue(def, env) || def.enumValues[0]
        });
    }

    if (def.type === 'boolean') {
        const suggested = suggestValue(def, env);
        return select<string>({
            message: 'Elegí un valor',
            choices: [
                { name: 'true', value: 'true' },
                { name: 'false', value: 'false' }
            ],
            default: suggested === 'true' || suggested === '1' ? 'true' : 'false'
        });
    }

    return input({
        message: 'Valor',
        default: suggestValue(def, env) || undefined,
        validate: (raw) => validateValue(raw, def)
    });
}

/**
 * Processes a single missing variable: prompts (or skips) the user and
 * creates/updates the var in Vercel.
 *
 * @returns 'added' | 'updated' | 'skipped' | 'error'
 */
async function processVar(params: {
    readonly def: EnvVarDefinition;
    readonly remote: { readonly id: string; readonly value: string } | undefined;
    readonly projectId: string;
    readonly token: string;
    readonly environment: EnvironmentTarget;
    readonly flags: SyncFlags;
}): Promise<'added' | 'updated' | 'skipped' | 'error'> {
    const { def, remote, projectId, token, environment, flags } = params;

    // ALWAYS show the full info block first — so the user has context before
    // deciding whether to set an optional var, choose a value, etc.
    printVarInfo(def, environment);

    // Optional + no flag → ask whether to include this var at all
    if (!def.required && !flags.includeOptional) {
        const include = await confirm({
            message: `¿Configurar ${colors.cyan(def.name)} ahora?`,
            default: false
        });
        if (!include) {
            console.log(colors.dim('  (omitida)'));
            return 'skipped';
        }
    }

    const value = await promptForValue(def, environment);

    // Empty input on optional var → skip cleanly
    if (value.length === 0 && !def.required) {
        console.log(colors.dim('  (valor vacío, omitiendo)'));
        return 'skipped';
    }

    try {
        if (remote === undefined) {
            await createEnvVar({
                projectId,
                token,
                key: def.name,
                value,
                target: [environment],
                type: def.secret ? 'encrypted' : 'plain'
            });
            console.log(colors.green(`  ✓ Creada ${def.name} en ${environment}`));
            return 'added';
        }
        // remote exists — only update if --update flag and values differ
        if (remote.value === value) {
            console.log(colors.dim(`  = ${def.name} sin cambios, omitiendo`));
            return 'skipped';
        }
        await updateEnvVar({ projectId, token, envId: remote.id, value });
        console.log(colors.yellow(`  ~ Actualizada ${def.name} en ${environment}`));
        return 'updated';
    } catch (err) {
        console.error(colors.red(`  ✗ Error al escribir ${def.name}: ${String(err)}`));
        return 'error';
    }
}

/**
 * Runs sync for one (app, environment) combination.
 *
 * @returns Counters for this run.
 */
async function syncAppEnv(params: {
    readonly app: SyncableApp;
    readonly environment: EnvironmentTarget;
    readonly token: string;
    readonly flags: SyncFlags;
}): Promise<SyncCounters> {
    const { app, environment, token, flags } = params;
    const counters: SyncCounters = { added: 0, updated: 0, skipped: 0, errors: 0 };

    console.log(formatHeader(`${app}  →  ${environment}`));

    const appDir = join(ROOT_DIR, 'apps', app);

    // Read project config
    let projectConfig: Awaited<ReturnType<typeof readProjectConfig>>;
    try {
        projectConfig = await readProjectConfig(appDir);
    } catch (err) {
        console.error(colors.red(`  ✗ ${String(err)}`));
        counters.errors++;
        return counters;
    }
    const { projectId } = projectConfig;

    // Fetch current Vercel vars for this environment
    let remoteAll: Awaited<ReturnType<typeof listEnvVars>>;
    try {
        remoteAll = await listEnvVars({ projectId, token });
    } catch (err) {
        console.error(colors.red(`  ✗ Vercel API error: ${String(err)}`));
        counters.errors++;
        return counters;
    }
    const remoteByKey = new Map(
        remoteAll
            .filter((v) => v.target.includes(environment))
            .map((v) => [v.key, { id: v.id, value: v.value }])
    );

    // Build the work list: registry vars for this app, partitioned by status
    const allVarsForApp = getRegistryVarsForApp(app);
    const missing = allVarsForApp.filter((v) => !remoteByKey.has(v.name));
    const existing = allVarsForApp.filter((v) => remoteByKey.has(v.name));

    console.log(
        `  ${colors.dim(`Variables del registry: ${allVarsForApp.length} | ya están en Vercel: ${existing.length} | faltan: ${missing.length}`)}`
    );

    if (missing.length === 0 && !flags.update) {
        console.log(colors.green('  ✓ Todas las variables del registry ya están configuradas.'));
        return counters;
    }

    // 1) Process missing vars
    for (const def of missing) {
        const result = await processVar({
            def,
            remote: undefined,
            projectId,
            token,
            environment,
            flags
        });
        counters[result === 'error' ? 'errors' : result]++;
    }

    // 2) If --update, also offer to update existing vars when value differs
    if (flags.update) {
        for (const def of existing) {
            const remote = remoteByKey.get(def.name);
            // Some encrypted vars come back with empty value from the API; cannot
            // diff blindly. Always prompt under --update for those.
            if (!remote) continue;
            const result = await processVar({
                def,
                remote,
                projectId,
                token,
                environment,
                flags
            });
            counters[result === 'error' ? 'errors' : result]++;
        }
    }

    console.log('');
    console.log(
        formatSummary({
            added: counters.added,
            updated: counters.updated,
            skipped: counters.skipped
        })
    );
    if (counters.errors > 0) {
        console.log(colors.red(`  ${counters.errors} error(es)`));
    }
    return counters;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
    const flags = parseFlags();
    const token = await getVercelToken();

    const appSelection = flags.app ?? (await selectApp());
    const envSelection: EnvironmentSelection | 'all' =
        flags.env ??
        (await select<EnvironmentSelection | 'all'>({
            message: '¿Qué entorno de Vercel?',
            choices: [
                { name: 'Development', value: 'development' },
                { name: 'Preview', value: 'preview' },
                { name: 'Production', value: 'production' },
                { name: 'Todos los entornos', value: 'all' }
            ]
        }));

    const apps = resolveApps(appSelection);
    const envs = resolveEnvironments(envSelection);

    const totals: SyncCounters = { added: 0, updated: 0, skipped: 0, errors: 0 };

    for (const app of apps) {
        for (const environment of envs) {
            const c = await syncAppEnv({ app, environment, token, flags });
            totals.added += c.added;
            totals.updated += c.updated;
            totals.skipped += c.skipped;
            totals.errors += c.errors;
        }
    }

    console.log('');
    console.log(colors.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(colors.bold('Total combinado (todas las apps × entornos):'));
    console.log(
        formatSummary({
            added: totals.added,
            updated: totals.updated,
            skipped: totals.skipped
        })
    );
    if (totals.errors > 0) {
        console.log(colors.red(`Errores: ${totals.errors}`));
        process.exit(1);
    }
}

main().catch((err: unknown) => {
    console.error(colors.red(`\nError fatal: ${String(err)}`));
    process.exit(1);
});
