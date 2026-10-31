/**
 * HOS-1917 — a service's `_executeSearch` must never read pagination from `params`.
 *
 * THE FAILURE THIS GUARD EXISTS FOR
 * `BaseCrudRead.search` moves `page`, `pageSize`, `sortBy` and `sortOrder` out of
 * `params` and onto `ctx.pagination` BEFORE it calls `_executeSearch`
 * (`src/base/base.crud.read.ts`, SPEC-088). A service that still destructures
 * those keys from `params` receives `undefined`, silently falls back to its own
 * default and answers page 1 for `?page=2`, while the response still reports the
 * requested `pageSize`. Nothing throws and no log line appears.
 *
 * WHAT IT CHECKS
 * It scans every `_executeSearch` in `src/services` (comments stripped) and fails
 * when its body takes one of the four keys from `params`, either by destructuring
 * or by property access.
 *
 * ALLOWLIST
 * Entries need a reason and are removed when the service is fixed. A stale entry
 * (fixed, or file gone) also fails, so the list cannot rot.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVICES_DIR = join(__dirname, '..', '..', 'src', 'services');
const RESERVED = ['page', 'pageSize', 'sortBy', 'sortOrder'] as const;

/** Services knowingly still reading pagination from params, with the reason. */
const ALLOWLIST: Readonly<Record<string, string>> = {
    'sponsorship/sponsorship.service.ts':
        'Deferred to the sponsorship rewrite (owner decision, HOS-1917).',
    'sponsorship/sponsorshipLevel.service.ts':
        'Deferred to the sponsorship rewrite (owner decision, HOS-1917).',
    'sponsorship/sponsorshipPackage.service.ts':
        'Deferred to the sponsorship rewrite (owner decision, HOS-1917).'
};

function listTsFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listTsFiles(full);
        return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
    });
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Returns the text of each `_executeSearch` definition: from its name up to the
 * next member declaration at class-body indentation (or end of file).
 */
function extractExecuteSearchBodies(src: string): string[] {
    const code = stripComments(src);
    const bodies: string[] = [];
    const start = /(?:protected|public)\s+(?:override\s+)?async\s+_executeSearch\s*\(/g;
    for (const m of code.matchAll(start)) {
        const rest = code.slice((m.index ?? 0) + m[0].length);
        const next = rest.search(
            /\n {4}(?:protected|private|public|async|override|static|get|set)\b/
        );
        bodies.push(next === -1 ? rest : rest.slice(0, next));
    }
    return bodies;
}

/** Returns the reserved keys a body reads from `params`. */
function findParamsPaginationReads(body: string): string[] {
    const keys = RESERVED.join('|');
    const found = new Set<string>();
    for (const m of body.matchAll(new RegExp(`\\bparams\\.(${keys})\\b`, 'g'))) {
        if (m[1]) found.add(m[1]);
    }
    for (const m of body.matchAll(/const\s*\{([^}]*)\}\s*=\s*params\b/g)) {
        // Entries look like `page`, `page = 1`, `page: alias` or `page: _alias`.
        // A binding prefixed with `_` is a deliberate discard, not a read.
        for (const entry of (m[1] ?? '').split(',')) {
            const match = entry.trim().match(/^(\w+)\s*(?::\s*(\w+))?/);
            const key = match?.[1];
            const binding = match?.[2] ?? key;
            if (key && binding && (RESERVED as readonly string[]).includes(key)) {
                if (!binding.startsWith('_')) found.add(key);
            }
        }
    }
    return [...found];
}

describe('_executeSearch reads pagination from ctx.pagination, not params (HOS-1917)', () => {
    const offenders = new Map<string, string[]>();
    for (const file of listTsFiles(SERVICES_DIR)) {
        const reads = extractExecuteSearchBodies(readFileSync(file, 'utf8')).flatMap(
            findParamsPaginationReads
        );
        if (reads.length > 0) offenders.set(relative(SERVICES_DIR, file), [...new Set(reads)]);
    }

    it('no non-allowlisted service reads page/pageSize/sortBy/sortOrder from params', () => {
        const unexpected = [...offenders].filter(([file]) => !(file in ALLOWLIST));
        expect(unexpected).toEqual([]);
    });

    it('every allowlist entry still offends (remove it once the service is fixed)', () => {
        const stale = Object.keys(ALLOWLIST).filter((file) => !offenders.has(file));
        expect(stale).toEqual([]);
    });

    it('detector flags a destructure and a property access, and ignores ctx reads', () => {
        const bad =
            'protected async _executeSearch(params, a, ctx) { const { page = 1, q } = params; }';
        const bad2 = 'protected async _executeSearch(params, a, ctx) { return params.sortBy; }';
        const good =
            'protected async _executeSearch(params, a, ctx) { const { q } = params; const page = ctx.pagination?.page; }';
        expect(extractExecuteSearchBodies(bad).flatMap(findParamsPaginationReads)).toEqual([
            'page'
        ]);
        expect(extractExecuteSearchBodies(bad2).flatMap(findParamsPaginationReads)).toEqual([
            'sortBy'
        ]);
        expect(extractExecuteSearchBodies(good).flatMap(findParamsPaginationReads)).toEqual([]);
    });
});
