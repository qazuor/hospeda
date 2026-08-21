#!/usr/bin/env tsx
/**
 * check-locale-resolution-single-source.ts — HOS-605 / HOS-609 / HOS-617
 *
 * Before this guard, three places decided which locale to show a visitor,
 * each with its own rule — and two of those rules directly contradicted each
 * other (see the owner's decision on HOS-617, 2026-08-21). The fix was a
 * single precedence rule (explicit URL locale > account preference >
 * `Accept-Language` > default), implemented ONCE as
 * `resolveDisplayLocale`/`matchAcceptLanguage` in
 * `packages/i18n/src/locale-resolution.ts`, with every redirect/return-URL
 * builder in the platform calling into it instead of deciding on its own.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * Check 1 — the canonical resolver still exists and exports the expected API.
 *   `packages/i18n/src/locale-resolution.ts` must export `resolveDisplayLocale`
 *   and `matchAcceptLanguage`. A rename/removal here would silently orphan
 *   every call site this guard is meant to protect.
 *
 * Check 2 — no file outside the allowlist reads the raw `Accept-Language`
 *   request header.
 *   Reading that header is the prerequisite of deciding a locale from it —
 *   a NEW site that reads the header directly is, by construction, a
 *   candidate fourth place re-deciding locale on its own. Every legitimate
 *   reader must be named in HEADER_READER_ALLOWLIST with a reason.
 *
 * This guard does NOT verify that an allowlisted file calls
 * `resolveDisplayLocale`/`matchAcceptLanguage` correctly (that is what the
 * unit tests in `packages/i18n/test/locale-resolution.test.ts`,
 * `apps/admin/test/lib/*.test.ts`, and `apps/api/test/routes/start-paid.test.ts`
 * are for) — only that no UNLISTED file has started reading the header at
 * all. Outbound `Accept-Language` headers this codebase SENDS to third-party
 * APIs (scrapers, geocoding clients) are a different concept entirely — this
 * check only matches the read call-form (`.header('accept-language')` /
 * `.get('accept-language')`), never an object-literal header assignment
 * (`'Accept-Language': '...'`), so those are structurally invisible to it.
 *
 * ---------------------------------------------------------------------------
 * ON THE ALLOWLIST
 * ---------------------------------------------------------------------------
 * Every entry names a FILE, not a directory or a pattern, and the guard
 * fails if an entry no longer actually reads the header (a stale entry is
 * exactly the kind of silent drift an allowlist must not accumulate).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
export const REPO_ROOT = resolve(HERE, '..');

const CANONICAL_RESOLVER = 'packages/i18n/src/locale-resolution.ts';
const SCAN_GLOBS = ['packages', 'apps'] as const;

/**
 * Files allowed to read the raw `Accept-Language` request header directly.
 * Each is a thin entry point that hands the raw value to
 * `matchAcceptLanguage`/`resolveDisplayLocale` — never its own parsing.
 */
type AllowlistEntry = {
    readonly file: string;
    readonly reason: string;
};

export const HEADER_READER_ALLOWLIST: readonly AllowlistEntry[] = [
    {
        file: 'apps/admin/src/lib/locale.ts',
        reason: 'Admin server function reading the request header (HOS-609); resolution itself happens via matchAcceptLanguage/resolveDisplayLocale.'
    },
    {
        file: 'apps/api/src/routes/billing/checkout-return-urls.ts',
        reason: 'resolveReturnUrlLocale reads the header as step 3 of the precedence rule (HOS-605), delegating the actual decision to resolveDisplayLocale.'
    }
];

/**
 * Matches a READ of the `Accept-Language` header, never an object-literal
 * header WRITE. Tolerates optional chaining on the call itself
 * (`c.req.header?.('accept-language')`, as used defensively against minimal
 * test-double Contexts), not just a plain call.
 */
