/**
 * Static TEST:V6:18 guard (AC:V6:32, HOS-1641): no file reads the six old listing
 * columns (`lifecycle_state`, `visibility`, `moderation_state` of the three listing
 * tables; `owner_suspended`, `plan_restricted`, `billing_unpublished_at` of
 * `accommodations`). Scope: git-listed `.ts/.tsx/.astro/.mjs/.cjs` under `apps/`,
 * `packages/` and `scripts/`, plus the seed JSON of `packages/seed/src/data/{accommodation,gastronomy}/`;
 * never `packages/db/src/migrations/**` nor Markdown; comments are ignored. Rules:
 * (a) `acc-only`: an accommodation-only name, anywhere; (b) `drizzle`:
 * `<listing table>.<old column>`; (c) `sql`: an SQL string literal naming a listing
 * table and an old column; (d) `listing-file`: an old name in a file under a listing
 * path segment (in a seed fixture, only top-level keys: `media[].moderationState`
 * is the photo's own). Exclusions (closed list, `scripts/guards/listing-old-columns.json`):
 * sub-entity file-name patterns and counted sub-entity references switch off (d)
 * only; single files switch off every rule; an exclusion that suppresses nothing
 * fails. Why counted references exist (Coord-427): the most important listing
 * files (the model, the service, the routes) also name sub-entity columns (the
 * owner `users` relation, a photo, an amenity); excluding them whole would blind
 * rule (d) there, so each such file allows exactly its counted mentions and one
 * more is a violation. Exit 0 clean; exit 1 on a violation or a broken/empty scan.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = ['acc-only', 'drizzle', 'sql', 'listing-file', 'dead-exclusion'] as const;
/** The rule a violation broke. */
export type ListingOldColumnRule = (typeof RULES)[number];

/** One forbidden read of an old listing column. */
export interface ListingOldColumnViolation {
    readonly file: string;
    readonly line: number;
    readonly rule: ListingOldColumnRule;
    readonly name: string;
}

/** A sub-entity file-name fragment whose table keeps its own columns (R6). */
export interface SubEntityFilePattern {
    readonly pattern: string;
    readonly table: string;
    readonly reason: string;
}

/** One file excluded from every rule, with the reason it is not a live reader. */
export interface FileExclusion {
    readonly file: string;
    readonly reason: string;
}

/** Exactly `count` rule (d) mentions of `name` in `file`, all of `table` (more fails; fewer is dead). */
export interface SubEntityReference {
    readonly file: string;
    readonly name: string;
    readonly count: number;
    readonly table: string;
    readonly reason: string;
}

/** The closed exclusion list of `scripts/guards/listing-old-columns.json`. */
export interface ListingOldColumnExclusions {
    readonly subEntityFilePatterns: readonly SubEntityFilePattern[];
    readonly subEntityReferences: readonly SubEntityReference[];
    readonly files: readonly FileExclusion[];
}

/** One scanned input: a repo-relative path and its contents. */
export interface ScannedFile {
    readonly file: string;
    readonly content: string;
}

/** Path of the exclusion list, as reported by a dead exclusion. */
export const EXCLUSIONS_FILE = 'scripts/guards/listing-old-columns.json';

const ACC_ONLY_NAMES = 'ownerSuspended planRestricted billingUnpublishedAt'.split(' ');
const ACC_ONLY_SNAKE = 'owner_suspended plan_restricted billing_unpublished_at'.split(' ');
const LISTING_FILE_NAMES = 'lifecycleState visibility moderationState'.split(' ');
const LISTING_FILE_SNAKE = 'lifecycle_state moderation_state'.split(' ');
const ACC_ONLY_PATTERN = new RegExp(
    `\\b(${[...ACC_ONLY_NAMES, ...ACC_ONLY_SNAKE].join('|')})\\b`,
    'g'
);
const DRIZZLE_PATTERN =
    /\b(?:accommodations|gastronomies|experiences)\s*\.\s*(lifecycleState|visibility|moderationState)\b/g;
const SQL_TABLE_PATTERN = /\b(?:accommodations|gastronomies|experiences)\b/;
const SQL_KEYWORD_PATTERN =
    /\b(?:SELECT|UPDATE|INSERT|DELETE|FROM|WHERE|JOIN|SET)\b|\bselect\b[\s\S]*\bfrom\b|\bupdate\b[\s\S]*\bset\b|\binsert\s+into\b|\bdelete\s+from\b/;
