import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const INVENTORY_PATH = 'scripts/guards/business-lines-single-validator-inventory.json';
export const MIN_SCANNED_FILES = 100;
const SOURCE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const ROOTS = ['apps', 'packages', 'scripts'] as const;
const SCAN_EXEMPT = 'packages/schemas/src/catalog/';
type FunctionName = 'validateBusinessLines' | 'resolveBusinessLineOptions';
type Inventory = Readonly<
    Record<FunctionName, readonly { readonly file: string; readonly count: number }[]>
>;

function filesUnder(root: string, relative: string): string[] {
    const absolute = join(root, relative);
    try {
        return readdirSync(absolute).flatMap((name) => {
            const path = join(absolute, name);
            const repoPath = `${relative}/${name}`;
            if (
                name === 'node_modules' ||
                name === 'dist' ||
                name === 'build' ||
                name.startsWith('.') ||
                name === '__tests__' ||
                name === 'test'
            )
                return [];
            if (statSync(path).isDirectory()) return filesUnder(root, repoPath);
            return SOURCE.test(name) && !/\.(?:test|spec)\./.test(name) ? [repoPath] : [];
        });
    } catch {
        return [];
    }
}

/**
 * Runs G-FAC-09: every business-line validation goes through `validateBusinessLines`,
 * with the exact caller counts pinned by the inventory and a floor of scanned files.
 *
 * @param args.root - Repository root; defaults to the current directory.
 * @param args.inventory - Expected callers per file; defaults to the committed inventory.
 * @param args.minScannedFiles - Floor of scanned source files, so an empty scan cannot pass.
 * @returns The exit code and the report text.
 */
export function run(
    args: {
        readonly root?: string;
        readonly inventory?: Inventory;
        readonly minScannedFiles?: number;
    } = {}
) {
    const root = resolve(args.root ?? process.cwd());
    let inventory: Inventory;
    try {
        inventory =
            args.inventory ??
            (JSON.parse(readFileSync(join(root, INVENTORY_PATH), 'utf8')) as Inventory);
    } catch {
        return {
            exitCode: 1 as const,
            output: 'FAIL GUARD:G-FAC-09 inventory: cannot load inventory'
        };
    }
    const files = ROOTS.flatMap((dir) => filesUnder(root, dir));
    const minFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minFiles)
        return {
            exitCode: 1 as const,
            output: `FAIL GUARD:G-FAC-09 scan: only ${files.length} files scanned; expected at least ${minFiles}`
        };

    const errors: string[] = [];
    for (const name of ['validateBusinessLines', 'resolveBusinessLineOptions'] as const) {
        const expected = new Map(inventory[name].map((row) => [row.file, row.count]));
        const actual = new Map<string, number>();
        for (const file of files) {
            if (file.startsWith(SCAN_EXEMPT)) continue;
            const source = readFileSync(join(root, file), 'utf8');
            const count = [...source.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))].length;
            if (count > 0) actual.set(file, count);
        }
        for (const [file, count] of actual) {
            if (expected.get(file) !== count)
                errors.push(
                    `FAIL GUARD:G-FAC-09 caller: ${file} has ${count} ${name} call(s), inventory expects ${expected.get(file) ?? 0}`
                );
        }
        for (const [file, count] of expected) {
            if ((actual.get(file) ?? 0) !== count)
                errors.push(
                    `FAIL GUARD:G-FAC-09 inventory: ${file} declares ${count} ${name} call(s), found ${actual.get(file) ?? 0}`
                );
        }
    }
    for (const file of files) {
        if (file.startsWith(SCAN_EXEMPT)) continue;
        const source = readFileSync(join(root, file), 'utf8');
        if (/businessLines\s*\.\s*length\s*>/.test(source))
            errors.push(
                `FAIL GUARD:G-FAC-09 maximum: ${file} compares businessLines.length against a maximum`
            );
        const unrelatedAllowedChecks = source
            .replace('allowed.includes(validated.status)', '')
            .replace('allowed.includes(listing.publicationStatus as (typeof allowed)[number])', '');
        if (/allowed\s*\.\s*includes\s*\(/.test(unrelatedAllowedChecks))
            errors.push(
                `FAIL GUARD:G-FAC-09 options: ${file} filters business-line options with allowed.includes`
            );
    }
    return errors.length
        ? { exitCode: 1 as const, output: errors.join('\n') }
        : {
              exitCode: 0 as const,
              output: `OK GUARD:G-FAC-09: ${files.length} production files scanned; callers match inventory`
          };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
