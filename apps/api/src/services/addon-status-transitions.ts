/**
 * Addon Purchase Status Transitions
 *
 * Defines the valid state machine for addon purchase statuses.
 * Enforces the state machine: pending → active → canceled/expired
 *
 * Note on spelling: addon purchases use American spelling ('canceled', 1 L)
 * to match the database column convention for `billing_addon_purchases`.
 * Subscriptions use British spelling ('cancelled', 2 L's) per MercadoPago/QZPay.
 *
 * @module services/addon-status-transitions
 */

/**
 * All valid addon purchase status values.
 * American spelling ('canceled') matches the DB column convention.
 */
export const ADDON_PURCHASE_STATUSES = {
    PENDING: 'pending',
    ACTIVE: 'active',
    CANCELED: 'canceled',
    EXPIRED: 'expired'
} as const;

/**
 * Union type of all addon purchase status strings.
 */
export type AddonPurchaseStatus =
    (typeof ADDON_PURCHASE_STATUSES)[keyof typeof ADDON_PURCHASE_STATUSES];

/**
 * Valid state transitions for addon purchases.
 * Terminal states (canceled, expired) have no outgoing transitions.
 *
 * State machine:
 * ```
 * pending → active
 * pending → canceled
 * active  → canceled
 * active  → expired
 * ```
 */
const VALID_TRANSITIONS: ReadonlyMap<
    AddonPurchaseStatus,
    ReadonlySet<AddonPurchaseStatus>
> = new Map([
    ['pending', new Set<AddonPurchaseStatus>(['active', 'canceled'])],
    ['active', new Set<AddonPurchaseStatus>(['canceled', 'expired'])],
    ['canceled', new Set<AddonPurchaseStatus>()], // terminal state
    ['expired', new Set<AddonPurchaseStatus>()] // terminal state
]);

/**
 * Input for {@link validateAddonStatusTransition}.
 */
export interface ValidateAddonStatusTransitionInput {
    /** The current status of the addon purchase. */
    readonly current: AddonPurchaseStatus;
    /** The target status to transition to. */
    readonly target: AddonPurchaseStatus;
    /** Optional purchase ID for more descriptive error messages. */
    readonly purchaseId?: string;
}

/**
 * Validates whether a status transition is allowed by the addon purchase state machine.
 *
 * Throws {@link InvalidStateTransitionError} if the transition is not permitted.
 * Returns `void` on success so it can be used as a guard before mutating state.
 *
 * @param input - Current status, target status, and optional purchase ID.
 * @throws {InvalidStateTransitionError} When the transition `current → target` is invalid.
 *
 * @example
 * ```ts
 * // Valid transition — no error thrown
 * validateAddonStatusTransition({ current: 'pending', target: 'active' });
 *
 * // Invalid transition — throws InvalidStateTransitionError
 * validateAddonStatusTransition({
 *   current: 'expired',
 *   target: 'active',
 *   purchaseId: 'abc-123',
 * });
 * ```
 */
export function validateAddonStatusTransition(input: ValidateAddonStatusTransitionInput): void {
    const { current, target, purchaseId } = input;
    const allowed = VALID_TRANSITIONS.get(current);
    if (!allowed?.has(target)) {
        throw new InvalidStateTransitionError({ current, target, purchaseId });
    }
}

/**
 * Thrown when an addon purchase status transition is not permitted by the state machine.
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof InvalidStateTransitionError) {
 *     console.error(err.current, '->', err.target, err.purchaseId);
 *   }
 * }
 * ```
 */
export class InvalidStateTransitionError extends Error {
    /** The status the purchase was in before the attempted transition. */
    public readonly current: string;
    /** The status that was requested but not permitted. */
    public readonly target: string;
    /** The purchase ID, if provided at the call site. */
    public readonly purchaseId: string | undefined;

    constructor({
        current,
        target,
        purchaseId
    }: {
        current: string;
        target: string;
        purchaseId?: string;
    }) {
        super(
            `Invalid addon status transition: ${current} → ${target}${purchaseId ? ` (purchase: ${purchaseId})` : ''}`
        );
        this.name = 'InvalidStateTransitionError';
        this.current = current;
        this.target = target;
        this.purchaseId = purchaseId;
    }
}
