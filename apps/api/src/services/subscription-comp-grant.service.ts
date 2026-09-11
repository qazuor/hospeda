/**
 * Comp grant orchestration (HOS-1171).
 *
 * `POST /api/v1/admin/billing/subscriptions/grant-comp` calls this and nothing
 * else. It wraps `createCompSubscription` — which only inserts the row — with
 * the part that makes an ADMIN grant different from the checkout grant it
 * replaced.
 *
 * ## Why the checkout never needed any of this
 *
 * A comp used to be redeemed at NEW-SUBSCRIBER checkout, so it arrived BEFORE
 * any preapproval existed. `mp_subscription_id = NULL` was natural and there was
 * nothing to cancel. An admin grant arrives at an arbitrary moment, and the
 * customer may have a preapproval MercadoPago is actively charging. Insert the
 * comp row and walk away, and MercadoPago keeps billing someone we have just
 * declared free.
 *
 * That is the HOS-751 failure mode, which already happened here: a preapproval
 * left `authorized` after a refund charged again. Its answer was
 * `services/billing/preapproval-hard-cancel.ts`, and this module uses it rather
 * than writing a second copy.
 *
 * ## The trap in that helper, and why this is the one caller that avoids it
 *
 * `hardCancelPreapprovalBestEffort` NEVER THROWS. Its `failed` outcome is
 * "MercadoPago refused and we logged it", returned rather than raised. Calling
 * it and continuing — which is right for the two crons and the refund path,
 * whose expensive half has already happened — would here produce exactly the bug
 * this module exists to prevent: the provider says no, nothing throws, and the
 * comp is granted on top of a live preapproval.
 *
 * So this is fail-CLOSED, and on THREE of the four outcomes rather than one.
 * `cancelled` proceeds. `skipped: 'no-preapproval'` proceeds, because there was
 * nothing to cancel. `failed` aborts. And `skipped: 'adapter-unavailable'`
 * aborts too, which is the one that reads like a false positive and is not:
 * branching on the `kind` alone lumps it in with "nothing to cancel", when it
 * actually means we never reached MercadoPago at all. Proceeding there is
 * fail-open on the case that matters most, and it is made worse by what happens
 * next — the supersede write NULLS `mp_subscription_id`, which is the only
 * pointer any recovery has to the orphaned preapproval. A live preapproval with
 * nothing local referencing it is the worst state this module can produce.
 *
 * ## Two vocabularies in one column
 *
 * `billing_subscriptions.status` stores Hospeda's `SubscriptionStatusEnum` AND
 * qzpay's vocabulary, depending on which layer last wrote the row. `incomplete`
 * and `unpaid` are not members of the Hospeda enum at all. Deciding what to
 * supersede by matching the raw column against enum values — worse, in SQL —
 * therefore skips exactly those rows, and a skipped row is a preapproval left
 * charging. Everything here normalizes first
 * (`normalizeStoredSubscriptionStatus`) and compares in TypeScript.
 *
 * ## Ordering, transactions, and resumability
 *
 * Provider first, local write second — the same order `courtesy-grant.service`
 * uses, for the same reason. There is no transaction spanning MercadoPago and
 * Postgres, so one of the two has to go first, and the recoverable failure is
 * the one where the provider side succeeded and the local side did not.
 *
 * ADR-019 forbids holding a transaction across that HTTP call, so the unit of
 * atomicity is deliberately small: ONE transaction per superseded row (its
 * status change plus its audit event), and ONE transaction for the comp insert
 * plus its audit event. Between those units the operation is resumable rather
 * than atomic, and it is written so that resuming converges — a retry re-reads
 * the rows, finds the already-retired ones no longer supersedable, and finishes
 * whatever is left. A single big transaction would have to either wrap the
 * MercadoPago calls (forbidden) or batch every write after every call, which
 * turns any crash in between into preapprovals cancelled at the provider with
 * rows still `active` locally.
 *
 * Resumability is NOT free, and the gap is precise: the IN-FLIGHT row. If the
 * process dies — or MercadoPago times out on a cancel it actually processed —
 * between one row's hard-cancel and its local write, that row stays `active`
 * with its `mp_subscription_id` set. The retry then asks MercadoPago to cancel
 * an already-cancelled preapproval, which it treats as terminal and rejects,
 * which `hardCancelPreapprovalBestEffort` swallows into `failed`, which aborts.
 * Left there, the grant would be permanently unretriable through the API for
 * exactly the customer whose preapproval is already closed.
 *
 * `isPreapprovalConfirmedTerminal` closes it, by asking the PROVIDER what the
 * preapproval is before treating a refusal as a refusal — the same answer
 * `billing/reactivation-supersession-complete.ts` reached at the same wall, with
 * its ALLOW-list imported rather than re-declared so the two cannot drift.
 *
 * Two consequences of resuming that are easy to miss, and are handled:
 * `hadActiveBilling` and the superseded-id list are seeded from the audit rows
 * of earlier attempts (`readPriorSupersessions`), because on a retry the loop
 * that would otherwise set them does not run at all.
 *
 * ## One comp per customer
 *
 * A second grant is refused (`ALREADY_COMPED`) rather than created. Two comp
 * rows for one customer leave `loadEntitlements`'s `.find()` picking whichever
 * the driver returns first, so a duplicate is not merely redundant — it decides
 * the customer's plan by accident. An operator who meant a different plan needs
 * to hear that, which is why this is an error and not a silent no-op returning
 * the existing grant.
 *
 * ## The asymmetry with courtesy is deliberate
 *
 * Courtesy PAUSES the preapproval: reversible, and a cron resumes it at full
 * price when the window closes. Comp DESTROYS it: `mp_subscription_id = NULL`,
 * permanent, nothing to resume. That is why comp needs a hard-cancel and
 * courtesy must never get one.
 *
 * @module services/subscription-comp-grant
 */

