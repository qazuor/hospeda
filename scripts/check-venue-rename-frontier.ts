/**
 * G-FAC-T1 counts remaining retired vertical identifiers by path and content.
 * It compares the exact scan with a committed inventory and prevents PRs from
 * increasing that inventory until G-FAC-R1 replaces this temporary guard.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const INVENTORY = 'scripts/guards/venue-rename-frontier.json';
const PARTS = ['gastronom', 'y', 'ies'];
const LOWER = `${PARTS[0]}ies|${PARTS[0]}y`;
const TITLE = `${PARTS[0][0]?.toUpperCase()}${PARTS[0].slice(1)}ies|${PARTS[0][0]?.toUpperCase()}${PARTS[0].slice(1)}y`;
const UPPER = `${PARTS[0].toUpperCase()}IES|${PARTS[0].toUpperCase()}Y`;
const HIT = new RegExp(`(?:${LOWER}|${TITLE}|${UPPER})`, 'g');
const EXPECTED_OUT = [
    'packages/db/src/migrations/',
    'packages/seed/src/data-migrations/',
    '.specs/'
].sort();
const THEME_ACCESS = new RegExp(
    `(?:EventCategoryEnum|PostCategoryEnum)\\.${PARTS[0].toUpperCase()}Y`,
    'g'
);
const EXEMPT_FILES = [
    'scripts/check-venue-rename-frontier.ts',
    'scripts/__tests__/check-venue-rename-frontier.test.ts',
    'scripts/check-venue-retired-word.ts',
    'scripts/__tests__/check-venue-retired-word.test.ts',
    'scripts/guards/venue-retired-word.json',
    INVENTORY
].sort();

/** Minimum number of git-listed paths that must be scanned. */
export const FRONTIER_FLOOR = 10000;

/** One inventory mismatch or increase against the base. */
export interface FrontierViolation {
    readonly file: string;
    readonly expected: number | string;
    readonly found: number | string;
    readonly reason: string;
}

/** The committed exception list and exact per-file hit inventory. */
export interface FrontierInventory {
    readonly $comment: string;
    readonly outOfScan: readonly string[];
    readonly exempt: {
        readonly files: readonly string[];
        readonly themeOccurrences: Readonly<Record<string, number>>;
    };
    readonly files: Readonly<Record<string, number>>;
    /** Maps each moved path to the old path used for its base count. */
    readonly renamedFrom?: Readonly<Record<string, string>>;
}

/** Counts retired identifier forms in non-binary content and in the path. */
export function countFrontierHits({
    file,
    content
}: {
    readonly file: string;
    readonly content: string;
}): number {
    const pattern = new RegExp(HIT.source, 'g');
    const contentHits = content.match(pattern)?.length ?? 0;
    const pathHits = file.match(new RegExp(HIT.source, 'g'))?.length ?? 0;
    return contentHits + pathHits;
}

/** Counts each scanned path, including zero-hit files. */
export function scanFrontier({
    files
}: {
    readonly files: readonly { readonly file: string; readonly content: string }[];
}): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const entry of files) {
        if (isOutOfScan(entry.file) || EXEMPT_FILES.includes(entry.file)) continue;
        const content = applyThemeExemptions(entry.file, entry.content);
        const count = countFrontierHits({ file: entry.file, content });
        if (count > 0) result.set(entry.file, count);
    }
    return result;
}

