/**
 * AC:V9b:9 counts the latest owner act from the V9a domain-event register.
 * `clockStart` already includes facts 2, 3, 5 and 6, the cut write C, the
 * fact 1 transitions in PB6/PB8, and any retention pause. This function never
 * reads the system clock.
 */
export function inactivityClockStart(args: {
    readonly clockStart: Date;
    readonly lastOwnerActAt: Date | null;
}): Date {
    if (!args.lastOwnerActAt || args.clockStart >= args.lastOwnerActAt)
        return new Date(args.clockStart);
    return new Date(args.lastOwnerActAt);
}
