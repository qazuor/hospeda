#!/usr/bin/env tsx
/**
 * check-soft-delete-actor.ts — HOS-556 / HOS-559
 *
 * A soft delete must record WHO performed it, not only when.
 *
 * Measured in production on 2026-08-15: of the 8 rows deleted by real people
 * using the product, 0 carried an actor. `BaseModelImpl.softDelete()` wrote
 * `{ deletedAt, updatedAt }` and nothing else, and `BaseCrudWrite.softDelete()`
 * dropped its validated actor one line before handing the write to the model.
 * The 145 rows that DID carry an actor all shared a single `deleted_at`
 * (2026-07-23 15:13:16.628) — one seed data-migration, not the application.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * Check 1 — the canonical writer still stamps the actor.
 *   `BaseModelImpl.softDelete` in packages/db/src/base/base.model.ts declares a
 *   REQUIRED `deletedById` parameter and assigns it into the update patch.
 *   This is check 2's blind spot: that method builds its patch object
 *   dynamically, so no literal scan can see it.
 *
 * Check 2 — no `softDelete(...)` call site hard-codes a null actor.
 *   A required parameter stops a caller from FORGETTING the actor; it does not
 *   stop one from writing `null` to silence the compiler. Every such site must
 *   be listed in SYSTEM_DELETE_SITES with a reason.
 *
 * Check 3 — no DB write sets `deletedAt` without `deletedById`.
 *   Every object literal handed to a Drizzle `.set(...)`, or used as the data
 *   argument of `.update(where, data)` / `.updateById(id, data)`, that assigns
 *   `deletedAt` a non-null value must also assign `deletedById` — unless the
 *   target table has no such column (see EXEMPT_TABLES).
 *
 * This guard does NOT assert that the value passed is the correct actor, nor
 * that every delete path goes through the base model. It only asserts that a
 * write which stamps `deletedAt` also stamps authorship where the column exists.
 *
 * ---------------------------------------------------------------------------
 * ON THE EXEMPTION LIST
 * ---------------------------------------------------------------------------
 * An allowlist is how a guard quietly becomes fail-open, so this one cannot be
 * used to wave through a real gap: every entry names a TABLE, and the guard
 * resolves that table's Drizzle definition and FAILS if the table actually has
 * a `deleted_by_id` column. Entries for tables owned by another package must
 * say so explicitly. Stale entries (no longer matching any site) also fail.
 * The number of exemptions actually used is printed on every run.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

const CANONICAL_WRITER = 'packages/db/src/base/base.model.ts';
const SCHEMA_DIR = 'packages/db/src/schemas';
const SCAN_GLOBS = ['packages', 'apps'] as const;

/**
 * Tables that legitimately cannot record a deleter because they have no
 * `deleted_by_id` column. Verified against the Drizzle schema on every run.
 */
type ExemptTable = {
    /** The Drizzle table identifier as written at the `.update(...)` call site. */
    readonly table: string;
    /** True when the table is defined outside packages/db (e.g. qzpay-owned). */
    readonly external: boolean;
    readonly reason: string;
};

export const EXEMPT_TABLES: readonly ExemptTable[] = [
    {
        table: 'billingPlans',
        external: true,
        reason: 'qzpay-owned billing table; no deleted_by_id column'
    },
    {
        table: 'billingAddons',
        external: true,
        reason: 'qzpay-owned billing table; no deleted_by_id column'
    },
    {
        table: 'billingSubscriptions',
        external: true,
        reason: 'qzpay-owned billing table; no deleted_by_id column'
    },
    // `billingCustomers` and `billingPayments` sit here for the same reason as
    // the three entries above, not as an exception granted to any one change.
    // The billing tables reach this repo through
    // `packages/db/src/billing/schemas.ts`, which is a bare
    // `export * from '@qazuor/qzpay-drizzle'` — so their shape is the
    // provider's, not ours. `deletedBy` appears in NONE of the 20 files of
    // qzpay's Drizzle schema, and neither column exists in the live production
    // tables either; there is simply no deleter to record, and these tables do
    // not go through `BaseModelImpl.softDelete`. They were absent until now
    // only because nothing had ever soft-deleted them: `git blame` shows all
    // six original entries landed together in c01f2f1a9 (the commit that
    // introduced this guard) and none has ever been removed since.
    {
        table: 'billingCustomers',
        external: true,
        reason: 'qzpay-owned billing table; no deleted_by_id column'
    },
    {
        table: 'billingPayments',
        external: true,
        reason: 'qzpay-owned billing table; no deleted_by_id column'
    },
    {
        table: 'billingAddonPurchases',
        external: false,
        reason: 'billing purchase ledger; no deleted_by_id column'
    },
    {
        table: 'newsletterCampaigns',
        external: false,
        reason: 'newsletter campaigns carry no audit-author columns'
    },
    {
        table: 'featureFlags',
        external: false,
        reason: 'admin infra toggles; table has deleted_at but no deleted_by_id'
    }
];

