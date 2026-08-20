import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../types';

/**
 * The single place the API composes an "entity does not exist" message (HOS-600).
 *
 * The contract in `apps/api/docs/error-contract.md` says a row that exists but
 * belongs to somebody else answers 404, byte-identical to a row that does not
 * exist — a difference in status OR message tells the caller which ids are real.
 * Status parity was already enforced; message parity was not, and that is what
 * leaked: `getByField` composed `${entityName} not found` (lowercase, from the
 * service's `ENTITY_NAME`) while the ownership branch of the very same endpoint
 * hand-wrote `'Accommodation not found'`. Both answered `404 NOT_FOUND`, so no
 * status-level audit could see it; the whole disclosure lived in one capital
 * letter.
 *
 * Two spellings of one response is the defect, not the capital — so both
 * branches now call this, and neither may compose the string itself.
 *
 * @param params - Parameters object.
 * @param params.entityName - The service's `ENTITY_NAME` (lowercase, e.g. `'accommodation'`).
 * @returns The canonical not-found message for that entity.
 */
export const buildEntityNotFoundMessage = ({
    entityName
}: {
    readonly entityName: string;
}): string => `${entityName} not found`;

/**
 * Builds the canonical NOT_FOUND {@link ServiceError} for an entity.
 *
 * Use this for BOTH branches of an anti-enumeration 404 — "no such row" and
 * "row exists but is not yours" — so the two cannot drift apart. Never pass a
 * value derived from the request (an id, a slug) into the message: rule R5 of
 * the error contract keeps the raw input in the server log only.
 *
 * @param params - Parameters object.
 * @param params.entityName - The service's `ENTITY_NAME` (lowercase, e.g. `'accommodation'`).
 * @returns A `ServiceError` carrying `NOT_FOUND` and the canonical message.
 */
export const entityNotFoundError = ({
    entityName
}: {
    readonly entityName: string;
}): ServiceError =>
    new ServiceError(ServiceErrorCode.NOT_FOUND, buildEntityNotFoundMessage({ entityName }));
