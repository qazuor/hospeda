/**
 * Billing's real `canCharge()` (`puedeCobrarle(user)`, contract §4.1; AC:B4:5, AC:B4:6): whether
 * anything left on the account can still charge it, in any vertical. Its only reader is action 24
 * («dar de baja una cuenta a pedido de su dueño»), which waits while it answers yes.
 *
 * The answer is about the cancellation CONFIRMED by the provider, not about the row's state
 * (DEC-ARCH-006📌10): `provider_link.cancelled_seen_at` holds the first re-read that saw the
 * authorization `cancelled`, and a later live re-read empties it. A row whose authorization the
 * provider cancelled after a rejected charge keeps counting for the 16th deadline, the re-read
 * window of that cancellation (PLAZO:16; DEC-ARCH-006📌11).
 *
 * It answers the whole account, in two halves: the «fila viva» half (glossary «fila viva»
 * inventory, row 27, counted by G-R1-E) and the «marca abierta» half (glossary «marca abierta»
 * inventory, row 12, counted by G-R1-F).
 */
import {
    type BillingForVerticals,
    type CanChargeArgs,
    CanChargeArgsSchema,
    type CanChargeResponse,
    CanChargeResponseSchema,
    type Clock
} from '@repo/billing-verticals-contract';
import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    ne,
    providerLinks,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The subscription state that keeps counting only until its cancellation is confirmed. */
const CANCEL_SCHEDULED = 'CANCEL_SCHEDULED';

/** The terminal state of a row whose authorization the provider cancelled after a rejection (I-2). */
const CHARGE_DECLINED = 'CHARGE_DECLINED';

/** One subscription of the account, as `decideCanCharge` reads it. */
export interface CanChargeRow {
    /** The subscription status (`subscription.status`). */
    readonly status: string;
    /** Whether the row has a provider authorization (`provider_link`). */
    readonly hasProviderLink: boolean;
    /** `provider_link.cancelled_seen_at`: the first re-read that saw it `cancelled`, or null. */
    readonly cancelledSeenAt: Date | null;
}

/**
 * The end of the 16th deadline's window (PLAZO:16): the re-read window of a cancellation decided
 * by the provider after a rejected charge, counted from the first re-read that saw it `cancelled`.
 * The row stops counting at this instant, inclusive (I-3). The sweep's exemption uses the same one.
 *
 * @param input.seenAt - `provider_link.cancelled_seen_at`
 * @param input.days - The 16th deadline's `days`
 * @returns The first instant at which the row no longer counts
 */
export function cancellationRereadWindowEndsAt(input: {
    readonly seenAt: Date;
    readonly days: number;
}): Date {
    return new Date(input.seenAt.getTime() + input.days * DAY_MS);
}

/**
 * Whether one subscription row can still charge (glossary «fila viva» inventory, row 27):
 *
 * 1. a live row other than `CANCEL_SCHEDULED` counts, whatever its column says (a `SUSPENDED`
 *    one too: the manual payer's reopens);
 * 2. a `CANCEL_SCHEDULED` or terminal row with a provider link whose cancellation no re-read saw
 *    yet counts; a `CANCEL_SCHEDULED` without a link counts too (I-4), a terminal one does not;
 * 3. a `CHARGE_DECLINED` row whose cancellation was seen counts until the 16th deadline's window
 *    ends (I-2, I-3);
 * 4. anything else does not count.
 */
function rowCanCharge(input: {
    readonly row: CanChargeRow;
    readonly now: Date;
    readonly rereadWindowDays: number;
}): boolean {
    const { row, now, rereadWindowDays } = input;
    const live = (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status);
    if (live && row.status !== CANCEL_SCHEDULED) return true;
    if (!row.hasProviderLink) return live;
    if (row.cancelledSeenAt === null) return true;
    if (row.status !== CHARGE_DECLINED) return false;
    const endsAt = cancellationRereadWindowEndsAt({
        seenAt: row.cancelledSeenAt,
        days: rereadWindowDays
    });
    return now.getTime() < endsAt.getTime();
}