import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue, SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    normalizeStoredSubscriptionStatus,
    subscriptionMatchesDomain
} from '@repo/service-core';
import { getQZPayBilling } from '../middlewares/billing.js';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';
import { resolvePlanProductDomain } from './billing/paid-subscription-create.js';
import { hardCancelPreapprovalBestEffort } from './billing/preapproval-hard-cancel.js';
import { CONFIRMED_TERMINAL_STATUSES } from './billing/reactivation-supersession-complete.js';
import { sendCompGrantedNotification } from './comp-notifications.service.js';
import { reconcilePartnerForSubscription } from './partner-reconcile.service.js';
import { createCompSubscription } from './subscription-comp-create.service.js';
import { reconcileSubscriptionLinkedEntities } from './subscription-linked-entities.service.js';

/** Trigger source recorded on both event rows this grant writes. */
const TRIGGER_SOURCE = 'admin-comp-grant' as const;

/** `metadata.reason` stamped on the audit row of a subscription this grant retired. */
const SUPERSEDE_REASON = 'superseded-by-comp-grant' as const;

/**
 * Statuses that need no action, expressed in Hospeda vocabulary.
 *
 * Written as the COMPLEMENT of what gets superseded, and that polarity is the
 * whole point. An earlier version listed the six statuses to supersede and
 * matched them in SQL; anything it had not thought of — including a status
 * added to the enum next year — was silently skipped, which here means "left
 * charging". Listing the four that are safe to ignore makes every other value,
 * known or not, supersedable by default.
 *
 * - `cancelled` / `expired` / `abandoned` are terminal: whatever preapproval
 *   they had is already closed by the path that made them terminal.
 * - `comp` has no preapproval by construction, and a live one is caught by the
 *   idempotency guard before this set is ever consulted.
 */
const NO_ACTION_STATUSES: ReadonlySet<SubscriptionStatusEnum> = new Set([
    SubscriptionStatusEnum.CANCELLED,
    SubscriptionStatusEnum.EXPIRED,
    SubscriptionStatusEnum.ABANDONED,
    SubscriptionStatusEnum.COMP
]);

/**
 * Whether a stored status leaves the customer exposed to a MercadoPago charge.
 *
 * `billing_subscriptions.status` holds TWO vocabularies — Hospeda's
 * {@link SubscriptionStatusEnum} and qzpay's, which has `incomplete`, `unpaid`,
 * `incomplete_expired` and the American `canceled` (one L). `incomplete` and
 * `unpaid` are not members of the Hospeda enum at all, so comparing the raw
 * column against enum values (which is what this used to do, in SQL) misses
 * them entirely: the row is not superseded, its preapproval is not cancelled,
 * and it goes on charging a customer we just declared free. That is precisely
 * the failure this service exists to prevent, reintroduced by a spelling.
 *
 * So the comparison happens in TypeScript, on the value
 * `normalizeStoredSubscriptionStatus` returns, and never in SQL.
 *
 * An UNKNOWN status (normalizer returns `null`) counts as supersedable. It is a
 * data-integrity signal, and of the two ways to be wrong about it, cancelling a
 * preapproval we did not fully understand is recoverable and leaving one
 * charging is not.
 *
 * @param rawStatus - The status exactly as stored on the row.
 * @returns `true` when the row must be retired before the comp is granted.
 */
