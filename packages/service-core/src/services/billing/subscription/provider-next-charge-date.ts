/**
 * HOS-2223: turns the provider's `nextChargeAt` (an ISO instant or null) from the
 * re-read that authorized S2 into the date S2 copies onto the row.
 *
 * Right after authorizing, the provider still reports the first-charge instant
 * (PA-3: the first charge lands ~26 minutes later in production); P1 then advances
 * the column when the charge is credited, and the nightly sweep keeps it aligned.
 *
 * @param input.nextChargeAt - The snapshot's `nextChargeAt`
 * @returns The parsed date, or null when absent or unparseable
 */
export function providerNextChargeDate(input: { readonly nextChargeAt: string | null }): {
    readonly nextChargeAt: Date | null;
} {
    if (input.nextChargeAt === null) return { nextChargeAt: null };
    const parsed = new Date(input.nextChargeAt);
    return { nextChargeAt: Number.isNaN(parsed.getTime()) ? null : parsed };
}
