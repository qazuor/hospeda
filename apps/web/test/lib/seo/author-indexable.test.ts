/**
 * @file author-indexable.test.ts
 * @description Table-driven tests for the shared author-page indexability
 * predicate (HOS-375 T-017, spec §6.5). One case per condition failing
 * independently, plus the all-pass case, so a regression names the condition it
 * broke instead of just "not indexable".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    type AuthorIndexabilityInput,
    type AuthorNotIndexableReason,
    evaluateAuthorIndexability
} from '../../../src/lib/seo/author-indexable';

/** The editorial account after HOS-375's migrations: every condition passes. */
const INDEXABLE_AUTHOR: AuthorIndexabilityInput = {
    isSystemAccount: false,
    publishedPostsCount: 22,
    publishedEventsCount: 52,
    bio: 'Somos el equipo editorial de Hospeda.',
    avatar: 'https://cdn.example.test/equipo-hospeda.jpg',
    page: 1
};

interface FailingCase {
    readonly name: string;
    readonly override: Partial<AuthorIndexabilityInput>;
    readonly reason: AuthorNotIndexableReason;
}

/** One entry per condition in §6.5, each failing on its own. */
const FAILING_CASES: readonly FailingCase[] = [
    {
        name: 'a system account',
        override: { isSystemAccount: true },
        reason: 'system-account'
    },
    {
        name: 'no published posts or events',
        override: { publishedPostsCount: 0, publishedEventsCount: 0 },
        reason: 'no-published-items'
    },
    {
        name: 'an empty bio',
        override: { bio: '' },
        reason: 'missing-bio'
    },
    {
        name: 'an empty avatar',
        override: { avatar: '' },
        reason: 'missing-avatar'
    },
    {
        name: 'a paginated page',
        override: { page: 2 },
        reason: 'paginated'
    }
];

