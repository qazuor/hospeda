/**
 * @file author-indexability-parity.test.ts
 * @description Cross-package guard for HOS-375 §6.6 / risk R-4: the author page
 * and the sitemap must never disagree about who is indexable.
 *
 * The two sides are written in different languages and cannot share code:
 *
 * - The PAGE decides with `evaluateAuthorIndexability` (TypeScript,
 *   `apps/web/src/lib/seo/author-indexable.ts`).
 * - The SITEMAP decides with `UserModel.listPublicAuthors` (SQL,
 *   `packages/db/src/models/user/user.model.ts`), through
 *   `GET /api/v1/public/authors`.
 *
 * Each one's docstring names the other, which is documentation, not enforcement.
 * Nothing stops someone from relaxing one side alone — and the failure that
 * produces is silent and one-directional: drop a condition from the SQL and the
 * sitemap starts handing Google URLs the page serves as `noindex`.
 *
 * So this file asserts that each ROW-LEVEL condition of §6.5 is present on BOTH
 * sides. It deliberately does not try to prove the two are semantically
 * equivalent — a source scan cannot do that, and claiming it would be a guard
 * whose message outruns its predicate. What it does prove is presence: a
 * condition silently deleted from either side turns red, naming the condition.
 *
 * `page` is the one §6.5 condition absent here on purpose: it is a property of
 * the REQUEST, not of the row. The sitemap only ever emits page-1 URLs, so the
 * SQL has nothing to mirror.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PREDICATE_PATH = resolve(__dirname, '../../../src/lib/seo/author-indexable.ts');
const QUERY_PATH = resolve(__dirname, '../../../../../packages/db/src/models/user/user.model.ts');

const predicateSrc = readFileSync(PREDICATE_PATH, 'utf8');
const fullQuerySrc = readFileSync(QUERY_PATH, 'utf8');

/**
 * Just the `listPublicAuthors` method.
 *
 * `user.model.ts` is a large file with many unrelated queries — `is_system_account`
 * or `'avatar'` appearing SOMEWHERE in it would satisfy a whole-file scan while
 * the author query had lost the condition entirely.
 */
function sliceListPublicAuthors(source: string): string {
    const start = source.indexOf('async listPublicAuthors(');
    if (start === -1) {
        throw new Error('listPublicAuthors is gone from user.model.ts — the sitemap query moved');
    }
    // Up to the next method declaration at the same indentation, or EOF.
    const rest = source.slice(start + 1);
    const nextMethod = rest.search(/\n {4}(?:async |public |private |protected )?\w+\(/);
    return nextMethod === -1 ? rest : rest.slice(0, nextMethod);
}

const querySrc = sliceListPublicAuthors(fullQuerySrc);

/**
 * Just the `and(...)` list actually handed to `.where()`.
 *
 * Scanning the whole method is not enough, and the difference is the entire
 * point of this file: the conditions are declared as named `sql` constants
 * ABOVE the where-clause, so deleting one from the `and(...)` while leaving its
 * declaration in place — the single likeliest way this breaks — keeps every
 * name present in the method body. That mutation ships a sitemap advertising
 * authors the page serves as `noindex`, and a method-wide scan stays green
 * through it. Verified: it does.
 */
function sliceWhereClause(method: string): string {
    const start = method.indexOf('const whereClause = and(');
    if (start === -1) {
        throw new Error('listPublicAuthors no longer builds a `whereClause` — re-read the query');
    }
    const end = method.indexOf(');', start);
    if (end === -1) throw new Error('unterminated whereClause in listPublicAuthors');
    return method.slice(start, end);
}

const whereClauseSrc = sliceWhereClause(querySrc);

interface Condition {
    /** The §6.5 condition, named the way a failure should read. */
    readonly name: string;
    /** How it must appear in the TypeScript predicate. */
    readonly inPredicate: readonly (string | RegExp)[];
    /** How it must be APPLIED in the SQL where-clause, not merely declared. */
    readonly inWhereClause: readonly (string | RegExp)[];
    /** How its SQL fragment must be BUILT, above the where-clause. */
    readonly inQueryBody: readonly (string | RegExp)[];
}

/** The four ROW-level conditions of §6.5. `page` is request-level — see the file docblock. */
const ROW_CONDITIONS: readonly Condition[] = [
    {
        name: 'not a system account',
        inPredicate: ['input.isSystemAccount === true'],
        inWhereClause: [/eq\(\s*users\.isSystemAccount,\s*false\s*\)/],
        inQueryBody: []
    },
    {
        name: 'at least one published post or event',
        inPredicate: ['input.publishedPostsCount', 'input.publishedEventsCount'],
        inWhereClause: [/or\(hasPublishedPost,\s*hasPublishedEvent\)/],
        inQueryBody: [/EXISTS/, /"posts"/, /"events"/]
    },
    {
        name: 'a non-empty bio',
        inPredicate: [/isNonEmpty\(input\.bio\)/],
        inWhereClause: [/\bhasBio\b/],
        inQueryBody: [/hasBio\s*=\s*sql`[^`]*->>'bio'/]
    },
    {
        name: 'a non-empty avatar',
        inPredicate: [/isNonEmpty\(input\.avatar\)/],
        inWhereClause: [/\bhasAvatar\b/],
        inQueryBody: [/hasAvatar\s*=\s*sql`[^`]*->>'avatar'/]
    }
];