/** Compares the measured scan to the exact inventory and the base inventory. */
export function checkFrontier({
    scanned,
    inventory,
    base
}: {
    readonly scanned: ReadonlyMap<string, number>;
    readonly inventory: FrontierInventory;
    readonly base?: FrontierInventory;
}): readonly FrontierViolation[] {
    const violations: FrontierViolation[] = [];
    if (JSON.stringify([...inventory.outOfScan].sort()) !== JSON.stringify(EXPECTED_OUT)) {
        violations.push({
            file: INVENTORY,
            expected: EXPECTED_OUT.join(', '),
            found: [...inventory.outOfScan].sort().join(', '),
            reason: 'outOfScan list differs'
        });
    }
    if (JSON.stringify([...inventory.exempt.files].sort()) !== JSON.stringify(EXEMPT_FILES)) {
        violations.push({
            file: INVENTORY,
            expected: EXEMPT_FILES.join(', '),
            found: [...inventory.exempt.files].sort().join(', '),
            reason: 'exempt file list differs'
        });
    }
    const expected = inventory.files;
    for (const file of new Set([...scanned.keys(), ...Object.keys(expected)])) {
        const actual = scanned.get(file) ?? 0;
        const declared = expected[file] ?? 0;
        if (actual !== declared)
            violations.push({
                file,
                expected: declared,
                found: actual,
                reason: 'inventory mismatch'
            });
    }
    if (base) {
        const oldPaths = new Set<string>();
        const invalidRenames = new Set<string>();
        for (const [file, oldFile] of Object.entries(inventory.renamedFrom ?? {})) {
            if (base.files[file] !== undefined) {
                violations.push({
                    file,
                    expected: 'new path absent from base',
                    found: file,
                    reason: 'renamedFrom new path already exists in base'
                });
                invalidRenames.add(file);
            }
            if (base.files[oldFile] === undefined) {
                violations.push({
                    file,
                    expected: 'old path present in base',
                    found: oldFile,
                    reason: 'renamedFrom old path absent from base'
                });
                invalidRenames.add(file);
            }
            if (oldPaths.has(oldFile)) {
                violations.push({
                    file,
                    expected: 'unique old path',
                    found: oldFile,
                    reason: 'renamedFrom old path is duplicated'
                });
                invalidRenames.add(file);
            }
            oldPaths.add(oldFile);
        }
        for (const [file, count] of Object.entries(expected)) {
            if (invalidRenames.has(file)) continue;
            const oldFile = inventory.renamedFrom?.[file];
            const old = base.files[oldFile ?? file];
            if (old === undefined || count > old)
                violations.push({
                    file,
                    expected: old ?? 'absent from base',
                    found: count,
                    reason:
                        oldFile && old !== undefined && count > old
                            ? `inventory may not grow for renamed path; old path ${oldFile}`
                            : 'inventory may not grow against base'
                });
        }
    }
    return violations;
}

function isOutOfScan(file: string): boolean {
    if (file.startsWith('packages/db/src/migrations/'))
        return !file.startsWith('packages/db/src/migrations/extras/');
    if (file.startsWith('packages/seed/src/data-migrations/')) return true;
    // Spec folders are historical records: they keep the old vertical name on purpose.
    return file.startsWith('.specs/');
}

function applyThemeExemptions(file: string, content: string): string {
    let result = content.replace(new RegExp(THEME_ACCESS.source, 'g'), '');
    if (
        file === 'packages/schemas/src/enums/event-category.enum.ts' ||
        file === 'packages/schemas/src/enums/post-category.enum.ts'
    ) {
        const declaration = new RegExp(
            `^\\s*${PARTS[0].toUpperCase()}Y\\s*=\\s*['"]${PARTS[0].toUpperCase()}Y['"],?\\s*$`,
            'gm'
        );
        result = result.replace(declaration, '');
    }
    return result;
}

function measureExemptions(
    files: readonly { readonly file: string; readonly content: string }[]
): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const { file, content } of files) {
        const accesses = content.match(new RegExp(THEME_ACCESS.source, 'g'))?.length ?? 0;
        const declarations =
            file === 'packages/schemas/src/enums/event-category.enum.ts' ||
            file === 'packages/schemas/src/enums/post-category.enum.ts'
                ? (content.match(
                      new RegExp(
                          `${PARTS[0].toUpperCase()}Y\\s*=\\s*['"]${PARTS[0].toUpperCase()}Y['"]`,
                          'g'
                      )
                  )?.length ?? 0) * 2
                : 0;
        if (accesses + declarations > 0) counts[file] = accesses + declarations;
    }
    return counts;
}

function readInventory(root: string): FrontierInventory {
    return JSON.parse(readFileSync(join(root, INVENTORY), 'utf8')) as FrontierInventory;
}

function gitFiles(root: string): readonly string[] {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        maxBuffer: 32 * 1024 * 1024
    })
        .toString()
        .split('\0')
        .filter(Boolean);
}

