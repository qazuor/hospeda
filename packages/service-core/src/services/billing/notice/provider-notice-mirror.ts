import { SUBSCRIPTION_STATUSES } from '@repo/db';
import type { MirrorPairId } from './provider-notice-ports.js';

export const READ_STATES = ['pending', 'active', 'paused', 'cancelled'] as const;
export type ReadState = (typeof READ_STATES)[number];
export type RowStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type PairAction =
    | { readonly kind: 'NOOP' }
    | { readonly kind: 'S2' }
    | { readonly kind: 'PROVIDER_CANCEL' }
    | { readonly kind: 'DIVERGENCE' }
    | { readonly kind: 'DELEGATE'; readonly pair: MirrorPairId };

const noop: PairAction = { kind: 'NOOP' };
const delegate = (pair: MirrorPairId): PairAction => ({ kind: 'DELEGATE', pair });
const row = (overrides: Partial<Record<RowStatus, PairAction>>): Record<RowStatus, PairAction> =>
    Object.fromEntries(
        SUBSCRIPTION_STATUSES.map((status) => [status, overrides[status] ?? noop])
    ) as Record<RowStatus, PairAction>;

/** The mirror grid: for each state read by id from the provider, what each local row status does. */
export type ProviderNoticeMirror = Record<ReadState, Record<RowStatus, PairAction>>;

let mirror: ProviderNoticeMirror | undefined;

/**
 * Returns the provider-notice mirror grid, built on first use.
 *
 * Built lazily on purpose: `@repo/service-core` re-exports this module from its
 * barrel, and consumers that replace `@repo/db` with a whole-module mock would
 * otherwise crash at import time on `SUBSCRIPTION_STATUSES.map`.
 */
export function getProviderNoticeMirror(): ProviderNoticeMirror {
    mirror ??= buildProviderNoticeMirror();
    return mirror;
}

const buildProviderNoticeMirror = (): ProviderNoticeMirror => ({
    pending: row({
        ACTIVE: { kind: 'DIVERGENCE' },
        GRACE_PERIOD: { kind: 'DIVERGENCE' },
        PAUSED: { kind: 'DIVERGENCE' },
        SUSPENDED: { kind: 'DIVERGENCE' },
        CANCEL_SCHEDULED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CANCELLED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        ABANDONED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CHARGE_DECLINED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW')
    }),
    active: row({
        PENDING_AUTHORIZATION: { kind: 'S2' },
        GRACE_PERIOD: { kind: 'DIVERGENCE' },
        SUSPENDED: { kind: 'DIVERGENCE' },
        PAUSED: delegate('RESUME_MIRROR'),
        CANCEL_SCHEDULED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CANCELLED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        ABANDONED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CHARGE_DECLINED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW')
    }),
    paused: row({
        PENDING_AUTHORIZATION: { kind: 'DIVERGENCE' },
        SUSPENDED: { kind: 'DIVERGENCE' },
        ACTIVE: delegate('PROVIDER_PAUSE_IS_ARREARS'),
        GRACE_PERIOD: delegate('PROVIDER_PAUSE_IS_ARREARS'),
        CANCEL_SCHEDULED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CANCELLED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        ABANDONED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW'),
        CHARGE_DECLINED: delegate('LIVE_PREAPPROVAL_ON_CLOSED_ROW')
    }),
    cancelled: row({
        ACTIVE: { kind: 'PROVIDER_CANCEL' },
        GRACE_PERIOD: delegate('CANCELLED_ON_GRACE'),
        PAUSED: delegate('CANCELLED_ON_PAUSE'),
        PENDING_AUTHORIZATION: delegate('CANCELLED_WHILE_PENDING')
    })
});