function assertPresent(source: string, needles: readonly (string | RegExp)[]): void {
    for (const needle of needles) {
        if (typeof needle === 'string') {
            expect(source).toContain(needle);
        } else {
            expect(source).toMatch(needle);
        }
    }
}

describe('author indexability — the slice helpers themselves', () => {
    it('isolates listPublicAuthors instead of scanning the whole model file', () => {
        // Non-vacuity guard: every assertion below is meaningless if this slice
        // silently returned the entire file.
        expect(querySrc).toContain('listPublicAuthors');
        expect(querySrc.length).toBeLessThan(fullQuerySrc.length);
        // A method that exists in the file but NOT in this query must be absent.
        expect(querySrc).not.toContain('async getUserStats(');
    });

    it('isolates the where-clause from the condition declarations above it', () => {
        // The distinction this whole file rests on: `hasAvatar` is DECLARED in
        // the method body and APPLIED in the where-clause. Only the second one
        // decides which rows come back.
        expect(whereClauseSrc).toContain('hasAvatar');
        expect(whereClauseSrc).not.toContain("->>'avatar'");
        expect(querySrc).toContain("->>'avatar'");
        expect(whereClauseSrc.length).toBeLessThan(querySrc.length);
    });
});

describe('author indexability — page and sitemap mirror the same §6.5 conditions (R-4)', () => {
    for (const condition of ROW_CONDITIONS) {
        it(`"${condition.name}" is present in the web predicate`, () => {
            assertPresent(predicateSrc, condition.inPredicate);
        });

        it(`"${condition.name}" is APPLIED in the sitemap query's where-clause`, () => {
            assertPresent(whereClauseSrc, condition.inWhereClause);
        });

        it(`"${condition.name}" is built correctly in the sitemap query`, () => {
            assertPresent(querySrc, condition.inQueryBody);
        });
    }

    it('covers every reason the predicate can return except the request-level one', () => {
        // Ties the table above to the predicate's own vocabulary: a NEW condition
        // added to §6.5 adds a reason, and this fails until it is mirrored here
        // — which is the moment to also mirror it in the SQL.
        const reasons = [...predicateSrc.matchAll(/reason:\s*'([a-z-]+)'/g)].map((m) => m[1]);
        const distinct = [...new Set(reasons)].sort();

        expect(distinct).toEqual([
            'missing-avatar',
            'missing-bio',
            'no-published-items',
            'paginated',
            'system-account'
        ]);
        // 4 row-level conditions here + `paginated`, which is request-level.
        expect(ROW_CONDITIONS).toHaveLength(distinct.length - 1);
    });
});

describe('author indexability — the sitemap query stays conservative (§6.6)', () => {
    it('requires published content to be PUBLIC and ACTIVE and not soft-deleted', () => {
        // The divergence between the two sides is allowed in ONE direction only:
        // the page may count content this query does not, so a page can be
        // indexable without being listed. The reverse — the sitemap listing a
        // page that serves noindex — is the failure §6.6 exists to prevent.
        expect(querySrc).toMatch(/"visibility"\s*=\s*'PUBLIC'/);
        expect(querySrc).toMatch(/"lifecycle_state"\s*=\s*'ACTIVE'/);
        expect(querySrc).toMatch(/"deleted_at"\s*IS NULL/);
    });

    it('excludes soft-deleted authors themselves', () => {
        expect(querySrc).toMatch(/isNull\(users\.deletedAt\)/);
    });

    it('builds the page and count queries from ONE condition list', () => {
        // Two separately-built lists is how a `total` silently stops matching
        // the rows it counts, which paginates the sitemap wrong.
        const whereClauseUses = [...querySrc.matchAll(/\.where\(whereClause\)/g)].length;
        expect(whereClauseUses).toBe(2);
    });
});
