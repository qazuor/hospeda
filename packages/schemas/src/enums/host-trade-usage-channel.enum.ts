/**
 * Host Trade Benefit Usage Channel Enum
 *
 * How the usage record came to exist (HOS-376 §6.2). The directory has no user
 * search available to non-admin actors, so "which host is this?" had to be
 * answered three different ways, and each one carries a different amount of
 * evidence.
 *
 * | channel           | who acts | evidence |
 * |-------------------|----------|----------|
 * | `QR`              | host     | strongest — the host's own session IS the identity |
 * | `LINKED_SELECTOR` | provider | strong — the pair already has a confirmed usage |
 * | `EMAIL_LOOKUP`    | provider | weakest — the provider names someone unilaterally |
 *
 * This is not decoration. `EMAIL_LOOKUP` is the only path where a provider can
 * name a host who never scanned anything and with whom no relationship is yet
 * established, which makes it the one an admin audits when looking for spray.
 * Collapsing the three into a single "manual" value would erase exactly the
 * signal worth keeping.
 */
export enum HostTradeUsageChannelEnum {
    /** The host scanned the provider's static QR and declared the usage. */
    QR = 'QR',
    /** The provider picked a host they already have a confirmed usage with. */
    LINKED_SELECTOR = 'LINKED_SELECTOR',
    /** The provider named a host by email. Rate-limited and audited. */
    EMAIL_LOOKUP = 'EMAIL_LOOKUP'
}