const IMPORT_SPECIFIER =
    /\b(?:from|import)\s*(['"])[^'"\n]*\1|\bimport\s*\(\s*(['"])[^'"\n]*\2\s*\)/g;
const SQL_COLUMN_PATTERN = /\b(lifecycle_state|moderation_state|visibility)\b/g;
const LISTING_NAME_PATTERN = new RegExp(
    `\\b(${[...LISTING_FILE_NAMES, ...LISTING_FILE_SNAKE].join('|')})\\b`,
    'g'
);
const LISTING_SEGMENT =
    /(?:^|\/)(?:accommodations?|gastronomy|gastronomies|experiences?|listings?|host|properties|propiedades|comercio)(?:\/|$)/;
const SOURCE_EXTENSION = /\.(?:ts|tsx|astro|mjs|cjs)$/;
const FIXTURE_JSON = /^packages\/seed\/src\/data\/(?:accommodation|gastronomy)\/.+\.json$/;
const MIGRATIONS_DIR = /^packages\/db\/src\/migrations\//;

/** Removes line and block comments while preserving source line positions. */
function stripComments(source: string): string {
    const output: string[] = [];
    let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' | 'html' = 'code';
    let escaped = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index] ?? '';
        const next = source[index + 1] ?? '';

        if (state === 'line') {
            if (char === '\n') {
                output.push('\n');
                state = 'code';
            } else {
                output.push(' ');
            }
            continue;
        }
        if (state === 'html') {
            if (char === '-' && next === '-' && source[index + 2] === '>') {
                output.push('   ');
                index += 2;
                state = 'code';
            } else {
                output.push(char === '\n' ? '\n' : ' ');
            }
            continue;
        }
        if (state === 'block') {
            if (char === '*' && next === '/') {
                output.push('  ');
                index += 1;
                state = 'code';
            } else {
                output.push(char === '\n' ? '\n' : ' ');
            }
            continue;
        }
        if (state !== 'code') {
            output.push(char);
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            ) {
                state = 'code';
            }
            continue;
        }

        if (char === '<' && source.slice(index, index + 4) === '<!--') {
            output.push('    ');
            index += 3;
            state = 'html';
        } else if (char === '/' && next === '/') {
            output.push('  ');
            index += 1;
            state = 'line';
        } else if (char === '/' && next === '*') {
            output.push('  ');
            index += 1;
            state = 'block';
        } else {
            output.push(char);
            if (char === "'") state = 'single';
            else if (char === '"') state = 'double';
            else if (char === '`') state = 'template';
        }
    }

    return output.join('');
}

interface RawHit {
    readonly line: number;
    readonly rule: Exclude<ListingOldColumnRule, 'dead-exclusion'>;
    readonly name: string;
}

function lineAt(source: string, offset: number): number {
    let line = 1;
    for (let index = 0; index < offset; index += 1) if (source[index] === '\n') line += 1;
    return line;
}

function matchAll(code: string, pattern: RegExp, rule: RawHit['rule']): RawHit[] {
    return [...code.matchAll(new RegExp(pattern.source, 'g'))].map((match) => ({
        line: lineAt(code, match.index ?? 0),
        rule,
        name: match[1] ?? match[0]
    }));
}

/** Returns every string literal of comment-free code with its start offset. */
function stringLiterals(
    code: string
): readonly { readonly text: string; readonly start: number }[] {
    const literals: { text: string; start: number }[] = [];
    for (let index = 0; index < code.length; index += 1) {
        const quote = code[index];
        if (quote !== "'" && quote !== '"' && quote !== '`') continue;
        let end = index + 1;
        while (end < code.length && code[end] !== quote) end += code[end] === '\\' ? 2 : 1;
        literals.push({ text: code.slice(index, end + 1), start: index });
        index = end;
    }
    return literals;
}

function sqlHits(code: string): RawHit[] {
    const hits: RawHit[] = [];
    for (const { text, start } of stringLiterals(code)) {
        if (!SQL_TABLE_PATTERN.test(text) || !SQL_KEYWORD_PATTERN.test(text)) continue;
        for (const match of text.matchAll(new RegExp(SQL_COLUMN_PATTERN.source, 'g'))) {
            hits.push({
                line: lineAt(code, start + (match.index ?? 0)),
                rule: 'sql',
                name: match[1] ?? ''
            });
        }
    }
    return hits;
}