function isSupersedableStatus(rawStatus: unknown): boolean {
    const normalized = normalizeStoredSubscriptionStatus(rawStatus);
    if (normalized === null) {
        return true;
    }
    return !NO_ACTION_STATUSES.has(normalized);
}

/** What an earlier, partially-completed run of this grant already did. */
interface PriorSupersessions {
    /** Subscriptions a previous attempt retired for this same customer. */
    readonly subscriptionIds: readonly string[];
    /** Whether any of them had a live preapproval that was actually cancelled. */
    readonly anyPreapprovalCancelled: boolean;
}

/**
 * Reads what a previous attempt at this grant already retired.
 *
 * This exists because the grant is RESUMABLE, and resuming loses information
 * the customer's email depends on. On a retry the rows a previous attempt
 * retired are `cancelled`, so they are no longer supersedable, so the loop that
 * sets `hadActiveBilling` never runs — and the customer gets the "you never gave
 * us a card" variant of the email even though this very grant cancelled their
 * preapproval minutes earlier. That is the same harm the `??` in
 * `notification-retry.service.ts` exists to prevent, arriving from the other
 * side.
 *
 * The audit rows are the record. Each retirement writes one with
 * `reason: 'superseded-by-comp-grant'` and an explicit `preapprovalCancelled`
 * boolean, so "did we cancel a live preapproval for this customer" survives
 * across attempts without inferring it from the rows' current state.
 *
 * The `metadata` predicates are applied in TypeScript rather than as JSONB SQL:
 * the row set is already narrowed to one customer's events for one trigger
 * source, so it is tiny, and a JSONB comparison here would buy nothing but a
 * way to be wrong.
 *
 * @param subscriptionIds - Every subscription id belonging to the customer.
 * @returns What the previous attempts retired, empty when there were none.
 */
async function readPriorSupersessions(
    subscriptionIds: readonly string[]
): Promise<PriorSupersessions> {
    if (subscriptionIds.length === 0) {
        return { subscriptionIds: [], anyPreapprovalCancelled: false };
    }

    const rows = await getDb()
        .select({
            subscriptionId: billingSubscriptionEvents.subscriptionId,
            metadata: billingSubscriptionEvents.metadata
        })
        .from(billingSubscriptionEvents)
        .where(
            and(
                inArray(billingSubscriptionEvents.subscriptionId, [...subscriptionIds]),
                eq(
                    billingSubscriptionEvents.eventType,
                    BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_CANCELLED
                ),
                eq(billingSubscriptionEvents.triggerSource, TRIGGER_SOURCE)
            )
        );

    const mine = rows.filter((row) => row.metadata?.reason === SUPERSEDE_REASON);

    return {
        subscriptionIds: [...new Set(mine.map((row) => row.subscriptionId))],
        anyPreapprovalCancelled: mine.some((row) => row.metadata?.preapprovalCancelled === true)
    };
}

/**
 * Asks MercadoPago whether a preapproval is already terminal.
 *
 * Called only after `hardCancelPreapprovalBestEffort` reported `failed`, and it
 * is what keeps a resumed grant from dead-ending. If a previous attempt died
 * between cancelling a preapproval and writing that fact locally — or
 * MercadoPago timed out on a cancel it actually processed — the retry asks it to
 * cancel an ALREADY-cancelled preapproval. MercadoPago treats `cancelled` as
 * terminal and rejects the transition (`packages/mercadopago/.../subscription.adapter.ts`
 * documents this for the inverse verb), the helper swallows that into `failed`,
 * and a `failed` aborts the grant. Without this check the grant would be
 * permanently unretriable through the API for exactly the customer whose
 * preapproval is already closed.
 *
 * The pattern and the ALLOW-list are lifted from
 * `billing/reactivation-supersession-complete.ts`, which hit this same wall and
 * solved it by re-verifying against the PROVIDER rather than local storage.
 * `CONFIRMED_TERMINAL_STATUSES` is imported from there rather than re-declared,
 * precisely so the two provider-verify paths cannot drift — note `paused` is
 * deliberately absent from it, because a paused preapproval can still resume
 * charging.
 *
 * Conservative in both failure directions: a retrieve that throws, or a status
 * outside the ALLOW-list, answers `false` and the grant still aborts.
 *
 * @param mpSubscriptionId - The preapproval MercadoPago refused to cancel.
 * @returns `true` only when the provider confirms a terminal status.
 */
