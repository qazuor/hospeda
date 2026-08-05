/**
 * @file public-visibility-scope.test.ts
 * @description Tests for `applyPublicVisibilityScope`.
 *
 * The rule it encodes was a live data-exposure bug: `GET /api/v1/public/posts`
 * and `GET /api/v1/public/events` returned `PRIVATE` and `DRAFT` rows to
 * anonymous visitors, because neither the routes nor the services ever
 * constrained those two columns. Reproduced against a real database — one
 * `PRIVATE` and one `DRAFT` post moved the public list's `total` from 40 to 42.
 *
 * The second half of this file is the one that matters most. The helper's first
 * version skipped the filter for actors holding `*_VIEW_PRIVATE`/`*_VIEW_DRAFT`,
 * which is cache poisoning rather than a preview feature: the public cache key
 * (`public:${path}${suffix}`) has no actor component and `cacheMiddleware` runs
 * BEFORE `authMiddleware`, so one privileged request stores unpublished rows
 * under the anonymous entry for the whole TTL. Every assertion below pins the
 * scope as actor-blind.
 */

import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import { applyPublicVisibilityScope } from '../../src/utils/public-visibility-scope';

/** An actor holding exactly the permissions given. */
const actorWith = (permissions: PermissionEnum[]): Actor =>
    ({
        id: '00000000-0000-4000-8000-000000000000',
        roles: [RoleEnum.USER],
        permissions
    }) as unknown as Actor;

const guest = actorWith([]);

const PUBLISHED = {
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
} as const;

const scope = (filters: Record<string, unknown>, actor: Actor | undefined) =>
    applyPublicVisibilityScope({ filters, actor });

describe('applyPublicVisibilityScope — the published scope', () => {
    it('constrains an unfiltered request to published content', () => {
        // The exact call the public list route makes.
        expect(scope({}, guest)).toEqual(PUBLISHED);
    });

    it('constrains a request with unrelated filters too', () => {
        // Non-vacuity guard: the scope is added, not substituted.
        expect(scope({ category: 'CULTURE' }, guest)).toEqual({
            category: 'CULTURE',
            ...PUBLISHED
        });
    });

    it('constrains an ABSENT actor, not just a guest one', () => {
        // A missing actor must not read as "no restrictions".
        expect(scope({}, undefined)).toEqual(PUBLISHED);
    });

    it('does not mutate the caller-supplied filters', () => {
        const filters = { category: 'CULTURE' };
        scope(filters, guest);
        expect(filters).toEqual({ category: 'CULTURE' });
    });
});

describe('applyPublicVisibilityScope — actor-blindness (the cache-poisoning guard)', () => {
    /**
     * Every permission that could plausibly be read as "may see unpublished
     * content", for both entities the helper serves. None of them may change
     * the result.
     */
    const PRIVILEGED = [
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.POST_VIEW_DRAFT,
        PermissionEnum.EVENT_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_DRAFT,
        PermissionEnum.EVENT_SOFT_DELETE_VIEW,
        PermissionEnum.POST_SOFT_DELETE_VIEW
    ] as const;

    it.each(PRIVILEGED)('gives an actor holding %s the anonymous scope', (permission) => {
        expect(scope({}, actorWith([permission]))).toEqual(scope({}, guest));
    });

    it('gives an actor holding ALL of them the anonymous scope', () => {
        // The strongest form: not even the full set unlocks anything, because
        // the response is stored under a key that does not know who asked.
        expect(scope({}, actorWith([...PRIVILEGED]))).toEqual(PUBLISHED);
    });

    it('still scopes an actor holding every permission the enum defines', () => {
        // A super-admin-shaped actor. If a future edit reintroduces a
        // permission branch under a different key, this catches it without the
        // test having to name that key.
        const everything = Object.values(PermissionEnum) as PermissionEnum[];

        expect(scope({}, actorWith(everything))).toEqual(PUBLISHED);
    });
});

describe('applyPublicVisibilityScope — an explicit filter wins', () => {
    it('keeps a caller-supplied visibility', () => {
        // Only reachable from a caller that is not the public HTTP schema (the
        // public query schemas cannot express PRIVATE). The helper fills gaps;
        // it does not overwrite.
        const result = scope({ visibility: VisibilityEnum.PRIVATE }, guest);

        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
    });

    it('keeps a caller-supplied lifecycleState', () => {
        const result = scope({ lifecycleState: LifecycleStatusEnum.ARCHIVED }, guest);

        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
    });

    it('still fills the OTHER field when only one was supplied', () => {
        const result = scope({ visibility: VisibilityEnum.PRIVATE }, guest);

        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});
