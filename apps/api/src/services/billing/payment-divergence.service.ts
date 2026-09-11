/**
 * MercadoPago <-> local ledger divergence report (HOS-765).
 *
 * Answers the two questions an operator needs before they can rescue anything:
 *
 * 1. Which MercadoPago payments were APPROVED with no `billing_payments` row?
 *    That is the accounting hole — money moved and the books cannot see it, so
 *    it can neither be reconciled nor refunded.
 * 2. Which MercadoPago preapprovals are AUTHORIZED with no
 *    `billing_subscriptions.mp_subscription_id` pointing at them? Nothing has
 *    necessarily been charged there yet; the damage is SCHEDULED, and
 *    `nextPaymentDate` is when it lands.
 *
 * ## It proposes, it never decides
 *
 * Every divergence carries `candidates`: the local rows that COULD be its
 * counterpart, each tagged with the signals that put it there. The report never
 * picks one, and there is deliberately no code path in this module that writes
 * anything. Crediting one person's charge to another person's subscription is
 * the exact failure this area exists to prevent, and the only automated signal
 * that would let us pick — `preapproval.payer_email` — was measured EMPTY on
 * every real preapproval. A ranked list plus a human is the design, not a
 * stepping stone to auto-linking.
 *
 * ## Why BOTH sweeps always run
 *
 * The `kind` parameter filters what is RETURNED, not what is fetched. An orphan
 * preapproval's only route to a real payer identity is a payment linked to it
 * (`payment.payer.email`), so the payment sweep is load-bearing even for a
 * caller that asked for orphans only. Skipping it to honour the filter would
 * quietly turn every orphan's `payerEmailFromPayment` into `null` — which the
 * schema documents as "cannot attribute yet", so the report would lie in
 * exactly the direction that makes it useless.
 *
 * ## Soft-deleted payment rows still count as recorded
 *
 * The "is this payment in the ledger" check does NOT filter `deleted_at`. A row
 * that was written and later soft-deleted is a payment the system KNOWS about;
 * reporting it as unrecorded would invent a divergence and invite an operator to
 * backfill a duplicate. Counting without excluding deleted rows fabricates
 * findings in most queries — here, excluding them would.
 *
 * @module services/billing/payment-divergence
 */

import type { Major } from '@repo/billing';
import { toCentavos } from '@repo/billing';
import {
    billingCustomers,
    billingPayments,
    billingPendingCheckouts,
    billingSubscriptions,
    type DrizzleClient,
    getDb,
    gte,
    isNotNull,
    users
} from '@repo/db';
import type {
    BillingDivergenceCandidate,
    BillingDivergenceItem,
    BillingDivergenceKind,
    BillingDivergenceOrphanPreapproval,
    BillingDivergenceUnrecordedPayment
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import {
    type MpPacedClient,
    type MpPaymentRecord,
    type MpPreapprovalRecord,
    searchApprovedPayments,
    searchPreapprovals
} from '../../utils/mp-reconciliation-search.js';

/**
 * How far back the report looks when the caller names no window.
 *
 * 90 days rather than "everything": each page of each sweep is a PACED
 * MercadoPago call (350 ms apart, by measurement), so an unbounded window turns
 * one admin request into a multi-minute crawl.
 */
export const DEFAULT_DIVERGENCE_WINDOW_DAYS = 90;

/**
 * Extra slack applied to the `since` bound when reading LOCAL rows.
 *
 * A payment approved just inside the window can have been recorded locally a
 * little before its MercadoPago `date_created` (clock skew, a webhook that
 * landed on the preceding row). Reading local rows from a slightly earlier point
 * means a genuinely-recorded payment near the boundary is recognised as
 * recorded, instead of being reported as a divergence that does not exist.
 */
const LOCAL_LOOKBACK_SLACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Result of {@link computeBillingDivergences}. */
export interface BillingDivergenceReport {
    /** The page of divergences the caller asked for. */
    readonly items: readonly BillingDivergenceItem[];
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
        readonly hasNextPage: boolean;
        readonly hasPreviousPage: boolean;
    };
    /**
     * True when either MercadoPago sweep hit its page ceiling, so `total` is a
     * FLOOR rather than a count. The screen must say so: a partial report that
     * presents itself as complete is worse than no report.
     */
    readonly truncated: boolean;
    /** How many MercadoPago requests this report cost, for the operator's benefit. */
    readonly mpCallCount: number;
    /** How many of those came back `429` and were retried. */
    readonly mpRateLimitedCount: number;
}

