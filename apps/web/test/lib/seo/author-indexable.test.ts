/**
 * @file author-indexable.test.ts
 * @description Table-driven tests for the shared author-page indexability
 * predicate (HOS-375 T-017, spec §6.5). One case per condition failing
 * independently, plus the all-pass case, so a regression names the condition it
 * broke instead of just "not indexable".
 */
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