const HEADER_READ_PATTERN = /\.(?:header|get)(?:\?\.)?\(\s*['"]accept-language['"]/i;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.astro']);

/** Collects production `.ts`/`.tsx` sources under `packages/*` and `apps/*`. */
function collectSourceFiles(root: string): string[] {
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
                // package/app without a src/ directory
            }
        }
    }

    return out;
}

/**
 * Check 1 — the canonical resolver file exists and exports the expected API.
 */
function checkCanonicalResolver(root: string): string[] {
    const errors: string[] = [];
    const full = join(root, CANONICAL_RESOLVER);

    let body: string;
    try {
        body = readFileSync(full, 'utf8');
    } catch {
        errors.push(`  ${CANONICAL_RESOLVER}: file does not exist.`);
        return errors;
    }

    if (!/export\s+function\s+resolveDisplayLocale\b/.test(body)) {
        errors.push(`  ${CANONICAL_RESOLVER}: no longer exports "resolveDisplayLocale".`);
    }
    if (!/export\s+const\s+matchAcceptLanguage\b/.test(body)) {
        errors.push(`  ${CANONICAL_RESOLVER}: no longer exports "matchAcceptLanguage".`);
    }

    return errors;
}

/**
 * Check 2 — no file outside the allowlist reads the `Accept-Language` header
 * directly, and no allowlist entry is stale.
 */
function checkHeaderReaders(
    root: string,
    files: readonly string[]
): { readonly violations: string[]; readonly staleEntries: string[] } {
    const allowedPaths = new Set(HEADER_READER_ALLOWLIST.map((e) => e.file));
    const hitPaths = new Set<string>();
    const violations: string[] = [];

    for (const file of files) {
        const relPath = relative(root, file).replace(/\\/g, '/');
        let body: string;
        try {
            body = readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        if (!HEADER_READ_PATTERN.test(body)) continue;

        if (allowedPaths.has(relPath)) {
            hitPaths.add(relPath);
            continue;
        }
        violations.push(`  ${relPath}: reads the Accept-Language header directly`);
    }

    const staleEntries = HEADER_READER_ALLOWLIST.filter((e) => !hitPaths.has(e.file)).map(
        (e) => `  ${e.file} (${e.reason})`
    );

    return { violations, staleEntries };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function run(root: string): number {
    console.log(
        '=== Checking locale resolution has a single source of truth (HOS-605 / HOS-609 / HOS-617) ===\n'
    );

    let failed = false;

    console.log('1. Canonical resolver still exports resolveDisplayLocale/matchAcceptLanguage...');
    const canonicalErrors = checkCanonicalResolver(root);
    if (canonicalErrors.length > 0) {
        console.log('ERROR: the canonical locale resolver regressed:');
        for (const e of canonicalErrors) console.log(e);
        failed = true;
    } else {
        console.log(`  OK — ${CANONICAL_RESOLVER} exports both.`);
    }

    const files = collectSourceFiles(root);

    console.log('\n2. No file outside the allowlist reads Accept-Language directly...');
    const { violations, staleEntries } = checkHeaderReaders(root, files);

    if (violations.length > 0) {
        console.log('ERROR: a file reads Accept-Language directly without being allowlisted:');
        for (const v of violations) console.log(v);
        console.log(
            '\n  Route this through resolveDisplayLocale/matchAcceptLanguage instead of ' +
                'deciding the locale on your own. If this read is genuinely a new, legitimate ' +
                'entry point, add it to HEADER_READER_ALLOWLIST in scripts/check-locale-resolution-single-source.ts ' +
                'with a reason — but that decision should not be made lightly: it is exactly the ' +
                'kind of fourth site HOS-617 closed.'
        );
        failed = true;
    } else {
        console.log(
            `  OK — no unlisted header readers (${HEADER_READER_ALLOWLIST.length} allowlisted).`
        );
    }

    if (staleEntries.length > 0) {
        console.log('\nERROR: stale allowlist entries — these files no longer read the header:');
        for (const e of staleEntries) console.log(e);
        console.log('\n  Remove the stale entry from HEADER_READER_ALLOWLIST.');
        failed = true;
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