/**
 * Call sites allowed to pass a literal `null` actor because the delete is
 * genuinely system-initiated (a cron, a reconciler) with no acting user.
 *
 * Deliberately EMPTY: today every soft delete in the codebase originates from
 * a request with a real actor. An entry here is a decision to accept an
 * unauditable row, so it must be added consciously and reviewed.
 */
export const SYSTEM_DELETE_SITES: readonly { readonly file: string; readonly reason: string }[] =
    [];

export type Violation = {
    readonly file: string;
    readonly line: number;
    readonly table: string | null;
    readonly snippet: string;
};

export type ScanResult = {
    readonly violations: readonly Violation[];
    /** Exempt-table names that were actually hit, for the counted report. */
    readonly exemptionsUsed: readonly string[];
    readonly sitesChecked: number;
};

// ---------------------------------------------------------------------------
// Source walking
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.astro']);

/** Collects production `.ts`/`.tsx` sources under `packages/*` and `apps/*`. */
export function collectSourceFiles(root: string): string[] {
    const out: string[] = [];

    const walk = (dir: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            const st = statSync(full);
            if (st.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry)) continue;
            if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
            if (/\.d\.ts$/.test(entry)) continue;
            out.push(full);
        }
    };

    for (const top of SCAN_GLOBS) {
        const base = join(root, top);
        let pkgs: string[];
        try {
            pkgs = readdirSync(base);
        } catch {
            continue;
        }
        for (const pkg of pkgs) {
            const src = join(base, pkg, 'src');
            try {
                if (statSync(src).isDirectory()) walk(src);
            } catch {
                // package without a src/ directory
            }
        }
    }

    return out;
}

// ---------------------------------------------------------------------------
// Balanced-argument extraction
// ---------------------------------------------------------------------------

/**
 * Returns the raw text of the argument list that starts at `openIdx`
 * (the index of the `(`), excluding the outer parentheses.
 */
export function readArgList(source: string, openIdx: number): string | null {
    if (source[openIdx] !== '(') return null;
    let depth = 0;
    for (let i = openIdx; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            if (depth === 0) return source.slice(openIdx + 1, i);
        }
    }
    return null;
}

