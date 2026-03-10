import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'glob';
import { z } from 'zod';
import { inferCategory, inferMode } from './categories.js';
import type { CliCommand } from './types.js';

/** Safe package name: scoped or unscoped, letters/digits/dots/dashes/underscores */
const SAFE_PKG_NAME = /^[@a-z0-9/_.-]+$/i;

/** Safe script name: lowercase-ish alphanumeric with colons, dashes, dots, underscores */
const SAFE_SCRIPT_NAME = /^[a-z0-9:_.-]+$/i;

/**
 * Scripts excluded from auto-discovery.
 * Includes npm lifecycle hooks and internal/infrastructure scripts that are
 * never meaningful as user-facing CLI commands.
 */
const EXCLUDED_SCRIPTS = new Set([
    'prepare',
    'preinstall',
    'postinstall',
    'prepublishOnly',
    'prebuild',
    'postbuild',
    'pretest',
    'posttest',
    'predev',
    'postdev'
]);

/**
 * Scripts that are turbo-orchestrated and should only appear as root curated
 * commands with `type: 'pnpm-root'`. When these scripts exist as both a root
 * curated command and a per-package script, the per-package version is
 * excluded to avoid duplication and noise in the CLI menu.
 *
 * The root curated variant (e.g. `pnpm build`) runs all packages via Turbo,
 * so surfacing individual per-package variants as separate commands would be
 * misleading and redundant.
 */
const TURBO_ORCHESTRATED_SCRIPTS = new Set([
    'build',
    'dev',
    'lint',
    'format',
    'test',
    'test:watch',
    'test:coverage',
    'typecheck',
    'clean'
]);

/**
 * Minimal Zod schema for validating package.json content at runtime.
 * Uses `passthrough()` so unknown fields are preserved without error.
 */
const PackageJsonSchema = z
    .object({
        name: z.string().optional(),
        scripts: z.record(z.string(), z.string()).optional()
    })
    .passthrough();

/** Inferred type from the schema above */
type PackageJson = z.infer<typeof PackageJsonSchema>;

/**
 * Extracts workspace glob patterns from pnpm-workspace.yaml content.
 * Uses simple string parsing to avoid a YAML library dependency.
 *
 * **Limitations**: This parser does not support YAML anchors, multi-line
 * values, block scalars, or inline arrays. It assumes the standard pnpm
 * workspace format where `packages:` is a top-level key followed by a
 * dash-list of glob patterns.
 *
 * @param content - Raw string content of pnpm-workspace.yaml
 * @returns Readonly array of validated, safe glob patterns
 */
export function parseWorkspacePatterns({ content }: { content: string }): readonly string[] {
    const patterns: string[] = [];
    let inPackages = false;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();

        if (trimmed === 'packages:') {
            inPackages = true;
            continue;
        }

        if (inPackages) {
            if (trimmed.startsWith('- ')) {
                const pattern = trimmed
                    .slice(2)
                    .trim()
                    .replace(/^['"]|['"]$/g, '');

                if (!pattern) continue;

                if (pattern.startsWith('/') || pattern.includes('..')) {
                    console.warn(`Skipping unsafe workspace pattern: ${pattern}`);
                    continue;
                }

                patterns.push(pattern);
            } else if (trimmed !== '' && !trimmed.startsWith('#')) {
                break;
            }
        }
    }

    return patterns;
}

/**
 * Converts a package name to a short prefix for command IDs.
 *
 * @example
 * ```ts
 * getPackagePrefix({ name: '@repo/db' })       // "db"
 * getPackagePrefix({ name: 'hospeda-api' })    // "api"
 * getPackagePrefix({ name: 'admin' })          // "admin"
 * ```
 */
export function getPackagePrefix({ name }: { name: string }): string {
    if (name.startsWith('@repo/')) {
        return name.slice(6);
    }
    if (name.startsWith('hospeda-')) {
        return name.slice(8);
    }
    return name;
}

/**
 * Determines if a script should be excluded from auto-discovery results.
 *
 * @param script - Script name to check
 * @param curatedIds - Set of IDs from curated commands
 * @returns `true` if the script should be skipped during discovery
 */
export function isExcludedScript({
    script,
    curatedIds
}: {
    script: string;
    curatedIds: ReadonlySet<string>;
}): boolean {
    if (EXCLUDED_SCRIPTS.has(script)) return true;
    if (TURBO_ORCHESTRATED_SCRIPTS.has(script) && curatedIds.has(script)) return true;
    return false;
}

/**
 * Reads and validates a single package.json file.
 * Returns `null` if the file cannot be read or fails schema validation.
 *
 * @param pkgPath - Absolute path to the package.json file
 * @returns Parsed package data or `null` on failure
 */
async function readPackageJson({
    pkgPath
}: {
    pkgPath: string;
}): Promise<{ pkgPath: string; pkg: PackageJson } | null> {
    try {
        const raw = await readFile(pkgPath, 'utf-8');
        const parsed = PackageJsonSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
            const name = parsed.error?.issues?.[0]?.path?.join('.') ?? 'unknown field';
            console.warn(`Warning: Invalid package.json (${name}) in workspace`);
            return null;
        }
        return { pkgPath, pkg: parsed.data };
    } catch {
        console.warn('Warning: Could not read a workspace package.json');
        return null;
    }
}