/** Lists the keys of the top-level object of a JSON document with their lines. */
function topLevelJsonKeys(
    source: string
): readonly { readonly key: string; readonly line: number }[] {
    const keys: { key: string; line: number }[] = [];
    let depth = 0;
    let line = 1;
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (char === '\n') line += 1;
        else if (char === '{' || char === '[') depth += 1;
        else if (char === '}' || char === ']') depth -= 1;
        else if (char === '"') {
            let end = index + 1;
            while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
            const rest = source.slice(end + 1).match(/^\s*:/);
            if (depth === 1 && rest) keys.push({ key: source.slice(index + 1, end), line });
            index = end;
        }
    }
    return keys;
}

function hitsFor(input: ScannedFile): RawHit[] {
    if (input.file.endsWith('.json')) {
        const listingNames = new Set<string>([...LISTING_FILE_NAMES, ...LISTING_FILE_SNAKE]);
        return [
            ...matchAll(input.content, ACC_ONLY_PATTERN, 'acc-only'),
            ...topLevelJsonKeys(input.content)
                .filter(({ key }) => listingNames.has(key))
                .map(({ key, line }) => ({ line, rule: 'listing-file' as const, name: key }))
        ];
    }
    // Module specifiers are paths, not reads (`from '../listing-faq-visibility'`).
    const code = stripComments(input.content).replace(IMPORT_SPECIFIER, (match) =>
        match.replace(/[^\n]/g, ' ')
    );
    return [
        ...matchAll(code, ACC_ONLY_PATTERN, 'acc-only'),
        ...matchAll(code, DRIZZLE_PATTERN, 'drizzle'),
        ...sqlHits(code),
        ...(LISTING_SEGMENT.test(input.file)
            ? matchAll(code, LISTING_NAME_PATTERN, 'listing-file')
            : [])
    ];
}

