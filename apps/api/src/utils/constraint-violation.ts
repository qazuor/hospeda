/**
 * Mapping of a PostgreSQL constraint violation onto the API's error contract,
 * by SQLSTATE — never by message text (HOS-1174).
 *
 * ## Why the SQLSTATE and not the message
 *
 * Drizzle wraps every query failure in an error whose `message` is only
 * `"Failed query: <SQL>\nparams: <...>"`. The pg driver's own message (the one
 * carrying `violates unique constraint "..."`), its SQLSTATE and the offending
 * `constraint` live one level down, on `error.cause`. Until HOS-1174 the DB
 * layer copied ONLY that wrapper message into `DbError` and dropped the error
 * itself, so a text matcher could not fire on anything a model actually threw
 * and every unique conflict answered 500 `DATABASE_ERROR` — against
 * `apps/api/docs/error-contract.md` ("a 4xx is never `INTERNAL_ERROR`").
 * `BaseModelImpl` now passes the caught error as the `DbError`'s `cause`, so
 * {@link extractPostgresErrorCause} can walk to the driver error and read the
 * SQLSTATE, which is stable across Postgres versions and locales in a way the
 * message text is not.
 *
 * ## What is deliberately NOT read
 *
 * The driver also reports `detail`, which embeds the OFFENDING VALUE (e.g.
 * `Key (email)=(alice@example.com) already exists.`).
 * {@link extractPostgresErrorCause} never extracts it (see its "Scope
 * decision"), and this module only ever reads `constraint` and `table` —
 * schema metadata — so no column value can reach a response body through this
 * path. Note the one pre-existing exception, unchanged here: with
 * `HOSPEDA_API_DEBUG_ERRORS` on, `details` carries Drizzle's raw message,
 * which embeds the bound `params:` and therefore the offending value by
 * another route. That flag is off in production.
 *
 * @module utils/constraint-violation
 */

import { extractPostgresErrorCause } from '@repo/service-core';
import { env } from './env';

/** PostgreSQL SQLSTATE for `unique_violation`. */
export const PG_UNIQUE_VIOLATION = '23505';

/** PostgreSQL SQLSTATE for `foreign_key_violation`. */
export const PG_FOREIGN_KEY_VIOLATION = '23503';

/**
 * Matches a Postgres unique-violation message, e.g.:
 * `duplicate key value violates unique constraint "partners_slug_unique"`.
 *
 * SECONDARY path only, kept for a thrown value that carries this text but NO
 * SQLSTATE anywhere in its `cause` chain — i.e. something that never came from
 * the pg driver (a hand-built `Error`, a legacy re-throw). Everything that did
 * come from the driver is decided by {@link buildConstraintViolationResponse}
 * BEFORE this pattern is ever consulted, so the fragile text match can never
 * override the authoritative signal.
 */
const UNIQUE_VIOLATION_PATTERN = /violates unique constraint "([^"]+)"/;

/**
 * The message used when a unique violation cannot be attributed to a single
 * user-facing field. Deliberately does NOT use the
 * `A <entity> with this <field> already exists` shape, because that shape is a
 * promise: `apps/admin/src/features/partners/components/PartnerForm.tsx` parses
 * `/with this (\w+) already exists/i` to highlight the offending input. Emitting
 * it with an invented field name points the operator at the wrong control.
 */
const GENERIC_CONFLICT_MESSAGE = 'This operation conflicts with an existing record';

/**
 * Purpose-written messages for constraints whose names do not follow Drizzle's
 * `<table>_<column>_unique` convention, and which therefore name no single
 * field at all.
 *
 * The `uq_*_single_featured` family is a PARTIAL unique index enforcing "at
 * most one featured item per parent". It is the constraint behind HOS-1174's
 * original symptom — a double click on the admin cover-image control raced two
 * writes into it — and the naive derivation turned it into the nonsense
 * `"A accommodationMedia with this featured already exists"`: an internal model
 * identifier, a field that is not a field, and broken grammar.
 *
 * Add an entry here whenever a hand-named constraint becomes reachable from a
 * user action; the fallback for anything unlisted is
 * {@link GENERIC_CONFLICT_MESSAGE}, never a guess.
 */
const NAMED_UNIQUE_CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
    uq_accommodation_media_single_featured:
        'This accommodation already has a featured image. Unset the current one first.',
    uq_event_media_single_featured:
        'This event already has a featured image. Unset the current one first.',
    uq_experience_media_single_featured:
        'This experience already has a featured image. Unset the current one first.',
    uq_gastronomy_media_single_featured:
        'This listing already has a featured image. Unset the current one first.',
    uq_post_media_single_featured:
        'This post already has a featured image. Unset the current one first.'
};

/** Drizzle's default suffix for a generated unique constraint/index name. */
const DRIZZLE_UNIQUE_SUFFIX = /_(unique|key)$/;

