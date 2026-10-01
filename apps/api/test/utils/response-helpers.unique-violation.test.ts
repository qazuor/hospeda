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
import { apiLogger } from '../../src/utils/logger';
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

    it('recovers a MULTI-WORD column by stripping the driver-reported table prefix', () => {
        // Arrange — the last-underscore-segment heuristic answers "hash" here.
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'userPushToken',
            {
                code: '23505',
                constraint: 'user_push_tokens_token_hash_unique',
                table: 'user_push_tokens'
            },
            'duplicate key value violates unique constraint "user_push_tokens_token_hash_unique"'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        const body = calls[0]?.body as { error: { message: string } };
        expect(body.error.message).toBe('A userPushToken with this token_hash already exists');
    });

    it('answers 400 VALIDATION_ERROR for a 23503 buried on the cause chain', () => {
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
        // NOT `INVALID_REFERENCE`: that string is not a ServiceErrorCode, is
        // absent from the error contract's table, and no client handles it.
        expect(body.error.code).toBe('VALIDATION_ERROR');
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

    it('logs a conflict at `warn`, not `error` with a stack (HOS-622 / HOS-283)', () => {
        // Arrange
        const { ctx } = createMockContext();
        const error = buildDbErrorWithDriverCause(
            'partner',
            { code: '23505', constraint: 'partners_slug_unique', table: 'partners' },
            'duplicate key value violates unique constraint "partners_slug_unique"'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert — a 409 is a correct response, not an application fault.
        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'ALREADY_EXISTS', status: 409 })
        );
    });
});

/**
 * HOS-1174: a constraint whose name does NOT follow Drizzle's
 * `<table>_<column>_unique` convention must not have a field invented for it.
 *
 * The old derivation had no failure mode — it stripped a suffix that might not
 * be there and took the last underscore segment regardless — so
 * `uq_accommodation_media_single_featured` (the partial unique index behind
 * HOS-1174's ORIGINAL symptom: a double click on the admin cover-image control)
 * produced `"A accommodationMedia with this featured already exists"`: an
 * internal model identifier, a field that is not a field, and broken grammar.
 * `r_entity_tag_pkey` produced `"pkey"`.
 */
describe('handleRouteError does not invent a field for a hand-named constraint (HOS-1174)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const buildDriverError = (fields: Record<string, unknown>): DbError => {
        const driverError = Object.assign(new Error('duplicate key value'), fields);
        const drizzleError = Object.assign(new Error('Failed query: insert into ...\nparams: x'), {
            cause: driverError
        });
        return new DbError('accommodationMedia', 'update', {}, drizzleError.message, drizzleError);
    };

    it('uses the purpose-written message for uq_accommodation_media_single_featured', () => {
        // Arrange — the exact constraint from the issue that opened HOS-1174.
        const { ctx, calls } = createMockContext();
        const error = buildDriverError({
            code: '23505',
            constraint: 'uq_accommodation_media_single_featured',
            table: 'accommodation_media'
        });

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.code).toBe('ALREADY_EXISTS');
        expect(body.error.message).toBe(
            'This accommodation already has a featured image. Unset the current one first.'
        );
        expect(body.error.message).not.toContain('with this featured');
    });

    it('falls back to a generic conflict message for a _pkey constraint', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDriverError({
            code: '23505',
            constraint: 'r_entity_tag_pkey',
            table: 'r_entity_tag'
        });

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { code: string; message: string } };
        expect(body.error.message).toBe('This operation conflicts with an existing record');
        expect(body.error.message).not.toContain('pkey');
    });

    it('falls back to a generic conflict message when the driver reported no constraint', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDriverError({ code: '23505' });

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(409);
        const body = calls[0]?.body as { error: { message: string } };
        expect(body.error.message).toBe('This operation conflicts with an existing record');
    });

    it('never emits the raw constraint name in the response', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDriverError({
            code: '23505',
            constraint: 'uq_accommodation_media_single_featured',
            table: 'accommodation_media'
        });

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(JSON.stringify(calls[0]?.body)).not.toContain(
            'uq_accommodation_media_single_featured'
        );
    });
});

/**
 * HOS-1174: the driver's `detail` carries the OFFENDING VALUE (e.g.
 * `Key (email)=(alice@example.com) already exists.`), and this PR is what makes
 * the chain that holds it reach `handleRouteError` at all. The property under
 * test is therefore "the 409 this PR introduces does not carry the value".
 *
 * Asserting only the ABSENCE of the value would be vacuous: with the SQLSTATE
 * detector short-circuited the response becomes a 500 `DATABASE_ERROR`, which
 * carries no `detail` either, so the test would pass with the feature off.
 * Every case below therefore pins the 409 AND the absence in the same
 * assertion set — it can only be green with the fix in place.
 */