/**
 * Every provider payment id the local ledger already knows about.
 *
 * `billing_payments` stores provider ids in the `provider_payment_ids` JSONB
 * (`{ "<provider>": "<id>" }`), not in a scalar column, so membership is decided
 * in memory over a bounded window rather than by a JSONB containment predicate
 * per id. That is deliberate: a JS array interpolated into a Drizzle `sql`
 * template is NOT a Postgres array, and the `= ANY(...)` form that looks correct
 * fails at runtime — reliably enough that it has already shipped as a bug here.
 *
 * @param params - Drizzle client and the oldest row to consider.
 * @returns The set of provider payment ids present locally.
 */
async function loadRecordedProviderPaymentIds(params: {
    readonly db: DrizzleClient;
    readonly since: Date;
}): Promise<Set<string>> {
    const rows = await params.db
        .select({ providerPaymentIds: billingPayments.providerPaymentIds })
        .from(billingPayments)
        .where(gte(billingPayments.createdAt, params.since));

    const known = new Set<string>();
    for (const row of rows) {
        const ids = row.providerPaymentIds;
        if (!ids || typeof ids !== 'object' || Array.isArray(ids)) {
            continue;
        }
        for (const value of Object.values(ids as Record<string, unknown>)) {
            if (typeof value === 'string' && value.length > 0) {
                known.add(value);
            }
        }
    }
    return known;
}

/** Every preapproval id some local subscription already claims. */
async function loadLinkedPreapprovalIds(db: DrizzleClient): Promise<Set<string>> {
    const rows = await db
        .select({ mpSubscriptionId: billingSubscriptions.mpSubscriptionId })
        .from(billingSubscriptions)
        .where(isNotNull(billingSubscriptions.mpSubscriptionId));

    return new Set(rows.map((row) => row.mpSubscriptionId).filter((id): id is string => !!id));
}

/**
 * A local row, joined once, that candidate matching runs over in memory.
 *
 * Loaded as one bounded set rather than queried per divergence: a per-item query
 * would multiply an already-paced request by the number of divergences, and the
 * candidate pool is inherently small (it is the set of checkouts that never
 * resolved).
 */
interface LocalCandidateRow {
    readonly localSubscriptionId: string;
    readonly localSubscriptionStatus: string;
    readonly customerId: string | null;
    readonly customerEmail: string | null;
    readonly customerDisplayName: string | null;
    readonly pendingCheckoutId: string | null;
    readonly pendingCheckoutPayerEmail: string | null;
    readonly pendingCheckoutNonce: string | null;
    readonly mpPreapprovalPlanId: string | null;
    readonly createdAt: Date;
}

/**
 * Load the local rows a divergence could be bound to.
 *
 * Sourced from `billing_pending_checkouts` joined to its subscription and
 * customer — a checkout row is precisely "somebody started paying and we never
 * finished the story", which is the population an orphan belongs to.
 *
 * @param params - Drizzle client and the oldest row to consider.
 * @returns Candidate rows, newest first.
 */