/** Splits an argument list on top-level commas. */
export function splitTopLevelArgs(args: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < args.length; i++) {
        const ch = args[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ',' && depth === 0) {
            parts.push(args.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(args.slice(start));
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** True when the text assigns `deletedAt` to something other than null/undefined. */
export function assignsNonNullDeletedAt(text: string): boolean {
    const m = text.match(/\bdeletedAt\s*:\s*([^,}\n]+)/);
    if (!m?.[1]) return false;
    const value = m[1].trim();
    return value !== 'null' && value !== 'undefined';
}

/**
 * True when the literal carries a `deletedById` key — either explicit
 * (`deletedById: x`) or ES6 shorthand (`deletedById,`), which the seed
 * data-migrations use.
 */
export function assignsDeletedById(text: string): boolean {
    return /\bdeletedById\s*(?::|,|\}|$)/.test(text);
}

/**
 * Walks backwards from `idx` to the nearest `.update(` and returns the single
 * identifier it was called with, or null when it is not a bare identifier.
 */
export function resolveTableIdentifier(source: string, idx: number): string | null {
    const head = source.slice(0, idx);
    const at = head.lastIndexOf('.update(');
    if (at < 0) return null;
    const args = readArgList(source, at + '.update'.length);
    if (args === null) return null;
    const parts = splitTopLevelArgs(args);
    if (parts.length !== 1) return null;
    const only = parts[0]?.trim() ?? '';
    return /^[A-Za-z_$][\w$]*$/.test(only) ? only : null;
}

const lineOf = (source: string, idx: number): number => source.slice(0, idx).split('\n').length;

// ---------------------------------------------------------------------------
// Check 2 — call-site scan
// ---------------------------------------------------------------------------

export function scanSources(root: string, files: readonly string[]): ScanResult {
    const violations: Violation[] = [];
    const exemptionsUsed: string[] = [];
    const exemptByName = new Map(EXEMPT_TABLES.map((e) => [e.table, e]));
    let sitesChecked = 0;

    for (const file of files) {
        const rel = relative(root, file);
        const source = readFileSync(file, 'utf8');
        if (!source.includes('deletedAt')) continue;

        // Payload positions: `.set(<obj>)`, `.update(<where>, <obj>)`,
        // `.updateById(<id>, <obj>)`.
        const candidates: Array<{ readonly payload: string; readonly idx: number }> = [];

        for (const method of ['.set', '.update', '.updateById'] as const) {
            let from = 0;
            for (;;) {
                const at = source.indexOf(`${method}(`, from);
                if (at < 0) break;
                from = at + method.length;
                const args = readArgList(source, at + method.length);
                if (args === null) continue;
                const parts = splitTopLevelArgs(args);
                const payload = method === '.set' ? parts[0] : parts[1];
                if (payload) candidates.push({ payload, idx: at });
            }
        }

        for (const { payload, idx } of candidates) {
            if (!assignsNonNullDeletedAt(payload)) continue;
            sitesChecked++;
            if (assignsDeletedById(payload)) continue;

            const table = resolveTableIdentifier(source, idx);
            const exempt = table === null ? undefined : exemptByName.get(table);
            if (exempt) {
                exemptionsUsed.push(exempt.table);
                continue;
            }

            violations.push({
                file: rel,
                line: lineOf(source, idx),
                table,
                snippet: payload.replace(/\s+/g, ' ').trim().slice(0, 120)
            });
        }
    }

    return { violations, exemptionsUsed, sitesChecked };
}

// ---------------------------------------------------------------------------
// Check 2 — null actors handed to softDelete()
// ---------------------------------------------------------------------------

export type NullActorSite = {
    readonly file: string;
    readonly line: number;
    readonly snippet: string;
};

/**
 * Finds `softDelete(<where>, null, ...)` call sites. The required parameter
 * makes forgetting the actor a compile error; writing `null` is how a caller
 * would satisfy the compiler while still losing the audit trail.
 */
export function scanNullActors(root: string, files: readonly string[]): NullActorSite[] {
    const found: NullActorSite[] = [];
    const allowed = new Set(SYSTEM_DELETE_SITES.map((s) => s.file));

    for (const file of files) {
        const rel = relative(root, file);
        if (allowed.has(rel)) continue;
        const source = readFileSync(file, 'utf8');
        if (!source.includes('softDelete(')) continue;

        let from = 0;
        for (;;) {
            const at = source.indexOf('softDelete(', from);
            if (at < 0) break;
            from = at + 'softDelete('.length;
            const args = readArgList(source, at + 'softDelete'.length);
            if (args === null) continue;
            const parts = splitTopLevelArgs(args);
            if (parts[1]?.trim() !== 'null') continue;
            found.push({
                file: rel,
                line: lineOf(source, at),
                snippet: args.replace(/\s+/g, ' ').trim().slice(0, 100)
            });
        }
    }

    return found;
}

// ---------------------------------------------------------------------------
// Exemption validation — an exemption may not hide a real column
// ---------------------------------------------------------------------------

export function validateExemptions(root: string): string[] {
    const errors: string[] = [];
    const schemaDir = join(root, SCHEMA_DIR);

    const schemaFiles: string[] = [];
    const walk = (dir: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (entry.endsWith('.ts')) schemaFiles.push(full);
        }
    };
    walk(schemaDir);

    for (const entry of EXEMPT_TABLES) {
        const declaration = new RegExp(`export\\s+const\\s+${entry.table}\\s*=\\s*pgTable\\(`, 'm');
        const owner = schemaFiles.find((f) => declaration.test(readFileSync(f, 'utf8')));

        if (!owner) {
            if (!entry.external) {
                errors.push(
                    `  ${entry.table}: declared as ours but no "export const ${entry.table} = pgTable(" ` +
                        `exists under ${SCHEMA_DIR}. Mark it external:true or fix the name.`
                );
            }
            continue;
        }

        if (entry.external) {
            errors.push(
                `  ${entry.table}: declared external, but it IS defined in ${relative(root, owner)}.`
            );
            continue;
        }

        // Read the pgTable(...) call with balanced brackets rather than a
        // fixed-size window: accommodations declares deletedById on line 140,
        // past any window short enough to be safe elsewhere.
        const body = readFileSync(owner, 'utf8');
        const start = body.search(declaration);
        const block = readArgList(body, body.indexOf('(', start)) ?? '';
        if (/\bdeletedById\b/.test(block)) {
            errors.push(
                `  ${entry.table}: exemption is INVALID — ${relative(root, owner)} declares ` +
                    'deletedById. Pass the actor at the call site instead of exempting the table.'
            );
        }
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Check 1 — the canonical writer
// ---------------------------------------------------------------------------

export function checkCanonicalWriter(root: string): string[] {
    const path = join(root, CANONICAL_WRITER);
    let source: string;
    try {
        source = readFileSync(path, 'utf8');
    } catch {
        return [`  ${CANONICAL_WRITER} is missing — the canonical soft-delete writer moved.`];
    }

    const errors: string[] = [];

    const at = source.search(/\basync\s+softDelete\s*\(/);
    if (at < 0) {
        return [`  ${CANONICAL_WRITER}: no "async softDelete(" method found.`];
    }

    const params = readArgList(source, source.indexOf('(', at));
    if (params === null || !/\bdeletedById\s*:\s*string\s*\|\s*null\b/.test(params)) {
        errors.push(
            `  ${CANONICAL_WRITER}: softDelete must declare a required ` +
                '"deletedById: string | null" parameter.'
        );
    } else if (/\bdeletedById\s*\?\s*:/.test(params)) {
        errors.push(
            `  ${CANONICAL_WRITER}: deletedById must be REQUIRED, not optional — an ` +
                'optional actor is exactly how it went missing on every call site.'
        );
    }

    // The method body, up to the next method declaration.
    const bodyStart = source.indexOf('{', at);
    const body = readArgList(`(${source.slice(bodyStart)}`, 0) ?? source.slice(bodyStart);
    if (!/\bdeletedById\s*=\s*deletedById\b/.test(body)) {
        errors.push(
            `  ${CANONICAL_WRITER}: softDelete does not assign the deletedById parameter ` +
                'into the update patch (expected "patch.deletedById = deletedById").'
        );
    }
    if (!/'deletedById'\s+in\s+this\.table/.test(body)) {
        errors.push(
            `  ${CANONICAL_WRITER}: softDelete must guard the write with ` +
                `"'deletedById' in this.table" so tables without the column still work.`
        );
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function run(root: string): number {
    console.log('=== Checking soft deletes record their actor (HOS-556 / HOS-559) ===\n');

    let failed = false;

    console.log('1. Canonical writer (BaseModelImpl.softDelete)...');
    const canonical = checkCanonicalWriter(root);
    if (canonical.length > 0) {
        console.log('ERROR: the canonical soft-delete writer no longer stamps the actor:');
        for (const e of canonical) console.log(e);
        failed = true;
    } else {
        console.log('  OK — required deletedById parameter, written into the patch.');
    }

    const files = collectSourceFiles(root);

    console.log('\n2. No softDelete() call site hard-codes a null actor...');
    const nullActors = scanNullActors(root, files);
    if (nullActors.length > 0) {
        console.log('ERROR: softDelete() called with a literal null actor:');
        for (const s of nullActors) {
            console.log(`  ${s.file}:${s.line}`);
            console.log(`    softDelete(${s.snippet})`);
        }
        console.log(
            '\n  Pass the acting user id. If the delete truly has no actor, add the ' +
                'file to SYSTEM_DELETE_SITES with a reason.'
        );
        failed = true;
    } else {
        console.log(`  OK — no null actors (${SYSTEM_DELETE_SITES.length} system sites allowed).`);
    }

    console.log('\n3. Exemption list is honest...');
    const exemptionErrors = validateExemptions(root);
    if (exemptionErrors.length > 0) {
        console.log('ERROR: an entry in EXEMPT_TABLES does not hold:');
        for (const e of exemptionErrors) console.log(e);
        failed = true;
    } else {
        console.log(`  OK — ${EXEMPT_TABLES.length} exempt tables, none of them has the column.`);
    }

    console.log('\n4. Writes that set deletedAt must also set deletedById...');
    const { violations, exemptionsUsed, sitesChecked } = scanSources(root, files);

    const stale = EXEMPT_TABLES.filter((e) => !exemptionsUsed.includes(e.table));
    if (stale.length > 0) {
        console.log('ERROR: stale exemptions — no soft-delete write targets these tables anymore:');
        for (const e of stale) console.log(`  ${e.table} (${e.reason})`);
        failed = true;
    }

    if (violations.length > 0) {
        console.log('ERROR: soft-delete writes that do not record who deleted the row:');
        for (const v of violations) {
            const where = v.table ? `table ${v.table}` : 'table not statically resolvable';
            console.log(`  ${v.file}:${v.line} (${where})`);
            console.log(`    ${v.snippet}`);
        }
        console.log(
            '\n  Add deletedById to the payload, or route the delete through ' +
                'BaseModelImpl.softDelete(where, actorId, tx).'
        );
        failed = true;
    } else {
        console.log(
            `  OK — ${sitesChecked} soft-delete writes checked, ` +
                `${exemptionsUsed.length} covered by an exempt table.`
        );
    }

    console.log('');
    if (failed) {
        console.log('FAILED — fix the issues above before merging.');
        return 1;
    }
    console.log('All checks passed.');
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(run(REPO_ROOT));
}
