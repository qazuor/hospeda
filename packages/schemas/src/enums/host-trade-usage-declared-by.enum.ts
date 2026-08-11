/**
 * Host Trade Benefit Usage Declared-By Enum
 *
 * Which side opened the usage record (HOS-376 §6.1). This single field decides
 * who has to confirm: whoever did NOT declare it.
 *
 * Both directions exist on purpose. The original design had only the provider
 * declaring — they are the one with the incentive, since the numbers are
 * theirs. But a review requires a confirmed usage, so a provider-only
 * declaration would let the provider decide which jobs are reviewable at all:
 * they would declare the ones that went well and quietly never declare the
 * ones that did not. The directory would then converge on nothing but
 * five-star ratings and stop being useful for choosing anyone.
 *
 * Letting the host declare too closes that gap without weakening
 * verification — the counterpart still has to confirm either way.
 *
 * Note the incentive is asymmetric, and that asymmetry works in our favour on
 * one side and against us on the other: a host-declared usage is confirmed
 * eagerly (it adds to the provider's numbers), while a provider-declared one
 * is the case where silence is expected. What keeps the eager direction honest
 * is the role gate on reviewing, not this field.
 */
export enum HostTradeUsageDeclaredByEnum {
    /** The provider declared "I served this host". The host must confirm. */
    PROVIDER = 'PROVIDER',
    /** The host declared "I used this benefit". The provider must confirm. */
    HOST = 'HOST'
}
