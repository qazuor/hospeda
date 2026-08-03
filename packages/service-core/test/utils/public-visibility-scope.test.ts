/**
 * @file public-visibility-scope.test.ts
 * @description Tests for `applyPublicVisibilityScope`.
 *
 * The rule it encodes was a live data-exposure bug: `GET /api/v1/public/posts`
 * and `GET /api/v1/public/events` returned `PRIVATE` and `DRAFT` rows to
 * anonymous visitors, because neither the routes nor the services ever
 * constrained those two columns. Reproduced against a real database — one
 * `PRIVATE` and one `DRAFT` post moved the public list's `total` from 40 to 42.
 */

import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/types';
import { applyPublicVisibilityScope } from '../../src/utils/public-visibility-scope';

const POST_PERMISSIONS = {
    viewPrivate: PermissionEnum.POST_VIEW_PRIVATE,
    viewDraft: PermissionEnum.POST_VIEW_DRAFT
} as const;

/** An actor holding exactly the permissions given. */
const actorWith = (permissions: PermissionEnum[]): Actor =>
    ({
        id: '00000000-0000-4000-8000-000000000000',
        roles: [RoleEnum.USER],
        permissions
    }) as unknown as Actor;

const guest = actorWith([]);

const scope = (filters: Record<string, unknown>, actor: Actor | undefined) =>
    applyPublicVisibilityScope({ filters, actor, permissions: POST_PERMISSIONS });

describe('applyPublicVisibilityScope — the unprivileged default', () => {
    it('constrains an unfiltered request to published content', () => {
        // The exact call the public list route makes.
        expect(scope({}, guest)).toEqual({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('constrains a request with unrelated filters too', () => {
        // Non-vacuity guard: the scope is added, not substituted.
        expect(scope({ category: 'CULTURE' }, guest)).toEqual({
            category: 'CULTURE',
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('constrains an ABSENT actor, not just a guest one', () => {
        // A missing actor must not read as "no restrictions".
        expect(scope({}, undefined)).toEqual({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('does not mutate the caller-supplied filters', () => {
        const filters = { category: 'CULTURE' };
        scope(filters, guest);
        expect(filters).toEqual({ category: 'CULTURE' });
    });
});

describe('applyPublicVisibilityScope — privileged actors', () => {
    it('leaves visibility open for an actor who may see private rows', () => {
        const result = scope({}, actorWith([PermissionEnum.POST_VIEW_PRIVATE]));

        expect(result.visibility).toBeUndefined();
        // Still drafts-restricted: the two permissions are independent.
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('leaves lifecycleState open for an actor who may see drafts', () => {
        const result = scope({}, actorWith([PermissionEnum.POST_VIEW_DRAFT]));

        expect(result.lifecycleState).toBeUndefined();
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('adds nothing for an actor holding both', () => {
        const result = scope(
            {},
            actorWith([PermissionEnum.POST_VIEW_PRIVATE, PermissionEnum.POST_VIEW_DRAFT])
        );

        expect(result).toEqual({});
    });

    it('does not honour the EVENT permissions for a POST scope', () => {
        // The permissions are passed in per entity precisely so an event
        // permission cannot unlock post content.
        const result = scope(
            {},
            actorWith([PermissionEnum.EVENT_VIEW_PRIVATE, PermissionEnum.EVENT_VIEW_DRAFT])
        );

        expect(result).toEqual({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });
});

describe('applyPublicVisibilityScope — an explicit filter wins', () => {
    it('keeps a caller-supplied visibility', () => {
        const result = scope(
            { visibility: VisibilityEnum.PRIVATE },
            actorWith([PermissionEnum.POST_VIEW_PRIVATE])
        );

        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
    });

    it('keeps a caller-supplied lifecycleState', () => {
        const result = scope(
            { lifecycleState: LifecycleStatusEnum.DRAFT },
            actorWith([PermissionEnum.POST_VIEW_DRAFT])
        );

        expect(result.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
    });

    it('still fills the OTHER field when only one was supplied', () => {
        const result = scope({ visibility: VisibilityEnum.PRIVATE }, guest);

        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});
