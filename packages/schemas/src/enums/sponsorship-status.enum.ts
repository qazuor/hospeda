/**
 * Sponsorship status enum
 * Defines the lifecycle states of a sponsorship
 */
export enum SponsorshipStatusEnum {
    /** Sponsorship is awaiting approval or payment */
    PENDING = 'pending',
    /** Sponsorship is active and running */
    ACTIVE = 'active',
    /** Sponsorship period has ended */
    EXPIRED = 'expired',
    /** Sponsorship was cancelled before completion */
    CANCELLED = 'cancelled'
}