function readBase(root: string): FrontierInventory | undefined {
    const ref =
        process.env.CI_BASELINE_SHA ?? (process.env.CI === 'true' ? undefined : 'origin/staging');
    if (!ref) throw new Error('CI_BASELINE_SHA is required in CI');
    try {
        execFileSync('git', ['rev-parse', '--verify', ref], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch {
        throw new Error(`Could not resolve base commit ${ref}`);
    }
    try {
        return JSON.parse(
            execFileSync('git', ['show', `${ref}:${INVENTORY}`], {
                cwd: root,
                stdio: ['ignore', 'pipe', 'ignore']
            }).toString()
        ) as FrontierInventory;
    } catch {
        return undefined;
    }
}

/** Runs G-FAC-T1 against a repository root and optional base inventory. */
export function run({
    root = ROOT,
    baseInventory,
    renames
}: {
    readonly root?: string;
    readonly baseInventory?: FrontierInventory | null;
    readonly renames?: ReadonlyMap<string, string>;
} = {}): { readonly exitCode: number; readonly output: string } {
    try {
        const inventory = readInventory(root);
        const paths = gitFiles(root).filter(
            (file) => !isOutOfScan(file) && !EXEMPT_FILES.includes(file)
        );
        if (paths.length < FRONTIER_FLOOR)
            return {
                exitCode: 1,
                output: `Scan floor failed: ${paths.length} < ${FRONTIER_FLOOR}`
            };
        const scannedFiles = paths.flatMap((file) => {
            try {
                const content = readFileSync(join(root, file));
                if (content.includes(0)) return [];
                return [{ file, content: content.toString('utf8') }];
            } catch {
                return [];
            }
        });
        const actualExemptions = measureExemptions(scannedFiles);
        if (JSON.stringify(actualExemptions) !== JSON.stringify(inventory.exempt.themeOccurrences))
            return {
                exitCode: 1,
                output: `${INVENTORY}: exempt theme counts differ; expected ${JSON.stringify(inventory.exempt.themeOccurrences)}, found ${JSON.stringify(actualExemptions)}`
            };
        const scanned = scanFrontier({ files: scannedFiles });
        if (process.argv.includes('--write')) {
            const base = baseInventory === null ? undefined : (baseInventory ?? readBase(root));
            if (base) {
                const gitRenames = renames ?? readGitRenames(root);
                const nameRenames = buildNameRenames(scanned, base);
                const conflicts = findRenameConflicts(gitRenames, nameRenames);
                if (conflicts.length)
                    return {
                        exitCode: 1,
                        output: conflicts
                            .map(
                                ({ file, oldPath }) =>
                                    `${file}: rename sources disagree; git found ${gitRenames.get(file)}, path mapping found ${oldPath}`
                            )
                            .join('\n')
                    };
                const renamedFrom = buildRenamedFrom({
                    scanned,
                    base,
                    renames: mergeRenames(gitRenames, nameRenames)
                });
                const growth = checkFrontier({
                    scanned,
                    inventory: { ...inventory, files: Object.fromEntries(scanned), renamedFrom },
                    base
                }).filter(
                    (item) =>
                        item.reason === 'inventory may not grow against base' &&
                        item.expected !== 'absent from base'
                );
                if (growth.length)
                    return { exitCode: 1, output: growth.map(formatViolation).join('\n') };
            }
            const next = {
                ...inventory,
                files: Object.fromEntries([...scanned].sort(([a], [b]) => a.localeCompare(b))),
                ...(baseInventory === null
                    ? {}
                    : (() => {
                          const base = baseInventory ?? readBase(root);
                          return base
                              ? {
                                    renamedFrom: buildRenamedFrom({
                                        scanned,
                                        base,
                                        renames: mergeRenames(
                                            renames ?? readGitRenames(root),
                                            buildNameRenames(scanned, base)
                                        )
                                    })
                                }
                              : { renamedFrom: undefined };
                      })())
            };
            writeFileSync(join(root, INVENTORY), stringifyInventory(next));
            return {
                exitCode: 0,
                output: `Wrote ${scanned.size} files / ${[...scanned.values()].reduce((sum, count) => sum + count, 0)} occurrences`
            };
        }
        const base = baseInventory === null ? undefined : (baseInventory ?? readBase(root));
        if (base) {
            const gitRenames = renames ?? readGitRenames(root);
            const nameRenames = buildNameRenames(scanned, base);
            const conflicts = findRenameConflicts(gitRenames, nameRenames);
            if (conflicts.length)
                return {
                    exitCode: 1,
                    output: conflicts
                        .map(
                            ({ file, oldPath }) =>
                                `${file}: rename sources disagree; git found ${gitRenames.get(file)}, path mapping found ${oldPath}`
                        )
                        .join('\n')
                };
            const detected = buildRenamedFrom({
                scanned,
                base,
                renames: mergeRenames(gitRenames, nameRenames)
            });
            const missingMappings = Object.entries(detected)
                .filter(([file, oldFile]) => inventory.renamedFrom?.[file] !== oldFile)
                .map(([file, oldFile]) => ({
                    file,
                    expected: oldFile,
                    found: inventory.renamedFrom?.[file] ?? 'missing',
                    reason: 'renamedFrom differs from detected rename sources'
                }));
            const violations = [...checkFrontier({ scanned, inventory, base }), ...missingMappings];
            if (violations.length)
                return { exitCode: 1, output: violations.map(formatViolation).join('\n') };
        }
        const violations = checkFrontier({ scanned, inventory, base });
        if (violations.length)
            return { exitCode: 1, output: violations.map(formatViolation).join('\n') };
        const baseNote =
            base === undefined && baseInventory !== null
                ? '; base inventory absent (G-FAC-T1 birth commit)'
                : '';
        return {
            exitCode: 0,
            output: `G-FAC-T1 clean: ${scanned.size} files / ${[...scanned.values()].reduce((sum, count) => sum + count, 0)} occurrences${baseNote}`
        };
    } catch (error) {
        return { exitCode: 1, output: error instanceof Error ? error.message : String(error) };
    }
}

/** Builds the inventory mapping from git rename pairs and measured paths. */
export function buildRenamedFrom({
    scanned,
    base,
    renames
}: {
    readonly scanned: ReadonlyMap<string, number>;
    readonly base: FrontierInventory;
    /** Maps new path to old path, as reported by git. */
    readonly renames: ReadonlyMap<string, string>;
}): Readonly<Record<string, string>> {
    return Object.fromEntries(
        [...renames]
            .filter(
                ([newPath, oldPath]) =>
                    scanned.has(newPath) &&
                    base.files[oldPath] !== undefined &&
                    base.files[newPath] === undefined
            )
            .sort(([a], [b]) => a.localeCompare(b))
    );
}

/** Derives a moved path by reversing the repository's segment mapping. */
export function buildNameRenames(
    scanned: ReadonlyMap<string, number>,
    base: FrontierInventory
): ReadonlyMap<string, string> {
    const from = ['venues', 'Venues', 'Venue', 'VENUE', 'venue'];
    const to = [
        `${PARTS[0]}ies`,
        `${PARTS[0][0]?.toUpperCase()}${PARTS[0].slice(1)}ies`,
        `${PARTS[0][0]?.toUpperCase()}${PARTS[0].slice(1)}y`,
        `${PARTS[0].toUpperCase()}Y`,
        `${PARTS[0]}y`
    ];
    const result = new Map<string, string>();
    for (const newPath of scanned.keys()) {
        if (base.files[newPath] !== undefined) continue;
        const oldPath = newPath
            .split('/')
            .map((segment) => {
                let mapped = segment;
                for (const [index, oldPart] of from.entries()) {
                    const newPart = to[index];
                    if (newPart) mapped = mapped.replaceAll(oldPart, newPart);
                }
                return mapped;
            })
            .join('/');
        if (base.files[oldPath] !== undefined && !scanned.has(oldPath))
            result.set(newPath, oldPath);
    }
    return result;
}

/** Finds paths for which Git and the path mapping propose different old paths. */
export function findRenameConflicts(
    gitRenames: ReadonlyMap<string, string>,
    nameRenames: ReadonlyMap<string, string>
): readonly { readonly file: string; readonly oldPath: string }[] {
    return [...nameRenames].flatMap(([file, oldPath]) => {
        const gitOldPath = gitRenames.get(file);
        return gitOldPath !== undefined && gitOldPath !== oldPath ? [{ file, oldPath }] : [];
    });
}

function mergeRenames(
    gitRenames: ReadonlyMap<string, string>,
    nameRenames: ReadonlyMap<string, string>
): ReadonlyMap<string, string> {
    return new Map([...gitRenames, ...nameRenames]);
}

function readGitRenames(root: string): ReadonlyMap<string, string> {
    const base = process.env.CI_BASELINE_SHA ?? 'origin/staging';
    const output = execFileSync(
        'git',
        ['diff', '-M', '--name-status', '--diff-filter=R', `${base}...HEAD`],
        { cwd: root }
    ).toString();
    return new Map(
        output
            .split('\n')
            .filter(Boolean)
            .flatMap((line) => {
                const [status, oldPath, newPath] = line.split('\t');
                return status?.startsWith('R') && oldPath && newPath ? [[newPath, oldPath]] : [];
            })
    );
}

export function formatViolation(item: FrontierViolation): string {
    return `${item.file}: ${item.reason}; expected ${item.expected}, found ${item.found}`;
}

function stringifyInventory(inventory: FrontierInventory): string {
    return `${JSON.stringify(inventory, null, 4).replace(new RegExp(HIT.source, 'g'), (match) => {
        const yIndex = match.indexOf('y') >= 0 ? match.indexOf('y') : match.indexOf('Y');
        const index = yIndex >= 0 ? yIndex : match.toUpperCase().indexOf('IES');
        const character = match[index];
        const escaped =
            character === 'Y'
                ? '\\u0059'
                : character === 'I'
                  ? '\\u0049'
                  : character === 'i'
                    ? '\\u0069'
                    : '\\u0079';
        return `${match.slice(0, index)}${escaped}${match.slice(index + 1)}`;
    })}\n`;
}

/** CLI entry point for G-FAC-T1. */
export function main(): void {
    const result = run({});
    process.stdout.write(`${result.output}\n`);
    process.exitCode = result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