/**
 * The whole answer of `puedeCobrarle` (contract §4.1; glossary «fila viva» row 27 and «marca
 * abierta» row 12; DEC-ARCH-006📌10/📌11), pure: yes when one row of the account can still charge
 * or when a `CANCELACION_SIN_CONFIRMAR` mark is open on one of its subscriptions; no otherwise,
 * including an account with no subscriptions.
 *
 * @param input.rows - Every non-tombstone subscription of the account, with its provider link
 * @param input.openUnconfirmedCancellationMarks - Open `CANCELACION_SIN_CONFIRMAR` marks on them
 * @param input.now - The instant of the question
 * @param input.rereadWindowDays - The 16th deadline's `days`
 * @returns Whether anything left can still charge the account
 */
export function decideCanCharge(input: {
    readonly rows: readonly CanChargeRow[];
    readonly openUnconfirmedCancellationMarks: number;
    readonly now: Date;
    readonly rereadWindowDays: number;
}): boolean {
    if (input.openUnconfirmedCancellationMarks > 0) return true;
    return input.rows.some((row) =>
        rowCanCharge({ row, now: input.now, rereadWindowDays: input.rereadWindowDays })
    );
}

/** Reads the 16th deadline's version in force; the default reads the latest published one. */
export interface CanChargeDeadlines {
    current(): Promise<{ readonly values: BillingDeadlineValues }>;
}

/** The ports of the real `canCharge()`. */
export interface BillingCanChargePorts {
    /** The injected clock: the instant the 16th deadline's window is compared with. */
    readonly clock: Clock;
    /** The billing deadlines; defaults to `getCurrentBillingDeadlines()`. */
    readonly deadlines?: CanChargeDeadlines;
}

const currentBillingDeadlines: CanChargeDeadlines = {
    current: getCurrentBillingDeadlines
};

/** Every non-tombstone subscription of the account with its provider link (row 27's half). */
async function readAccountSubscriptions(input: {
    readonly db: DrizzleClient;
    readonly userId: string;
}): Promise<CanChargeRow[]> {
    const rows = await input.db
        .select({
            status: subscriptions.status,
            providerLinkId: providerLinks.id,
            cancelledSeenAt: providerLinks.cancelledSeenAt
        })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(and(eq(subscriptions.userId, input.userId), ne(subscriptions.class, 'LAPIDA')));
    return rows.map((row) => ({
        status: row.status,
        hasProviderLink: row.providerLinkId !== null,
        cancelledSeenAt: row.cancelledSeenAt ?? null
    }));
}

/** How many `CANCELACION_SIN_CONFIRMAR` marks are open on the account (row 12's half). */
async function countOpenUnconfirmedCancellationMarks(input: {
    readonly db: DrizzleClient;
    readonly userId: string;
}): Promise<number> {
    const marks = await input.db
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .innerJoin(subscriptions, eq(subscriptions.id, reconciliationMarks.subscriptionId))
        .where(
            and(
                eq(subscriptions.userId, input.userId),
                eq(reconciliationMarks.reason, 'CANCELACION_SIN_CONFIRMAR'),
                isNull(reconciliationMarks.liftedAt)
            )
        );
    return marks.length;
}

/**
 * Builds billing's real `canCharge()` (contract §4.1).
 *
 * Reads, without locking (action 24 calls it while holding rows of its own), every subscription
 * of the account with its provider link, the open `CANCELACION_SIN_CONFIRMAR` marks on them and
 * the 16th deadline in force, then applies `decideCanCharge`. A failed read throws: it never
 * answers no for an account it could not read (fails closed).
 *
 * @param args.ports - Clock and, optionally, the billing deadlines
 * @returns `{ canCharge }`
 */
export function createBillingCanCharge(args: {
    readonly ports: BillingCanChargePorts;
}): Pick<BillingForVerticals, 'canCharge'> {
    const { clock } = args.ports;
    const deadlines = args.ports.deadlines ?? currentBillingDeadlines;
    return {
        async canCharge(input: CanChargeArgs): Promise<CanChargeResponse> {
            const { userId } = CanChargeArgsSchema.parse(input);
            const db = getDb();
            const [rows, openUnconfirmedCancellationMarks, version] = await Promise.all([
                readAccountSubscriptions({ db, userId }),
                countOpenUnconfirmedCancellationMarks({ db, userId }),
                deadlines.current()
            ]);
            return CanChargeResponseSchema.parse({
                canCharge: decideCanCharge({
                    rows,
                    openUnconfirmedCancellationMarks,
                    now: clock.now(),
                    rereadWindowDays: version.values['16'].days
                })
            });
        }
    };
}
