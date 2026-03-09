import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'glob';
import { inferCategory, inferMode } from './categories.js';
import type { CliCommand } from './types.js';

/** Scripts excluded from auto-discovery (internal/infrastructure) */
const EXCLUDED_SCRIPTS = new Set(['prepare', 'preinstall', 'postinstall']);

/**
 * Scripts that are turbo-orchestrated and should only appear as root curated commands.
 * When these scripts exist as both a root curated command and a per-package script,
 * the per-package version is excluded.
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
 * Extracts workspace glob patterns from pnpm-workspace.yaml content.
 * Uses regex to avoid a YAML library dependency.
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
                if (pattern) {
                    patterns.push(pattern);
                }
            } else if (trimmed !== '' && !trimmed.startsWith('#')) {
                break;
            }
        }
    }

    return patterns;
}

/**
 * Converts a package name to a short prefix for command IDs.
 * - `@repo/db` -> `db`
 * - `hospeda-api` -> `api`
 * - `admin` -> `admin`
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
 * Auto-discovers CLI commands from all workspace package.json files.
 * Curated commands take precedence over discovered ones.
 */
export async function discoverCommands({
    curatedCommands,
    rootDir
}: {
    curatedCommands: readonly CliCommand[];
    rootDir: string;
}): Promise<readonly CliCommand[]> {
    const curatedIds = new Set(curatedCommands.map((c) => c.id));

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

    const discovered: CliCommand[] = [];

    const results = await Promise.all(
        packageJsonPaths.map(async (pkgPath) => {
            try {
                const raw = await readFile(pkgPath, 'utf-8');
                return {
                    pkgPath,
                    pkg: JSON.parse(raw) as { name?: string; scripts?: Record<string, string> }
                };
            } catch {
                console.warn(`Warning: Could not read ${pkgPath}`);
                return null;
            }
        })
    );

    for (const result of results) {
        if (!result) continue;
        const { pkg } = result;
        const pkgName = pkg.name ?? 'unknown';
        const scripts = pkg.scripts ?? {};
        const prefix = getPackagePrefix({ name: pkgName });

        for (const scriptName of Object.keys(scripts)) {
            if (isExcludedScript({ script: scriptName, curatedIds })) continue;

            const commandId = prefix === 'hospeda' ? scriptName : `${prefix}:${scriptName}`;

            if (curatedIds.has(commandId)) continue;

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
