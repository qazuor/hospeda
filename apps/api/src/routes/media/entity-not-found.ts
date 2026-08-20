/**
 * The single answer the entity-scoped media routes give when the caller may not
 * act on the entity they named — whether because no such row exists or because
 * the row belongs to somebody else (HOS-600).
 *
 * These two routes used to answer `404 ENTITY_NOT_FOUND` for a missing entity
 * and `403 FORBIDDEN` for a foreign one, which is precisely the disclosure the
 * error contract's "a foreign resource answers 404" rule exists to prevent: the
 * 403 confirmed the id was real. The 404 also echoed the entity type and id
 * back in its message, against rule R5 — the server log keeps the raw input,
 * the client does not.
 *
 * Both branches now call this, so they cannot drift apart again.
 */

import type { Context } from 'hono';
import { createErrorResponse } from '../../utils/response-helpers';

/**
 * The message both branches share. Carries no id, no entity type and no hint
 * about which of the two situations occurred.
 */
export const MEDIA_ENTITY_NOT_FOUND_MESSAGE = 'entity not found';

/** The machine-readable code both branches share. */
export const MEDIA_ENTITY_NOT_FOUND_CODE = 'ENTITY_NOT_FOUND';

/**
 * Builds the 404 an entity-scoped media route answers when the entity is
 * missing OR is not the caller's to touch.
 *
 * @param params - Parameters object.
 * @param params.ctx - The Hono request context.
 * @returns The JSON 404 response.
 */
export const mediaEntityNotFoundResponse = ({ ctx }: { readonly ctx: Context }): Response =>
    createErrorResponse(
        { code: MEDIA_ENTITY_NOT_FOUND_CODE, message: MEDIA_ENTITY_NOT_FOUND_MESSAGE },
        ctx,
        404
    );