/**
 * Auto-discovers CLI commands from all workspace package.json files.
 * Curated commands take precedence over discovered ones.
 *
 * Deduplication uses execution-based comparison (filter + script) so that
 * commands like curated `seed:required` and discovered `seed:seed:required`
 * that map to the same underlying execution are not duplicated.
 *
 * @param curatedCommands - Manually defined curated commands
 * @param rootDir - Absolute path to the monorepo root
 * @returns Readonly array of discovered (non-curated) commands
 */
export async function discoverCommands({
    curatedCommands,
    rootDir
}: {
    curatedCommands: readonly CliCommand[];
    rootDir: string;
}): Promise<readonly CliCommand[]> {
    const curatedIds = new Set(curatedCommands.map((c) => c.id));
    const curatedRootScripts = new Set(
        curatedCommands
            .filter(
                (c): c is CliCommand & { execution: { type: 'pnpm-root'; script: string } } =>
                    c.execution.type === 'pnpm-root'
            )
            .map((c) => c.execution.script)
    );

    const yamlPath = join(rootDir, 'pnpm-workspace.yaml');
    let yamlContent: string;
    try {
        yamlContent = await readFile(yamlPath, 'utf-8');
    } catch {
        console.error('Cannot find pnpm-workspace.yaml. Run from monorepo root.');
        return [];
    }

    const patterns = parseWorkspacePatterns({ content: yamlContent });
    const packageJsonGlobs = patterns.map((p) => join(rootDir, p, 'package.json'));
    const packageJsonPaths = (
        await Promise.all(packageJsonGlobs.map((g) => glob(g, { absolute: true })))
    ).flat();

    const results = await Promise.all(
        packageJsonPaths.map((pkgPath) => readPackageJson({ pkgPath }))
    );

    const discovered: CliCommand[] = [];

    for (const result of results) {
        if (!result) continue;

        const { pkg } = result;
        const pkgName = pkg.name ?? 'unknown';

        if (!SAFE_PKG_NAME.test(pkgName)) {
            console.warn(`Skipping package with unsafe name: ${pkgName}`);
            continue;
        }

        const scripts = pkg.scripts ?? {};
        const prefix = getPackagePrefix({ name: pkgName });

        for (const scriptName of Object.keys(scripts)) {
            if (!SAFE_SCRIPT_NAME.test(scriptName)) {
                console.warn(`Skipping unsafe script name: ${scriptName} in ${pkgName}`);
                continue;
            }

            if (isExcludedScript({ script: scriptName, curatedIds })) continue;

            // Turbo-orchestrated scripts that already exist as root curated commands
            // are excluded even when the curated ID differs from the discovered ID.
            if (TURBO_ORCHESTRATED_SCRIPTS.has(scriptName) && curatedRootScripts.has(scriptName)) {
                continue;
            }

            const commandId = prefix === 'hospeda' ? scriptName : `${prefix}:${scriptName}`;

            // Execution-based dedup: skip if any curated command targets the same
            // package + script, regardless of ID format differences.
            const alreadyCurated = curatedCommands.some(
                (c) =>
                    c.execution.type === 'pnpm-filter' &&
                    c.execution.filter === pkgName &&
                    c.execution.script === scriptName
            );
            if (alreadyCurated || curatedIds.has(commandId)) continue;

            discovered.push({
                id: commandId,
                description: `${scriptName} (${pkgName})`,
                category: inferCategory({ scriptName }),
                execution: { type: 'pnpm-filter', filter: pkgName, script: scriptName },
                source: pkgName,
                mode: inferMode({ scriptName }),
                curated: false
            });
        }
    }

    return discovered;
}
