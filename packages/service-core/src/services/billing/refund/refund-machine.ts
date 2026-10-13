import type { REFUND_STATUSES } from '@repo/db';

/** A `refund.status` value (`REFUND_STATUSES` of `@repo/db`, B5.md AC:B5:12). */
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * The refund statuses, declared here as values so this module never evaluates
 * `@repo/db` at load time. A unit test asserts they equal `REFUND_STATUSES`.
 */
export const REFUND_MACHINE_STATUSES = [
    'REQUESTED',
    'CONFIRMED',
    'EXECUTED',
    'FAILED'
] as const satisfies readonly RefundStatus[];

/** The five refund transitions of the catalogue (TRANS:B:RF1 to TRANS:B:RF5). */
export type RefundTransition = 'RF1' | 'RF2' | 'RF3' | 'RF4' | 'RF5';

/** One row of the minimal refund machine. `NO_ROW` is the "(sin fila)" origin. */
export type RefundTransitionRule = {
    readonly from: readonly (RefundStatus | 'NO_ROW')[];
    readonly to: RefundStatus;
    readonly via: 'PROVIDER' | 'EXTERNAL' | null;
    readonly owner: 'B5' | 'B6';
};

/**
 * The minimal refund machine (DEC-RF-008; AC:B5:12): `REQUESTED → CONFIRMED →
 * EXECUTED | FAILED`. B5 builds RF1 and RF4; RF2, RF3 and RF5 belong to B6
 * (Phase 2) and are only declared. RF4 also closes an open `REQUESTED`
 * (AC:B5:41, owner decision CT of 2026-10-07; notes H4), which is the only way
 * a `REQUESTED` reaches `EXECUTED` without `CONFIRMED`. `EXECUTED` and `FAILED`
 * are terminal.
 */
export const REFUND_TRANSITIONS: Readonly<Record<RefundTransition, RefundTransitionRule>> = {
    RF1: { from: ['NO_ROW'], to: 'REQUESTED', via: null, owner: 'B5' },
    RF2: { from: ['REQUESTED'], to: 'CONFIRMED', via: null, owner: 'B6' },
    RF3: { from: ['CONFIRMED'], to: 'EXECUTED', via: 'PROVIDER', owner: 'B6' },
    RF4: { from: ['NO_ROW', 'REQUESTED'], to: 'EXECUTED', via: 'EXTERNAL', owner: 'B5' },
    RF5: { from: ['REQUESTED', 'CONFIRMED'], to: 'FAILED', via: null, owner: 'B6' }
};

/**
 * Whether a transition may leave the given origin.
 *
 * @param input - The transition and the current status (`NO_ROW` when no row exists yet).
 * @returns `{ allowed }`; nothing leaves `EXECUTED` or `FAILED`.
 */
export function canRefundTransition(input: {
    readonly transition: RefundTransition;
    readonly from: RefundStatus | 'NO_ROW';
}): { readonly allowed: boolean } {
    return { allowed: REFUND_TRANSITIONS[input.transition].from.includes(input.from) };
}

/**
 * The reasons an RF1 refund request is born with (notes H10):
 * - `REVOCATION`: S36, the revocation within 10 days, for the last credited payment;
 * - `ADDON_ORPHAN`: S21, the last charge of an add-on whose principal S36 removed;
 * - `ONE_TIME_ADDON_REVOCATION`: S36 over the payment of each `UNA_VEZ` instance its orphaning turns off;
 * - `MARK_PROPOSAL`: a person proposing a refund from a reconciliation mark whose reason asks for it.
 */
export const RF1_REASONS = [
    'REVOCATION',
    'ADDON_ORPHAN',
    'ONE_TIME_ADDON_REVOCATION',
    'MARK_PROPOSAL'
] as const;

/** A reason of an RF1 refund request. */
export type Rf1Reason = (typeof RF1_REASONS)[number];

/**
 * The reasons an RF4 out-of-flow refund is settled with (admin action 14; notes H10):
 * - `OUT_OF_FLOW_REFUND`: reason 18 (`REEMBOLSO_FUERA_DEL_FLUJO`) or a refund made from the provider panel;
 * - `MANUAL_PAYMENT_REFUND`: the refund of a `manual_payment`;
 * - `STALE_CHARGE_REFUND`: a charge older than the provider's refund window.
 *
 * When RF4 closes an open `REQUESTED`, the row keeps its RF1 reason.
 */
export const RF4_REASONS = [
    'OUT_OF_FLOW_REFUND',
    'MANUAL_PAYMENT_REFUND',
    'STALE_CHARGE_REFUND'
] as const;

/** A reason of an RF4 out-of-flow refund settlement. */
export type Rf4Reason = (typeof RF4_REASONS)[number];
