#!/usr/bin/env tsx
/**
 * check-mergeable-contact-info.ts
 *
 * `BaseModelImpl.mergeableJsonbColumns` decides whether `update({ column })`
 * MERGES a JSONB column against the stored row (PostgreSQL `||`) or REPLACES
 * it wholesale. The default is replace. A model whose table has a
 * `contact_info` JSONB column and does NOT declare `contactInfo` in
 * `mergeableJsonbColumns` loses, on every partial PATCH, every contact field
 * the caller's payload did not include.
 *
 * Measured against `origin/staging` before this guard existed: 4 of 7 tables
 * carrying a `contact_info` column (`event_organizers`, `post_sponsors`,
 * `gastronomies`, `experiences`) shipped with the dangerous default while
 * `accommodations`, `users` and `partners` had already opted in.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * 1. Every `contact_info` JSONB column is discovered by SCANNING the Drizzle
 *    schema files under `packages/db/src/schemas/**` — never from a
 *    hardcoded list of table names. A table born tomorrow with a
 *    `contact_info` column is caught the same way the seven existing ones
 *    are.
 * 2. Each such table must be owned by at least one model file (a
 *    `protected table = <tableVar>;` assignment under
 *    `packages/db/src/models/**`). No owning model is a FAILURE, not a
 *    silent skip — a `contact_info` column with no model attached is exactly
 *    the kind of gap this guard exists to surface. When SEVERAL model files
 *    claim the same table, EVERY one of them must declare the column
 *    mergeable: the verdict must not depend on which file the directory walk
 *    happened to reach first.
 * 3. That model must declare `mergeableJsonbColumns` as an OVERRIDDEN,
 *    `readonly` class property (`protected override readonly
 *    mergeableJsonbColumns = [...] as const;`) whose array literal contains
 *    the exact quoted item `'contactInfo'`.
 *
 * This guard PROHIBITS the dangerous state (a `contact_info` column reachable
 * through a model that does not declare it mergeable) — it does not merely
 * confirm the safe state exists elsewhere, which would fail open the moment
 * a declaration is silently removed.
 *
 * ---------------------------------------------------------------------------
 * HOW IT AVOIDS FAILING OPEN
 * ---------------------------------------------------------------------------
 *
 * Every match below runs against a COMMENT-STRIPPED copy of the source
 * ({@link stripComments}), and only within the body of the class that actually
 * owns the table ({@link findOwningClassBody}). Both are load-bearing, and
 * neither is a theoretical concern — an earlier revision of this guard matched
 * raw file text and reported "All checks passed" on all three of:
 *
 *   - the declaration commented OUT from inside the array
 *     (`mergeableJsonbColumns = [ /* 'contactInfo' *\/ ] as const;`), the most
 *     natural way to disable an entry;
 *   - the declaration existing ONLY inside a JSDoc block, which is easy to
 *     produce by accident because these models carry long JSDoc quoting the
 *     very line the guard was looking for;
 *   - a second model file claiming the same table, where the verdict flipped
 *     with the alphabetical order of the filenames.
 *
 * The array literal is read by bracket matching rather than a lazy regex, so a
 * JSDoc example or a neighbouring property cannot be mistaken for the
 * declaration, and a `[...SHARED]` spread is resolved against a module-level
 * `const` in the same file. A spread this guard cannot resolve statically is
 * reported as a violation asking for an explicit literal — never passed over.
 *
 * WHAT IT DOES NOT PROVE
 *   - That `mergeableJsonbColumns` is *correct* for OTHER JSONB columns on
 *     the same table (e.g. `socialNetworks`, `seo`). Widening the merge set
 *     beyond `contactInfo` is a product decision, not something this guard
 *     opines on.
 *   - Runtime behaviour of the `||` merge itself — that is
 *     `packages/db/test/base/jsonb-merge.test.ts`'s job.
 *   - That a declaration INHERITED from an intermediate base class (rather
 *     than written in the owning class itself) covers `contactInfo`. Only the
 *     owning class body is read, so such a model is reported as missing the
 *     declaration. No model in this repo is shaped that way today.
 *   - Anything about a regex literal that contains `//` or `/*`.
 *     {@link stripComments} tracks strings and template literals but not
 *     regex literals; a regex holding a comment opener would confuse it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

const SCHEMA_DIR = 'packages/db/src/schemas';
const MODELS_DIR = 'packages/db/src/models';

/** Anchored: a Drizzle table export, e.g. `export const gastronomies = pgTable(`. */
const TABLE_EXPORT_RE = /^export const (\w+) = pgTable\(/gm;

/**
 * Anchored: a `contactInfo: jsonb('contact_info')` column definition line
 * (leading whitespace only). Always applied to comment-stripped source, so a
 * commented-out column cannot satisfy it.
 */
const CONTACT_INFO_COLUMN_RE = /^\s*contactInfo:\s*jsonb\('contact_info'\)/m;

/**
 * The HEAD of the `mergeableJsonbColumns` class-property declaration, up to
 * and including the `=`. The value itself is read by bracket matching from
 * there, not by this regex — a lazy `[\s\S]*?\]` tail would stop at the first
 * `]` it found, which is how a JSDoc example above the real declaration used
 * to shadow it.
 */
const MERGEABLE_DECL_HEAD_RE =
    /protected\s+(?:override\s+)?readonly\s+mergeableJsonbColumns\s*(?::\s*readonly\s+string\[\]\s*)?=\s*/g;

/** A quoted `'contactInfo'` / `"contactInfo"` array item. */
const CONTACT_INFO_ITEM_RE = /(['"])contactInfo\1/;

/** `...IDENTIFIER` inside an array literal. */
const SPREAD_RE = /\.\.\.\s*([A-Za-z_$][\w$]*)/g;

/** A class declaration head, e.g. `export class GastronomyModel extends ... {`. */
const CLASS_HEAD_RE = /\bclass\s+([A-Za-z_$][\w$]*)/g;

export interface ContactInfoTable {
    readonly tableVar: string;
    readonly schemaFile: string;
}

export interface Violation {
    readonly table: string;
    readonly schemaFile: string;
    readonly reason: string;
    /** Remediation text for THIS reason — never a generic one. */
    readonly fix: string;
    readonly modelFile?: string;
}

/**
 * The three possible verdicts for one class body. `unresolved` is deliberately
 * distinct from `absent`: "I cannot tell" must not be reported as "it is
 * declared", and it must not be reported as "somebody deleted it" either.
 */
export type MergeableVerdict =
    | { readonly kind: 'declared' }
    | { readonly kind: 'absent' }
    | { readonly kind: 'unresolved'; readonly detail: string };

// ---------------------------------------------------------------------------
// Source primitives
// ---------------------------------------------------------------------------

/**
 * Replace every `//` and `/* *\/` comment with equivalent whitespace, leaving
 * string and template literals untouched so `'contactInfo'` and
 * `jsonb('contact_info')` still match.
 *
 * Whitespace rather than deletion: offsets and line boundaries are preserved,
 * so the `^\s*`-anchored regexes above keep meaning what they meant on the raw
 * file.
 */
export function stripComments(source: string): string {
    let out = '';
    let i = 0;
    const n = source.length;

    while (i < n) {
        const ch = source[i] as string;
        const next = source[i + 1];

        if (ch === '/' && next === '/') {
            while (i < n && source[i] !== '\n') {
                out += ' ';
                i++;
            }
            continue;
        }

        if (ch === '/' && next === '*') {
            out += '  ';
            i += 2;
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
                out += source[i] === '\n' ? '\n' : ' ';
                i++;
            }
            if (i < n) {
                out += '  ';
                i += 2;
            }
            continue;
        }

        if (ch === "'" || ch === '"' || ch === '`') {
            out += ch;
            i++;
            while (i < n) {
                if (source[i] === '\\') {
                    out += source[i] as string;
                    out += source[i + 1] ?? '';
                    i += 2;
                    continue;
                }
                out += source[i] as string;
                const closed = source[i] === ch;
                i++;
                if (closed) break;
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

/**
 * Index of the delimiter closing the one at `openIndex`, or `-1`.
 * String literals are skipped, so a `'}'` inside a string cannot unbalance it.
 * Expects comment-stripped input.
 */
export function findMatchingDelimiter(
    source: string,
    openIndex: number,
    open: string,
    close: string
): number {
    let depth = 0;
    let i = openIndex;
    const n = source.length;

    while (i < n) {
        const ch = source[i] as string;

        if (ch === "'" || ch === '"' || ch === '`') {
            i++;
            while (i < n) {
                if (source[i] === '\\') {
                    i += 2;
                    continue;
                }
                const closed = source[i] === ch;
                i++;
                if (closed) break;
            }
            continue;
        }

        if (ch === open) {
            depth++;
        } else if (ch === close) {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }

    return -1;
}

/** Every `class X { ... }` body in comment-stripped source, by declaration order. */
export function findClassBodies(
    strippedSource: string
): ReadonlyArray<{ readonly name: string; readonly body: string }> {
    const out: Array<{ name: string; body: string }> = [];

    for (const match of strippedSource.matchAll(CLASS_HEAD_RE)) {
        const start = match.index;
        if (start === undefined) continue;
        const braceIndex = strippedSource.indexOf('{', start);
        if (braceIndex < 0) continue;
        const end = findMatchingDelimiter(strippedSource, braceIndex, '{', '}');
        if (end < 0) continue;
        out.push({ name: match[1] as string, body: strippedSource.slice(braceIndex + 1, end) });
    }

    return out;
}

/**
 * The body of the class that assigns `protected table = <tableVar>;`, read
 * from comment-stripped source.
 *
 * Scoping to the class body — rather than testing the whole file — is what
 * stops a declaration belonging to a NEIGHBOURING class in the same file from
 * vouching for this one.
 */
export function findOwningClassBody(
    source: string,
    tableVar: string
): { readonly name: string; readonly body: string } | undefined {
    const stripped = stripComments(source);
    const ownerRe = new RegExp(`^\\s*protected\\s+table\\s*=\\s*${tableVar}\\s*;`, 'm');
    return findClassBodies(stripped).find((cls) => ownerRe.test(cls.body));
}

/**
 * Read the array literal assigned to a module-level `const <name> = [...]`.
 * Returns `undefined` when the constant is absent or is not an array literal
 * (e.g. it is imported from another module), which the caller must treat as
 * "cannot tell", never as "safe".
 */
export function resolveConstArrayLiteral(
    strippedModuleSource: string,
    name: string
): string | undefined {
    const re = new RegExp(`\\bconst\\s+${name}\\s*(?::[^=;]*)?=\\s*`);
    const match = re.exec(strippedModuleSource);
    if (!match) return undefined;

    const after = match.index + match[0].length;
    if (strippedModuleSource[after] !== '[') return undefined;
    const end = findMatchingDelimiter(strippedModuleSource, after, '[', ']');
    if (end < 0) return undefined;
    return strippedModuleSource.slice(after, end + 1);
}

/**
 * Whether the given (comment-stripped) class body declares `contactInfo` as a
 * mergeable JSONB column.
 *
 * @param strippedClassBody - Class body with comments already removed.
 * @param strippedModuleSource - The whole file, comments removed, used to
 *   resolve a `[...CONSTANT]` spread. Defaults to the class body.
 */
export function declaresContactInfoMergeable(
    strippedClassBody: string,
    strippedModuleSource: string = strippedClassBody
): MergeableVerdict {
    const heads = [...strippedClassBody.matchAll(MERGEABLE_DECL_HEAD_RE)];
    if (heads.length === 0) {
        return { kind: 'absent' };
    }

    const unresolved: string[] = [];

    for (const head of heads) {
        if (head.index === undefined) continue;
        const valueStart = head.index + head[0].length;

        if (strippedClassBody[valueStart] !== '[') {
            unresolved.push('the assigned value is not an array literal');
            continue;
        }

        const end = findMatchingDelimiter(strippedClassBody, valueStart, '[', ']');
        if (end < 0) {
            unresolved.push('the array literal is unterminated');
            continue;
        }

        const literal = strippedClassBody.slice(valueStart, end + 1);
        if (CONTACT_INFO_ITEM_RE.test(literal)) {
            return { kind: 'declared' };
        }

        for (const spread of literal.matchAll(SPREAD_RE)) {
            const constName = spread[1] as string;
            const resolved = resolveConstArrayLiteral(strippedModuleSource, constName);
            if (resolved === undefined) {
                unresolved.push(
                    `\`...${constName}\` is not a module-level array literal in this file, so its items cannot be read statically`
                );
                continue;
            }
            if (CONTACT_INFO_ITEM_RE.test(resolved)) {
                return { kind: 'declared' };
            }
        }
    }

    if (unresolved.length > 0) {
        return { kind: 'unresolved', detail: unresolved.join('; ') };
    }
    return { kind: 'absent' };
}

// ---------------------------------------------------------------------------
// Repository walk
// ---------------------------------------------------------------------------

function collectFiles(root: string, dir: string, suffix: string): string[] {
    const abs = join(root, dir);
    const out: string[] = [];
    let entries: string[];
    try {
        entries = readdirSync(abs);
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(abs, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            out.push(...collectFiles(root, join(dir, entry), suffix));
        } else if (entry.endsWith(suffix) && extname(entry) === '.ts') {
            out.push(full);
        }
    }
    return out;
}

/**
 * Finds every `contact_info` JSONB column across the schema tree, resolving
 * each to the Drizzle table variable it belongs to (not merely "somewhere in
 * this file") by scanning per `pgTable(` block rather than per file.
 */
export function findContactInfoTables(root: string): ContactInfoTable[] {
    const files = collectFiles(root, SCHEMA_DIR, '.dbschema.ts');
    const out: ContactInfoTable[] = [];

    for (const file of files) {
        const content = stripComments(readFileSync(file, 'utf8'));
        const exportMatches = [...content.matchAll(TABLE_EXPORT_RE)];
        if (exportMatches.length === 0) continue;

        for (let i = 0; i < exportMatches.length; i++) {
            const current = exportMatches[i];
            const next = exportMatches[i + 1];
            if (!current?.index && current?.index !== 0) continue;
            const start = current.index as number;
            const end = next?.index ?? content.length;
            const block = content.slice(start, end);

            if (CONTACT_INFO_COLUMN_RE.test(block)) {
                out.push({
                    tableVar: current[1] as string,
                    schemaFile: relative(root, file)
                });
            }
        }
    }
    return out;
}

/** All `.model.ts` files under `packages/db/src/models/**`. */
export function collectModelFiles(root: string): string[] {
    return collectFiles(root, MODELS_DIR, '.model.ts');
}

/**
 * EVERY model file whose class assigns `protected table = <tableVar>;`.
 *
 * Deliberately not "the first one": stopping at the first match makes the
 * verdict depend on the order `readdirSync` returns, so two models over the
 * same table would be judged by whichever filename sorts earlier.
 */
export function findOwningModels(
    root: string,
    modelFiles: readonly string[],
    tableVar: string
): ReadonlyArray<{ readonly file: string; readonly classBody: string; readonly module: string }> {
    const out: Array<{ file: string; classBody: string; module: string }> = [];
    for (const file of modelFiles) {
        const source = readFileSync(file, 'utf8');
        const owner = findOwningClassBody(source, tableVar);
        if (owner) {
            out.push({
                file: relative(root, file),
                classBody: owner.body,
                module: stripComments(source)
            });
        }
    }
    return out;
}

const FIX_ADD_DECLARATION =
    "Fix: add `protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;`\n" +
    '  (extending the array if the model already declares other mergeable columns)\n' +
    '  to the owning model, following packages/db/src/models/partner/partner.model.ts.';

const FIX_NO_OWNER =
    'Fix: this column is unreachable through any model, so nothing enforces its merge\n' +
    '  semantics. Either attach it to a model that assigns `protected table = <table>;`\n' +
    '  (and declare `contactInfo` mergeable there), or drop the column if the table is dead.';

const FIX_UNRESOLVED_SPREAD =
    'Fix: spell the mergeable columns as a literal array in the model itself, e.g.\n' +
    "  `= ['contactInfo'] as const;`. This guard reads the declaration statically and\n" +
    '  refuses to assume an unresolvable value contains the column.';

export function run(root: string): number {
    console.log('=== Checking contact_info columns declare mergeableJsonbColumns ===\n');

    const tables = findContactInfoTables(root);
    if (tables.length === 0) {
        console.log('ERROR: found zero contact_info columns across packages/db/src/schemas/**.');
        console.log(
            '  This almost certainly means the scan regex broke, not that the column disappeared.'
        );
        return 1;
    }

    console.log(`Found ${tables.length} table(s) with a contact_info JSONB column:`);
    for (const t of tables) console.log(`  - ${t.tableVar} (${t.schemaFile})`);
    console.log('');

    const modelFiles = collectModelFiles(root);
    const violations: Violation[] = [];

    for (const table of tables) {
        const owners = findOwningModels(root, modelFiles, table.tableVar);
        if (owners.length === 0) {
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                reason: `no model file assigns \`protected table = ${table.tableVar};\``,
                fix: FIX_NO_OWNER
            });
            continue;
        }

        if (owners.length > 1) {
            console.log(
                `  NOTE: ${table.tableVar} is claimed by ${owners.length} model files — all of them must declare the column:`
            );
            for (const owner of owners) console.log(`    - ${owner.file}`);
            console.log('');
        }

        for (const owner of owners) {
            const verdict = declaresContactInfoMergeable(owner.classBody, owner.module);
            if (verdict.kind === 'declared') continue;
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                modelFile: owner.file,
                reason:
                    verdict.kind === 'absent'
                        ? "does not declare 'contactInfo' in mergeableJsonbColumns"
                        : `declares mergeableJsonbColumns but this guard cannot read it: ${verdict.detail}`,
                fix: verdict.kind === 'absent' ? FIX_ADD_DECLARATION : FIX_UNRESOLVED_SPREAD
            });
        }
    }

    if (violations.length > 0) {
        console.log('ERROR: the following contact_info columns are NOT protected:\n');
        for (const v of violations) {
            console.log(`  Table: ${v.table} (${v.schemaFile})`);
            if (v.modelFile) console.log(`  Model: ${v.modelFile}`);
            console.log(`  Reason: ${v.reason}`);
            console.log(`  ${v.fix}`);
            console.log('');
        }
        return 1;
    }

    console.log(
        `OK — all ${tables.length} contact_info column(s) are declared mergeable by their model.`
    );
    console.log('');
    console.log('All checks passed.');
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(run(REPO_ROOT));
}
