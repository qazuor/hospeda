/**
 * @file accommodation.calendar-revocation-call.ts
 * @description The single, defensive call into the calendar revocation port
 * (HOS-663, shared with HOS-1377).
 *
 * Both paths that close a host's calendar grant go through here: the
 * delete-time cascade and the host-initiated disconnect. It lives in its own
 * module, rather than in either caller, so neither has to import the other and
 * there is exactly one place that decides what a malformed adapter answer
 * means.
 *
 * Only `import type` from the cascade module: a value import would close a
 * runtime cycle, because the cascade imports this file.
 */

import type { OccupancySourceEnum } from '@repo/schemas';
import type {
    CalendarConnectionRevocationPort,
    CalendarConnectionRevocationResult
} from './accommodation.calendar-cascade';

/** Input for {@link askPortToRevoke}. */
export interface AskPortToRevokeInput {
    /** The registered adapter, or `undefined` when none is. */
    readonly port: CalendarConnectionRevocationPort | undefined;
    /** The accommodation whose connection is being closed. */
    readonly accommodationId: string;
    /** The connection's provider. */
    readonly provider: OccupancySourceEnum;
}

/**
 * Calls the port for one connection and normalises every way it can go wrong
 * into a {@link CalendarConnectionRevocationResult}.
 *
 * The shape check is not paranoia about our own adapter: the port is a
 * registration hole any caller can fill, and reading `.revoked` off whatever
 * comes back would turn a malformed adapter into an uncaught `TypeError`
 * thrown out of a delete or disconnect whose row is already written — a 500
 * for work that already happened. Anything that is not literally
 * `{ revoked: true }` or a well-formed failure is treated as a failure, so it
 * gets recorded rather than crashing.
 *
 * @param input - Port, accommodation id and provider — see {@link AskPortToRevokeInput}.
 * @returns A well-formed outcome, always. Never throws.
 *
 * @example
 * ```ts
 * const outcome = await askPortToRevoke({
 *     port: getCalendarConnectionRevocationPort(),
 *     accommodationId,
 *     provider: OccupancySourceEnum.GOOGLE_CALENDAR
 * });
 * ```
 */
export async function askPortToRevoke(
    input: AskPortToRevokeInput
): Promise<CalendarConnectionRevocationResult> {
    const { port, accommodationId, provider } = input;

    if (port === undefined) {
        return { revoked: false, reason: 'no revocation adapter registered' };
    }

    let raw: unknown;
    try {
        raw = await port.revoke({ accommodationId, provider });
    } catch (error) {
        return {
            revoked: false,
            reason: `adapter threw: ${error instanceof Error ? error.message : String(error)}`
        };
    }

    if (typeof raw !== 'object' || raw === null) {
        return { revoked: false, reason: 'adapter returned a malformed result' };
    }

    const result = raw as Partial<{ revoked: unknown; reason: unknown }>;
    if (result.revoked === true) {
        return { revoked: true };
    }
    if (result.revoked === false) {
        return {
            revoked: false,
            reason: typeof result.reason === 'string' ? result.reason : 'adapter gave no reason'
        };
    }
    return { revoked: false, reason: 'adapter returned a malformed result' };
}