async function loadLocalCandidates(params: {
    readonly db: DrizzleClient;
    readonly since: Date;
}): Promise<readonly LocalCandidateRow[]> {
    const rows = await params.db
        .select({
            localSubscriptionId: billingSubscriptions.id,
            localSubscriptionStatus: billingSubscriptions.status,
            customerId: billingCustomers.id,
            customerEmail: billingCustomers.email,
            userDisplayName: users.displayName,
            customerName: billingCustomers.name,
            pendingCheckoutId: billingPendingCheckouts.id,
            pendingCheckoutPayerEmail: billingPendingCheckouts.payerEmail,
            pendingCheckoutNonce: billingPendingCheckouts.nonce,
            mpPreapprovalPlanId: billingPendingCheckouts.mpPreapprovalPlanId,
            createdAt: billingPendingCheckouts.createdAt
        })
        .from(billingPendingCheckouts)
        .innerJoin(
            billingSubscriptions,
            sql`${billingSubscriptions.id} = ${billingPendingCheckouts.localSubscriptionId}`
        )
        .leftJoin(
            billingCustomers,
            sql`${billingCustomers.id} = ${billingPendingCheckouts.customerId}`
        )
        .leftJoin(users, sql`${users.id}::text = ${billingCustomers.externalId}`)
        .where(gte(billingPendingCheckouts.createdAt, params.since));

    return rows.map((row) => ({
        localSubscriptionId: row.localSubscriptionId,
        localSubscriptionStatus: row.localSubscriptionStatus ?? 'unknown',
        customerId: row.customerId ?? null,
        customerEmail: row.customerEmail ?? null,
        customerDisplayName: row.userDisplayName ?? row.customerName ?? null,
        pendingCheckoutId: row.pendingCheckoutId ?? null,
        pendingCheckoutPayerEmail: row.pendingCheckoutPayerEmail ?? null,
        pendingCheckoutNonce: row.pendingCheckoutNonce ?? null,
        mpPreapprovalPlanId: row.mpPreapprovalPlanId ?? null,
        createdAt: row.createdAt
    }));
}