describe('the 409 introduced by HOS-1174 never carries the driver detail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const PII_VALUE = 'secret.person@example.com';

    const buildDbErrorWithDetail = (): DbError => {
        const driverError = Object.assign(
            new Error('duplicate key value violates unique constraint "users_email_unique"'),
            {
                code: '23505',
                constraint: 'users_email_unique',
                table: 'users',
                detail: `Key (email)=(${PII_VALUE}) already exists.`
            }
        );
        const drizzleError = Object.assign(new Error('Failed query: insert into "users" ...'), {
            cause: driverError
        });
        return new DbError('user', 'create', {}, drizzleError.message, drizzleError);
    };

    it('answers 409 AND omits the offending value from the body', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = buildDbErrorWithDetail();

        // Act
        handleRouteError(error, ctx);

        // Assert — the 409 is what proves the detector ran; the absence is the
        // property. Both in one test, so neither can pass without the other.
        expect(calls[0]?.status).toBe(409);
        const serialized = JSON.stringify(calls[0]?.body);
        expect(serialized).toContain('ALREADY_EXISTS');
        expect(serialized).not.toContain(PII_VALUE);
        expect(serialized).not.toContain('already exists.');
    });

    it('logs the conflict at `warn` with only the code and status, never the error object', () => {
        // Arrange
        const { ctx } = createMockContext();
        const error = buildDbErrorWithDetail();

        // Act
        handleRouteError(error, ctx);

        // Assert — `logRouteError` passes the full error object only at `error`
        // level; the compact projection carries no stack and no cause chain.
        expect(apiLogger.warn).toHaveBeenCalledWith({
            message: 'Route error',
            code: 'ALREADY_EXISTS',
            status: 409
        });
        const warnPayload = JSON.stringify(
            (apiLogger.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
        );
        expect(warnPayload).not.toContain(PII_VALUE);
    });
});

/**
 * HOS-1174, second pass: requiring only the `_unique`/`_key` SUFFIX was not
 * the convention, it was a weaker gate that still let ~12 hand-written unique
 * INDEXES through to the last-segment heuristic. Run over the schema's real
 * constraint names, each produced a plausible-looking lie — a tourist creating
 * the same price alert twice was told "A touristPriceAlert with this ACTIVE
 * already exists".
 *
 * The gate is now the convention itself: when the driver reports the `table`,
 * the constraint name must also START with `<table>_`. Every row below fails
 * that and therefore degrades to the generic conflict message.
 */
describe('handleRouteError rejects a constraint name that does not start with its table (HOS-1174)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const buildDriverError = (constraint: string, table: string, entity: string): DbError => {
        const driverError = Object.assign(new Error('duplicate key value'), {
            code: '23505',
            constraint,
            table
        });
        const drizzleError = Object.assign(new Error('Failed query: insert into ...\nparams: x'), {
            cause: driverError
        });
        return new DbError(entity, 'create', {}, drizzleError.message, drizzleError);
    };

    /** Real (constraint, table) pairs from `packages/db/src/migrations/**`. */
    const REAL_NON_CONVENTION_INDEXES: ReadonlyArray<{
        readonly constraint: string;
        readonly table: string;
        readonly entity: string;
        /** What the suffix-only gate used to answer. */
        readonly oldLie: string;
    }> = [
        {
            constraint: 'idx_tourist_price_alerts_user_accommodation_active_unique',
            table: 'tourist_price_alerts',
            entity: 'touristPriceAlert',
            oldLie: 'active'
        },
        {
            constraint: 'idx_refunds_provider_refund_id_unique',
            table: 'billing_refunds',
            entity: 'refund',
            oldLie: 'id'
        },
        {
            constraint: 'idx_notification_log_idempotency_key',
            table: 'billing_notification_log',
            entity: 'notificationLog',
            oldLie: 'idempotency'
        },
        {
            constraint: 'conv_notif_schedules_conversation_recipient_unique',
            table: 'conversation_notification_schedules',
            entity: 'conversationNotificationSchedule',
            oldLie: 'recipient'
        },
        {
            constraint: 'promo_code_usage_customer_promo_unique',
            table: 'billing_promo_code_usage',
            entity: 'promoCodeUsage',
            oldLie: 'promo'
        }
    ];

    for (const { constraint, table, entity, oldLie } of REAL_NON_CONVENTION_INDEXES) {
        it(`answers the generic conflict message for ${constraint}`, () => {
            // Arrange
            const { ctx, calls } = createMockContext();
            const error = buildDriverError(constraint, table, entity);

            // Act
            handleRouteError(error, ctx);

            // Assert
            expect(calls[0]?.status).toBe(409);
            const body = calls[0]?.body as { error: { code: string; message: string } };
            expect(body.error.code).toBe('ALREADY_EXISTS');
            expect(body.error.message).toBe('This operation conflicts with an existing record');
            expect(body.error.message).not.toContain(`with this ${oldLie}`);
        });
    }

    it('still names the field when the constraint DOES start with its table', () => {
        // Arrange — the gate must not be so strict that it rejects the real
        // convention it exists to recognise.
        const { ctx, calls } = createMockContext();
        const error = buildDriverError('partners_slug_unique', 'partners', 'partner');

        // Act
        handleRouteError(error, ctx);

        // Assert
        const body = calls[0]?.body as { error: { message: string } };
        expect(body.error.message).toBe('A partner with this slug already exists');
    });
});
