import type {
    CancelCallResult,
    ListPage,
    ObjectKind,
    PaymentRead,
    ProviderApi,
    ProviderObject,
    RefundCallResult,
    RefundRead
} from '../../cutover/types.ts';

/** One seeded provider object. */
export interface FakeObject {
    readonly kind: ObjectKind;
    readonly id: string;
    readonly status: string;
}

/** One seeded payment (the step-4b small payment). */
export interface FakePayment {
    readonly id: string;
    readonly status: string;
    readonly refundIds?: readonly string[];
}

/** Behaviour switches of the simulated provider. */
export interface FakeProviderOptions {
    readonly objects: readonly FakeObject[];
    /** Cancel calls on these ids are accepted (200) but the status never changes. */
    readonly stuckIds?: readonly string[];
    /** Ids hidden from the search walk but still readable by id (an incomplete walk). */
    readonly hiddenFromWalk?: readonly string[];
    /** Overrides the `total` the search reports, per kind. */
    readonly totalOverride?: Partial<Record<ObjectKind, number>>;
    readonly payments?: readonly FakePayment[];
    /** Status each refund reads back, by refund id (default `approved`). */
    readonly refundStatus?: Readonly<Record<string, string>>;
}

/** A simulated provider and its call log. Never touches the network. */
export interface FakeProvider {
    readonly api: ProviderApi;
    readonly calls: string[];
    readonly state: Map<string, FakeObject>;
    readonly payments: Map<string, FakePayment>;
}

/**
 * In-memory provider double. A plan set `inactive` reads back `cancelled`, like the
 * real provider (probe 50); a preapproval set `cancelled` reads back `cancelled`.
 */
export function createFakeProvider({
    objects,
    stuckIds = [],
    hiddenFromWalk = [],
    totalOverride = {},
    payments: seededPayments = [],
    refundStatus = {}
}: FakeProviderOptions): FakeProvider {
    const payments = new Map<string, FakePayment>(seededPayments.map((p) => [p.id, p]));
    let refundSeq = 0;
    const state = new Map<string, FakeObject>(objects.map((o) => [o.id, o]));
    const calls: string[] = [];
    const stuck = new Set(stuckIds);
    const hidden = new Set(hiddenFromWalk);

    const api: ProviderApi = {
        listPage: async ({ kind, offset, limit }): Promise<ListPage> => {
            calls.push(`LIST ${kind} ${offset}`);
            const visible = [...state.values()].filter((o) => o.kind === kind && !hidden.has(o.id));
            return {
                total: totalOverride[kind] ?? visible.length,
                // The search listing is deliberately stale: it reports `pending` for everything live.
                results: visible.slice(offset, offset + limit).map((o) => ({
                    id: o.id,
                    status: o.status === 'cancelled' ? 'cancelled' : 'pending'
                }))
            };
        },
        getById: async ({ kind, id }): Promise<ProviderObject> => {
            calls.push(`GET ${kind} ${id}`);
            const found = state.get(id);
            if (!found) throw new Error('not found');
            return { kind, id, status: found.status };
        },
        cancel: async ({ kind, id }): Promise<CancelCallResult> => {
            calls.push(`CANCEL ${kind} ${id}`);
            const found = state.get(id);
            if (!found) return { accepted: false, httpStatus: 404 };
            if (!stuck.has(id)) state.set(id, { ...found, status: 'cancelled' });
            return { accepted: true, httpStatus: 200 };
        },
        getPayment: async ({ paymentId }): Promise<PaymentRead> => {
            calls.push(`GET payment ${paymentId}`);
            const found = payments.get(paymentId);
            if (!found) throw new Error('not found');
            return { id: found.id, status: found.status, refundIds: found.refundIds ?? [] };
        },
        refundPayment: async ({ paymentId }): Promise<RefundCallResult> => {
            calls.push(`REFUND payment ${paymentId}`);
            const found = payments.get(paymentId);
            if (!found) return { accepted: false, httpStatus: 404, refundId: null };
            refundSeq += 1;
            const refundId = `refund-${refundSeq}`;
            payments.set(paymentId, {
                ...found,
                status: 'refunded',
                refundIds: [...(found.refundIds ?? []), refundId]
            });
            return { accepted: true, httpStatus: 201, refundId };
        },
        getRefund: async ({ paymentId, refundId }): Promise<RefundRead> => {
            calls.push(`GET refund ${refundId}`);
            if (!(payments.get(paymentId)?.refundIds ?? []).includes(refundId)) {
                throw new Error('not found');
            }
            return { id: refundId, status: refundStatus[refundId] ?? 'approved' };
        }
    };
    return { api, calls, state, payments };
}

/** Standard account: every status, one unknown to the DB, one probe. */
export const STANDARD_OBJECTS: readonly FakeObject[] = [
    { kind: 'plan', id: 'plan-active', status: 'active' },
    { kind: 'plan', id: 'plan-cancelled', status: 'cancelled' },
    { kind: 'preapproval', id: 'pre-pending', status: 'pending' },
    { kind: 'preapproval', id: 'pre-authorized', status: 'authorized' },
    { kind: 'preapproval', id: 'pre-paused', status: 'paused' },
    { kind: 'preapproval', id: 'pre-cancelled', status: 'cancelled' },
    { kind: 'preapproval', id: 'pre-unknown-to-db', status: 'authorized' },
    { kind: 'preapproval', id: 'pre-probe-kept', status: 'authorized' },
    { kind: 'preapproval', id: 'pre-probe-not-listed', status: 'pending' }
];

/** Ids the old DB knows for {@link STANDARD_OBJECTS} (it does not know `pre-unknown-to-db`). */
export const STANDARD_KNOWN = {
    planIds: ['plan-active', 'plan-cancelled'],
    preapprovalIds: ['pre-pending', 'pre-authorized', 'pre-paused', 'pre-cancelled']
} as const;
