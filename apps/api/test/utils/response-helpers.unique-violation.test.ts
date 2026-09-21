/**
 * Regression tests for HOS-1061: `handleRouteError` must answer 409
 * `ALREADY_EXISTS` — naming the conflicting field — for a Postgres
 * unique-constraint violation, instead of falling through to the generic
 * 500 `DATABASE_ERROR`.
 *
 * Before this fix, `PUT /api/v1/admin/partners/:id` with a slug already used
 * by another partner answered 500 with zero indication of what went wrong,
 * and the admin form silently kept the operator's stale, unsaved input on
 * screen — the operator was left believing the save had succeeded.
 *
 * `@repo/db` isn't mocked here: `DbError` is a plain class with no DB
 * dependency, so these tests construct it directly with a realistic `pg`
 * message and assert on `handleRouteError`'s response body, matching the
 * `response-helpers.handle-route-error.test.ts` pattern.
 */

import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    },
    validateApiEnv: vi.fn()
}));

import { DbError } from '@repo/db/utils';
import { handleRouteError } from '../../src/utils/response-helpers';

type JsonCall = {
    body: unknown;
    status: number | undefined;
};

const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        req: { method: 'PUT', path: '/api/v1/admin/partners/test-id' },
        get: (key: string) => (key === 'requestId' ? 'req-test-1' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

describe('handleRouteError unique-constraint violation (HOS-1061)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('answers 409 ALREADY_EXISTS naming the field, for a DbError wrapping a partner slug conflict', () => {
        const { ctx, calls } = createMockContext();
        const error = new DbError(
            'partner',
            'update',
            { where: { id: 'test-id' }, data: { slug: 'duplicate-slug' } },
            'duplicate key value violates unique constraint "partners_slug_unique"'
        );

        handleRouteError(error, ctx);

        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.message).toBe('A partner with this slug already exists');
    });

    it('derives the field from a different entity/constraint (posts slug conflict)', () => {
        const { ctx, calls } = createMockContext();
        const error = new DbError(
            'posts',
            'update',
            {},
            'duplicate key value violates unique constraint "posts_slug_unique"'
        );

        handleRouteError(error, ctx);

        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.message).toBe('A posts with this slug already exists');
    });

    it('still answers 400 INVALID_REFERENCE for a foreign-key violation (unchanged behavior)', () => {
        const { ctx, calls } = createMockContext();
        const error = new DbError(
            'partner',
            'update',
            {},
            'insert or update on table "partners" violates foreign key constraint "partners_owner_id_fkey"'
        );

        handleRouteError(error, ctx);

        expect(calls[0]?.status).toBe(400);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe('INVALID_REFERENCE');
    });

    it('falls through to 500 DATABASE_ERROR for an unrelated DbError message (unchanged behavior)', () => {
        const { ctx, calls } = createMockContext();
        const error = new DbError('partner', 'update', {}, 'connection terminated unexpectedly');

        handleRouteError(error, ctx);

        expect(calls[0]?.status).toBe(500);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe('DATABASE_ERROR');
    });

    it('does not leak the raw Postgres message in `details` when HOSPEDA_API_DEBUG_ERRORS is off', () => {
        const { ctx, calls } = createMockContext();
        const error = new DbError(
            'partner',
            'update',
            {},
            'duplicate key value violates unique constraint "partners_slug_unique"'
        );

        handleRouteError(error, ctx);

        const body = calls[0]?.body as { error: { details?: unknown } };
        expect(body.error.details).toBeUndefined();
    });
});

/**
 * HOS-1174: the tests above construct a `DbError` whose MESSAGE carries the
 * Postgres constraint text. The model layer never produced that shape — it
 * copied Drizzle's wrapper message, which is only
 * `"Failed query: <SQL>\nparams: <...>"`, so the text matcher could not fire
 * in production and a unique conflict answered 500 `DATABASE_ERROR`.
 *
 * The errors below are the shape `BaseModelImpl` ACTUALLY throws now, measured
 * against a real Postgres: the constraint text and the SQLSTATE live on the
 * `cause` chain (`DbError` → `DrizzleQueryError` → `pg.DatabaseError`), never
 * on the top-level message. Detection is by SQLSTATE, never by message text.
 */
describe('handleRouteError detects the SQLSTATE through the cause chain (HOS-1174)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Builds the exact wrapping the DB layer produces for a driver failure. */
    const buildDbErrorWithDriverCause = (
        entity: string,
        driverFields: Record<string, unknown>,
        driverMessage: string
    ): DbError => {
        const driverError = Object.assign(new Error(driverMessage), driverFields);
        const drizzleError = Object.assign(
            new Error(
                'Failed query: update "partners" set "slug" = $1 where "id" = $2\nparams: duplicate-slug,test-id'
            ),
            { cause: driverError }
        );
        return new DbError(
            entity,
            'update',
            { where: { id: 'test-id' } },
            drizzleError.message,
            drizzleError
        );
    };

    it('answers 409 ALREADY_EXISTS for a 23505 buried on the cause chain, with no constraint text in the message', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'partner',
            { code: '23505', constraint: 'partners_slug_unique', table: 'partners' },
            'duplicate key value violates unique constraint "partners_slug_unique"'
        );
        expect(error.message).not.toContain('violates unique constraint');

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.message).toBe('A partner with this slug already exists');
    });

    it('names the field from the driver-reported constraint, not from a parsed message', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'user',
            { code: '23505', constraint: 'users_email_unique', table: 'users' },
            'duplicate key value violates unique constraint "users_email_unique"'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        const body = calls[0]?.body as { error: { message: string } };
        expect(body.error.message).toBe('A user with this email already exists');
    });

    it('answers 400 INVALID_REFERENCE for a 23503 buried on the cause chain', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'partner',
            { code: '23503', constraint: 'partners_owner_id_fkey', table: 'partners' },
            'insert or update on table "partners" violates foreign key constraint "partners_owner_id_fkey"'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(400);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe('INVALID_REFERENCE');
    });

    it('still answers 500 DATABASE_ERROR for a SQLSTATE that is not a constraint violation', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'partner',
            { code: '08006' },
            'connection failure'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(500);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe('DATABASE_ERROR');
    });

    it('never puts the driver `detail` (which carries the offending VALUE) in the response', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'user',
            {
                code: '23505',
                constraint: 'users_email_unique',
                detail: 'Key (email)=(secret.person@example.com) already exists.'
            },
            'duplicate key value violates unique constraint "users_email_unique"'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(JSON.stringify(calls[0]?.body)).not.toContain('secret.person@example.com');
        expect(JSON.stringify(calls[0]?.body)).not.toContain('already exists.');
    });

    it('answers 409 for a bare pg error carrying the SQLSTATE at the top level (no DbError wrapping)', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = Object.assign(new Error('duplicate key value'), {
            code: '23505',
            constraint: 'posts_slug_unique'
        });

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.message).toBe('A record with this slug already exists');
    });
});
