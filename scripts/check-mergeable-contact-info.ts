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
 * 2. Each such table must be owned by exactly one model file (a
 *    `protected table = <tableVar>;` assignment under
 *    `packages/db/src/models/**`). No owning model is a FAILURE, not a
 *    silent skip — a `contact_info` column with no model attached is exactly
 *    the kind of gap this guard exists to surface.
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
 * WHAT IT DOES NOT PROVE
 *   - That `mergeableJsonbColumns` is *correct* for OTHER JSONB columns on
 *     the same table (e.g. `socialNetworks`, `seo`). Widening the merge set
 *     beyond `contactInfo` is a product decision, not something this guard
 *     opines on.
 *   - Runtime behaviour of the `||` merge itself — that is
 *     `packages/db/test/base/jsonb-merge.test.ts`'s job.
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
 * (leading whitespace only — never matches inside a comment or string).
 */
const CONTACT_INFO_COLUMN_RE = /^\s*contactInfo:\s*jsonb\('contact_info'\)/m;

/**
 * Anchored: the actual `mergeableJsonbColumns` class-property declaration,
 * captured up to its closing `as const;` (or plain `;`), never matching a
 * mention of the identifier inside a comment because it requires the
 * `protected ... readonly` modifier prefix that only a real declaration has.
 */
const MERGEABLE_DECL_RE =
    /protected\s+(?:override\s+)?readonly\s+mergeableJsonbColumns\s*(?::\s*readonly\s+string\[\]\s*)?=\s*(\[[\s\S]*?\])\s*(?:as const)?;/;

interface ContactInfoTable {
    readonly tableVar: string;
    readonly schemaFile: string;
}

interface Violation {
    readonly table: string;
    readonly schemaFile: string;
    readonly reason: string;
    readonly modelFile?: string;
}

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
function findContactInfoTables(root: string): ContactInfoTable[] {
    const files = collectFiles(root, SCHEMA_DIR, '.dbschema.ts');
    const out: ContactInfoTable[] = [];

    for (const file of files) {
        const content = readFileSync(file, 'utf8');
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
function collectModelFiles(root: string): string[] {
    return collectFiles(root, MODELS_DIR, '.model.ts');
}

/**
 * Finds the model file assigning `protected table = <tableVar>;`.
 * Returns undefined when no model owns the table (a guard failure, not a skip).
 */
function findOwningModel(
    root: string,
    modelFiles: string[],
    tableVar: string
): { file: string; content: string } | undefined {
    const ownerRe = new RegExp(`^\\s*protected\\s+table\\s*=\\s*${tableVar}\\s*;`, 'm');
    for (const file of modelFiles) {
        const content = readFileSync(file, 'utf8');
        if (ownerRe.test(content)) {
            return { file: relative(root, file), content };
        }
    }
    return undefined;
}

/**
 * Checks whether the model's `mergeableJsonbColumns` declaration (if any)
 * contains the exact quoted item `'contactInfo'`.
 */
function declaresContactInfoMergeable(modelContent: string): boolean {
    const match = modelContent.match(MERGEABLE_DECL_RE);
    if (!match) return false;
    const arrayLiteral = match[1] ?? '';
    return /(['"])contactInfo\1/.test(arrayLiteral);
}

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
        const owner = findOwningModel(root, modelFiles, table.tableVar);
        if (!owner) {
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                reason: `no model file assigns \`protected table = ${table.tableVar};\``
            });
            continue;
        }
        if (!declaresContactInfoMergeable(owner.content)) {
            violations.push({
                table: table.tableVar,
                schemaFile: table.schemaFile,
                modelFile: owner.file,
                reason: "does not declare 'contactInfo' in mergeableJsonbColumns"
            });
        }
    }

    if (violations.length > 0) {
        console.log('ERROR: the following contact_info columns are NOT protected:\n');
        for (const v of violations) {
            console.log(`  Table: ${v.table} (${v.schemaFile})`);
            if (v.modelFile) console.log(`  Model: ${v.modelFile}`);
            console.log(`  Reason: ${v.reason}`);
            console.log('');
        }
        console.log(
            "  Fix: add `protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;`\n" +
                '  (extending the array if the model already declares other mergeable columns)\n' +
                '  to the owning model, following packages/db/src/models/partner/partner.model.ts.'
        );
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