async function isPreapprovalConfirmedTerminal(mpSubscriptionId: string): Promise<boolean> {
    const paymentAdapter = getQZPayBilling()?.getPaymentAdapter();
    if (!paymentAdapter) {
        return false;
    }

    try {
        const live = await paymentAdapter.subscriptions.retrieve(mpSubscriptionId);
        const status = live?.status;
        return status !== undefined && CONFIRMED_TERMINAL_STATUSES.has(status);
    } catch (error) {
        apiLogger.warn(
            {
                mpSubscriptionId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Comp grant: could not read the preapproval back from MercadoPago — treating as unresolved'
        );
        return false;
    }
}

/** Typed failures a comp grant can report. */
export type GrantCompErrorCode = 'NOT_FOUND' | 'INVALID_PLAN' | 'PROVIDER_ERROR' | 'ALREADY_COMPED';

/** What a successful grant produces. */
export interface GrantCompResult {
    /** UUID of the newly-created `status='comp'` subscription. */
    readonly subscriptionId: string;
    /** Subscriptions retired to make room for it. */
    readonly supersededSubscriptionIds: readonly string[];
    /**
     * True when at least one live MercadoPago preapproval was hard-cancelled.
     * Carried into the customer's email: someone who was being charged has to be
     * told the charging stopped, and someone who never was must not read a
     * sentence about a card they never gave us.
     */
    readonly hadActiveBilling: boolean;
}

/** Result envelope, matching `courtesy-grant.service`'s shape. */
export type GrantCompOutcome =
    | { readonly success: true; readonly data: GrantCompResult }
    | {
          readonly success: false;
          readonly error: { readonly code: GrantCompErrorCode; readonly message: string };
      };

/**
 * Grants a permanently-complimentary subscription to a customer.
 *
 * @param input.customerId - Billing customer receiving the grant.
 * @param input.planId - Plan (`billing_plans.id`) whose entitlements are granted.
 * @param input.interval - Recorded for audit; a comp is never charged either way.
 * @param input.livemode - Whether the record is in live mode.
 * @param input.actorId - The admin performing the grant, recorded on the event rows.
 * @returns The new subscription id, or a typed error. Nothing is written on error.
 *
 * @example
 * ```ts
 * const outcome = await grantCompSubscription({
 *     customerId, planId, interval: 'monthly', livemode: true, actorId: actor.id
 * });
 * if (!outcome.success) throw new HTTPException(502, { message: outcome.error.message });
 * ```
 */
export async function grantCompSubscription(input: {
    readonly customerId: string;
    readonly planId: string;
    readonly interval: 'monthly' | 'annual';
    readonly livemode: boolean;
    readonly actorId: string;
}): Promise<GrantCompOutcome> {
    const { customerId, planId, interval, livemode, actorId } = input;
    const db = getDb();

    // 0. Resolve the vertical this grant belongs to, from the plan's own column,
    //    BEFORE anything else reads or cancels a subscription. Every step below
    //    is scoped by it: which subscriptions may be superseded, which existing
    //    comp counts as a duplicate, and what the new row is stamped with.
    //
    //    `resolvePlanProductDomain` is the same authoritative read the paid
    //    checkout uses — the DB column, not the static `@repo/billing`
    //    catalogue, so an admin-created negotiated plan (HOS-1062: one row per
    //    agreement, in no catalogue) resolves correctly instead of falling into
    //    a carve-out.
    let productDomain: ProductDomainValue;
    try {
        productDomain = await resolvePlanProductDomain({ planId });
    } catch (error) {
        // Fails closed: a plan we cannot resolve is a plan we do not comp.
        // `resolvePlanProductDomain` throws only `PLAN_NOT_FOUND`, which is a
        // caller mistake the route maps to 404 — the same code the transaction
        // below returns for the same condition.
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.warn({ customerId, planId, actorId, error: message }, 'Comp grant: unknown plan');
        return {
            success: false,
            error: { code: 'NOT_FOUND', message: `Comp grant: plan '${planId}' not found` }
        };
    }

    // 1. Read the customer's whole subscription set, statuses RAW. The
    //    supersedable filter runs in TypeScript, never in SQL — see
    //    `isSupersedableStatus` for why a SQL `IN (…)` over enum values is the
    //    bug and not the shortcut.
    //
    //    HOS-1277: `productDomain` is selected and filtered on directly — this
    //    is a typed Drizzle column read straight off the row, not a
    //    `getByCustomerId()`-mapped object, so no `hydrateSubscriptionProductDomains`
    //    step is needed the way it is at qzpay-mapped call sites.
    const allRowsRaw = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            productDomain: billingSubscriptions.productDomain
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customerId),
                isNull(billingSubscriptions.deletedAt)
            )
        );

    // HOS-1277 scoped this filter to accommodation because a comp could only
    // ever BE accommodation. HOS-1160 opened comp to every vertical, so the
    // scope became the GRANTED plan's domain instead of a literal.
    //
    // The hazard it defends is unchanged and is why the filter cannot simply be
    // dropped now that more than one domain is reachable: `isSupersedableStatus`
    // supersedes anything not in `NO_ACTION_STATUSES`, so without a scope a
    // dual-owner's live gastronomy subscription would be hard-cancelled at
    // MercadoPago as a side effect of comping their unrelated accommodation
    // plan. Scoping to the granted domain is what `selectAccommodationSubscription`
    // does for plan-change (HOS-1213) and `subscriptionMatchesDomain` does
    // everywhere else — a legacy row with no `productDomain` still counts as
    // accommodation (the column post-dates most rows), every other domain fails
    // closed.
    const allRows = allRowsRaw.filter((row) => subscriptionMatchesDomain(row, productDomain));

    // 2. Idempotency, PER DOMAIN — `allRows` is already scoped above. Two clicks
    //    on the admin button used to produce two comp rows, after which
    //    `loadEntitlements`'s `.find()` picked one of them at random — including,
    //    potentially, the one on the wrong plan. Refusing is better than
    //    returning the existing grant: an operator who meant a DIFFERENT plan
    //    needs to hear that the customer already has one.
    //
    //    HOS-1160: scoped rather than global on purpose. A hotelier who also
    //    runs a restaurant can hold an accommodation comp AND a gastronomy comp
    //    — they are different products. A global check would refuse the second
    //    with `ALREADY_COMPED` naming a subscription in an unrelated vertical,
    //    which reads to the operator as a bug in the button.
    const existingComp = allRows.find(
        (row) => normalizeStoredSubscriptionStatus(row.status) === SubscriptionStatusEnum.COMP
    );
    if (existingComp) {
        return {
            success: false,
            error: {
                code: 'ALREADY_COMPED',
                message:
                    `Customer ${customerId} already has a complimentary '${productDomain}' ` +
                    `subscription (${existingComp.id}). Cancel it first if the plan needs to ` +
                    'change; granting a second one in the same vertical would leave the ' +
                    'entitlement engine choosing between them.'
            }
        };
    }

    const supersedable = allRows.filter((row) => isSupersedableStatus(row.status));

    // 3. Provider first, and OUTSIDE any transaction (ADR-019: never hold one
    //    across an HTTP call to MercadoPago).
    //
    //    Each row is closed at the provider and retired locally BEFORE the next
    //    one is touched, rather than cancelling all of them and then writing all
    //    of them. That is what makes a partial failure resumable: every write
    //    that lands has its preapproval already closed, and a retry re-reads the
    //    rows and simply finds fewer of them supersedable. Batching the writes
    //    would mean a crash between the two loops leaves preapprovals cancelled
    //    at MercadoPago and rows still `active` locally, and the retry would
    //    then re-attempt a cancel MercadoPago has no reason to accept twice.
    //
    //    `hadActiveBilling` is SEEDED from what earlier attempts already did,
    //    not started at false. On a resume the rows a previous attempt retired
    //    are `cancelled` and therefore not supersedable, so this loop does not
    //    run at all — and a flag derived only from this run would tell a
    //    customer whose preapproval this grant cancelled minutes ago that they
    //    never gave us a card. Same for the id list the audit row and the 201
    //    report.
    const prior = await readPriorSupersessions(allRows.map((row) => row.id));
    let hadActiveBilling = prior.anyPreapprovalCancelled;
    const supersededIds = new Set<string>(prior.subscriptionIds);

    for (const row of supersedable) {
        const outcome = await hardCancelPreapprovalBestEffort({
            subscriptionId: row.id,
            mpSubscriptionId: row.mpSubscriptionId,
            source: 'admin-comp-grant'
        });

        // `skipped` is TWO different situations and only one of them is safe.
        // `no-preapproval` means there is nothing to cancel — proceed. But
        // `adapter-unavailable` means we could not even ASK MercadoPago, and
        // treating that as success is fail-open on the exact case that matters:
        // the write below nulls `mp_subscription_id`, which is the only pointer
        // anyone would have to find the orphaned preapproval afterwards. A live
        // preapproval plus no local reference to it is the worst state this
        // service can produce, so it aborts like a refusal.
        let providerRefused =
            outcome.kind === 'failed' ||
            (outcome.kind === 'skipped' && outcome.reason === 'adapter-unavailable');

        /** Did THIS row have a live preapproval that is now closed? */
        let hadCancelledThisRow = outcome.kind === 'cancelled';

        // A `failed` is not proof the preapproval is open. The one gap this
        // grant's resumability really has is the in-flight row: if the process
        // dies — or MercadoPago times out on a cancel it actually processed —
        // between the hard-cancel and the local write, the row stays `active`
        // with its `mp_subscription_id` set, and the retry asks MercadoPago to
        // cancel an ALREADY-cancelled preapproval. MP treats `cancelled` as
        // terminal and rejects the transition, the helper swallows that into
        // `failed`, and the grant would abort forever for that customer.
        //
        // So ask the provider what the preapproval actually IS before deciding.
        // Same answer `billing/reactivation-supersession-complete.ts` reached
        // for the same wall, and it re-verifies against the PROVIDER rather than
        // local storage for the reason that module spells out: a local read
        // reflects the write that may not have happened.
        //
        // `adapter-unavailable` is deliberately NOT re-verified: without an
        // adapter there is nothing to ask, and inventing an affirmative answer
        // there is the fail-open this whole branch exists to prevent.
        if (outcome.kind === 'failed' && row.mpSubscriptionId) {
            const alreadyTerminal = await isPreapprovalConfirmedTerminal(row.mpSubscriptionId);
            if (alreadyTerminal) {
                apiLogger.info(
                    { customerId, subscriptionId: row.id, mpSubscriptionId: row.mpSubscriptionId },
                    'Comp grant: MercadoPago refused the cancel because the preapproval is already terminal — resuming'
                );
                providerRefused = false;
                // It WAS a live preapproval this grant closed, on an earlier
                // attempt. The customer needs the email that says so.
                hadActiveBilling = true;
                hadCancelledThisRow = true;
            }
        }

        if (providerRefused) {
            const detail =
                outcome.kind === 'failed'
                    ? `MercadoPago refused to cancel preapproval ${row.mpSubscriptionId} and does not report it as terminal: ${outcome.error}`
                    : `the MercadoPago adapter is unavailable, so preapproval ${row.mpSubscriptionId} could not be cancelled`;

            apiLogger.error(
                {
                    customerId,
                    planId,
                    actorId,
                    subscriptionId: row.id,
                    mpSubscriptionId: row.mpSubscriptionId,
                    outcome
                },
                'Comp grant aborted: the MercadoPago preapproval was not closed'
            );

            return {
                success: false,
                error: {
                    code: 'PROVIDER_ERROR',
                    message:
                        `${detail}. No comp was granted and subscription ${row.id} is still ` +
                        'billing. Retry — the grant resumes, skips whatever is already closed, ' +
                        'and accepts a preapproval MercadoPago confirms as terminal. If it keeps ' +
                        'refusing without confirming, cancel that subscription from the admin ' +
                        'panel first: a cancelled row is not superseded, so the grant stops ' +
                        'trying to close its preapproval.'
                }
            };
        }

        if (outcome.kind === 'cancelled') {
            hadActiveBilling = true;
        }

        // Retire the row and its event together. `mp_subscription_id` is nulled
        // only now, once the preapproval is provably closed (or provably absent)
        // — never on a path where we failed to reach MercadoPago.
        await withTransaction(async (tx) => {
            await tx
                .update(billingSubscriptions)
                .set({
                    status: SubscriptionStatusEnum.CANCELLED,
                    mpSubscriptionId: null,
                    canceledAt: new Date()
                })
                .where(eq(billingSubscriptions.id, row.id));

            await tx.insert(billingSubscriptionEvents).values({
                subscriptionId: row.id,
                eventType: BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_CANCELLED,
                previousStatus: row.status,
                newStatus: SubscriptionStatusEnum.CANCELLED,
                triggerSource: TRIGGER_SOURCE,
                metadata: {
                    actorId,
                    reason: SUPERSEDE_REASON,
                    mpSubscriptionId: row.mpSubscriptionId,
                    // Recorded EXPLICITLY rather than left to be inferred from
                    // `mpSubscriptionId` being non-null: this is the field a
                    // resumed attempt reads back to decide what the customer's
                    // email may claim, and an inference is one refactor away
                    // from meaning something else.
                    preapprovalCancelled: hadCancelledThisRow
                }
            });
        });

        // HOS-1280: the transaction above just committed `row.id` to CANCELLED —
        // that write, not the comp grant below, is what makes `row` stale for
        // anything reading the shared cache. The single call in step 6 (after
        // this loop) only ever names `localSubscriptionId`, so without this a
        // superseded row's OWN commerce listing link stayed PUBLIC forever: the
        // accommodation half self-heals by re-deriving the owner's current
        // subscription regardless of which id triggered it, but the commerce
        // half looks up listings by THIS subscription's id specifically, and
        // nothing else ever calls the bridge with `row.id`.
        //
        await reconcileSubscriptionLinkedEntities({
            subscriptionId: row.id,
            subscriptionStatus: SubscriptionStatusEnum.CANCELLED,
            source: TRIGGER_SOURCE
        });

        // HOS-1280 left this call out because `supersedable` was filtered to
        // accommodation, which made a partner row reachable here only through
        // `subscriptionMatchesDomain`'s accommodation fail-open. HOS-1160 scopes
        // the filter to the GRANTED domain instead, so when that domain is
        // `partner` every row in this loop is a real partner subscription being
        // retired — and `partners.subscriptionStatus` has to hear about it, or
        // the alliance keeps rendering from the subscription that was just
        // cancelled. Non-throwing by its own contract.
        if (productDomain === ProductDomainEnum.PARTNER) {
            await reconcilePartnerForSubscription({
                subscriptionId: row.id,
                subscriptionStatus: SubscriptionStatusEnum.CANCELLED,
                source: TRIGGER_SOURCE
            });
        }

        supersededIds.add(row.id);
    }

    // 4. The comp row and its audit event, atomically. `createCompSubscription`
    //    is handed this transaction so its insert, its promo stamp and the event
    //    row below either all land or none do.
    //
    //    It throws on an unknown plan, or on one whose domain disagrees with the
    //    `productDomain` resolved in step 0; those are caller mistakes the route
    //    maps to 404/422. Reaching them means the supersede loop above already
    //    ran, which is fine and is why the operation is written to be resumable:
    //    the customer is not comped, is no longer billed, and a corrected retry
    //    finishes the job.
    let localSubscriptionId: string;
    try {
        localSubscriptionId = await withTransaction(async (tx) => {
            const created = await createCompSubscription({
                customerId,
                planId,
                interval,
                productDomain,
                livemode,
                db: tx
            });

            await tx.insert(billingSubscriptionEvents).values({
                subscriptionId: created.localSubscriptionId,
                eventType: BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_COMP_GRANTED,
                newStatus: SubscriptionStatusEnum.COMP,
                triggerSource: TRIGGER_SOURCE,
                metadata: {
                    actorId,
                    planId,
                    interval,
                    productDomain,
                    supersededSubscriptionIds: [...supersededIds],
                    hadActiveBilling
                }
            });

            return created.localSubscriptionId;
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { customerId, planId, productDomain, actorId, error: message },
            'Comp grant failed'
        );

        // HOS-1160: matches the domain-mismatch message `createCompSubscription`
        // now raises, replacing the `'only accommodation plans can be comped'`
        // string it raised while comp was accommodation-only. In practice step 0
        // resolved `productDomain` from this very plan, so a mismatch means the
        // plan's row changed underneath the grant — still a 422, not a 500.
        if (message.includes('but the comp was requested for')) {
            return { success: false, error: { code: 'INVALID_PLAN', message } };
        }
        if (message.includes('not found')) {
            return { success: false, error: { code: 'NOT_FOUND', message } };
        }
        throw error;
    }

    // 5. Cache clear, POST-commit and from here rather than from
    //    `createCompSubscription`. That helper clears at the end of its own
    //    `withTransaction`, which — now that it is handed this transaction —
    //    runs BEFORE the outer commit. `clearEntitlementCache` is pure in-memory
    //    eviction and repopulates nothing itself, but a CONCURRENT reader between
    //    that clear and the commit would repopulate from the pre-commit picture
    //    and pin the stale answer for the full TTL. This call evicts that. It is
    //    also what covers the supersede writes in step 3, which the helper knows
    //    nothing about.
    clearEntitlementCache(customerId);

    // 6. INV-1: a comp never goes through MercadoPago, so no webhook will ever
    //    fire for it — the one reconciler that every other lifecycle site is
    //    called FROM the webhook has to be called here by hand instead, or the
    //    owner's accommodations keep serving the superseded subscription's
    //    cached status.
    await reconcileSubscriptionLinkedEntities({
        subscriptionId: localSubscriptionId,
        subscriptionStatus: SubscriptionStatusEnum.COMP,
        source: TRIGGER_SOURCE
    });

    // 6b. The alliance half of the same INV-1 argument (HOS-1160). A partner
    //     comp reaches `partners.subscriptionStatus` through nothing else: every
    //     other call site of that reconciler is downstream of a MercadoPago
    //     webhook, a billing cron, or an explicit admin/self-serve lifecycle
    //     action on an existing subscription, and a comp fires none of them.
    //     (HOS-1306 removed a count from this sentence — it said "nine" and was
    //     wrong by the time it was read. `test/services/subscription-linked-entities-bridge.guard.test.ts`
    //     holds the live tally.) Without this call
    //     `mapBillingStatusToPartnerState` is never invoked for the grant, the
    //     partner stays on whatever state their last real subscription left, and
    //     the courtesy HOS-278 §6.3 promised buys them nothing.
    //
    //     The mapper already knows what to do with `comp`: HOS-702 moved the live
    //     branch onto `isEntitlementGrantingStatus`, which includes it, precisely
    //     because comp used to fall into the `default` arm and archive a
    //     complimentary partner off the carousel. This is the tenth caller of an
    //     existing path, not a new one.
    //
    //     >>> COUPLING, HOS-1299 <<<
    //     This call SEALS `partners.startsAt` (see `reconcilePartnerForSubscription`,
    //     which stamps it whenever the mapper returns ACTIVE — and comp does).
    //     That seal is deliberate and load-bearing: `partner-unpaid-reaper.job.ts`
    //     decides "never paid" by `starts_at IS NULL`, NOT by reading a status, so
    //     a comped partner left with a null date is indistinguishable from a
    //     deadbeat and gets an unpaid notice on day 30 and archived on day 90 —
    //     which would make partner courtesy not work at all, the exact defect
    //     HOS-1160 exists to fix.
    //
    //     The consequence for HOS-1299, which is building unpaid-partner
    //     detection on `coalesce(payment_confirmed_through, starts_at) + N < now`:
    //     a comped partner now HAS a `starts_at` and will therefore enter that
    //     predicate's range, while legitimately having no payment behind it,
    //     because the access was given away on purpose. That detection must
    //     exclude partners whose subscription is `status = 'comp'`. The machine-
    //     readable marker for it to key on is the audit row this grant writes:
    //     `billing_subscription_events.event_type = ADMIN_SUBSCRIPTION_COMP_GRANTED`
    //     with `metadata.productDomain = 'partner'`, alongside the subscription's
    //     own `status` — no field has to be inferred from a date.
    if (productDomain === ProductDomainEnum.PARTNER) {
        await reconcilePartnerForSubscription({
            subscriptionId: localSubscriptionId,
            subscriptionStatus: SubscriptionStatusEnum.COMP,
            source: TRIGGER_SOURCE
        });
    }

    // 7. Fire-and-forget, and the OPPOSITE criterion from step 3 on purpose: a
    //    mail failure must not undo a grant that MercadoPago and the database
    //    have both already accepted, whereas a provider failure must stop the
    //    grant before either of them does anything.
    await sendCompGrantedNotification({
        subscriptionId: localSubscriptionId,
        hadActiveBilling
    }).catch((err) => {
        apiLogger.warn(
            { subscriptionId: localSubscriptionId, error: String(err) },
            'Comp granted notification failed'
        );
    });

    apiLogger.info(
        {
            subscriptionId: localSubscriptionId,
            customerId,
            planId,
            productDomain,
            actorId,
            supersededSubscriptionIds: [...supersededIds],
            hadActiveBilling
        },
        'Comp subscription granted'
    );

    return {
        success: true,
        data: {
            subscriptionId: localSubscriptionId,
            supersededSubscriptionIds: [...supersededIds],
            hadActiveBilling
        }
    };
}
