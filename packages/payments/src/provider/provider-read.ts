/**
 * A read by id carries its instant, and a decision refuses an old one
 * (AC:B1:4, INV:D17, DEC-TEST-003#📌1).
 *
 * `ProviderRead<T>` is the ONLY way a decision receives the provider's state:
 * `readAuthorization` and `readCharge` return it, and only an implementation of
 * the interface (the adapter, the fake) builds it, through `stampProviderRead`,
 * which this package does not export. The brand is a module-private symbol, so
 * an object literal shaped like a read is not one, and neither is a clone of
 * one (`structuredClone` drops symbol keys).
 *
 * `assertFreshForAct` is the check: a read taken before the act started is
 * refused, and the act re-reads. The start of an act is the start of the
 * decision on THAT subject, never the start of the run: a nightly job that read
 * 500 subscriptions at 3:00 and reaches one of them at 3:40 has to re-read it.
 * For an administrative action, the start is its confirmation.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { z } from 'zod';

/** Module-private brand: its value is the read's instant, in epoch milliseconds. */
const PROVIDER_READ = Symbol('ProviderRead');

/** What the provider said about one resource, read by id, and when. */
export interface ProviderRead<T> {
    /** The resource as the provider answered it. */
    readonly snapshot: T;
    /** When the read was taken, by the injected clock. A fresh copy on every access. */
    readonly readAt: Date;
    /** Only an implementation of the interface sets it. */
    readonly [PROVIDER_READ]: number;
}

/**
 * Builds a read with its instant. Package-internal: the adapter and the fake
 * call it, nothing else can (it is not exported from the package entry).
 *
 * @param input.snapshot - The resource as read by id
 * @param input.clock - The injected clock; the read's instant is its `now()`
 * @returns The read, frozen
 */
export function stampProviderRead<T>(input: {
    readonly snapshot: T;
    readonly clock: Clock;
}): ProviderRead<T> {
    const readAtMs = input.clock.now().getTime();
    return Object.freeze({
        snapshot: input.snapshot,
        get readAt(): Date {
            return new Date(readAtMs);
        },
        [PROVIDER_READ]: readAtMs
    });
}

/**
 * When an act started.
 *
 * - `decision`: a job's or a customer's decision on one subject, started at
 *   `startedAt` (the decision on that subject, not the run it belongs to).
 * - `adminAction`: an administrative action; it starts when it is confirmed.
 */
export type ActStart =
    | { readonly kind: 'decision'; readonly startedAt: Date }
    | { readonly kind: 'adminAction'; readonly confirmedAt: Date };

const ActStartSchema: z.ZodType<ActStart> = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('decision'), startedAt: z.date() }),
    z.strictObject({ kind: z.literal('adminAction'), confirmedAt: z.date() })
]);

/** Why a read was refused for an act. */
export type ProviderReadRejection = 'STALE_READ' | 'NOT_A_PROVIDER_READ';

/** Constructor input of `ProviderReadRejectedError`. */
export interface ProviderReadRejectedErrorInput {
    readonly reason: ProviderReadRejection;
    readonly message: string;
    readonly readAt?: Date;
    readonly actStartedAt?: Date;
}

/** A read the act may not decide on. The act re-reads by id and tries again. */
export class ProviderReadRejectedError extends Error {
    readonly reason: ProviderReadRejection;
    readonly readAt: Date | undefined;
    readonly actStartedAt: Date | undefined;

    /**
     * @param input.reason - Stale, or not built by an implementation of the interface
     * @param input.message - Human-readable detail
     * @param input.readAt - The refused read's instant, when it has one
     * @param input.actStartedAt - The start of the act it was refused for
     */
    constructor(input: ProviderReadRejectedErrorInput) {
        super(input.message);
        this.name = 'ProviderReadRejectedError';
        this.reason = input.reason;
        this.readAt = input.readAt;
        this.actStartedAt = input.actStartedAt;
    }
}

/**
 * The instant an act starts from: its start for a decision, its confirmation
 * for an administrative action.
 *
 * @param input.act - The act
 * @returns The instant reads must not predate
 */
export function actStartInstant(input: { readonly act: ActStart }): { readonly at: Date } {
    const act = ActStartSchema.parse(input.act);
    return { at: new Date(act.kind === 'decision' ? act.startedAt : act.confirmedAt) };
}

/**
 * Hands the act the provider's state only if it was read at or after the act
 * started. Otherwise the act must re-read by id.
 *
 * @param input.read - A read by id, as `readAuthorization`/`readCharge` returned it
 * @param input.act - The act that is about to decide on it
 * @returns The snapshot the act may decide on, and when it was read
 * @throws ProviderReadRejectedError `STALE_READ` when the read predates the act,
 *   `NOT_A_PROVIDER_READ` when the object was not built by an implementation
 * @throws ZodError when `act` is not valid
 */
export function assertFreshForAct<T>(input: {
    readonly read: ProviderRead<T>;
    readonly act: ActStart;
}): { readonly snapshot: T; readonly readAt: Date } {
    const { at: actStartedAt } = actStartInstant({ act: input.act });
    const readAtMs: unknown = (input.read as Partial<ProviderRead<T>>)[PROVIDER_READ];
    if (typeof readAtMs !== 'number') {
        throw new ProviderReadRejectedError({
            reason: 'NOT_A_PROVIDER_READ',
            message: 'only a read by id built by a payment provider can carry provider state',
            actStartedAt
        });
    }
    const readAt = new Date(readAtMs);
    if (readAtMs < actStartedAt.getTime()) {
        throw new ProviderReadRejectedError({
            reason: 'STALE_READ',
            message: `read at ${readAt.toISOString()}, before the act started at ${actStartedAt.toISOString()}: re-read by id`,
            readAt,
            actStartedAt
        });
    }
    return { snapshot: input.read.snapshot, readAt };
}
