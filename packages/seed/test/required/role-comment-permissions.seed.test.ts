/**
 * Unit tests for the SPEC-165 comment-permission seed grants.
 *
 * Verifies the ROLE_PERMISSIONS constant directly (no DB). Literal string values
 * are used instead of @repo/schemas imports to avoid workspace module-resolution
 * issues in the Vitest runner (same approach as the sibling seed tests). Values
 * MUST match packages/schemas/src/enums/permission.enum.ts and role.enum.ts.
 *
 * Focus: SPEC-165 T-004 (AC-6, AC-7, AC-38, AC-39). "TOURIST" in the spec maps to
 * RoleEnum.USER — the public-portal logged-in user role.
 */

import { describe, expect, it } from 'vitest';
import { _internals } from '../../src/required/rolePermissions.seed.js';

// Roles (role.enum.ts)
const USER = 'USER' as const; // spec "TOURIST"
const HOST = 'HOST' as const;
const EDITOR = 'EDITOR' as const;
const ADMIN = 'ADMIN' as const;

// Comment permissions (permission.enum.ts)
const POST_COMMENT_CREATE = 'post.comment.create' as const;
const POST_COMMENT_VIEW = 'post.comment.view' as const;
const POST_COMMENT_MODERATE = 'post.comment.moderate' as const;
const EVENT_COMMENT_CREATE = 'event.comment.create' as const;
const EVENT_COMMENT_VIEW = 'event.comment.view' as const;
const EVENT_COMMENT_MODERATE = 'event.comment.moderate' as const;

const { ROLE_PERMISSIONS } = _internals;
const permsFor = (role: string): readonly string[] =>
    ROLE_PERMISSIONS[role as unknown as keyof typeof ROLE_PERMISSIONS] as unknown as string[];

describe('ROLE_PERMISSIONS — comment grants (SPEC-165 T-004)', () => {
    describe('USER / tourist (AC-6, AC-38)', () => {
        const perms = permsFor(USER);

        it('grants both _CREATE comment permissions', () => {
            expect(perms).toContain(POST_COMMENT_CREATE);
            expect(perms).toContain(EVENT_COMMENT_CREATE);
        });

        it('does NOT grant any _VIEW or _MODERATE comment permission', () => {
            expect(perms).not.toContain(POST_COMMENT_VIEW);
            expect(perms).not.toContain(POST_COMMENT_MODERATE);
            expect(perms).not.toContain(EVENT_COMMENT_VIEW);
            expect(perms).not.toContain(EVENT_COMMENT_MODERATE);
        });
    });

    describe('HOST', () => {
        const perms = permsFor(HOST);

        it('grants both _CREATE comment permissions', () => {
            expect(perms).toContain(POST_COMMENT_CREATE);
            expect(perms).toContain(EVENT_COMMENT_CREATE);
        });

        it('does NOT grant _MODERATE comment permissions', () => {
            expect(perms).not.toContain(POST_COMMENT_MODERATE);
            expect(perms).not.toContain(EVENT_COMMENT_MODERATE);
        });
    });

    describe('EDITOR (AC-7, AC-39)', () => {
        const perms = permsFor(EDITOR);

        it('grants all six comment permissions', () => {
            expect(perms).toContain(POST_COMMENT_CREATE);
            expect(perms).toContain(POST_COMMENT_VIEW);
            expect(perms).toContain(POST_COMMENT_MODERATE);
            expect(perms).toContain(EVENT_COMMENT_CREATE);
            expect(perms).toContain(EVENT_COMMENT_VIEW);
            expect(perms).toContain(EVENT_COMMENT_MODERATE);
        });
    });

    describe('ADMIN', () => {
        const perms = permsFor(ADMIN);

        it('grants all six comment permissions (same as EDITOR)', () => {
            expect(perms).toContain(POST_COMMENT_CREATE);
            expect(perms).toContain(POST_COMMENT_VIEW);
            expect(perms).toContain(POST_COMMENT_MODERATE);
            expect(perms).toContain(EVENT_COMMENT_CREATE);
            expect(perms).toContain(EVENT_COMMENT_VIEW);
            expect(perms).toContain(EVENT_COMMENT_MODERATE);
        });
    });
});
