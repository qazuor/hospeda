import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanBusinessLineDecisions } from './business-line-decisions-scan';

/**
 * GUARD:G-FAC-03 checks TypeScript source in app/package projects. It cannot
 * detect a line copied into an untyped `string`, Astro templates (`.astro`),
 * reflection/dynamic property names, or decisions made from non-catalog text.
 */

export const INVENTORY_PATH = 'scripts/guards/business-lines-reader-inventory.json';
export const MIN_SCANNED_FILES = 1000;
const SPEC_REF = /\.md:\d+/;
type ReaderRow = { file: string; symbol: string; count: number; category: string; spec: string };
type ImportRow = { file: string; category: string; spec: string };
type Inventory = { readers: ReaderRow[]; imports: ImportRow[] };
type Args = { root?: string; inventoryPath?: string; minScannedFiles?: number };

export function run(args: Args = {}): { exitCode: number; output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    let inventory: Inventory;
    try {
        inventory = JSON.parse(
            readFileSync(args.inventoryPath ?? join(root, INVENTORY_PATH), 'utf8')
        ) as Inventory;
    } catch (error) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-03 inventory cannot be read: ${(error as Error).message}`
        };
    }
    const errors: string[] = [];
    if (!Array.isArray(inventory.readers) || !Array.isArray(inventory.imports))
        return {
            exitCode: 1,
            output: 'FAIL GUARD:G-FAC-03 inventory must contain readers and imports arrays'
        };
    for (const [kind, rows] of [
        ['reader', inventory.readers],
        ['import', inventory.imports]
    ] as const) {
        const keys = new Set<string>();
        rows.forEach((row) => {
            const key = `${row.file}|${'symbol' in row ? row.symbol : ''}`;
            if (keys.has(key)) errors.push(`duplicate ${kind} inventory row ${key}`);
            keys.add(key);
            if (typeof row.spec !== 'string' || !SPEC_REF.test(row.spec))
                errors.push(`${kind} row ${key} has no spec reference`);
        });
    }
    const scan = scanBusinessLineDecisions(root);
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (scan.scannedFiles < minimum)
        errors.push(`scan covered ${scan.scannedFiles} files; expected at least ${minimum}`);
    for (const hit of scan.decisions) errors.push(`${hit.file}:${hit.line} ${hit.reason}`);
    const excluded = (file: string) =>
        file.startsWith('packages/verticals/src/listing-sections/') ||
        file.startsWith('packages/db/src/schemas/') ||
        file.endsWith('/types.ts');
    const actual = new Map<string, number>();
    for (const hit of scan.readers)
        if (!excluded(hit.file)) {
            const key = `${hit.file}|${hit.symbol}`;
            actual.set(key, (actual.get(key) ?? 0) + 1);
        }
    for (const [key, count] of actual) {
        const row = inventory.readers.find(
            (candidate) => `${candidate.file}|${candidate.symbol}` === key
        );
        if (!row) errors.push(`reader outside inventory ${key} (${count} sites)`);
        else if (row.count !== count)
            errors.push(`reader count mismatch ${key}: inventory ${row.count}, found ${count}`);
    }
    for (const row of inventory.readers) {
        const key = `${row.file}|${row.symbol}`;
        const count = actual.get(key) ?? 0;
        if (count !== row.count)
            errors.push(`stale reader row ${key}: inventory ${row.count}, found ${count}`);
    }
    if (actual.size === 0) errors.push('scan found zero businessLines readers');
    const imports = [...new Set(scan.imports)].sort();
    const allowed = new Set(inventory.imports.map((row) => row.file));
    for (const file of imports)
        if (!allowed.has(file)) errors.push(`catalog value import outside allowlist: ${file}`);
    for (const file of allowed)
        if (!imports.includes(file)) errors.push(`stale import allowlist row: ${file}`);
    if (errors.length)
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-FAC-03:\n${errors.map((error) => `- ${error}`).join('\n')}`
        };
    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-03: ${scan.scannedFiles} production files scanned; ${actual.size} reader symbols and ${imports.length} catalog importers inventoried`
    };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    console.log(result.output);
    process.exitCode = result.exitCode;
}