/** Case-insensitive, trimmed email equality where both sides must be present. */
function emailsMatch(a: string | null, b: string | null): boolean {
    if (!a || !b) {
        return false;
    }
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Project a local row into the wire shape, carrying the signals that matched. */
function toCandidate(
    row: LocalCandidateRow,
    matchedOn: readonly string[]
): BillingDivergenceCandidate {
    return {
        localSubscriptionId: row.localSubscriptionId,
        localSubscriptionStatus: row.localSubscriptionStatus,
        customerId: row.customerId,
        customerEmail: row.customerEmail,
        customerDisplayName: row.customerDisplayName,
        pendingCheckoutId: row.pendingCheckoutId,
        pendingCheckoutPayerEmail: row.pendingCheckoutPayerEmail,
        createdAt: row.createdAt,
        matchedOn: [...matchedOn]
    };
}

/**
 * Rank candidates so the strongest evidence sorts first.
 *
 * Ordering only — it never drops a weaker candidate, because "the only candidate
 * that matched" and "the candidate that matched best" are different claims and
 * the operator is the one entitled to tell them apart.
 */
function rankCandidates(
    candidates: readonly BillingDivergenceCandidate[]
): BillingDivergenceCandidate[] {
    return [...candidates].sort((a, b) => b.matchedOn.length - a.matchedOn.length);
}

/**
 * Find the local rows an ORPHAN PREAPPROVAL could belong to.
 *
 * Signals, strongest first:
 * - `external-reference` — the preapproval carries a checkout nonce. This is an
 *   unforgeable server-side secret, so a match here is near-proof.
 * - `payer-email` — the checkout's payer-email snapshot matches the email
 *   recovered from a LINKED PAYMENT (never `preapproval.payer_email`, which is
 *   empty in practice).
 * - `mp-plan-id` — same commercial plan. Shared by every buyer of that plan and
 *   present in the public share-link URL, so on its own it proves nothing at all.
 */
function findPreapprovalCandidates(params: {
    readonly preapproval: MpPreapprovalRecord;
    readonly payerEmailFromPayment: string | null;
    readonly locals: readonly LocalCandidateRow[];
}): BillingDivergenceCandidate[] {
    const { preapproval, payerEmailFromPayment, locals } = params;
    const found: BillingDivergenceCandidate[] = [];

    for (const row of locals) {
        const matchedOn: string[] = [];

        if (
            preapproval.externalReference &&
            row.pendingCheckoutNonce &&
            preapproval.externalReference === row.pendingCheckoutNonce
        ) {
            matchedOn.push('external-reference');
        }
        if (
            emailsMatch(row.pendingCheckoutPayerEmail, payerEmailFromPayment) ||
            emailsMatch(row.customerEmail, payerEmailFromPayment)
        ) {
            matchedOn.push('payer-email');
        }
        if (
            preapproval.preapprovalPlanId &&
            row.mpPreapprovalPlanId &&
            preapproval.preapprovalPlanId === row.mpPreapprovalPlanId
        ) {
            matchedOn.push('mp-plan-id');
        }

        if (matchedOn.length > 0) {
            found.push(toCandidate(row, matchedOn));
        }
    }

    return rankCandidates(found);
}

/**
 * Find the local rows an UNRECORDED PAYMENT could belong to.
 *
 * `preapproval-id` is the decisive one: on a real charge MercadoPago reports the
 * payer AND the subscription together, so a payment naming a preapproval that a
 * local subscription already claims is not a guess. When it names none (the $0
 * authorization charge), only the email is left.
 */
function findPaymentCandidates(params: {
    readonly payment: MpPaymentRecord;
    readonly locals: readonly LocalCandidateRow[];
    readonly subscriptionIdByPreapproval: ReadonlyMap<string, string>;
}): BillingDivergenceCandidate[] {
    const { payment, locals, subscriptionIdByPreapproval } = params;
    const linkedSubscriptionId = payment.preapprovalId
        ? subscriptionIdByPreapproval.get(payment.preapprovalId)
        : undefined;

    const found: BillingDivergenceCandidate[] = [];

    for (const row of locals) {
        const matchedOn: string[] = [];

        if (linkedSubscriptionId && linkedSubscriptionId === row.localSubscriptionId) {
            matchedOn.push('preapproval-id');
        }
        if (
            emailsMatch(row.pendingCheckoutPayerEmail, payment.payerEmail) ||
            emailsMatch(row.customerEmail, payment.payerEmail)
        ) {
            matchedOn.push('payer-email');
        }

        if (matchedOn.length > 0) {
            found.push(toCandidate(row, matchedOn));
        }
    }

    return rankCandidates(found);
}

/**
 * Map a subscription's preapproval id to its local id, for payment correlation.
 */
async function loadSubscriptionIdByPreapproval(db: DrizzleClient): Promise<Map<string, string>> {
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId
        })
        .from(billingSubscriptions)
        .where(isNotNull(billingSubscriptions.mpSubscriptionId));

    const map = new Map<string, string>();
    for (const row of rows) {
        if (row.mpSubscriptionId) {
            map.set(row.mpSubscriptionId, row.id);
        }
    }
    return map;
}

/**
 * Compute the divergence report.
 *
 * Read-only: this function performs no writes of any kind, and must stay that
 * way. Rescue is {@link module:services/billing/payment-reconcile}'s job, behind
 * an explicit operator decision.
 *
 * @param params - MercadoPago client, window, paging and optional kind filter.
 * @returns One page of divergences plus the sweep's own honesty flags.
 */