/**
 * Derives the offending column name from a Postgres unique constraint name.
 *
 * Returns `null` — never a guess — when the name does not follow Drizzle's
 * `<table>_<column>_unique` (or `_key`) convention. That nullability is the
 * fix, not a detail: the previous version had no failure mode, so it answered
 * `"pkey"` for `r_entity_tag_pkey` and `"featured"` for
 * `uq_accommodation_media_single_featured`, and the caller had no way to tell
 * a real column from a fragment of a constraint name.
 *
 * When the driver reported the `table`, the column is recovered EXACTLY by
 * stripping the table prefix and the suffix, which is the only way to get a
 * multi-word column right: `user_push_tokens_token_hash_unique` over table
 * `user_push_tokens` yields `token_hash`, where the last-segment heuristic
 * yields `hash`. The heuristic is kept only for the case where no `table` was
 * reported.
 *
 * @param constraintName - The constraint name as reported by the pg driver.
 * @param tableName - The table the statement targeted, when the driver reported one.
 * @returns The column name, or `null` when the convention does not hold.
 */
export const deriveUniqueConstraintFieldName = (
    constraintName: string,
    tableName?: string
): string | null => {
    if (!DRIZZLE_UNIQUE_SUFFIX.test(constraintName)) return null;

    const withoutSuffix = constraintName.replace(DRIZZLE_UNIQUE_SUFFIX, '');
    if (withoutSuffix.length === 0) return null;

    if (tableName && withoutSuffix.startsWith(`${tableName}_`)) {
        const column = withoutSuffix.slice(tableName.length + 1);
        return column.length > 0 ? column : null;
    }

    const segments = withoutSuffix.split('_').filter(Boolean);
    return segments.at(-1) ?? null;
};

/**
 * Builds the user-facing message for a unique violation.
 *
 * Order: a purpose-written message for a hand-named constraint, then the
 * field-shaped message when the column can be derived with confidence, then
 * the generic conflict message. Only the middle case emits the
 * `with this <field> already exists` shape the admin form parses.
 *
 * @param constraintName - The constraint name reported by the driver, if any.
 * @param tableName - The table reported by the driver, if any.
 * @param entity - A human-readable entity label to name in the message.
 */
const resolveUniqueViolationMessage = (
    constraintName: string | undefined,
    tableName: string | undefined,
    entity: string
): string => {
    if (!constraintName) return GENERIC_CONFLICT_MESSAGE;

    const named = NAMED_UNIQUE_CONSTRAINT_MESSAGES[constraintName];
    if (named) return named;

    const field = deriveUniqueConstraintFieldName(constraintName, tableName);
    if (field) return `A ${entity} with this ${field} already exists`;

    return GENERIC_CONFLICT_MESSAGE;
};

/** A client-facing response derived from a PostgreSQL constraint violation. */
export type ConstraintViolationResponse = {
    readonly payload: {
        readonly code: 'ALREADY_EXISTS' | 'VALIDATION_ERROR';
        readonly message: string;
        readonly details: string | undefined;
    };
    /** `409` for a state conflict, `400` for a bad reference. */
    readonly status: 409 | 400;
};

/**
 * Maps a PostgreSQL constraint violation to its client-facing response.
 *
 * `23505` is a state conflict → **409 `ALREADY_EXISTS`**; `23503` is a
 * reference to a row that does not exist, i.e. bad input → **400
 * `VALIDATION_ERROR`**. Both pairs come straight from the table in
 * `apps/api/docs/error-contract.md`. In particular this does NOT emit
 * `INVALID_REFERENCE`, which the older message-text branches use: that string
 * is not a `ServiceErrorCode`, is absent from the contract table, and no
 * client handles it — it survived only because the branch emitting it was
 * unreachable for driver errors.
 *
 * @param error - The caught value, of unknown shape.
 * @param entity - A human-readable entity label to name in the response message.
 * @returns The response to send, or `null` when the error is not a constraint
 *   violation (or carries no SQLSTATE at all).
 */
export const buildConstraintViolationResponse = (
    error: unknown,
    entity: string
): ConstraintViolationResponse | null => {
    const postgresCause = extractPostgresErrorCause(error);
    if (!postgresCause) return null;

    const rawMessage = error instanceof Error ? error.message : String(error);
    const details = env.HOSPEDA_API_DEBUG_ERRORS ? rawMessage : undefined;

    if (postgresCause.code === PG_UNIQUE_VIOLATION) {
        return {
            payload: {
                code: 'ALREADY_EXISTS',
                message: resolveUniqueViolationMessage(
                    postgresCause.constraint,
                    postgresCause.table,
                    entity
                ),
                details
            },
            status: 409
        };
    }

    if (postgresCause.code === PG_FOREIGN_KEY_VIOLATION) {
        return {
            payload: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid reference: The specified resource does not exist',
                details
            },
            status: 400
        };
    }

    return null;
};

/**
 * Builds the 409 `ALREADY_EXISTS` error payload for a Postgres unique-violation
 * MESSAGE, or `null` if the message doesn't match that shape.
 *
 * Secondary path — see {@link UNIQUE_VIOLATION_PATTERN}. Reachable only for a
 * value that carries no SQLSTATE anywhere in its cause chain.
 *
 * @param message - The raw error message (`DbError#message` or a bare `Error#message`).
 * @param entity - A human-readable entity label to name in the response message.
 */
export const buildUniqueViolationErrorPayload = (
    message: string,
    entity: string
): { code: 'ALREADY_EXISTS'; message: string; details: string | undefined } | null => {
    const match = message.match(UNIQUE_VIOLATION_PATTERN);
    if (!match?.[1]) return null;

    return {
        code: 'ALREADY_EXISTS',
        message: resolveUniqueViolationMessage(match[1], undefined, entity),
        details: env.HOSPEDA_API_DEBUG_ERRORS ? message : undefined
    };
};
