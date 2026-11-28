/**
 * Why an address is on the direct email suppression list (HOS-2685).
 *
 * - `OPT_OUT`: the person used the opt-out link in a direct email.
 * - `HARD_BOUNCE`: the provider reported a permanent delivery failure.
 * - `MANUAL`: an admin added the address by hand.
 */
export enum DirectEmailSuppressionReasonEnum {
    OPT_OUT = 'opt_out',
    HARD_BOUNCE = 'hard_bounce',
    MANUAL = 'manual'
}