export async function computeBillingDivergences(params: {
    readonly client: MpPacedClient;
    readonly since: Date;
    readonly page: number;
    readonly pageSize: number;
    readonly kind?: BillingDivergenceKind;
    readonly db?: DrizzleClient;
}): Promise<BillingDivergenceReport> {
    const { client, since, page, pageSize, kind } = params;
    const db = params.db ?? getDb();
    const localSince = new Date(since.getTime() - LOCAL_LOOKBACK_SLACK_MS);

    // Both MercadoPago sweeps always run — see the module JSDoc on why `kind`
    // cannot be pushed down into the fetch.
    const [paymentSweep, preapprovalSweep] = [
        await searchApprovedPayments({ client, since }),
        await searchPreapprovals({ client, status: 'authorized' })
    ];

    const [recordedIds, linkedPreapprovalIds, locals, subscriptionIdByPreapproval] =
        await Promise.all([
            loadRecordedProviderPaymentIds({ db, since: localSince }),
            loadLinkedPreapprovalIds(db),
            loadLocalCandidates({ db, since: localSince }),
            loadSubscriptionIdByPreapproval(db)
        ]);

    // Payment index by preapproval, so an orphan can borrow a real payer email.
    const paymentsByPreapproval = new Map<string, MpPaymentRecord>();
    for (const payment of paymentSweep.items) {
        if (payment.preapprovalId && !paymentsByPreapproval.has(payment.preapprovalId)) {
            paymentsByPreapproval.set(payment.preapprovalId, payment);
        }
    }

    const unrecordedPayments: BillingDivergenceUnrecordedPayment[] = paymentSweep.items
        .filter((payment) => !recordedIds.has(payment.id))
        .map((payment) => ({
            kind: 'unrecorded-payment' as const,
            mpPaymentId: payment.id,
            mpStatus: payment.status,
            mpStatusDetail: payment.statusDetail,
            amountInCents: toCentavos(payment.transactionAmount as Major),
            currency: payment.currencyId,
            approvedAt: payment.dateApproved ? new Date(payment.dateApproved) : null,
            createdAt: new Date(payment.dateCreated),
            payerEmail: payment.payerEmail,
            payerId: payment.payerId,
            preapprovalId: payment.preapprovalId,
            externalReference: payment.externalReference,
            description: payment.description,
            candidates: findPaymentCandidates({ payment, locals, subscriptionIdByPreapproval })
        }));

    const orphanPreapprovals: BillingDivergenceOrphanPreapproval[] = preapprovalSweep.items
        .filter((preapproval) => !linkedPreapprovalIds.has(preapproval.id))
        .map((preapproval) => {
            const sourcePayment = paymentsByPreapproval.get(preapproval.id) ?? null;
            const payerEmailFromPayment = sourcePayment?.payerEmail ?? null;

            return {
                kind: 'orphan-preapproval' as const,
                preapprovalId: preapproval.id,
                mpStatus: preapproval.status,
                reason: preapproval.reason,
                amountInCents:
                    preapproval.transactionAmount === null
                        ? null
                        : toCentavos(preapproval.transactionAmount as Major),
                currency: preapproval.currencyId,
                createdAt: new Date(preapproval.dateCreated),
                nextPaymentDate: preapproval.nextPaymentDate
                    ? new Date(preapproval.nextPaymentDate)
                    : null,
                externalReference: preapproval.externalReference,
                preapprovalPlanId: preapproval.preapprovalPlanId,
                payerId: preapproval.payerId,
                payerEmail: preapproval.payerEmail,
                payerEmailFromPayment,
                sourcePaymentId: sourcePayment?.id ?? null,
                candidates: findPreapprovalCandidates({
                    preapproval,
                    payerEmailFromPayment,
                    locals
                })
            };
        });

    const all: BillingDivergenceItem[] = [
        ...(kind === 'orphan-preapproval' ? [] : unrecordedPayments),
        ...(kind === 'unrecorded-payment' ? [] : orphanPreapprovals)
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    apiLogger.info(
        {
            since: since.toISOString(),
            unrecordedPayments: unrecordedPayments.length,
            orphanPreapprovals: orphanPreapprovals.length,
            mpCallCount: client.callCount,
            mpRateLimitedCount: client.rateLimitedCount,
            truncated: paymentSweep.truncated || preapprovalSweep.truncated
        },
        'HOS-765 divergence report computed'
    );

    return {
        items: all.slice(offset, offset + pageSize),
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        },
        truncated: paymentSweep.truncated || preapprovalSweep.truncated,
        mpCallCount: client.callCount,
        mpRateLimitedCount: client.rateLimitedCount
    };
}