/** One hit per line, rule and name: a repeated name on a line is one read. */
function dedupe(hits: readonly RawHit[]): RawHit[] {
    const seen = new Set<string>();
    return hits.filter((hit) => {
        const key = `${hit.line}\0${hit.rule}\0${hit.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function baseName(file: string): string {
    return file.slice(file.lastIndexOf('/') + 1);
}

/**
 * Scans in-memory inputs and reports, besides the violations, how many files
 * each exclusion switched off (the basis of the dead-exclusion check).
 */
export function scanListingOldColumns(args: {
    readonly files: readonly ScannedFile[];
    readonly exclusions: ListingOldColumnExclusions;
}): {
    readonly violations: readonly ListingOldColumnViolation[];
    readonly suppressedFiles: ReadonlyMap<string, number>;
} {
    const { files, exclusions } = args;
    const violations: ListingOldColumnViolation[] = [];
    const suppressedFiles = new Map<string, number>();
    const excludedFiles = new Map(exclusions.files.map((entry) => [entry.file, entry]));
    const bump = (key: string) => suppressedFiles.set(key, (suppressedFiles.get(key) ?? 0) + 1);

    const references = new Map(
        exclusions.subEntityReferences.map((entry) => [`${entry.file}\0${entry.name}`, entry])
    );
    const foundReferences = new Map<string, number>();

    for (const input of files) {
        const hits = dedupe(hitsFor(input));
        if (hits.length === 0) continue;
        if (excludedFiles.has(input.file)) {
            bump(`file:${input.file}`);
            continue;
        }
        const lowerName = baseName(input.file).toLowerCase();
        const pattern = exclusions.subEntityFilePatterns.find((entry) =>
            lowerName.includes(entry.pattern.toLowerCase())
        );
        const kept = pattern ? hits.filter((hit) => hit.rule !== 'listing-file') : hits;
        if (pattern && kept.length < hits.length) bump(`pattern:${pattern.pattern}`);
        const counted = new Map<string, number>();
        for (const hit of kept) {
            if (hit.rule === 'listing-file')
                counted.set(hit.name, (counted.get(hit.name) ?? 0) + 1);
        }
        for (const [name, found] of counted) {
            const key = `${input.file}\0${name}`;
            if (references.has(key)) foundReferences.set(key, found);
        }
        for (const hit of kept) {
            const reference = references.get(`${input.file}\0${hit.name}`);
            const isCounted = hit.rule === 'listing-file' && reference !== undefined;
            if (isCounted && (counted.get(hit.name) ?? 0) <= reference.count) continue;
            violations.push({ file: input.file, ...hit });
        }
    }

    for (const entry of exclusions.subEntityFilePatterns) {
        if (!suppressedFiles.has(`pattern:${entry.pattern}`)) {
            violations.push({
                file: EXCLUSIONS_FILE,
                line: 0,
                rule: 'dead-exclusion',
                name: entry.pattern
            });
        }
    }
    for (const entry of exclusions.subEntityReferences) {
        const found = foundReferences.get(`${entry.file}\0${entry.name}`) ?? 0;
        if (found < entry.count) {
            violations.push({
                file: EXCLUSIONS_FILE,
                line: 0,
                rule: 'dead-exclusion',
                name: `${entry.file} ${entry.name} counts ${entry.count}, found ${found}`
            });
        }
    }
    for (const entry of exclusions.files) {
        if (!suppressedFiles.has(`file:${entry.file}`)) {
            violations.push({
                file: EXCLUSIONS_FILE,
                line: 0,
                rule: 'dead-exclusion',
                name: entry.file
            });
        }
    }

    violations.sort((left, right) =>
        left.file === right.file ? left.line - right.line : left.file.localeCompare(right.file)
    );
    return { violations, suppressedFiles };
}

/**
 * Finds every read of the six old listing columns in pure in-memory inputs.
 *
 * @param args.files - Repo-relative file names and their contents.
 * @param args.exclusions - The closed exclusion list.
 * @returns Each violation with its file, line, rule and matched name.
 */
export function findListingOldColumnReads(args: {
    readonly files: readonly ScannedFile[];
    readonly exclusions: ListingOldColumnExclusions;
}): readonly ListingOldColumnViolation[] {
    return scanListingOldColumns(args).violations;
}

/**
 * Whether a repo-relative path is inside the guard's scope.
 * @param args.file - Repo-relative path. @returns `{ scanned }`.
 */
export function isScannedPath(args: { readonly file: string }): { readonly scanned: boolean } {
    const { file } = args;
    if (MIGRATIONS_DIR.test(file)) return { scanned: false };
    if (FIXTURE_JSON.test(file)) return { scanned: true };
    return { scanned: /^(?:apps|packages|scripts)\//.test(file) && SOURCE_EXTENSION.test(file) };
}

function readExclusions(root: string): ListingOldColumnExclusions {
    const parsed = JSON.parse(
        readFileSync(join(root, EXCLUSIONS_FILE), 'utf8')
    ) as Partial<ListingOldColumnExclusions>;
    if (
        !Array.isArray(parsed.subEntityFilePatterns) ||
        !Array.isArray(parsed.subEntityReferences) ||
        !Array.isArray(parsed.files)
    ) {
        throw new Error(
            `${EXCLUSIONS_FILE} must hold "subEntityFilePatterns", "subEntityReferences" and "files" arrays`
        );
    }
    return {
        subEntityFilePatterns: parsed.subEntityFilePatterns,
        subEntityReferences: parsed.subEntityReferences,
        files: parsed.files
    };
}

function listScannedFiles(root: string): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => isScannedPath({ file }).scanned);
}

/** Runs the repository scan and returns a report suitable for the CLI or tests. */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listScannedFiles(root);
    if (files.length === 0) {
        return {
            exitCode: 1,
            output: 'ERROR: scanned 0 files. The root is wrong or the scan is broken.'
        };
    }
    const exclusions = readExclusions(root);
    const inputs = files.map((file) => ({ file, content: readFileSync(join(root, file), 'utf8') }));
    const { violations, suppressedFiles } = scanListingOldColumns({ files: inputs, exclusions });
    if (violations.length > 0) {
        return {
            exitCode: 1,
            output: [
                `FAIL: ${violations.length} read(s) of the six old listing columns (TEST:V6:18):`,
                ...violations.map(
                    ({ file, line, rule, name }) => `  ${file}:${line} [${rule}] ${name}`
                )
            ].join('\n')
        };
    }
    const patternCounts = exclusions.subEntityFilePatterns.map(
        ({ pattern }) => `${pattern}=${suppressedFiles.get(`pattern:${pattern}`) ?? 0}`
    );
    return {
        exitCode: 0,
        output: [
            `OK: no file reads the six old listing columns across ${files.length} file(s).`,
            `  sub-entity patterns (files switched off): ${patternCounts.join(', ')}`,
            `  counted sub-entity references: ${exclusions.subEntityReferences.length}`,
            `  single-file exclusions: ${exclusions.files.length}`
        ].join('\n')
    };
}

/**
 * CLI entry point: prints the report and returns its exit code.
 * @param args.root - Repository root (defaults to this script's parent). @returns `{ exitCode }`.
 */
export function main(args: { readonly root?: string } = {}): { readonly exitCode: number } {
    try {
        const result = run({ root: args.root });
        (result.exitCode === 0 ? console.log : console.error)(result.output);
        return { exitCode: result.exitCode };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`ERROR: scan failed: ${reason}`);
        return { exitCode: 1 };
    }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main().exitCode);
}
