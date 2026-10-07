import type {
    CancelCallResult,
    ListPage,
    ObjectKind,
    ProviderApi,
    ProviderObject
} from '../../cutover/types.ts';

/** One seeded provider object. */
export interface FakeObject {
    readonly kind: ObjectKind;
    readonly id: string;
    readonly status: string;
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
}

/** A simulated provider and its call log. Never touches the network. */
export interface FakeProvider {
    readonly api: ProviderApi;
    readonly calls: string[];
    readonly state: Map<string, FakeObject>;
}

/**
 * In-memory provider double. A plan set `inactive` reads back `cancelled`, like the
 * real provider (probe 50); a preapproval set `cancelled` reads back `cancelled`.
 */
export function createFakeProvider({
    objects,
    stuckIds = [],
    hiddenFromWalk = [],
    totalOverride = {}
}: FakeProviderOptions): FakeProvider {
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
        }
    };
    return { api, calls, state };
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