describe('evaluateAuthorIndexability', () => {
    it('indexes an author that satisfies every condition', () => {
        expect(evaluateAuthorIndexability(INDEXABLE_AUTHOR)).toEqual({
            isIndexable: true,
            reason: null
        });
    });

    it.each(FAILING_CASES)('does not index $name', ({ override, reason }) => {
        const result = evaluateAuthorIndexability({ ...INDEXABLE_AUTHOR, ...override });

        expect(result.isIndexable).toBe(false);
        expect(result.reason).toBe(reason);
    });

    it('counts posts and events together, so either alone is enough', () => {
        const postsOnly = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            publishedPostsCount: 1,
            publishedEventsCount: 0
        });
        const eventsOnly = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            publishedPostsCount: 0,
            publishedEventsCount: 1
        });

        expect(postsOnly.isIndexable).toBe(true);
        expect(eventsOnly.isIndexable).toBe(true);
    });

    it('treats whitespace-only bio and avatar as empty', () => {
        expect(evaluateAuthorIndexability({ ...INDEXABLE_AUTHOR, bio: '   \n ' }).reason).toBe(
            'missing-bio'
        );
        expect(evaluateAuthorIndexability({ ...INDEXABLE_AUTHOR, avatar: '  ' }).reason).toBe(
            'missing-avatar'
        );
    });

    it('treats an absent bio or avatar as failing, not as passing', () => {
        // A payload that simply did not carry the field must not index by
        // omission — the whole gate is "this page has enough substance".
        expect(evaluateAuthorIndexability({ ...INDEXABLE_AUTHOR, bio: undefined }).reason).toBe(
            'missing-bio'
        );
        expect(evaluateAuthorIndexability({ ...INDEXABLE_AUTHOR, avatar: null }).reason).toBe(
            'missing-avatar'
        );
    });

    it('treats an absent isSystemAccount as a person, matching the column default', () => {
        const result = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            isSystemAccount: undefined
        });

        expect(result.isIndexable).toBe(true);
    });

    it('treats an omitted page as page 1, which is what the sitemap passes', () => {
        const { page: _page, ...withoutPage } = INDEXABLE_AUTHOR;

        expect(evaluateAuthorIndexability(withoutPage).isIndexable).toBe(true);
    });

    it('distinguishes a FAILED content fetch from a genuinely empty author', () => {
        // The two arrive identically — both leave the totals at 0 — and
        // collapsing them de-indexes a live author on a transient 500 while the
        // sitemap keeps advertising the URL, which is the one direction §6.6
        // forbids outright.
        const genuinelyEmpty = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            publishedPostsCount: 0,
            publishedEventsCount: 0
        });
        const fetchFailed = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            publishedPostsCount: 0,
            publishedEventsCount: 0,
            contentCountsUnavailable: true
        });

        expect(genuinelyEmpty).toEqual({ isIndexable: false, reason: 'no-published-items' });
        expect(fetchFailed).toEqual({ isIndexable: true, reason: null });
    });

    it('still applies every OTHER condition when the counts are unavailable', () => {
        // The counts are the only thing the outage took away. The bio, the
        // avatar, the system-account flag and the page number all come from the
        // author payload, which loaded — an unreadable count must not be a
        // blanket "index anything".
        const inputs = { ...INDEXABLE_AUTHOR, contentCountsUnavailable: true };

        expect(evaluateAuthorIndexability({ ...inputs, bio: '' }).reason).toBe('missing-bio');
        expect(evaluateAuthorIndexability({ ...inputs, avatar: '' }).reason).toBe('missing-avatar');
        expect(evaluateAuthorIndexability({ ...inputs, isSystemAccount: true }).reason).toBe(
            'system-account'
        );
        expect(evaluateAuthorIndexability({ ...inputs, page: 2 }).reason).toBe('paginated');
    });

    it('treats an absent contentCountsUnavailable as "the counts are trustworthy"', () => {
        // Every existing caller omits the flag; omission must keep meaning
        // "0 really is zero", never "unknown".
        const result = evaluateAuthorIndexability({
            ...INDEXABLE_AUTHOR,
            publishedPostsCount: 0,
            publishedEventsCount: 0,
            contentCountsUnavailable: undefined
        });

        expect(result.reason).toBe('no-published-items');
    });

    it('reports the FIRST failing condition when several fail at once', () => {
        // Ordering matters for diagnosis: a system account with no content is
        // reported as a system account, not as an empty one.
        const result = evaluateAuthorIndexability({
            isSystemAccount: true,
            publishedPostsCount: 0,
            publishedEventsCount: 0,
            bio: '',
            avatar: '',
            page: 3
        });

        expect(result.reason).toBe('system-account');
    });
});

describe('evaluateAuthorIndexability — role-coupling static guard (HOS-375 T-031)', () => {
    /**
     * `evaluateAuthorIndexability` does not even accept a role today, which
     * is the correct design (HOS-375 §6.10.1, R-9): eligibility is decided
     * from the STORED `isSystemAccount` flag, never from a live role. Roles
     * are mutable and this property is not — coupling the two would mean
     * promoting a real editor to ADMIN silently unpublishes their author
     * page, and demoting a staff account publishes one.
     *
     * The first draft of this spec DID couple them. Since the function has no
     * `role` parameter to exercise with a value-level test, the only way to
     * pin the invariant is structurally: assert its SOURCE never references
     * role data at all. If a future edit adds a `role`/`roles` field or
     * branches on `RoleEnum`/`ADMIN`/`SUPER_ADMIN`/`EDITOR`, this fails
     * before a single indexed URL can appear or vanish as a side effect of a
     * permissions change.
     */
    it('never references role data anywhere in the module', () => {
        // Arrange — read the real source, not a copy, so the guard tracks the
        // file as it evolves and cannot go stale.
        const source = readFileSync(
            resolve(__dirname, '../../../src/lib/seo/author-indexable.ts'),
            'utf8'
        );

        // Strip comments (block + line) before scanning: the file's JSDoc
        // legitimately explains the "not a role check" decision using these
        // exact words, and that documentation must not trip the guard it
        // motivates. Only the EXECUTABLE source (types, params, logic) is
        // checked below.
        const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

        // Act / Assert
        for (const forbidden of ['RoleEnum', 'roles', 'ADMIN', 'SUPER_ADMIN', 'EDITOR']) {
            expect(codeOnly).not.toContain(forbidden);
        }
    });
});
